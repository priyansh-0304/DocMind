"""Run the retrieval evaluation across chunking and embedding configurations.

Everything runs in memory with exact cosine search, so it never touches your
database. A retrieved chunk counts as relevant if it covers at least half of
the evidence sentence's words.

Usage (from the backend/ directory):
    python -m rag_eval.run_eval
"""
import json

import numpy as np
from sentence_transformers import SentenceTransformer

from rag_eval.common import (
    PDF_DIR,
    RESULTS_JSON,
    RESULTS_MD,
    TESTSET_PATH,
    chunk_with_offsets,
    load_doc_words,
)

MODELS = {
    "minilm": {"name": "all-MiniLM-L6-v2", "query_prefix": ""},  # current, 384-dim
    "bge-small": {
        "name": "BAAI/bge-small-en-v1.5",  # 384-dim: drop-in for vector(384)
        "query_prefix": "Represent this sentence for searching relevant passages: ",
    },
    "mpnet": {"name": "all-mpnet-base-v2", "query_prefix": ""},  # 768-dim
}

# (model, chunk_size, overlap). The first entry is what DocMind runs today.
CONFIGS = [
    ("minilm", 500, 50),  # baseline
    ("minilm", 100, 10),
    ("minilm", 200, 20),
    ("minilm", 300, 30),
    ("minilm", 500, 0),
    ("minilm", 500, 100),
    ("bge-small", 200, 20),
    ("bge-small", 300, 30),
    ("bge-small", 500, 50),
    ("mpnet", 200, 20),
    ("mpnet", 300, 30),
    ("mpnet", 500, 50),
]

KS = (1, 4, 8)  # DocMind currently retrieves k=4
_loaded: dict[str, SentenceTransformer] = {}


def get_model(key: str) -> SentenceTransformer:
    if key not in _loaded:
        print(f"Loading {MODELS[key]['name']}...")
        _loaded[key] = SentenceTransformer(MODELS[key]["name"])
    return _loaded[key]


def is_relevant(c_start: int, c_end: int, ev_start: int, ev_end: int) -> bool:
    overlap = max(0, min(c_end, ev_end) - max(c_start, ev_start))
    return overlap >= 0.5 * (ev_end - ev_start)


def evaluate(config, docs: dict, testset: list[dict]) -> dict:
    model_key, size, overlap = config
    model = get_model(model_key)
    prefix = MODELS[model_key]["query_prefix"]

    ranks: list[int | None] = []
    total_chunks = 0

    for doc_name, words in docs.items():
        qs = [q for q in testset if q["doc"] == doc_name]
        if not qs:
            continue
        chunks = chunk_with_offsets(words, size, overlap)
        total_chunks += len(chunks)

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
        sims = q_emb @ c_emb.T  # cosine similarity (embeddings are normalized)

        for qi, q in enumerate(qs):
            rank = None
            for r, ci in enumerate(np.argsort(-sims[qi]), start=1):
                _, c_start, c_end = chunks[ci]
                if is_relevant(c_start, c_end, q["ev_start"], q["ev_end"]):
                    rank = r
                    break
            ranks.append(rank)

    n = len(ranks)
    row = {
        "model": MODELS[model_key]["name"],
        "chunk_size": size,
        "overlap": overlap,
        "chunks": total_chunks,
        "questions": n,
        "mrr": round(sum(1 / r for r in ranks if r) / n, 3),
    }
    for k in KS:
        row[f"hit@{k}"] = round(sum(1 for r in ranks if r and r <= k) / n, 3)
    return row


def to_markdown(rows: list[dict]) -> str:
    header = "| Model | Chunk | Overlap | Chunks | " + " | ".join(f"Hit@{k}" for k in KS) + " | MRR |"
    sep = "|---|---|---|---|" + "---|" * (len(KS) + 1)
    lines = [header, sep]
    for r in rows:
        hits = " | ".join(f"{r[f'hit@{k}']:.3f}" for k in KS)
        lines.append(
            f"| {r['model']} | {r['chunk_size']} | {r['overlap']} | {r['chunks']} | {hits} | {r['mrr']:.3f} |"
        )
    return "\n".join(lines)


def main() -> None:
    testset = [json.loads(line) for line in open(TESTSET_PATH)]
    doc_names = sorted({q["doc"] for q in testset})
    docs = {name: load_doc_words(PDF_DIR / name) for name in doc_names}
    print(f"{len(testset)} questions across {len(docs)} documents\n")

    rows = []
    for cfg in CONFIGS:
        print(f"Evaluating {cfg}...")
        rows.append(evaluate(cfg, docs, testset))

    rows.sort(key=lambda r: r["mrr"], reverse=True)
    md = to_markdown(rows)
    RESULTS_JSON.write_text(json.dumps(rows, indent=2))
    RESULTS_MD.write_text(md + "\n")
    print("\n" + md)
    print(f"\nSaved to {RESULTS_MD} and {RESULTS_JSON}")


if __name__ == "__main__":
    main()
