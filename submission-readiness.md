# Vaani Submission Readiness

## Product verification

| Area | Status | Evidence |
|---|---|---|
| Nexus visual system | Complete | Responsive Signal Sanctuary interface uses the approved warm-black, mint, neutral, Inter, and Geist system. |
| Voice input | Complete | Browser MediaRecorder and live Sarvam STT executed across ten generated WAV fixtures; UI capture now caps at 25 seconds to remain within Sarvam’s synchronous STT limit. |
| Gemini retrieval | Complete | Backend calls `gemini-embedding-001`; persisted cosine HNSW graph contains 51 real MSMARCO-XI validation-document chunks from 52 source rows. |
| Multi-strategy chunking | Complete | Semantic sections, overlapping sliding windows, document views, metadata, and source provenance are implemented and persisted. |
| Grounded generation | Complete | Groq structured output uses exact source IDs plus citation and semantic-support gates; the current default `groq/compound-mini` was live-verified. |
| Guardrails | Complete | Ten voice runs produced seven grounded answers and three grounded refusals; clean weather and FIFA World Cup outside-corpus queries were withheld with evidence-based reasons. |
| Benchmark | Complete, honest target result | 50 completed source-derived observations: total P50/P70/P100 = 5,673 / 6,866 / 29,005 ms; RAG-core = 5,450 / 6,613 / 28,762 ms, so the 200 ms target is not met. |
| Edge-case behavior | Complete | Silent audio and malformed bytes return explicit STT failures; 97.64-second audio is rejected by the synchronous provider; two simultaneous voice requests succeed after the current-model fix. |
| Accessibility contract | Complete | Vitest contract confirms keyboard-reachable native voice, submit, disclosure, and benchmark controls. |
| UI verification | Complete | Fresh browser run displayed System armed, 51 index chunks, live stage timings, a grounded answer, citations, seven candidates, and telemetry from the real backend result. |
| Legacy architecture audit | Complete | Full repository grep found no retired local-embedding, model, environment-variable, or tunnel-provider references. |

## Owner-supplied submission fields

The team owner must insert the repository URL in the footer and Google submission form. The live production deployment provides the working link and recoverable version. The two required videos remain owner deliverables: a 90-second team/process video and an end-to-end product demonstration. Every team member must publish both videos on Instagram, X, and LinkedIn, include `#RAGInGoa` in every post, and ensure at least one Instagram account is public.

## Honest performance note

The observed RAG-core P50 exceeds the aspirational 200 ms target by 5,250 ms, primarily because hosted Gemini embedding and Groq generation are external network operations. Vaani displays observed latency only; it does not claim sub-200 ms performance. The complete methodology, raw artifacts, failure remediations, and voice/edge evidence are documented in [live-validation-report.md](live-validation-report.md).
