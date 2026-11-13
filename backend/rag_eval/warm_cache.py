"""Prepare the TL;DR and suggested questions for every document that lacks them, from the command line.

This runs the same worker logic the server runs in the background (app/prepare.py), one
document at a time with a pause between, so Groq's per-minute token limit is respected. You
do not normally need it, because the server does this by itself after every upload. It is
useful with the server stopped. Do not run it while the server is running: they are separate
processes and would use the same token budget at the same time.

Usage (from the backend/ directory):
    python -m rag_eval.warm_cache
"""
import time

from app.prepare import PAUSE_SECONDS, pending_documents, process_next


def main() -> None:
    todo = pending_documents()
    if not todo:
        print("Every document already has a stored summary and suggestions.")
        return
    print(f"{len(todo)} document(s) to prepare, about {PAUSE_SECONDS}s apiece to stay inside Groq's limit.\n")

    while True:
        before = {d["id"]: d["filename"] for d in pending_documents()}
        result = process_next()
        if result == "idle":
            break
        after = {d["id"] for d in pending_documents()}
        for doc_id, name in before.items():
            if doc_id not in after:
                print(f"stored: {name}")
        if result == "failed":
            print("one attempt failed (details above); it will be retried later")
        time.sleep(PAUSE_SECONDS)

    left = pending_documents()
    if left:
        print(f"\n{len(left)} document(s) still missing something. Run this again in a minute or two:")
        for d in left:
            print("  -", d["filename"])
    else:
        print("\nDone. Every document is ready.")


if __name__ == "__main__":
    main()