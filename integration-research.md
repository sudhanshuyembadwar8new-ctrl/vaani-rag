# Integration Research — 16 August 2026

## Sarvam Speech-to-Text

The live transcription adapter will call `POST https://api.sarvam.ai/speech-to-text` using a multipart request with the captured audio attached as `file`. Sarvam documents support for WebM and other common browser-recording formats. The implementation will request `saaras:v4`, provide an explicit BCP-47 language code where selected by the caller, and request timestamps for audit visibility. Its response includes a `transcript`, a detected `language_code`, optional chunk-level timestamps, and a confidence-like `language_probability` value.

## Groq Answer Generation

The answer-generation adapter will call Groq Chat Completions using a server-side secret. The harness will request structured JSON for an answer, cited chunk identifiers, groundedness verdict, and refusal rationale, which makes source-attribution validation programmatic rather than prompt-only. Streaming is available, but the first implementation will favour validated, short structured completion before adding streaming transport to the live answer panel.

## Product Constraint

The UI must not show synthetic answers, source chunks, benchmark numbers, or fake pipeline success. Before Sarvam, Groq, and retrieval-index configuration are present, it should expose a purposeful, actionable configuration state. Timings will be generated only from observed server timestamps.

## MSMARCO-XI Corpus Manifest

The supplied `ai4bharat/MSMARCO-XI` repository publishes language-specific Parquet files organised in `train/` and `validation/` directories. The validation manifest includes Assamese, Bengali, Gujarati, Hindi, Kannada, Malayalam, Marathi, Nepali, Odia, Punjabi, Sanskrit, Tamil, Telugu, and Urdu splits. The indexing workflow will use an intentionally bounded, reproducible sample from the selected language split for the live demo, and will preserve language, split, row identifiers, passage position, chunk strategy, and source filename as provenance metadata.

## Sources

1. [Sarvam REST Speech-to-Text Reference](https://docs.sarvam.ai/api-reference/speech-to-text/transcribe)
2. [Groq Text Generation Documentation](https://console.groq.com/docs/text-chat)
