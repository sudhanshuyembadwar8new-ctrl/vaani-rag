from __future__ import annotations

import json
import os
from pathlib import Path

import pyarrow.parquet as pq

max_rows = int(os.environ.get("RAG_MAX_ROWS_PER_SOURCE", "30"))
spec = os.environ.get(
    "RAG_SOURCES",
    ".rag-source/hinval.parquet|hi-IN|validation/hinval.parquet,"
    ".rag-source/marval.parquet|mr-IN|validation/marval.parquet,"
    ".rag-source/tamval.parquet|ta-IN|validation/tamval.parquet,"
    ".rag-source/telval.parquet|te-IN|validation/telval.parquet",
)
out_path = Path(os.environ.get("RAG_ROWS_JSON", ".rag-source/msmarco_rows.json"))
out_path.parent.mkdir(parents=True, exist_ok=True)
rows = []
for item in spec.split(","):
    file_name, language, source_file = item.split("|")
    parquet_file = pq.ParquetFile(file_name)
    collected = 0
    for batch in parquet_file.iter_batches(batch_size=min(8, max_rows)):
        for row in batch.to_pylist():
            rows.append({"language": language, "sourceFile": source_file, "split": "validation", "row": collected, "data": row})
            collected += 1
            if collected >= max_rows:
                break
        if collected >= max_rows:
            break
print(f"Read {len(rows)} rows across {len(spec.split(','))} MSMARCO-XI splits")
out_path.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
print(f"Extracted rows to {out_path}")
