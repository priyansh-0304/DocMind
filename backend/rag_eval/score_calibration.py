"""Check how DocMind's similarity scores relate to retrieval correctness.

Replays the reviewed test set under DocMind's production settings (BGE-small,
500-word chunks, 50 overlap, top-4) and records, for every retrieved chunk, its
score and whether it actually contains the answer sentence. The output shows
what score a correct chunk typically has, so the UI's confidence-badge colours
can be set from data.

Usage (from the backend/ directory):
    python -m rag_eval.score_calibration
"""
import json

import numpy as np

from rag_eval.common import (
    EVAL_DIR,
    PDF_DIR,
    TESTSET_PATH,
    chunk_with_offsets,
    load_doc_words,
)
from rag_eval.run_eval import MODELS, get_model, is_relevant

MODEL_KEY = "bge-small"
CHUNK_SIZE, OVERLAP, K = 500, 50, 4  # DocMind's production settings
OUT_PATH = EVAL_DIR / "calibration.md"

HIGH_TARGET = 0.70    # "green": at least this share of chunks at/above the cutoff hold the answer
MEDIUM_TARGET = 0.40  # "amber"
MIN_SUPPORT = 10      # a cutoff must be backed by at least this many chunks
CURRENT_CUTOFFS = (55, 80)  # what ChatMessage.jsx uses today


def pct(score: float) -> int:
    """Match the UI, which shows Math.round(score * 100)."""
    return int(score * 100 + 0.5)


def collect() -> tuple[list[tuple[int, float, bool]], int]:
    """Return one (rank, score, is_relevant) row per retrieved chunk, and the question count."""
    testset = [json.loads(line) for line in open(TESTSET_PATH)]
    docs = {n: load_doc_words(PDF_DIR / n) for n in sorted({q["doc"] for q in testset})}
    model = get_model(MODEL_KEY)
    prefix = MODELS[MODEL_KEY]["query_prefix"]

    rows = []
    for doc_name, words in docs.items():
        qs = [q for q in testset if q["doc"] == doc_name]
        chunks = chunk_with_offsets(words, CHUNK_SIZE, OVERLAP)
        c_emb = model.encode(
            [c[0] for c in chunks],
            batch_size=32,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        q_emb = model.encode(
            [prefix + q["question"] for q in qs],
            batch_size=32,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        sims = q_emb @ c_emb.T
        for qi, q in enumerate(qs):
            for rank, ci in enumerate(np.argsort(-sims[qi])[:K], start=1):
                _, c_start, c_end = chunks[ci]
                rows.append(
                    (
                        rank,
                        float(sims[qi][ci]),
                        is_relevant(c_start, c_end, q["ev_start"], q["ev_end"]),
                    )
                )
    return rows, len(testset)


def auc(pos: list[int], neg: list[int]) -> float:
    """Chance a random answer-bearing chunk outscores a random non-answer chunk."""
    wins = sum((p > n) + 0.5 * (p == n) for p in pos for n in neg)
    return wins / (len(pos) * len(neg))


def lowest_cutoff(rows, target: float):
    """Lowest percent cutoff where >= target of chunks at/above it hold the answer."""
    for t in range(30, 96):
        sel = [r for r in rows if pct(r[1]) >= t]
        if len(sel) >= MIN_SUPPORT:
            prec = sum(r[2] for r in sel) / len(sel)
            if prec >= target:
                return t, len(sel), prec
    return None


def precision_at(rows, t: int):
    sel = [r for r in rows if pct(r[1]) >= t]
    if not sel:
        return 0, 0.0
    return len(sel), sum(r[2] for r in sel) / len(sel)


def describe(values: list[int]) -> str:
    v = np.array(values)
    return (
        f"n={len(v)}, min {v.min()}, p25 {int(np.percentile(v, 25))}, "
        f"median {int(np.median(v))}, p75 {int(np.percentile(v, 75))}, max {v.max()}"
    )


def analyze(rows, n_questions: int) -> list[str]:
    out = []
    pos = [pct(r[1]) for r in rows if r[2]]
    neg = [pct(r[1]) for r in rows if not r[2]]
    top1 = [r for r in rows if r[0] == 1]

    out.append("# Similarity score calibration")
    out.append("")
    out.append(
        f"BGE-small, {CHUNK_SIZE}/{OVERLAP} chunking, top-{K}, {n_questions} questions, "
        f"{len(rows)} retrieved chunks. Scores are shown as whole percents, like the UI badges."
    )
    out.append("")
    out.append(
        f"Sanity check: Hit@1 = {sum(r[2] for r in top1) / len(top1):.3f} "
        "(should match the BGE 500/50 row in results.md)."
    )
    out.append("")
    out.append("## Score distributions")
    out.append("")
    out.append(f"- Chunks that contain the answer: {describe(pos) if pos else 'none'}")
    out.append(f"- Chunks that do not: {describe(neg) if neg else 'none'}")
    if pos and neg:
        out.append(
            f"- Separation (AUC): {auc(pos, neg):.2f}. "
            "1.0 means every answer-bearing chunk outscores every other chunk; 0.5 means the score says nothing."
        )
    out.append("")
    out.append("## How often a chunk holds the answer, by score")
    out.append("")
    out.append("| Score band | Chunks | Hold the answer | Share |")
    out.append("|---|---|---|---|")
    edges = [0, 40, 45, 50, 55, 60, 65, 70, 75, 80, 100]
    for lo, hi in zip(edges, edges[1:]):
        band = [r for r in rows if lo <= pct(r[1]) < hi]
        if not band:
            continue
        hits = sum(r[2] for r in band)
        label = f"<{hi}" if lo == 0 else (f"{lo}+" if hi == 100 else f"{lo}-{hi - 1}")
        out.append(f"| {label} | {len(band)} | {hits} | {hits / len(band):.0%} |")
    out.append("")
    out.append("## Cutoffs")
    out.append("")
    lo_c, hi_c = CURRENT_CUTOFFS
    for name, t in (("amber", lo_c), ("green", hi_c)):
        n, p = precision_at(rows, t)
        out.append(f"- Current {name} cutoff ({t}%): {n} chunks at or above, {p:.0%} hold the answer")
    out.append("")
    for name, target in (("amber", MEDIUM_TARGET), ("green", HIGH_TARGET)):
        res = lowest_cutoff(rows, target)
        if res:
            t, n, p = res
            out.append(
                f"- Suggested {name} cutoff: {t}% "
                f"(of {n} chunks at or above, {p:.0%} hold the answer; target {target:.0%})"
            )
        else:
            out.append(
                f"- Suggested {name} cutoff: none reached {target:.0%} with at least {MIN_SUPPORT} chunks"
            )
    out.append("")
    out.append(
        "Caveats: a chunk counts as correct only if it covers the answer sentence, so other chunks can still be "
        "useful context and these shares are conservative. The corpus is five ML papers; scores on other "
        "document types may sit differently. A few hundred chunks is a small sample."
    )
    return out


def main() -> None:
    rows, n_questions = collect()
    lines = analyze(rows, n_questions)
    text = "\n".join(lines)
    OUT_PATH.write_text(text + "\n")
    print(text)
    print(f"\nSaved to {OUT_PATH}")


if __name__ == "__main__":
    main()
