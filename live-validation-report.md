# Vaani Live Validation Report

**Validation date:** 16 August 2026

## Live voice path

A generated spoken English test question was sent as WAV audio through the real Sarvam speech-to-text adapter, then through Gemini Embedding, the persisted HNSW index, Groq structured generation, and the post-generation grounding checks.

| Field | Observed result |
| --- | --- |
| Spoken question | “What is the main purpose of this benchmark data set?” |
| Sarvam transcript | “What is the main purpose of this benchmark data set?” |
| Pipeline outcome | `answered` |
| Total observed latency | 11,041 ms |
| Retrieved passages | 7 |
| Citations released | 5 exact source IDs |
| Grounding state | Verified by citation and semantic-support gates |

The released answer was: “The main purpose of this benchmark data set is to provide examples of entities in a sentence, specifically companies, and to describe the concept of an Association and its types.” The interface exposes the retrieved passages, their chunk strategies, language metadata, row provenance, and similarity values rather than presenting a citation-free answer.

## Live safety refusal

An explicit unsafe test query was sent through the live text pipeline. The guardrail refused it before transcription, retrieval, or generation.

| Field | Observed result |
| --- | --- |
| Outcome | `refused` |
| Reason | “This request falls outside Vaani’s safe research-assistance boundary.” |
| Retrieved sources | 0 |
| Total observed latency | 1 ms |
| Answer release | Withheld |

## Persisted index

The corpus builder downloaded the real MSMARCO-XI validation files for Hindi, Marathi, Tamil, and Telugu. The available dataset manifest did not publish an English validation split, so English remains a supported input language but is not falsely represented as an indexed dataset language.

The compact, quota-aware build extracted 1 row per available language split, generated **78 multi-strategy chunks**, called the live `gemini-embedding-001` endpoint for each vector, and persisted a cosine HNSW graph plus provenance manifest at `server/rag-index/`. The model and chunk count are returned by the backend health contract and rendered in the visible **Index state** panel.

## Observed benchmark

The benchmark executed five distinct corpus-relevant questions through the complete text pipeline. It recorded one intentional refusal and four grounded answers. Percentiles are calculated from the five observed total pipeline durations, not from estimates.

| Metric | Observed value |
| --- | ---: |
| Samples | 5 |
| P50 | 4,886 ms |
| P70 | 5,130 ms |
| P100 | 21,159 ms |
| Observed durations | 4,452 ms; 4,562 ms; 5,130 ms; 21,159 ms; 4,886 ms |

The measured results are above the brief’s aspirational 200 ms end-to-end target because the live path includes external Sarvam and Groq network calls. The UI deliberately labels telemetry as **Observed, not promised** and does not fabricate a sub-200 ms result.

## Verification status

`pnpm check` passed. The deterministic Vitest suite passed with **11 tests across 8 test files**; the live-service suite remains opt-in. A repository-wide audit across backend, frontend, scripts, documentation, package configuration, and checklist found no remaining legacy local-model or tunnel references in runtime or project copy. Gemini Embedding is now the only embedding service configured by the application.

## Live keyboard interaction verification

A Playwright run against the live preview used real browser keyboard events rather than only programmatic focus. Tab traversal reached the voice action at position 1, text area at position 3, submit button at position 4, benchmark button at position 5, and evidence disclosure summary at position 6. Space activated the voice action and benchmark control; Enter activated the text submit; Space/Enter opened the evidence disclosure and Space closed it. The observed result was recorded as `tabOrder: { voice: 1, textarea: 3, submit: 4, benchmark: 5, summary: 6 }` with all activation checks true.

The final browser run also verified reverse traversal with Shift+Tab. Forward focus positions were voice 5, textarea 7, submit 8, benchmark 9, and summary 10; reverse traversal reached submit 1, textarea 2, voice 4, and summary 12. Both Enter and Space triggered the benchmark request, while the voice action, text submit, and disclosure controls retained their earlier successful keyboard results.
