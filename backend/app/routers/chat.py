from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from app.db import get_db_connection
from app.auth.utils import get_current_user
from app.models.schemas import ChatRequest, ChatResponse, MultiChatRequest
from app.rag.pipeline import (
    retrieve_chunks, generate_answer,
    generate_answer_stream, retrieve_chunks_multi,
    BACKGROUND_MODEL, BACKGROUND_LOCK,
)
import json
import logging
import re

router = APIRouter(tags=["Chat"])
logger = logging.getLogger("uvicorn.error")  # shows up in the uvicorn terminal

SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}

# Fixed on the server: suggestions are stored per document, so the prompt must not
# depend on what a client sends.
SUGGEST_PROMPT = (
    'Generate exactly 3 short questions (max 8 words each) someone might ask about this document. '
    'Return ONLY a JSON array of strings. Example: ["What is X?", "How does Y work?", "What are the Z?"]'
)


def parse_questions(text: str) -> list[str]:
    """Pull the first JSON array of strings out of the model output (max 3)."""
    match = re.search(r"\[.*?\]", text, re.S)
    if not match:
        return []
    try:
        data = json.loads(match.group(0))
    except Exception:
        return []
    return [q.strip() for q in data if isinstance(q, str) and q.strip()][:3]


@router.post("/", response_model=ChatResponse)
def chat(req: ChatRequest, user=Depends(get_current_user)):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id FROM documents WHERE id = %s AND user_id = %s",
        (req.doc_id, user["id"]),
    )
    if not cur.fetchone():
        raise HTTPException(404, "Document not found.")

    chunks = retrieve_chunks(req.query, req.doc_id, k=4)

    if not chunks:
        return ChatResponse(
            answer="No relevant content found in the document for your question.",
            sources=[],
            doc_id=req.doc_id,
        )

    chunk_texts = [c["text"] for c in chunks]
    history = [{"role": m.role, "content": m.content} for m in req.history]
    answer = generate_answer(req.query, chunk_texts, history)

    cur.execute(
        "INSERT INTO chat_messages (user_id, doc_id, role, content) VALUES (%s,%s,%s,%s)",
        (user["id"], req.doc_id, "user", req.query),
    )
    cur.execute(
        "INSERT INTO chat_messages (user_id, doc_id, role, content) VALUES (%s,%s,%s,%s)",
        (user["id"], req.doc_id, "assistant", answer),
    )
    conn.commit()
    cur.close()
    conn.close()

    return ChatResponse(answer=answer, sources=chunks, doc_id=req.doc_id)


@router.post("/stream")
def chat_stream(req: ChatRequest, user=Depends(get_current_user)):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id FROM documents WHERE id = %s AND user_id = %s",
        (req.doc_id, user["id"]),
    )
    if not cur.fetchone():
        raise HTTPException(404, "Document not found.")

    chunks = retrieve_chunks(req.query, req.doc_id, k=4)
    cur.close()
    conn.close()

    if not chunks:
        def empty():
            yield f"data: {json.dumps({'text': 'No relevant content found.', 'done': True, 'sources': []})}\n\n"
        return StreamingResponse(empty(), media_type="text/event-stream")

    # chunk_texts defined here so stream_with_save() closure can access it
    chunk_texts = [c["text"] for c in chunks]
    history = [{"role": m.role, "content": m.content} for m in req.history]

    def stream_with_save():
        full_answer = ""
        # sources carries full dicts including similarity_score
        yield f"data: {json.dumps({'sources': chunks, 'done': False})}\n\n"

        for token in generate_answer_stream(req.query, chunk_texts, history):
            full_answer += token
            yield f"data: {json.dumps({'text': token, 'done': False})}\n\n"

        yield f"data: {json.dumps({'text': '', 'done': True})}\n\n"

        conn2 = get_db_connection()
        cur2 = conn2.cursor()
        cur2.execute(
            "INSERT INTO chat_messages (user_id, doc_id, role, content) VALUES (%s,%s,%s,%s)",
            (user["id"], req.doc_id, "user", req.query),
        )
        cur2.execute(
            "INSERT INTO chat_messages (user_id, doc_id, role, content) VALUES (%s,%s,%s,%s)",
            (user["id"], req.doc_id, "assistant", full_answer),
        )
        conn2.commit()
        cur2.close()
        conn2.close()

    return StreamingResponse(
        stream_with_save(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/stream/multi")
def chat_stream_multi(req: MultiChatRequest, user=Depends(get_current_user)):
    conn = get_db_connection()
    cur = conn.cursor()

    for doc_id in req.doc_ids:
        cur.execute(
            "SELECT id FROM documents WHERE id = %s AND user_id = %s",
            (doc_id, user["id"]),
        )
        if not cur.fetchone():
            raise HTTPException(404, f"Document {doc_id} not found.")

    chunk_dicts = retrieve_chunks_multi(req.query, req.doc_ids, k=6)
    cur.close()
    conn.close()

    if not chunk_dicts:
        def empty():
            yield f"data: {json.dumps({'text': 'No relevant content found.', 'done': True, 'sources': []})}\n\n"
        return StreamingResponse(empty(), media_type="text/event-stream")

    # Plain texts for generation, full dicts as sources (carries similarity_score)
    chunk_texts = [c["text"] for c in chunk_dicts]
    sources_meta = [
        {
            "doc_id": c["doc_id"],
            "chunk_index": c["chunk_index"],
            "similarity_score": c["similarity_score"],
        }
        for c in chunk_dicts
    ]
    history = [{"role": m.role, "content": m.content} for m in req.history]

    def stream_multi():
        full_answer = ""
        yield f"data: {json.dumps({'sources': sources_meta, 'done': False})}\n\n"

        for token in generate_answer_stream(req.query, chunk_texts, history):
            full_answer += token
            yield f"data: {json.dumps({'text': token, 'done': False})}\n\n"

        yield f"data: {json.dumps({'text': '', 'done': True})}\n\n"

    return StreamingResponse(
        stream_multi(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/history/{doc_id}")
def get_history(doc_id: int, user=Depends(get_current_user)):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT role, content, created_at FROM chat_messages
        WHERE user_id = %s AND doc_id = %s
        ORDER BY created_at ASC
        LIMIT 50
        """,
        (user["id"], doc_id),
    )
    messages = cur.fetchall()
    cur.close()
    conn.close()
    return messages


@router.post("/suggest")
def suggest_questions(req: ChatRequest, user=Depends(get_current_user)):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, suggestions FROM documents WHERE id = %s AND user_id = %s",
        (req.doc_id, user["id"]),
    )
    row = cur.fetchone()
    if not row:
        cur.close()
        conn.close()
        raise HTTPException(404, "Document not found.")

    # Generated once per document: serve the stored questions, no retrieval or model call.
    if row["suggestions"]:
        cur.close()
        conn.close()
        cached = row["suggestions"]

        def cached_stream():
            yield f"data: {json.dumps({'text': cached, 'done': True})}\n\n"

        return StreamingResponse(cached_stream(), media_type="text/event-stream", headers=SSE_HEADERS)

    # The opening chunk (title, abstract, introduction) is enough to write three overview
    # questions, and a single chunk keeps this request to roughly 1K tokens.
    cur.execute(
        "SELECT text FROM chunks WHERE doc_id = %s ORDER BY chunk_index ASC LIMIT 1",
        (req.doc_id,),
    )
    first = cur.fetchone()
    cur.close()
    conn.close()

    if not first:
        def empty():
            yield f"data: {json.dumps({'text': '[]', 'done': True})}\n\n"
        return StreamingResponse(empty(), media_type="text/event-stream")

    chunk_texts = [first["text"]]
    history = []

    def stream_suggestions():
        parts = []
        try:
            # Background model + fail fast: suggestions must never hold up chat answers
            with BACKGROUND_LOCK:
                for token in generate_answer_stream(
                    SUGGEST_PROMPT, chunk_texts, history,
                    model=BACKGROUND_MODEL, max_retries=0,
                ):
                    parts.append(token)
                    yield f"data: {json.dumps({'text': token, 'done': False})}\n\n"
        except Exception:
            # e.g. rate limit or model error: tell the client instead of hanging
            logger.exception("Suggestion generation failed for document %s", req.doc_id)
            yield f"data: {json.dumps({'text': '', 'done': True, 'error': True})}\n\n"
            return

        # Store only a complete, valid result. If the client disconnects mid-stream
        # (the user moved to another document), this is never reached.
        questions = parse_questions("".join(parts))
        if not questions:
            logger.warning("Suggestions for document %s were not a usable JSON list", req.doc_id)
        if questions:
            try:
                save_conn = get_db_connection()
                save_cur = save_conn.cursor()
                save_cur.execute(
                    "UPDATE documents SET suggestions = %s WHERE id = %s",
                    (json.dumps(questions), req.doc_id),
                )
                save_conn.commit()
                save_cur.close()
                save_conn.close()
            except Exception:
                pass  # caching is best-effort; the questions were still delivered

        yield f"data: {json.dumps({'text': '', 'done': True})}\n\n"

    return StreamingResponse(stream_suggestions(), media_type="text/event-stream", headers=SSE_HEADERS)


@router.get("/activity")
def get_activity(user=Depends(get_current_user)):
    """Real daily message counts for the last 7 days."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT
            TO_CHAR(created_at::date, 'Dy') AS day,
            created_at::date AS date,
            COUNT(*) FILTER (WHERE role = 'user') AS questions
        FROM chat_messages
        WHERE user_id = %s
          AND created_at >= NOW() - INTERVAL '7 days'
        GROUP BY created_at::date
        ORDER BY created_at::date ASC
        """,
        (user["id"],),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    from datetime import date, timedelta
    today = date.today()
    days_map = {row["date"]: row for row in rows}
    result = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        row = days_map.get(d)
        result.append({
            "day": d.strftime("%a"),
            "questions": int(row["questions"]) if row else 0,
        })

    return result


@router.get("/stats")
def get_stats(user=Depends(get_current_user)):
    """Aggregated stats: total messages, avg response length."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT
            COUNT(*) FILTER (WHERE role = 'user') AS total_questions,
            COUNT(*) FILTER (WHERE role = 'assistant') AS total_answers,
            ROUND(AVG(LENGTH(content)) FILTER (WHERE role = 'assistant')) AS avg_response_length
        FROM chat_messages
        WHERE user_id = %s
        """,
        (user["id"],),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row