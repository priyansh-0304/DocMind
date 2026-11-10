"""Debug one question against one stored document.

Shows what DocMind retrieves (chunk, score), where an expected phrase ranks among ALL
chunks of the document, and what the model answers, optionally with the stored chat
history, so you can tell a retrieval miss from a model refusal.

Usage (from the backend/ directory):
    python -m rag_eval.ask_debug --list
    python -m rag_eval.ask_debug --doc 12 "How many GPUs did they use?"
    python -m rag_eval.ask_debug --doc 12 --expect "GTX 580" "How many GPUs did they use?"
    python -m rag_eval.ask_debug --doc 12 --history "Explain that in simpler terms"
"""
import argparse

from app.db import get_db_connection
from app.rag.pipeline import GEN_MODEL, generate_answer, retrieve_chunks

K = 4  # what the app retrieves for a normal question


def one_line(text: str, n: int = 150) -> str:
    return " ".join(text.split())[:n]


def list_documents() -> None:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, filename, chunk_count FROM documents ORDER BY id")
    for r in cur.fetchall():
        print(f"{r['id']:>4}  {r['chunk_count']:>3} chunks  {r['filename']}")
    cur.close()
    conn.close()


def load_history(doc_id: int) -> list[dict]:
    """The last 6 stored messages, like the app sends with each question."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT role, content FROM chat_messages WHERE doc_id = %s ORDER BY created_at DESC LIMIT 6",
        (doc_id,),
    )
    rows = list(reversed(cur.fetchall()))
    cur.close()
    conn.close()
    return [{"role": r["role"], "content": r["content"]} for r in rows]


def find_rank(ranked: list[dict], phrase: str):
    """1-based rank of the first chunk (among all chunks, best first) containing the phrase."""
    needle = " ".join(phrase.lower().split())
    for i, c in enumerate(ranked, start=1):
        if needle in " ".join(c["text"].lower().split()):
            return i, c["similarity_score"]
    return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("question", nargs="?")
    ap.add_argument("--doc", type=int)
    ap.add_argument("--expect", help="a phrase the correct answer must come from")
    ap.add_argument("--history", action="store_true", help="include the stored chat history")
    ap.add_argument("--list", action="store_true", help="list documents and exit")
    args = ap.parse_args()

    if args.list:
        list_documents()
        return
    if not args.question or not args.doc:
        ap.error("give --doc <id> and a question (use --list to see ids)")

    ranked = retrieve_chunks(args.question, args.doc, k=1000)  # every chunk, best first
    top = ranked[:K]

    print(f"Question : {args.question}")
    print(f"Document : {args.doc} ({len(ranked)} chunks)   Model: {GEN_MODEL}\n")
    print(f"Top {K} retrieved chunks:")
    for i, c in enumerate(top, start=1):
        print(f"  {i}. {c['similarity_score']:.2f}  {one_line(c['text'])}")

    if args.expect:
        hit = find_rank(ranked, args.expect)
        print()
        if hit is None:
            print(f'Expected phrase "{args.expect}" was not found in ANY chunk of this document.')
        else:
            rank, score = hit
            verdict = "in the top 4, so retrieval is fine" if rank <= K else "OUTSIDE the top 4: a retrieval miss"
            print(f'Expected phrase "{args.expect}" is in the chunk ranked #{rank} (score {score:.2f}): {verdict}.')

    history = load_history(args.doc) if args.history else []
    answer = generate_answer(args.question, [c["text"] for c in top], history)
    print(f"\nAnswer ({'with' if args.history else 'without'} chat history, {len(history)} earlier messages):")
    print(answer)
    if answer.strip().lower().startswith("i couldn't find"):
        print("\n-> The model refused. Compare with the expected-phrase rank above.")


if __name__ == "__main__":
    main()
