from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.db import get_db_connection
from app.auth.utils import get_current_user
from app.models.schemas import DocumentOut, TagOut, TagCreate, TagAssign
from app.rag.pipeline import extract_text_from_pdf, chunk_text, embed_and_store, generate_summary_stream
import json
from app.rag.pipeline import extract_text_from_pdf, chunk_text, embed_and_store, generate_summary_stream, search_chunks

router = APIRouter(tags=["Documents"])

ALLOWED_TYPES = {"application/pdf", "text/plain", "text/markdown"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


class RenameRequest(BaseModel):
    filename: str


def get_doc_tags(cur, doc_id: int) -> list:
    cur.execute("""
        SELECT t.id, t.name, t.color, t.created_at
        FROM tags t
        JOIN document_tags dt ON dt.tag_id = t.id
        WHERE dt.doc_id = %s
        ORDER BY t.name
    """, (doc_id,))
    return cur.fetchall()


def doc_with_tags(cur, doc: dict) -> dict:
    tags = get_doc_tags(cur, doc["id"])
    return {**dict(doc), "tags": [dict(t) for t in tags]}


# ── Tag CRUD ──────────────────────────────────────────────────────────────────

@router.get("/tags", response_model=list[TagOut])
def list_tags(user=Depends(get_current_user)):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT * FROM tags WHERE user_id = %s ORDER BY name",
        (user["id"],)
    )
    tags = cur.fetchall()
    cur.close()
    conn.close()
    return tags


@router.post("/tags", response_model=TagOut, status_code=201)
def create_tag(body: TagCreate, user=Depends(get_current_user)):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Tag name cannot be empty.")
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO tags (user_id, name, color) VALUES (%s, %s, %s) RETURNING *",
            (user["id"], name, body.color)
        )
        tag = cur.fetchone()
        conn.commit()
    except Exception:
        raise HTTPException(400, "Tag already exists.")
    finally:
        cur.close()
        conn.close()
    return tag


@router.delete("/tags/{tag_id}", status_code=204)
def delete_tag(tag_id: int, user=Depends(get_current_user)):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id FROM tags WHERE id = %s AND user_id = %s",
        (tag_id, user["id"])
    )
    if not cur.fetchone():
        raise HTTPException(404, "Tag not found.")
    cur.execute("DELETE FROM tags WHERE id = %s", (tag_id,))
    conn.commit()
    cur.close()
    conn.close()


@router.post("/{doc_id}/tags", status_code=201)
def assign_tag(doc_id: int, body: TagAssign, user=Depends(get_current_user)):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id FROM documents WHERE id = %s AND user_id = %s",
        (doc_id, user["id"])
    )
    if not cur.fetchone():
        raise HTTPException(404, "Document not found.")
    cur.execute(
        "SELECT id FROM tags WHERE id = %s AND user_id = %s",
        (body.tag_id, user["id"])
    )
    if not cur.fetchone():
        raise HTTPException(404, "Tag not found.")
    try:
        cur.execute(
            "INSERT INTO document_tags (doc_id, tag_id) VALUES (%s, %s)",
            (doc_id, body.tag_id)
        )
        conn.commit()
    except Exception:
        pass  # already assigned
    finally:
        cur.close()
        conn.close()
    return {"ok": True}


@router.delete("/{doc_id}/tags/{tag_id}", status_code=204)
def remove_tag(doc_id: int, tag_id: int, user=Depends(get_current_user)):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id FROM documents WHERE id = %s AND user_id = %s",
        (doc_id, user["id"])
    )
    if not cur.fetchone():
        raise HTTPException(404, "Document not found.")
    cur.execute(
        "DELETE FROM document_tags WHERE doc_id = %s AND tag_id = %s",
        (doc_id, tag_id)
    )
    conn.commit()
    cur.close()
    conn.close()


# ── Document CRUD ─────────────────────────────────────────────────────────────

@router.post("/upload", response_model=DocumentOut, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    user=Depends(get_current_user),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Only PDF, TXT, and Markdown files are supported.")

    content = await file.read()

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(400, "File size exceeds 10 MB limit.")

    if file.content_type == "application/pdf":
        text = extract_text_from_pdf(content)
    else:
        text = content.decode("utf-8")

    if not text.strip():
        raise HTTPException(400, "Could not extract text from the file.")

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO documents (user_id, filename, file_size) VALUES (%s, %s, %s) RETURNING *",
        (user["id"], file.filename, len(content)),
    )
    doc = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()

    chunks = chunk_text(text, chunk_size=500, overlap=50)
    embed_and_store(doc["id"], chunks)

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM documents WHERE id = %s", (doc["id"],))
    doc = cur.fetchone()
    result = doc_with_tags(cur, doc)
    cur.close()
    conn.close()
    return result


@router.get("/", response_model=list[DocumentOut])
def list_documents(user=Depends(get_current_user)):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT * FROM documents WHERE user_id = %s ORDER BY created_at DESC",
        (user["id"],),
    )
    docs = cur.fetchall()
    result = [doc_with_tags(cur, d) for d in docs]
    cur.close()
    conn.close()
    return result


@router.patch("/{doc_id}/rename", response_model=DocumentOut)
def rename_document(doc_id: int, body: RenameRequest, user=Depends(get_current_user)):
    filename = body.filename.strip()
    if not filename:
        raise HTTPException(400, "Filename cannot be empty.")

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id FROM documents WHERE id = %s AND user_id = %s",
        (doc_id, user["id"]),
    )
    if not cur.fetchone():
        raise HTTPException(404, "Document not found.")

    cur.execute(
        "UPDATE documents SET filename = %s WHERE id = %s RETURNING *",
        (filename, doc_id),
    )
    doc = cur.fetchone()
    result = doc_with_tags(cur, doc)
    conn.commit()
    cur.close()
    conn.close()
    return result


@router.get("/{doc_id}/summary")
def get_summary(doc_id: int, user=Depends(get_current_user)):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id FROM documents WHERE id = %s AND user_id = %s",
        (doc_id, user["id"]),
    )
    if not cur.fetchone():
        raise HTTPException(404, "Document not found.")

    cur.execute(
        "SELECT text FROM chunks WHERE doc_id = %s ORDER BY chunk_index ASC LIMIT 6",
        (doc_id,),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    chunks = [r["text"] for r in rows]
    if not chunks:
        def empty():
            yield f"data: {json.dumps({'text': 'No content found.', 'done': True})}\n\n"
        return StreamingResponse(empty(), media_type="text/event-stream")

    def stream():
        for token in generate_summary_stream(chunks):
            yield f"data: {json.dumps({'text': token, 'done': False})}\n\n"
        yield f"data: {json.dumps({'text': '', 'done': True})}\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

@router.get("/search")
def search_documents(q: str, user=Depends(get_current_user)):
    """Semantic search across all user's documents."""
    if not q or len(q.strip()) < 2:
        raise HTTPException(400, "Query must be at least 2 characters.")
    
    results = search_chunks(q.strip(), user["id"], k=5)
    return results

@router.delete("/{doc_id}", status_code=204)
def delete_document(doc_id: int, user=Depends(get_current_user)):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id FROM documents WHERE id = %s AND user_id = %s",
        (doc_id, user["id"]),
    )
    if not cur.fetchone():
        raise HTTPException(404, "Document not found.")
    cur.execute("DELETE FROM documents WHERE id = %s", (doc_id,))
    conn.commit()
    cur.close()
    conn.close()