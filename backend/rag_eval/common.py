"""Shared helpers for the DocMind retrieval evaluation harness.

Ground truth is stored as WORD OFFSETS into the document, not as chunk IDs.
That makes the test set independent of how the document is chunked, so the
same questions can be used to compare different chunk sizes and overlaps.
"""
from pathlib import Path

from app.rag.pipeline import chunk_text, extract_text_from_pdf

EVAL_DIR = Path(__file__).parent
PDF_DIR = EVAL_DIR / "pdfs"
TESTSET_PATH = EVAL_DIR / "testset.jsonl"
RESULTS_JSON = EVAL_DIR / "results.json"
RESULTS_MD = EVAL_DIR / "results.md"


def load_doc_words(pdf_path: Path) -> list[str]:
    """Extract a PDF with the production extractor and split into words."""
    text = extract_text_from_pdf(pdf_path.read_bytes())
    return text.split()


def chunk_with_offsets(
    words: list[str], chunk_size: int, overlap: int
) -> list[tuple[str, int, int]]:
    """Same logic as pipeline.chunk_text, but also returns (start, end) word offsets."""
    step = chunk_size - overlap
    out = []
    for i in range(0, len(words), step):
        end = min(i + chunk_size, len(words))
        chunk = " ".join(words[i:end])
        if chunk.strip():
            out.append((chunk, i, end))
        if i + chunk_size >= len(words):
            break
    return out


def check_chunker_matches_pipeline(words: list[str]) -> None:
    """Guard against drift: our offset-aware chunker must equal the production one."""
    mine = [c for c, _, _ in chunk_with_offsets(words, 500, 50)]
    theirs = chunk_text(" ".join(words), 500, 50)
    assert mine == theirs, (
        "chunk_with_offsets no longer matches app.rag.pipeline.chunk_text; "
        "update rag_eval/common.py"
    )


def find_subsequence(words: list[str], target: list[str], lo: int, hi: int) -> int:
    """Return the index in words[lo:hi] where target starts, or -1."""
    n = len(target)
    if n == 0:
        return -1
    for i in range(lo, hi - n + 1):
        if words[i : i + n] == target:
            return i
    return -1
