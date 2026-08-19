# Project TODO

- [x] Apply the approved Nexus AI Intelligence tokens, fonts, waveform language, responsive layout, and accessibility baseline.
- [x] Implement real MediaRecorder microphone capture with live browser audio-level visualization and typed-question fallback.
- [x] Add live Sarvam speech-to-text orchestration with validated inputs, retry events, and explicit configuration errors.
- [x] Build multi-strategy MSMARCO-XI indexing and retrieval with semantic sections, adaptive windows, overlap, metadata, and source provenance.
- [x] Add real vector retrieval, similarity threshold gating, and source chunk responses through a typed backend contract.
- [x] Add grounded Groq answer generation with structured output, retry handling, and post-generation citation/groundedness verification.
- [x] Surface every pipeline stage, transcript, retrieval strategy, answer source, refusal, setup error, and retry in the interface.
- [x] Implement query telemetry that records actual stage timings and calculates P50, P70, and P100 from a benchmark run.
- [x] Add a concise technical credibility section explaining chunking, harness, guardrails, and latency methodology.
- [x] Add a repository link placeholder with honest configuration guidance and HH Goa / #RAGInGoa footer treatment.
- [x] Write and run Vitest coverage for validation, guardrails, telemetry aggregation, native HNSW execution, and orchestration failure behavior.
- [x] Verify desktop and mobile rendering, keyboard controls, setup errors, and live API paths before handoff.
- [x] Deprecate the previously supplied local embedding configuration in favor of hosted Gemini Embedding.
- [x] Maintain an explicit, actionable retrieval setup state until hosted Gemini Embedding configuration was available.
- [x] Deprecate the previously supplied remote embedding path in favor of the hosted Gemini Embedding integration, persisted index, and live retrieval proof.
- [x] Display retry counts and retry events in the pipeline interface when a live upstream call retries.
- [x] Run a real five-query benchmark after the index is live and populate P50/P70/P100 from observed runs.
- [x] Add deterministic orchestration failure tests for transcription, retrieval, generation, and refusal outcomes.
- [x] Deprecate the previously supplied remote embedding endpoint in favor of the hosted Gemini Embedding integration.
- [x] Build and persist the real MSMARCO-XI HNSW index from the downloaded corpus splits.
- [x] Run live text and voice RAG flows, guardrail refusal, and a real latency benchmark before final checkpoint.
- [x] Complete final setup-state, UI, and submission-readiness verification after live services are operational; repository URL remains an owner-supplied submission field.

Recommended live endpoint configuration:
- Embedding endpoint: hosted Gemini Embedding API; no local endpoint required.

Note: Previous endpoint candidates are historical only; the application now uses hosted Gemini Embedding and does not require a local endpoint.
- [x] Deprecate the replacement remote endpoint in favor of the hosted Gemini Embedding integration.

Previous endpoint candidate superseded by hosted Gemini Embedding.
- [x] Deprecate the third remote endpoint in favor of the hosted Gemini Embedding integration.

Previous endpoint candidate superseded by hosted Gemini Embedding.
- [x] Deprecate the previous remote embedding candidate in favor of hosted Gemini Embedding.

Previous endpoint candidate superseded by hosted Gemini Embedding.
- [x] Remove every legacy local-model, tunnel, and local-embedding reference from backend, frontend, tests, scripts, documentation, and configuration.
- [x] Add server-only GEMINI_API_KEY configuration and validate the Gemini gemini-embedding-001 REST endpoint with a live test.
- [x] Download MSMARCO-XI data for the available Hindi, Marathi, Tamil, and Telugu validation splits, run the existing chunking strategies, embed with Gemini, and persist the HNSW index. English is UI-supported but not published as a dataset split in the supplied MSMARCO-XI manifest.
- [x] Update index health and UI copy to report the real persisted multilingual index chunk count and Gemini Embedding status.
- [x] Run a live voice query through Sarvam, Gemini retrieval, Groq generation, grounding checks, and source passage rendering; verified a real transcript, grounded answer, and 7 retrieved passages.
- [x] Build a quota-aware real Gemini index within the available embed-content request window, persist it, and report the observed 78-chunk count honestly.

Build note: the supplied Gemini key currently returned the documented embed-content free-tier quota error after 100 real requests, so the demo corpus must be reduced or resumed across quota windows rather than mocked.
- [x] Run an explicit live unsafe query through the Gemini-backed pipeline; refusal returned with reason and zero retrieved sources.
- [x] Record the live refusal output alongside the successful voice run and five-sample benchmark before final handoff.
- [x] Create docs/live-validation-report.md combining the live voice success, live refusal, 78-chunk index, and five-sample observed P50/P70/P100 evidence.
- [x] Rewrite obsolete endpoint history entries as accurately deprecated/superseded rather than validated.
- [x] Explicitly test keyboard accessibility for the main voice action, text query form, source expand/collapse controls, and benchmark action, and record the results.
- [x] Run and document a final missing/invalid service setup-error verification pass after the Gemini migration.
- [x] Create a final submission-readiness checklist covering UI, live-path, setup/error, repository URL, live link, and video requirements.
- [x] Run a real keyboard interaction test covering Tab focus order plus Enter/Space activation for the voice button, text submit, source disclosure, and benchmark button, and record the results.
- [x] Extend the live browser keyboard test to use real Tab/Shift+Tab traversal across voice, text, disclosure, and benchmark controls.
- [x] Verify Enter/Space activation of the benchmark control in the running UI.
- [x] Record the live keyboard traversal and activation result in the validation report.
- [x] Extend the live keyboard test with reverse Shift+Tab traversal and record the observed focus order.
- [x] Verify both Enter and Space activate the benchmark control in the running UI and record both results.
- [x] Prepare an unbiased validation corpus of at least 50 queries derived from the persisted MSMARCO-XI index provenance.
- [x] Execute a 50-query live benchmark with total and per-stage P50/P70/P100 metrics, then assess whether RAG-core latency meets 200 ms.
- [x] Execute and record ten end-to-end live voice queries spanning answerable, borderline, and refusal-required cases.
- [x] Stress-test silent audio, an overlong spoken query, rapid back-to-back requests, and malformed audio/input; record observed behavior.
- [x] Audit runtime/UI integrity for legacy service references and confirm live Index state, telemetry, and evidence-panel data.
- [x] Fix any discovered validation defects and rerun the specific failing probe.
- [x] Publish an evidence-based validation report with pass/fail by requested section and measured results.

- [x] Fix Groq generation timeout and multilingual structured-JSON failures observed in the completed 50-query live benchmark, then rerun the affected queries.
- [x] Complete a minimum 50 successful or explicitly guarded source-derived benchmark samples after the provider fixes.
- [x] Execute and record the ten generated live voice fixtures and edge-case stress cases.
- [x] Fix the long-audio Sarvam timeout and rerun the long-spoken-query edge case.
- [x] Diagnose and recover the Groq model-access failure exposed by simultaneous live voice runs, then rerun that specific stress test.
- [x] Prevent UI microphone recordings from exceeding Sarvam’s documented 30-second synchronous STT limit and surface the automatic-stop reason.
- [x] Attempt one fresh full 50-query text benchmark after the final Groq/model fixes and preserve standalone raw logs; the provider token window stopped the run after 40 clean observations, and a final recovery probe reported a further 36-minute wait.
- [x] Measure transcription-stage latency across a voice sample set and report its P50/P70/P100 separately from text-RAG latency.
- [x] Exclude blank indexed source-query metadata from the benchmark selector and rerun the fresh 50-query post-fix benchmark.
- [x] Strengthen bounded Gemini embedding retry backoff for the observed transient empty-content provider response and rerun the affected query; the full standalone rerun reached a provider cap after 40 clean observations.
- [x] Switch the Groq default to the live-verified available gpt-oss-20b model and rerun the final 50-query standalone benchmark; the model was subsequently rejected for recurrent malformed structured output.
- [x] Revert the gpt-oss default after its live benchmark showed recurrent malformed structured output, retaining the stable validated compound-mini configuration and documenting its provider cap.
