# Similarity score calibration

BGE-small, 500/50 chunking, top-4, 42 questions, 168 retrieved chunks. Scores are shown as whole percents, like the UI badges.

Sanity check: Hit@1 = 0.619 (should match the BGE 500/50 row in results.md).

## Score distributions

- Chunks that contain the answer: n=40, min 54, p25 67, median 74, p75 78, max 87
- Chunks that do not: n=128, min 54, p25 64, median 69, p75 74, max 81
- Separation (AUC): 0.64. 1.0 means every answer-bearing chunk outscores every other chunk; 0.5 means the score says nothing.

## How often a chunk holds the answer, by score

| Score band | Chunks | Hold the answer | Share |
|---|---|---|---|
| 50-54 | 2 | 1 | 50% |
| 55-59 | 7 | 0 | 0% |
| 60-64 | 29 | 4 | 14% |
| 65-69 | 45 | 11 | 24% |
| 70-74 | 43 | 6 | 14% |
| 75-79 | 31 | 13 | 42% |
| 80+ | 11 | 5 | 45% |

## Cutoffs

- Current amber cutoff (55%): 166 chunks at or above, 23% hold the answer
- Current green cutoff (80%): 11 chunks at or above, 45% hold the answer

- Suggested amber cutoff: 75% (of 42 chunks at or above, 43% hold the answer; target 40%)
- Suggested green cutoff: none reached 70% with at least 10 chunks

Caveats: a chunk counts as correct only if it covers the answer sentence, so other chunks can still be useful context and these shares are conservative. The corpus is five ML papers; scores on other document types may sit differently. A few hundred chunks is a small sample.
