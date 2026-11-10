"""Re-embed every stored chunk with the model configured in app.rag.pipeline.

Run this once after changing MODEL_NAME. Old and new embeddings live in
different vector spaces, so leaving them mixed silently breaks retrieval.
Chunk text is already in the database, so the original PDFs are not needed.

Usage (from the backend/ directory, with the database reachable):
    python -m reindex_chunks
"""
from app.db import get_db_connection
from app.rag.pipeline import MODEL_NAME, get_model

BATCH = 64


def main() -> None:
    model = get_model()
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("SELECT id, text FROM chunks ORDER BY id")
    rows = cur.fetchall()
    print(f"Re-embedding {len(rows)} chunks with {MODEL_NAME}...")

    for i in range(0, len(rows), BATCH):
        batch = rows[i : i + BATCH]
        embeddings = model.encode(
            [r["text"] for r in batch], batch_size=32, show_progress_bar=False
        )
        for r, emb in zip(batch, embeddings):
            cur.execute(
                "UPDATE chunks SET embedding = %s::vector WHERE id = %s",
                (emb.tolist(), r["id"]),
            )
        conn.commit()
        print(f"  {min(i + BATCH, len(rows))}/{len(rows)}")

    cur.close()
    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()