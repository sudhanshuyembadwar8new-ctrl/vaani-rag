# Vaani Go-Live Runbook

## 1. Configure and Validate Gemini Embeddings

Set `GEMINI_API_KEY` in the project’s secure settings. Vaani calls Google’s generally available `gemini-embedding-001` REST endpoint from the backend for both document and query embeddings. No local model, tunnel, or separate embedding server is required.

```bash
pnpm vitest run server/gemini.secret.test.ts
RUN_LIVE_SERVICE_TESTS=true pnpm vitest run server/liveServices.integration.test.ts
```

The live checks deliberately verify Gemini authorization, Groq authorization, and Sarvam authorization before corpus indexing or voice demos proceed.

## 3. Build the Real MSMARCO-XI Demo Index

The repository includes a reproducible, intentionally bounded indexing route suitable for a live hackathon demo. It downloads actual language splits from `ai4bharat/MSMARCO-XI`, creates semantic and overlapping chunks with provenance, requests real `gemini-embedding-001` vectors, and writes the HNSW graph plus metadata manifest under `server/rag-index/`.

```bash
pnpm corpus:download validation/hinval.parquet .rag-source/hinval.parquet
pnpm corpus:download validation/marval.parquet .rag-source/marval.parquet
pnpm corpus:download validation/tamval.parquet .rag-source/tamval.parquet
pnpm corpus:download validation/telval.parquet .rag-source/telval.parquet
RAG_MAX_ROWS_PER_SOURCE=30 pnpm index:build server/rag-index
```

Use `RAG_MAX_ROWS_PER_SOURCE=30` only as a launch-friendly demo subset. Increase it deliberately after measuring the index size, build time, and memory footprint. The application will show the actual chunk count and source split only after the persisted index is present.

## 4. Run the Measured Benchmark

Use the **Run benchmark** action after an index is live. It draws actual source queries from indexed metadata, executes the live RAG path, and computes P50, P70, and P100 from observed total pipeline durations. Do not quote a latency figure until the dashboard has actual samples.

## 5. Submission Finalization

Before submitting, replace the honest footer placeholder with the real project repository URL, run an end-to-end voice question and a guardrail-refusal demo, record benchmark results, and create a fresh checkpoint. The final demo video should show the source chunks and latency panel, not only the polished hero.
