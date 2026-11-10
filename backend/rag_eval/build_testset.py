"""Build a retrieval test set from the PDFs in rag_eval/pdfs/.

For each PDF we sample non-overlapping ~200-word passages, ask an LLM to write
one question answerable from that passage plus the verbatim sentence that
contains the answer, then verify the sentence really appears in the passage.
Each kept item stores the evidence's word offsets in the document.

Usage (from the backend/ directory):
    python -m rag_eval.build_testset --per-doc 15
"""
import argparse
import json
import os
import random
import re
import time

from groq import Groq

from app.config import settings
from rag_eval.common import (
    PDF_DIR,
    TESTSET_PATH,
    check_chunker_matches_pipeline,
    find_subsequence,
    load_doc_words,
)

WINDOW = 200  # words per sampled passage

SYSTEM = "You write evaluation questions for a document question-answering system."

USER_TEMPLATE = """Passage:
{passage}

Write ONE question that can be answered using only this passage, and that a reader \
who has NOT seen the passage could plausibly ask about the document.

Rules:
- Paraphrase. Do not copy distinctive phrases or long word sequences from the passage into the question.
- Be specific. No questions like "what is this passage about".
- Then copy, word for word, the single sentence from the passage that contains the answer (max 40 words).

Reply in exactly this format:
QUESTION: <question>
EVIDENCE: <verbatim sentence>"""

REPLY_RE = re.compile(r"QUESTION:\s*(.+?)\s*EVIDENCE:\s*(.+)", re.DOTALL)


def alpha_ratio(words: list[str]) -> float:
    if not words:
        return 0.0
    return sum(1 for w in words if re.search(r"[A-Za-z]", w)) / len(words)


def ask_llm(client: Groq, model: str, passage: str) -> tuple[str, str] | None:
    for attempt in range(3):
        try:
            resp = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": SYSTEM},
                    {"role": "user", "content": USER_TEMPLATE.format(passage=passage)},
                ],
                max_tokens=2000,  # reasoning models spend part of this on thinking
                temperature=0.4,
            )
            m = REPLY_RE.search(resp.choices[0].message.content or "")
            if not m:
                return None
            return m.group(1).strip(), m.group(2).strip()
        except Exception as e:  # rate limit / transient errors
            if "model_not_found" in str(e):
                raise SystemExit(
                    f"\nGroq says this model is unavailable: {model}\n"
                    "Pick a current one from console.groq.com/docs/models and rerun with "
                    "--model <id> (or set EVAL_GEN_MODEL)."
                )
            print(f"    LLM error ({e}); retrying...")
            time.sleep(5 * (attempt + 1))
    return None


def lexical_overlap(question: str, evidence: str) -> float:
    """Share of the question's longer words that also appear in the evidence."""
    q = {w.lower().strip(".,?;:()") for w in question.split() if len(w) > 3}
    e = {w.lower().strip(".,?;:()") for w in evidence.split()}
    return len(q & e) / len(q) if q else 0.0


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-doc", type=int, default=15)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument(
        "--model",
        default=os.getenv("EVAL_GEN_MODEL", "openai/gpt-oss-120b"),
        help="Groq model used to write questions (check console.groq.com for current names)",
    )
    args = ap.parse_args()

    pdfs = sorted(PDF_DIR.glob("*.pdf"))
    if not pdfs:
        raise SystemExit(f"No PDFs found in {PDF_DIR}. Add some and rerun.")

    rng = random.Random(args.seed)
    client = Groq(api_key=settings.groq_api_key)
    items, rejected = [], 0

    for pdf in pdfs:
        words = load_doc_words(pdf)
        print(f"{pdf.name}: {len(words)} words")
        if pdf is pdfs[0]:
            check_chunker_matches_pipeline(words)

        starts = list(range(0, max(len(words) - WINDOW, 0), WINDOW))
        rng.shuffle(starts)
        kept = 0
        for s in starts:
            if kept >= args.per_doc:
                break
            window = words[s : s + WINDOW]
            if alpha_ratio(window) < 0.7:  # skip tables, references, equations
                continue

            result = ask_llm(client, args.model, " ".join(window))
            if result is None:
                rejected += 1
                continue
            question, evidence = result

            ev_words = evidence.split()
            pos = find_subsequence(words, ev_words, s, s + WINDOW)
            if pos == -1 or len(question.split()) < 5:
                rejected += 1
                continue

            items.append(
                {
                    "id": f"{pdf.stem}-{kept}",
                    "doc": pdf.name,
                    "question": question,
                    "evidence": evidence,
                    "ev_start": pos,
                    "ev_end": pos + len(ev_words),
                    "lexical_overlap": round(lexical_overlap(question, evidence), 2),
                }
            )
            kept += 1
        print(f"  kept {kept}")

    with open(TESTSET_PATH, "w") as f:
        for it in items:
            f.write(json.dumps(it) + "\n")

    mean_overlap = sum(i["lexical_overlap"] for i in items) / max(len(items), 1)
    print(f"\nWrote {len(items)} questions to {TESTSET_PATH} ({rejected} rejected)")
    print(f"Mean question/evidence word overlap: {mean_overlap:.2f}")
    print("Next: open the file and delete weak or ambiguous questions before running run_eval.")


if __name__ == "__main__":
    main()
