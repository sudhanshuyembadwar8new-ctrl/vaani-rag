import { trpc } from "@/lib/trpc";
import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowRight, Check, ChevronDown, CircleAlert, FileSearch, Github, Mic, Play, RefreshCw, Search, Send, ShieldCheck, Square, Terminal, Volume2, X } from "lucide-react";

function VaaniLogo({ className = "h-8 w-8", size = 32 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="none" className={`shrink-0 ${className}`} style={{ width: size, height: size, display: "inline-block", flexShrink: 0 }} xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="#101010" stroke="#34D399" strokeWidth="1.2" />
      <path d="M8 16h2M12 11v10M16 8v16M20 12v8M24 16h2" stroke="#34D399" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

type Mode = "idle" | "listening" | "processing" | "answered" | "refused" | "error";
type ServerStage = "pending" | "running" | "complete" | "refused" | "error";

const toBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  const groups: string[] = [];
  for (let index = 0; index < bytes.length; index += 8192) groups.push(String.fromCharCode(...Array.from(bytes.subarray(index, index + 8192))));
  return btoa(groups.join(""));
};

const MAX_SYNC_RECORDING_MS = 25_000;

function Eyebrow({ children }: { children: React.ReactNode }) { return <p className="mono text-[10px] font-semibold uppercase tracking-[.13em] text-[#34D399]">{children}</p>; }

function Stage({ number, name, body, status, duration, detail, retries = 0 }: { number: string; name: string; body: string; status: ServerStage; duration?: number | null; detail?: string; retries?: number }) {
  const success = status === "complete";
  const stopped = status === "refused" || status === "error";
  return <div className={`grid grid-cols-[28px_1fr_auto] gap-3 py-4 ${status === "running" ? "bg-[#34D399]/[.035]" : ""}`}>
    <span className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border text-[9px] ${success ? "border-[#34D399] bg-[#34D399] text-[#030303]" : stopped ? "border-[#ff8585] text-[#ff8585]" : status === "running" ? "border-[#34D399] text-[#34D399]" : "border-[#888] text-[#888]"}`}>{success ? <Check size={12} strokeWidth={3} /> : stopped ? <X size={12} /> : <span className="mono">{number}</span>}</span>
    <div><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><p className="display text-sm font-medium">{name}</p>{status === "running" && <span className="mono text-[9px] uppercase tracking-[.1em] text-[#34D399]">Live</span>}</div><p className="mt-1 text-xs leading-5 text-[#888]">{detail || body}{retries > 0 ? ` · retry ${retries}` : ""}</p></div>
    <span className="mono pt-1 text-[10px] text-[#a19fa9]">{duration == null ? "—" : `${duration}ms`}</span>
  </div>;
}

function Metric({ label, value, mint = false }: { label: string; value?: number | null; mint?: boolean }) {
  return <div className="border-l border-[#888]/30 pl-3"><p className="mono text-[9px] uppercase tracking-[.11em] text-[#888]">{label}</p><p className={`mono mt-1 text-base font-semibold ${mint ? "text-[#34D399]" : "text-white"}`}>{value == null ? "—" : `${value}ms`}</p></div>;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("idle");
  const [language, setLanguage] = useState("unknown");
  const [question, setQuestion] = useState("");
  const [transcript, setTranscript] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [level, setLevel] = useState(.12);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const frame = useRef<number | null>(null);
  const recordingLimit = useRef<number | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const health = trpc.rag.health.useQuery(undefined, { refetchInterval: 15_000 });
  const metrics = trpc.rag.metrics.useQuery(undefined, { refetchInterval: 5_000 });
  const query = trpc.rag.startQuery.useMutation();
  const voice = trpc.rag.startVoice.useMutation();
  const benchmark = trpc.rag.benchmark.useMutation();
  const run = trpc.rag.runStatus.useQuery({ runId: runId || "00000000-0000-4000-8000-000000000000" }, { enabled: Boolean(runId), retry: false, refetchInterval: mode === "processing" ? 550 : false });
  const result = run.data?.result;
  const stages = useMemo(() => new Map(run.data?.stages.map(item => [item.name, item]) ?? []), [run.data?.stages]);
  const stage = (name: "transcribing" | "embedding" | "retrieving" | "generating" | "verifying" | "answered") => stages.get(name);
  const systemReady = Boolean(health.data?.index.ready && health.data.sarvam === "configured-unverified" && health.data.groq === "configured-unverified" && health.data.gemini === "configured-unverified");

  useEffect(() => {
    if (!run.data) return;
    if (run.data.transcript) setTranscript(run.data.transcript);
    if (run.data.status === "error") { setMode("error"); setMessage(run.data.error || "The pipeline could not complete."); }
    if (run.data.status === "complete" && result) { setMode(result.outcome === "answered" ? "answered" : "refused"); setMessage(null); }
  }, [run.data, result]);
  useEffect(() => () => stopMedia(), []);

  function stopMedia() {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = null;
    if (recordingLimit.current) window.clearTimeout(recordingLimit.current);
    recordingLimit.current = null;
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    analyser.current = null;
    recorder.current = null;
    setLevel(.12);
  }
  function watchLevel() {
    if (!analyser.current) return;
    const values = new Uint8Array(analyser.current.frequencyBinCount);
    const update = () => { if (!analyser.current) return; analyser.current.getByteTimeDomainData(values); setLevel(Math.min(1, Math.max(.1, values.reduce((sum, value) => sum + Math.abs(value - 128), 0) / values.length / 38))); frame.current = requestAnimationFrame(update); };
    update();
  }
  async function startListening() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setMode("error"); setMessage("Secure microphone capture is unavailable in this browser."); return; }
    try {
      setMessage(null); setTranscript(""); setRunId(null);
      const captured = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      const context = new AudioContext(); const audioAnalyser = context.createAnalyser(); audioAnalyser.fftSize = 128; context.createMediaStreamSource(captured).connect(audioAnalyser);
      stream.current = captured; analyser.current = audioAnalyser;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const activeRecorder = new MediaRecorder(captured, { mimeType, audioBitsPerSecond: 64000 });
      audioChunks.current = [];
      activeRecorder.ondataavailable = event => { if (event.data.size) audioChunks.current.push(event.data); };
      activeRecorder.onstop = async () => {
        const audio = new Blob(audioChunks.current, { type: activeRecorder.mimeType || "audio/webm" }); stopMedia();
        if (!audio.size || audio.size > 8 * 1024 * 1024) { setMode("error"); setMessage(audio.size ? "Audio exceeded the 8 MB request limit. Please record a shorter question." : "No audio was captured. Please try again."); return; }
        try { setMode("processing"); const started = await voice.mutateAsync({ audioBase64: toBase64(await audio.arrayBuffer()), mimeType: audio.type, languageCode: language }); setRunId(started.runId); }
        catch (error) { setMode("error"); setMessage(error instanceof Error ? error.message : "Voice request could not start."); }
      };
      activeRecorder.start(250); recorder.current = activeRecorder; setMode("listening"); watchLevel();
      recordingLimit.current = window.setTimeout(() => {
        setMessage("Recording stopped automatically at 25 seconds so it stays within the live transcription limit.");
        if (activeRecorder.state === "recording") activeRecorder.stop();
      }, MAX_SYNC_RECORDING_MS);
    } catch (error) { setMode("error"); setMessage(error instanceof Error ? error.message : "Microphone permission was not granted."); }
  }
  function stopListening() { if (recorder.current?.state === "recording") recorder.current.stop(); else stopMedia(); }
  async function sendText(event: React.FormEvent) {
    event.preventDefault(); if (question.trim().length < 3) return;
    try { setMessage(null); setTranscript(question.trim()); setRunId(null); setMode("processing"); const started = await query.mutateAsync({ question: question.trim() }); setRunId(started.runId); }
    catch (error) { setMode("error"); setMessage(error instanceof Error ? error.message : "Text request could not start."); }
  }

  const sources = result?.sources ?? [];
  const shownSources = expanded ? sources : sources.slice(0, 3);
  const currentMs = result?.totalMs ?? run.data?.currentMs;

  return <div className="canvas-grain min-h-screen bg-[#030303] text-white">
    <header className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12"><a href="#top" className="flex items-center gap-3"><VaaniLogo className="h-8 w-8" /><span><b className="display block text-sm tracking-[.22em]">VAANI</b><small className="mono block mt-0.5 text-[8px] tracking-[.14em] text-[#888]">VOICE RAG SYSTEM</small></span></a><nav className="hidden gap-6 md:flex"><a href="#pipeline">Pipeline</a><a href="#evidence">Evidence</a><a href="#architecture">Architecture</a></nav><span className="inline-flex items-center gap-2 border border-[#888]/30 bg-[#090909] px-3 py-2 mono text-[9px] uppercase tracking-[.1em] text-[#a19fa9]"><i className={`h-1.5 w-1.5 rounded-full ${health.data?.index.ready ? "bg-[#34D399] pulse-dot" : "bg-[#ff8585]"}`} />{health.data?.index.ready ? "System armed" : "Setup required"}</span></header>

    <main id="top"><section className="signal-frame relative mx-auto min-h-[650px] max-w-[1440px] px-5 pb-20 pt-20 sm:px-8 lg:px-12 lg:pt-28"><div className="pointer-events-none absolute inset-x-0 top-16 -z-10 h-[420px]"><i className="flow-line" /><i className="flow-line" /><i className="flow-line" /><i className="flow-line" /></div><div className="max-w-4xl"><div className="mb-7 flex items-center gap-3"><Eyebrow>HH Goa 2026 · #RAGInGoa</Eyebrow><i className="h-px w-9 bg-[#34D399]/60" /><span className="mono text-[10px] uppercase tracking-[.1em] text-[#888]">Voice → Evidence → Answer</span></div><h1 className="display max-w-3xl text-[clamp(3.2rem,8vw,7.15rem)] font-medium leading-[.94] tracking-[-.065em]">Speak. Retrieve.<br /><em className="not-italic text-[#34D399]">Verify.</em></h1><p className="mt-7 max-w-xl text-[15px] leading-7 text-[#a19fa9]">A voice-to-answer RAG system where every response stays attached to the source passages used to generate it.</p></div>
      <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center"><button onClick={mode === "listening" ? stopListening : startListening} disabled={mode === "processing"} className={`listening inline-flex min-h-16 items-center justify-center gap-4 border px-7 text-sm font-semibold transition-all active:scale-[.98] disabled:opacity-45 ${mode === "listening" ? "border-[#34D399] bg-[#0b2b1d] text-[#34D399]" : "border-[#34D399] bg-[#34D399] text-[#030303] hover:bg-white"}`}><span className={`flex h-9 w-9 items-center justify-center rounded-full ${mode === "listening" ? "border border-[#34D399]" : "bg-[#030303] text-[#34D399]"}`}>{mode === "listening" ? <Square size={13} fill="currentColor" /> : <Mic size={18} />}</span>{mode === "listening" ? "Stop & send voice" : "Ask Vaani with your voice"}<ArrowRight size={17} /></button><label className="flex items-center gap-3 border border-[#888]/30 bg-[#090909]/85 px-4 py-3 text-xs text-[#a19fa9]"><Volume2 size={15} className="text-[#34D399]" />Input language<select value={language} onChange={event => setLanguage(event.target.value)}><option value="unknown">Auto detect</option><option value="en-IN">English · India</option><option value="hi-IN">Hindi</option><option value="mr-IN">Marathi</option><option value="ta-IN">Tamil</option><option value="te-IN">Telugu</option></select></label></div>
      <div className="mt-8 flex flex-wrap gap-5 mono text-[10px] uppercase tracking-[.08em] text-[#a19fa9]"><span><i className={`mr-2 inline-block h-1.5 w-1.5 rounded-full ${health.data?.sarvam === "configured-unverified" ? "bg-[#34D399]" : "bg-[#ff8585]"}`} />Sarvam STT</span><span><i className={`mr-2 inline-block h-1.5 w-1.5 rounded-full ${health.data?.groq === "configured-unverified" ? "bg-[#34D399]" : "bg-[#ff8585]"}`} />Groq generation</span><span><i className={`mr-2 inline-block h-1.5 w-1.5 rounded-full ${health.data?.gemini === "configured-unverified" ? "bg-[#34D399]" : "bg-[#ff8585]"}`} />Gemini Embedding</span></div>
      <div className={`absolute bottom-12 right-5 hidden h-32 w-[38%] items-center justify-end gap-[3px] pr-3 lg:flex ${mode === "listening" ? "listening" : ""}`}>{Array.from({ length: 48 }, (_, index) => <i key={index} className="voice-bar w-1 bg-[#34D399] shadow-[0_0_12px_rgba(52,211,153,.7)]" style={{ height: `${Math.max(9, 19 + Math.sin(index * .63) * 14 + index % 7 * 2) * (mode === "listening" ? level : .46)}px` }} />)}</div></section>
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12"><div className="hairline" /></div>

      <section id="pipeline" className="mx-auto grid max-w-[1440px] gap-5 px-5 py-20 sm:px-8 lg:grid-cols-[1.38fr_.62fr] lg:px-12"><div className="panel p-5 sm:p-7"><div className="flex justify-between gap-5 border-b border-[#888]/25 pb-6"><div><Eyebrow>Live pipeline</Eyebrow><h2 className="display mt-3 text-2xl font-medium tracking-[-.04em]">Every stage, inspectable.</h2></div><span className="mono text-[10px] uppercase tracking-[.1em] text-[#a19fa9]">{mode === "listening" ? "Listening" : mode === "processing" ? "Executing" : mode === "answered" ? "Verified" : mode === "refused" ? "Withheld" : mode === "error" ? "Attention" : "Awaiting input"}</span></div><div className="divide-y divide-[#888]/20"><Stage number="01" name="Listening" body="Browser MediaRecorder capture with live amplitude response, capped at 25 seconds for live transcription." status={mode === "listening" ? "running" : transcript ? "complete" : "pending"} detail={mode === "listening" ? "Capturing microphone input locally." : transcript ? "Input received." : undefined} /><Stage number="02" name="Transcribing" body="Sarvam Saaras V4 converts captured audio to query text." status={stage("transcribing")?.status ?? "pending"} duration={stage("transcribing")?.durationMs} detail={stage("transcribing")?.detail} retries={stage("transcribing")?.retries} /><Stage number="03" name="Embedding" body="Gemini Embedding converts the input into a live query vector." status={stage("embedding")?.status ?? "pending"} duration={stage("embedding")?.durationMs} detail={stage("embedding")?.detail} retries={stage("embedding")?.retries} /><Stage number="04" name="Retrieving" body="HNSW neighbours and the similarity threshold select evidence." status={stage("retrieving")?.status ?? "pending"} duration={stage("retrieving")?.durationMs} detail={stage("retrieving")?.detail} retries={stage("retrieving")?.retries} /><Stage number="05" name="Generating" body="Groq emits structured answer and exact source IDs." status={stage("generating")?.status ?? "pending"} duration={stage("generating")?.durationMs} detail={stage("generating")?.detail} retries={stage("generating")?.retries} /><Stage number="06" name="Answer integrity" body="Citation and semantic-support checks decide whether to release." status={stage("answered")?.status === "complete" ? "complete" : stage("verifying")?.status ?? "pending"} duration={stage("verifying")?.durationMs} detail={stage("verifying")?.detail || stage("answered")?.detail} retries={stage("verifying")?.retries} /></div></div>
        <aside className="panel relative overflow-hidden p-5 sm:p-7"><div className="relative"><Eyebrow>Input console</Eyebrow><h2 className="display mt-3 text-xl font-medium tracking-[-.04em]">Type when the room is loud.</h2><form className="mt-7" onSubmit={sendText}><textarea value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ask a question about the indexed corpus…" maxLength={1000} /><div className="mt-3 flex items-center justify-between"><span className="mono text-[9px] text-[#888]">{question.length}/1000</span><button type="submit" disabled={mode === "processing" || question.trim().length < 3} className="inline-flex items-center gap-2 bg-white px-4 py-2.5 text-xs font-semibold text-[#030303] hover:bg-[#34D399] disabled:opacity-40"><Send size={14} />Run query</button></div></form><div className="mt-8 border-t border-[#888]/25 pt-5"><p className="mono text-[9px] uppercase tracking-[.1em] text-[#888]">Current transcript</p><p className="mt-3 min-h-12 text-sm leading-6 text-[#e7e7e7]">{transcript || "A verified transcript will appear here after transcription."}</p></div></div></aside></section>

      <section id="evidence" className="mx-auto max-w-[1440px] px-5 pb-20 sm:px-8 lg:px-12"><div className="grid gap-5 lg:grid-cols-[1.38fr_.62fr]"><div className={`panel relative overflow-hidden p-5 sm:p-7 ${mode === "refused" ? "border-[#34D399]/70" : mode === "error" ? "border-[#ff8585]/60" : ""}`}><div className="relative"><div className="flex justify-between gap-4 border-b border-[#888]/25 pb-6"><div><Eyebrow>Grounded answer</Eyebrow><h2 className="display mt-3 text-2xl font-medium tracking-[-.04em]">Evidence before eloquence.</h2></div>{currentMs != null && <span className="mono h-fit border border-[#34D399]/45 bg-[#34D399]/10 px-3 py-2 text-xs text-[#34D399]">{currentMs}ms observed</span>}</div>{mode === "answered" && result?.outcome === "answered" ? <div className="py-8"><p className="max-w-3xl text-[17px] leading-8 sm:text-xl">{result.answer}</p><div className="mt-7 flex flex-wrap gap-2">{result.citations.map(citation => <span key={citation} className="mono border border-[#34D399]/35 bg-[#34D399]/10 px-2.5 py-1 text-[10px] text-[#34D399]">{citation}</span>)}</div></div> : mode === "refused" && result?.outcome === "refused" ? <div className="py-8"><div className="flex max-w-xl gap-4 border-l-2 border-[#34D399] bg-[#34D399]/[.06] p-5"><ShieldCheck className="shrink-0 text-[#34D399]" size={22} /><div><p className="display text-lg font-medium">Answer withheld by design.</p><p className="mt-2 text-sm leading-6 text-[#a19fa9]">{result.reason}</p></div></div></div> : mode === "error" ? <div className="py-8"><div className="flex max-w-xl gap-4 border-l-2 border-[#ff8585] bg-[#ff8585]/[.06] p-5"><CircleAlert className="shrink-0 text-[#ff8585]" size={22} /><div><p className="display text-lg font-medium">A live dependency needs attention.</p><p className="mt-2 text-sm leading-6 text-[#a19fa9]">{message}</p></div></div></div> : <div className="py-11"><p className="max-w-md text-sm leading-7 text-[#a19fa9]">A real answer appears only after sufficient context is retrieved and the post-generation check verifies its citations. This panel deliberately stays empty before a live run.</p></div>}</div></div>
          <aside className="panel metric-grid p-5 sm:p-7"><div className="flex justify-between"><div><Eyebrow>Latency telemetry</Eyebrow><h2 className="display mt-3 text-xl font-medium tracking-[-.04em]">Observed, not promised.</h2></div><Activity size={19} className="text-[#34D399]" /></div><div className="mt-9 grid grid-cols-3 gap-3"><Metric label="P50" value={metrics.data?.p50} /><Metric label="P70" value={metrics.data?.p70} mint /><Metric label="P100" value={metrics.data?.p100} /></div><div className="mt-8 flex h-24 items-end gap-1.5 border-b border-l border-[#888]/30 pb-1 pl-1.5">{metrics.data?.latest ? [metrics.data.p50, metrics.data.p70, metrics.data.p100].map((point, index) => <i key={index} className="w-full bg-[#34D399] shadow-[0_0_12px_rgba(52,211,153,.42)]" style={{ height: `${Math.max(10, Math.min(100, ((point || 0) / Math.max(metrics.data?.p100 || 1, 1)) * 100))}%` }} />) : <p className="mono self-center px-3 text-[10px] uppercase tracking-[.1em] text-[#888]">Awaiting observed runs</p>}</div><div className="mt-4 flex justify-between gap-3"><p className="mono text-[9px] uppercase tracking-[.1em] text-[#888]">{metrics.data?.sampleCount ? `${metrics.data.sampleCount} real runs` : "No latency samples"}</p><button onClick={() => benchmark.mutate()} disabled={!systemReady || benchmark.isPending} className="inline-flex items-center gap-1.5 text-xs text-[#34D399] disabled:text-[#888]"><Play size={12} />Run benchmark</button></div>{benchmark.error && <p className="mt-3 text-xs text-[#ff8585]">{benchmark.error.message}</p>}</aside></div>
        <div className="panel mt-5 p-5 sm:p-7"><div className="flex flex-wrap justify-between gap-4 border-b border-[#888]/25 pb-6"><div><Eyebrow>Retrieved evidence</Eyebrow><h2 className="display mt-3 text-2xl font-medium tracking-[-.04em]">Show the passages, not just the claim.</h2></div><span className="mono text-[10px] uppercase tracking-[.1em] text-[#888]">{sources.length ? `${sources.length} live candidates` : "No live candidates"}</span></div>{shownSources.length ? <div className="divide-y divide-[#888]/20">{shownSources.map((source, index) => <details className="source-collapsible group py-5" key={source.id}><summary className="flex items-start gap-4"><span className="mono mt-1 text-[10px] text-[#34D399]">{String(index + 1).padStart(2, "0")}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-3"><p className="mono text-[10px] text-[#a19fa9]">{source.strategy.toUpperCase()} · {source.metadata.language} · ROW {source.metadata.row}</p><span className="mono border border-[#34D399]/35 px-2 py-1 text-[10px] text-[#34D399]">{(source.similarity * 100).toFixed(1)}% SIM</span></div><p className="mt-3 line-clamp-2 text-sm leading-6 text-[#e4e4e4]">{source.content}</p></div><ChevronDown className="mt-1 shrink-0 text-[#888] group-open:rotate-180" size={17} /></summary><div className="ml-9 mt-4 border-l border-[#34D399]/40 pl-4 text-sm leading-7 text-[#a19fa9]">{source.content}<p className="mono mt-3 text-[9px] uppercase tracking-[.09em] text-[#888]">{source.metadata.sourceFile} · {source.metadata.field}</p></div></details>)}</div> : <p className="py-10 text-sm leading-7 text-[#a19fa9]">Retrieved passages attach only to a completed live run. Vaani never previews fabricated citations.</p>}{sources.length > 3 && <button onClick={() => setExpanded(value => !value)} className="mt-3 inline-flex items-center gap-2 text-xs text-[#34D399]">{expanded ? "Collapse sources" : `Show ${sources.length - 3} more sources`}<ChevronDown size={14} /></button>}</div></section>

      <section id="architecture" className="mx-auto max-w-[1440px] px-5 pb-24 sm:px-8 lg:px-12"><div className="grid gap-5 border-t border-[#888]/30 pt-16 lg:grid-cols-[.72fr_1.28fr]"><div><Eyebrow>How it’s built</Eyebrow><h2 className="display mt-4 max-w-md text-4xl font-medium leading-[1.02] tracking-[-.055em]">A harness, not a hopeful prompt.</h2><p className="mt-6 max-w-sm text-sm leading-7 text-[#a19fa9]">External operations are typed, time-stamped, retried once on transient failure, and shown in the interface.</p></div><div className="grid gap-px overflow-hidden border border-[#888]/30 bg-[#888]/30 sm:grid-cols-2">{[{ icon: <FileSearch size={18} />, title: "Multi-view chunking", body: "Semantic thought groups, overlapping precision windows, and short-document views preserve context without one naïve chunk size." }, { icon: <Search size={18} />, title: "Real vector retrieval", body: "Gemini vectors use a persisted cosine HNSW graph; provenance follows every chunk into the answer panel." }, { icon: <ShieldCheck size={18} />, title: "Two grounding gates", body: "Similarity thresholding blocks weak retrieval; citation and semantic-support validation blocks unsupported generation." }, { icon: <RefreshCw size={18} />, title: "Observable harness", body: "Sarvam, Gemini, and Groq each have bounded retries, stage traces, and explicit configuration failures." }].map(card => <article className="bg-[#090909] p-6" key={card.title}><span className="text-[#34D399]">{card.icon}</span><h3 className="display mt-7 text-lg font-medium">{card.title}</h3><p className="mt-3 text-sm leading-6 text-[#a19fa9]">{card.body}</p></article>)}</div></div><div className="panel mt-5 flex flex-col gap-5 p-5 sm:flex-row sm:justify-between sm:p-6"><div className="flex gap-4"><Terminal className="mt-0.5 shrink-0 text-[#34D399]" size={19} /><div><Eyebrow>Index state</Eyebrow><p className="mt-2 text-sm text-[#e7e7e7]">{health.data?.index.message || "Checking persisted corpus index…"}</p>{health.data?.index.ready && <p className="mono mt-2 text-[10px] text-[#a19fa9]">{health.data.index.chunkCount} chunks · {health.data.index.corpus?.sourceFile} · {health.data.index.model}</p>}</div></div><span className="mono text-[10px] uppercase tracking-[.1em] text-[#888]">MSMARCO-XI · AI4Bharat</span></div></section></main>
    <footer className="border-t border-[#888]/25"><div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-5 py-8 sm:flex-row sm:justify-between sm:px-8 lg:px-12"><div className="flex items-center gap-3"><VaaniLogo className="h-5 w-5" size={20} /><span className="mono text-[10px] uppercase tracking-[.12em] text-[#a19fa9]">Vaani · Voice RAG intelligence</span></div><div className="flex gap-5"><span className="mono text-[10px] text-[#34D399]">#RAGInGoa</span><a href="https://github.com/sudhanshuyembadwar8new-ctrl/vaani-rag" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs text-[#a19fa9] transition-colors hover:text-[#34D399]"><Github size={14} />https://github.com/sudhanshuyembadwar8new-ctrl/vaani-rag</a></div></div></footer>
  </div>;
}
