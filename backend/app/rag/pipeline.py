import fitz  # PyMuPDF
from sentence_transformers import SentenceTransformer
from app.db import get_db_connection
from app.config import settings
from groq import Groq

_model = None


def get_model():
    global _model
    if _model is None:
        print("Loading sentence-transformers model...")
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages = []
    for page in doc:
        pages.append(page.get_text())
    return "\n\n".join(pages)


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    words = text.split()
    chunks = []
    step = chunk_size - overlap
    for i in range(0, len(words), step):
        chunk = " ".join(words[i : i + chunk_size])
        if chunk.strip():
            chunks.append(chunk)
        if i + chunk_size >= len(words):
            break
    return chunks


def embed_and_store(doc_id: int, chunks: list[str]) -> int:
    model = get_model()
    embeddings = model.encode(chunks, batch_size=32, show_progress_bar=False)

    conn = get_db_connection()
    cur = conn.cursor()
    for idx, (chunk, emb) in enumerate(zip(chunks, embeddings)):
        cur.execute(
            """
            INSERT INTO chunks (doc_id, chunk_index, text, embedding)
            VALUES (%s, %s, %s, %s)
            """,
            (doc_id, idx, chunk, emb.tolist()),
        )
    cur.execute(
        "UPDATE documents SET chunk_count = %s WHERE id = %s",
        (len(chunks), doc_id),
    )
    conn.commit()
    cur.close()
    conn.close()
    return len(chunks)


# CHANGED: returns list[dict] with text + similarity_score
def retrieve_chunks(query: str, doc_id: int, k: int = 4) -> list[dict]:
    model = get_model()
    query_embedding = model.encode([query])[0].tolist()

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT text, 1 - (embedding <=> %s::vector) AS similarity_score
        FROM chunks
        WHERE doc_id = %s
        ORDER BY embedding <=> %s::vector
        LIMIT %s
        """,
        (query_embedding, doc_id, query_embedding, k),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [
        {"text": r["text"], "similarity_score": round(float(r["similarity_score"]), 2)}
        for r in rows
    ]


def generate_answer(
    query: str,
    context_chunks: list[str],  # expects plain strings
    history: list[dict],
) -> str:
    client = Groq(api_key=settings.groq_api_key)

    context = "\n\n".join(
        f"[Source {i + 1}]:\n{chunk}" for i, chunk in enumerate(context_chunks)
    )

    messages = [
        {
            "role": "system",
            "content": """You are an expert document Q&A assistant.
        Answer questions ONLY based on the provided document context.
        If the answer is not found in the context, say clearly: "I couldn't find that information in the document."
        Be concise and accurate.
        Format with markdown when it helps clarity (bullet points, bold, code blocks).
        Do NOT include source citations or chunk references like [Source 1] in your response.""",
        }
    ]

    for m in history[-6:]:
        messages.append({"role": m["role"], "content": m["content"]})

    messages.append({
        "role": "user",
        "content": f"Document context:\n\n{context}\n\nQuestion: {query}",
    })

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=messages,
        max_tokens=1000,
    )
    return response.choices[0].message.content


def generate_answer_stream(
    query: str,
    context_chunks: list[str],  # expects plain strings
    history: list[dict],
):
    client = Groq(api_key=settings.groq_api_key)

    context = "\n\n".join(
        f"[Source {i + 1}]:\n{chunk}" for i, chunk in enumerate(context_chunks)
    )

    messages = [
        {
            "role": "system",
            "content": """You are an expert document Q&A assistant.
        Answer questions ONLY based on the provided document context.
        If the answer is not found in the context, say clearly: "I couldn't find that information in the document."
        Be concise and accurate.
        Format with markdown when it helps clarity (bullet points, bold, code blocks).
        Do NOT include source citations or chunk references like [Source 1] in your response.""",
        }
    ]

    for m in history[-6:]:
        messages.append({"role": m["role"], "content": m["content"]})

    messages.append({
        "role": "user",
        "content": f"Document context:\n\n{context}\n\nQuestion: {query}",
    })

    stream = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=messages,
        max_tokens=1000,
        stream=True,
    )

    for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


def generate_summary_stream(context_chunks: list[str]):
    """Generate a concise document summary from the first few chunks."""
    client = Groq(api_key=settings.groq_api_key)

    context = "\n\n".join(context_chunks)

    stream = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {
                "role": "system",
                "content": "You are a document summarizer. Given document content, produce a concise 2-3 sentence summary covering the main topic, key points, and purpose. Be direct and factual. No preamble.",
            },
            {
                "role": "user",
                "content": f"Summarize this document:\n\n{context}",
            },
        ],
        max_tokens=200,
        stream=True,
    )

    for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


# CHANGED: now returns similarity_score from actual row value
def retrieve_chunks_multi(query: str, doc_ids: list[int], k: int = 6) -> list[dict]:
    model = get_model()
    query_embedding = model.encode([query])[0].tolist()

    conn = get_db_connection()
    cur = conn.cursor()
    placeholders = ','.join(['%s'] * len(doc_ids))
    cur.execute(
        f"""
        SELECT text, doc_id, chunk_index,
               1 - (embedding <=> %s::vector) AS similarity_score
        FROM chunks
        WHERE doc_id IN ({placeholders})
        ORDER BY embedding <=> %s::vector
        LIMIT %s
        """,
        (query_embedding, *doc_ids, query_embedding, k),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [
        {
            "text": r["text"],
            "doc_id": r["doc_id"],
            "chunk_index": r["chunk_index"],
            "similarity_score": round(float(r["similarity_score"]), 2),
        }
        for r in rows
    ]


def search_chunks(query: str, user_id: int, k: int = 5) -> list[dict]:
    """Search across all chunks belonging to a user's documents."""
    model = get_model()
    query_embedding = model.encode([query])[0].tolist()

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT c.text, c.chunk_index, c.doc_id,
               d.filename,
               1 - (c.embedding <=> %s::vector) AS similarity
        FROM chunks c
        JOIN documents d ON d.id = c.doc_id
        WHERE d.user_id = %s
        ORDER BY c.embedding <=> %s::vector
        LIMIT %s
        """,
        (query_embedding, user_id, query_embedding, k),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [
        {
            "text": r["text"],
            "chunk_index": r["chunk_index"],
            "doc_id": r["doc_id"],
            "filename": r["filename"],
            "similarity": round(float(r["similarity"]), 3),
        }
        for r in rows
    ]