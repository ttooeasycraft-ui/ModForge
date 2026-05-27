import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Hammer, Copy, Bot, RotateCcw, Send, Check, Code,
  Smartphone, Monitor, ChevronRight, AlertTriangle,
  RefreshCw, Download, Loader2, FileCode,
  Zap, BookOpen, CheckCircle2, XCircle, Sparkles, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// ── BUG FIX: use || (not ??) so empty string also falls back to the Railway URL
const COMPILE_SERVER =
  ((import.meta.env.VITE_COMPILE_SERVER_URL as string | undefined) || "https://modforge-compile-production.up.railway.app")
    .replace(/\/$/, "");

// ── History ───────────────────────────────────────────────────────────────────
type DownloadEntry = {
  jobId: string; modName: string; version: string; loader: string;
  status: "compiling" | "ready" | "error"; createdAt: number;
};
const HISTORY_KEY = "modforge_downloads";
const saveEntry = (e: DownloadEntry) => {
  try {
    const arr: DownloadEntry[] = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    arr.unshift(e); localStorage.setItem(HISTORY_KEY, JSON.stringify(arr.slice(0, 20)));
  } catch {}
};
const updateEntry = (jobId: string, patch: Partial<DownloadEntry>) => {
  try {
    const arr: DownloadEntry[] = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    const i = arr.findIndex(e => e.jobId === jobId);
    if (i >= 0) { arr[i] = { ...arr[i], ...patch }; localStorage.setItem(HISTORY_KEY, JSON.stringify(arr)); }
  } catch {}
};

// ── Mod types ─────────────────────────────────────────────────────────────────
const MOD_TYPES = [
  { id: "fabric",      label: "Fabric",        emoji: "🧵", desc: "Mais popular, 1.14+" },
  { id: "forge",       label: "Forge",         emoji: "🔨", desc: "Mais mods disponíveis" },
  { id: "neoforge",    label: "NeoForge",      emoji: "⚙️", desc: "Moderno, 1.20.1+" },
  { id: "spigot",      label: "Spigot/Paper",  emoji: "🌐", desc: "Plugin para servidores" },
  { id: "bedrock",     label: "Bedrock/MCPE",  emoji: "📱", desc: "Addon para celular" },
  { id: "cobblemon",   label: "Cobblemon",     emoji: "🐉", desc: "Add-on de Pokémon" },
  { id: "datapack",    label: "Datapack",      emoji: "📦", desc: "Sem instalação extra" },
  { id: "resourcepack",label: "Resource Pack", emoji: "🎨", desc: "Texturas e sons" },
];
const VERSIONS: Record<string, string[]> = {
  fabric:       ["1.21.4","1.21.1","1.20.4","1.20.1","1.19.4","1.18.2"],
  forge:        ["1.20.1","1.19.4","1.18.2","1.16.5","1.12.2"],
  neoforge:     ["1.21.4","1.21.1","1.20.4","1.20.1"],
  spigot:       ["1.21.4","1.21.1","1.20.4","1.20.1","1.19.4"],
  bedrock:      ["Latest"],
  cobblemon:    ["1.21.1","1.20.1"],
  datapack:     ["1.21.4","1.21.1","1.20.4","1.20.1"],
  resourcepack: ["1.21.4","1.21.1","1.20.1","Todas"],
};
const EXTRAS = [
  "Adicionar itens/blocos novos","Adicionar receitas (crafting)",
  "Interação com jogadores","Efeitos e partículas visuais",
  "Comandos personalizados","Compatível com multiplayer",
  "Funciona em servidor","Sem dependências extras",
];
const COMPILE_FILES = [
  { key:"main.java",        label:"Arquivo principal",  hint:"Implementação do mod (.java)",               required:true,  nameEditable:true  },
  { key:"client.java",      label:"Arquivo Client",     hint:"Deixe vazio se não tiver",                   required:false, nameEditable:true  },
  { key:"fabric.mod.json",  label:"fabric.mod.json",    hint:"Metadados do mod (ou mods.toml para Forge)", required:true,  nameEditable:false },
  { key:"build.gradle",     label:"build.gradle",       hint:"Configurações de build",                     required:true,  nameEditable:false },
  { key:"gradle.properties",label:"gradle.properties",  hint:"Versão Minecraft, mod ID, etc.",             required:false, nameEditable:false },
  { key:"settings.gradle",  label:"settings.gradle",    hint:"Nome do projeto",                            required:false, nameEditable:false },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────
function CopyBtn({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      size="sm" variant="outline"
      className={`h-8 rounded-lg text-xs gap-1.5 shrink-0 transition-all ${copied
        ? "bg-emerald-600/20 border-emerald-500/50 text-emerald-400"
        : "bg-background border-border/50 text-muted-foreground hover:text-white"}`}>
      {copied ? <><Check className="w-3 h-3"/>Copiado!</> : <><Copy className="w-3 h-3"/>{label}</>}
    </Button>
  );
}

async function downloadJar(jobId: string, fileName: string) {
  const res = await fetch(`${COMPILE_SERVER}/baixar/${jobId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Arquivo expirado. Compile novamente." }));
    throw new Error(err.error ?? "Erro ao baixar o arquivo.");
  }
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = fileName; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ── Auto-compile section (paste files) ───────────────────────────────────────
type JobStatus = "idle" | "compiling" | "ready" | "error";

function AutoCompile({ modData }: { modData: { type: string; version: string; description: string } }) {
  const [files, setFiles]       = useState<Record<string, string>>({});
  const [names, setNames]       = useState<Record<string, string>>({ "main.java": "MeuMod.java", "client.java": "MeuModClient.java" });
  const [activeTab, setActive]  = useState("main.java");
  const [jobId, setJobId]       = useState<string|null>(null);
  const [jobStatus, setStatus]  = useState<JobStatus>("idle");
  const [jobLog, setLog]        = useState("");
  const [jobError, setError]    = useState("");
  const [dlErr, setDlErr]       = useState("");
  const [dlLoading, setDlLoad]  = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>|null>(null);

  const stopPoll = useCallback(() => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } }, []);

  useEffect(() => {
    if (jobStatus !== "compiling" || !jobId) return stopPoll();
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${COMPILE_SERVER}/status/${jobId}`);
        const d = await r.json();
        setLog(d.log ?? "");
        if (d.status === "ready") { setStatus("ready"); updateEntry(jobId, { status: "ready" }); stopPoll(); }
        else if (d.status === "error") { setStatus("error"); setError(d.error ?? "Erro desconhecido."); updateEntry(jobId, { status: "error" }); stopPoll(); }
      } catch {}
    }, 4000);
    return stopPoll;
  }, [jobStatus, jobId, stopPoll]);

  const missing = COMPILE_FILES.filter(f => f.required && !files[f.key]?.trim()).map(f => f.label);

  const handleCompile = async () => {
    const payload: Record<string, string> = {};
    for (const [k, v] of Object.entries(files)) {
      if (!v?.trim()) continue;
      payload[k === "main.java" ? names["main.java"] : k === "client.java" ? names["client.java"] : k] = v;
    }
    setStatus("compiling"); setLog(""); setError(""); setDlErr("");
    try {
      const r = await fetch(`${COMPILE_SERVER}/compilar`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: payload, version: modData.version, loader: modData.type }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Erro ao enviar arquivos.");
      setJobId(d.jobId);
      saveEntry({ jobId: d.jobId, modName: names["main.java"].replace(".java",""), version: modData.version, loader: modData.type, status: "compiling", createdAt: Date.now() });
    } catch (err) { setStatus("error"); setError(err instanceof Error ? err.message : "Erro de conexão."); }
  };

  const reset = () => { stopPoll(); setJobId(null); setStatus("idle"); setLog(""); setError(""); setDlErr(""); };

  const handleDownload = async () => {
    if (!jobId) return;
    setDlLoad(true); setDlErr("");
    try { await downloadJar(jobId, names["main.java"].replace(".java", "-1.0.jar")); }
    catch (e) { setDlErr(e instanceof Error ? e.message : "Erro ao baixar."); }
    finally { setDlLoad(false); }
  };

  if (jobStatus === "idle") return (
    <div className="bg-card/50 border border-white/10 rounded-2xl overflow-hidden">
      <div className="border-b border-white/8 px-5 py-3.5 flex items-center gap-2">
        <FileCode className="w-4 h-4 text-primary" />
        <p className="font-bold text-white text-sm">Cole os arquivos gerados pela IA</p>
      </div>
      <div className="p-5">
        <div className="flex gap-2 bg-amber-500/8 border border-amber-500/20 rounded-xl p-3 mb-4 text-xs text-amber-200">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400"/>
          Cole cada arquivo nos campos. <span className="text-red-400 ml-1">* = obrigatório</span>
        </div>
        {/* File tabs */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {COMPILE_FILES.map(f => (
            <button key={f.key} onClick={() => setActive(f.key)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === f.key ? "bg-primary text-black"
                : files[f.key]?.trim() ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                : "bg-white/5 text-muted-foreground border border-white/10 hover:border-primary/30"
              }`}>
              {f.required && <span className="text-red-400 mr-0.5">*</span>}
              {f.nameEditable ? names[f.key] : f.label}
              {files[f.key]?.trim() && <Check className="w-3 h-3 inline ml-1"/>}
            </button>
          ))}
        </div>
        {COMPILE_FILES.map(f => activeTab !== f.key ? null : (
          <div key={f.key} className="space-y-2">
            {f.nameEditable && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground shrink-0">Nome do arquivo:</span>
                <Input value={names[f.key]} onChange={e => setNames(p => ({ ...p, [f.key]: e.target.value }))}
                  className="h-7 text-xs bg-background/50 border-white/15 font-mono" />
              </div>
            )}
            <p className="text-xs text-muted-foreground">{f.hint}</p>
            <Textarea value={files[f.key] ?? ""}
              onChange={e => setFiles(p => ({ ...p, [f.key]: e.target.value }))}
              placeholder={`Cole o conteúdo de ${f.nameEditable ? names[f.key] : f.label}...`}
              className="min-h-[220px] bg-[#060912] border-white/10 font-mono text-sm text-emerald-400 placeholder:text-muted-foreground/25 rounded-xl" />
          </div>
        ))}
        {missing.length > 0 && <p className="text-xs text-red-400 mt-2">Faltam: {missing.join(", ")}</p>}
        <Button onClick={handleCompile} disabled={missing.length > 0}
          className="w-full h-12 mt-4 rounded-xl bg-primary hover:bg-primary/90 text-black font-bold gap-2 disabled:opacity-40">
          <Zap className="w-4 h-4"/> Compilar Automaticamente
        </Button>
      </div>
    </div>
  );

  if (jobStatus === "compiling") return (
    <div className="bg-card/50 border border-white/10 rounded-2xl overflow-hidden">
      <div className="border-b border-white/8 px-5 py-3.5 flex items-center gap-2">
        <Loader2 className="w-4 h-4 text-primary animate-spin"/> <p className="font-bold text-white text-sm">Compilando...</p>
      </div>
      <div className="p-8 text-center">
        <div className="relative inline-flex mb-5">
          <div className="w-16 h-16 rounded-full border-4 border-white/8 border-t-primary animate-spin"/>
          <Hammer className="absolute inset-0 m-auto w-7 h-7 text-primary"/>
        </div>
        <p className="font-semibold text-white mb-1">Forjando seu mod...</p>
        <p className="text-sm text-muted-foreground mb-5">2–5 minutos (primeira vez pode ser mais)</p>
        {jobLog && <div className="bg-[#060912] rounded-xl border border-white/8 p-3 max-h-32 overflow-y-auto text-left">
          <pre className="text-xs font-mono text-muted-foreground/60 whitespace-pre-wrap">{jobLog}</pre>
        </div>}
      </div>
    </div>
  );

  if (jobStatus === "ready") return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
      className="bg-card/50 border border-emerald-500/30 rounded-2xl overflow-hidden">
      <div className="border-b border-emerald-500/20 px-5 py-3.5 bg-emerald-500/8 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-400"/> <p className="font-bold text-white text-sm">Pronto para baixar!</p>
      </div>
      <div className="p-8 text-center">
        <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4"/>
        <p className="font-bold text-xl text-white mb-2">Compilado com sucesso!</p>
        <p className="text-muted-foreground text-sm mb-6">Seu mod está pronto</p>
        <Button onClick={handleDownload} disabled={dlLoading}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 h-12 rounded-xl gap-2 mb-3">
          {dlLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-5 h-5"/>}
          {dlLoading ? "Baixando..." : "Baixar .jar do Mod"}
        </Button>
        {dlErr && <p className="text-red-400 text-xs mb-4">{dlErr} — <button onClick={reset} className="underline text-primary">Recompilar</button></p>}
        <div className="bg-white/3 border border-white/8 rounded-xl p-4 text-left mt-4">
          <p className="text-xs font-semibold text-white mb-2">Como instalar:</p>
          <ol className="text-xs text-muted-foreground space-y-1.5">
            <li className="flex gap-2"><span className="text-primary font-bold">1.</span>Baixe o .jar acima</li>
            <li className="flex gap-2"><span className="text-primary font-bold">2.</span>Abra PojavLauncher ou MojoLauncher</li>
            <li className="flex gap-2"><span className="text-primary font-bold">3.</span>Copie para a pasta <code className="text-primary">mods/</code></li>
            <li className="flex gap-2"><span className="text-primary font-bold">4.</span>Inicie Minecraft com Fabric instalado</li>
          </ol>
        </div>
        <p className="text-xs text-muted-foreground/40 mt-4">Arquivo disponível por 1 hora no servidor</p>
        <Button onClick={reset} variant="ghost" className="mt-3 text-muted-foreground hover:text-white gap-2 text-sm">
          <RefreshCw className="w-3.5 h-3.5"/> Compilar outro mod
        </Button>
      </div>
    </motion.div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="bg-card/50 border border-red-500/25 rounded-2xl overflow-hidden">
      <div className="border-b border-red-500/20 px-5 py-3.5 bg-red-500/8 flex items-center gap-2">
        <XCircle className="w-4 h-4 text-red-400"/> <p className="font-bold text-white text-sm">Erro na compilação</p>
      </div>
      <div className="p-5">
        <div className="bg-[#060912] rounded-xl border border-red-500/15 p-4 mb-4 max-h-40 overflow-y-auto">
          <pre className="text-xs font-mono text-red-400 whitespace-pre-wrap">{jobError}</pre>
        </div>
        <div className="flex gap-2 mb-4">
          <CopyBtn text={`Corrija este erro de compilação do meu mod Minecraft:\n\n${jobError}\n\nMod deve fazer: ${modData.description || "(não informado)"}\n\nDê o código corrigido completo.`} label="Copiar prompt de correção"/>
        </div>
        <div className="flex gap-2">
          <Button onClick={reset} variant="outline" className="flex-1 h-11 rounded-xl border-white/15">
            <RefreshCw className="w-4 h-4 mr-2"/> Tentar novamente
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Compile choice (auto vs manual) ──────────────────────────────────────────
type CV = "choice"|"auto"|"manual";
type MT = "termux"|"pc"|null;

function CompileSection({ modData }: { modData: { type: string; version: string; description: string } }) {
  const [view, setView] = useState<CV>("choice");
  const [manual, setManual] = useState<MT>(null);
  const [errTxt, setErrTxt] = useState("");
  const [fixPrompt, setFixPrompt] = useState("");
  const isJVM = ["fabric","forge","neoforge","spigot","cobblemon"].includes(modData.type);

  if (view === "choice") return (
    <div className="bg-card/50 border border-white/10 rounded-2xl overflow-hidden mt-4">
      <div className="border-b border-white/8 px-5 py-3.5 bg-primary/5 flex items-center gap-2">
        <Hammer className="w-4 h-4 text-primary"/>
        <p className="font-bold text-white text-sm">Como quer compilar?</p>
      </div>
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {isJVM ? (
          <button onClick={() => setView("auto")}
            className="rounded-xl p-5 border border-primary/30 bg-primary/8 text-left hover:bg-primary/15 transition-all">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-primary"/>
              <span className="text-xs bg-primary/20 text-primary rounded-full px-2 py-0.5 font-bold">RECOMENDADO</span>
            </div>
            <h3 className="font-semibold text-white text-sm mb-1">Compilar automaticamente</h3>
            <p className="text-xs text-muted-foreground">Cole os arquivos, baixe o .jar em 2–5 min</p>
          </button>
        ) : (
          <div className="rounded-xl p-5 border border-white/8 bg-white/2 opacity-60 cursor-not-allowed text-left">
            <Zap className="w-5 h-5 text-muted-foreground mb-3"/>
            <h3 className="font-semibold text-muted-foreground text-sm mb-1">Compilação automática</h3>
            <p className="text-xs text-muted-foreground/60">
              {modData.type === "bedrock" ? "Bedrock não precisa compilar"
               : modData.type === "datapack" ? "Datapack → faça um .zip dos arquivos"
               : modData.type === "resourcepack" ? "Resource Pack → compacte em .zip"
               : "Indisponível para este tipo"}
            </p>
          </div>
        )}
        <button onClick={() => setView("manual")}
          className="rounded-xl p-5 border border-white/10 bg-white/2 text-left hover:border-primary/20 hover:bg-white/5 transition-all">
          <BookOpen className="w-5 h-5 text-muted-foreground mb-3"/>
          <h3 className="font-semibold text-white text-sm mb-1">Tutorial manual</h3>
          <p className="text-xs text-muted-foreground">Termux (celular) ou PC com IntelliJ</p>
        </button>
      </div>
    </div>
  );

  if (view === "auto") return (
    <div className="mt-4">
      <Button variant="ghost" onClick={() => setView("choice")} className="text-muted-foreground hover:text-white gap-1.5 mb-3 text-xs">← Voltar</Button>
      <AutoCompile modData={modData} />
    </div>
  );

  return (
    <div className="mt-4">
      <Button variant="ghost" onClick={() => setView("choice")} className="text-muted-foreground hover:text-white gap-1.5 mb-3 text-xs">← Voltar</Button>
      <div className="bg-card/50 border border-white/10 rounded-2xl overflow-hidden mb-4">
        <div className="border-b border-white/8 px-5 py-3.5 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary"/> <p className="font-bold text-white text-sm">Tutorial manual</p>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { id:"termux" as MT, icon: Smartphone, title:"Termux (Android)", sub:"Gratuito, funciona no celular" },
            { id:"pc"     as MT, icon: Monitor,    title:"PC (IntelliJ)",    sub:"Mais fácil de depurar"        },
          ].map(o => (
            <button key={o.id} onClick={() => setManual(o.id)}
              className={`rounded-xl p-4 border text-left transition-all ${manual === o.id ? "border-primary bg-primary/10" : "border-white/10 bg-white/2 hover:border-primary/30"}`}>
              <o.icon className={`w-5 h-5 mb-2 ${manual === o.id ? "text-primary" : "text-muted-foreground"}`}/>
              <p className="font-semibold text-white text-sm">{o.title}</p>
              <p className="text-xs text-muted-foreground">{o.sub}</p>
            </button>
          ))}
        </div>
        <AnimatePresence>
          {manual && (
            <motion.div initial={{ height:0,opacity:0 }} animate={{ height:"auto",opacity:1 }} exit={{ height:0,opacity:0 }} className="overflow-hidden">
              <div className="px-5 pb-5 space-y-4 border-t border-white/8 pt-4">
                {(manual === "termux" ? [
                  { n:1, t:"Instalar Termux (F-Droid)", c:<a href="https://f-droid.org/packages/com.termux/" target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">f-droid.org <ChevronRight className="w-3 h-3"/></a>},
                  { n:2, t:"Instalar Java 21",          c:<div className="bg-[#060912] rounded-xl border border-white/8 p-3"><pre className="text-xs font-mono text-emerald-400">pkg update -y && pkg install openjdk-21 -y</pre><CopyBtn text="pkg update -y && pkg install openjdk-21 -y"/></div>},
                  { n:3, t:"Instalar Gradle 8.12",      c:<div className="bg-[#060912] rounded-xl border border-white/8 p-3"><pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap">{"curl -L https://services.gradle.org/distributions/gradle-8.12-bin.zip -o g.zip\nunzip g.zip && export PATH=$PWD/gradle-8.12/bin:$PATH"}</pre></div>},
                  { n:4, t:"Compilar",                  c:<div className="bg-[#060912] rounded-xl border border-white/8 p-3"><pre className="text-xs font-mono text-emerald-400">cd meumod && gradle build</pre><CopyBtn text="cd meumod && gradle build"/></div>},
                  { n:5, t:"Instalar o .jar",            c:<p className="text-xs text-muted-foreground">Arquivo em <code className="text-primary">build/libs/</code>. Copie para <code className="text-primary">mods/</code>.</p>},
                ] : [
                  { n:1, t:"Baixar Java 21",        c:<a href="https://adoptium.net/" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">adoptium.net</a>},
                  { n:2, t:"Baixar IntelliJ IDEA",  c:<a href="https://www.jetbrains.com/idea/download/" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">jetbrains.com/idea/download</a>},
                  { n:3, t:"Baixar Fabric MDK",     c:<a href="https://fabricmc.net/develop/" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">fabricmc.net/develop</a>},
                  { n:4, t:"Substituir os arquivos",c:<p className="text-xs text-muted-foreground">Cole os arquivos em <code className="text-primary">src/main/java/</code></p>},
                  { n:5, t:"Compilar",              c:<div className="bg-[#060912] rounded-xl border border-white/8 p-3"><pre className="text-xs font-mono text-emerald-400">./gradlew build</pre></div>},
                  { n:6, t:"Instalar o .jar",       c:<p className="text-xs text-muted-foreground">Arquivo em <code className="text-primary">build/libs/</code>. Copie para <code className="text-primary">mods/</code>.</p>},
                ]).map(s => (
                  <div key={s.n} className="pl-8 relative">
                    <div className="absolute left-0 top-0 w-6 h-6 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-[10px] font-bold text-primary">{s.n}</div>
                    <p className="font-semibold text-white text-sm mb-1.5">{s.t}</p>
                    {s.c}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {manual && (
        <div className="bg-card/50 border border-white/10 rounded-2xl overflow-hidden">
          <div className="border-b border-white/8 px-5 py-3 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-amber-400"/>
            <p className="font-semibold text-white text-sm">Deu erro? Corrija com IA</p>
          </div>
          <div className="p-5">
            <Textarea value={errTxt} onChange={e => setErrTxt(e.target.value)}
              placeholder={"Cole o erro do terminal aqui..."}
              className="min-h-[100px] bg-[#060912] border-white/10 font-mono text-sm text-red-400 placeholder:text-muted-foreground/30 rounded-xl mb-3"/>
            <Button onClick={() => setFixPrompt(`Corrija este erro Minecraft mod:\n\n${errTxt.trim()}\n\nMod deve fazer: ${modData.description || "não informado"}\n\nDê o código corrigido completo.`)}
              disabled={!errTxt.trim()}
              className="w-full h-11 rounded-xl bg-amber-500 hover:bg-amber-500/90 text-black font-bold gap-2 disabled:opacity-40 mb-3">
              <RefreshCw className="w-4 h-4"/> Gerar prompt de correção
            </Button>
            {fixPrompt && (
              <div className="bg-[#060912] rounded-xl border border-emerald-500/25 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-emerald-500/20 bg-emerald-500/5">
                  <span className="text-xs text-emerald-400 font-semibold">Cole na IA</span>
                  <CopyBtn text={fixPrompt}/>
                </div>
                <pre className="p-3 text-xs font-mono text-emerald-400 whitespace-pre-wrap max-h-48 overflow-y-auto">{fixPrompt}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── ForgeAI tab (direct AI creation) ─────────────────────────────────────────
type AIState = "idle"|"generating"|"compiling"|"ready"|"error"|"no-key";

function ForgeAI() {
  const [description, setDescription] = useState("");
  const [loader, setLoader]           = useState("fabric");
  const [version, setVersion]         = useState("1.20.4");
  const [state, setState]             = useState<AIState>("idle");
  const [jobId, setJobId]             = useState<string|null>(null);
  const [error, setError]             = useState("");
  const [log, setLog]                 = useState("");
  const [noKeyMsg, setNoKeyMsg]       = useState("");
  const [dlLoading, setDlLoad]        = useState(false);
  const [dlErr, setDlErr]             = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const stopPoll = useCallback(() => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } }, []);

  useEffect(() => {
    if (state !== "compiling" || !jobId) return stopPoll();
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${COMPILE_SERVER}/status/${jobId}`);
        const d = await r.json();
        setLog(d.log ?? "");
        if (d.status === "ready") { setState("ready"); updateEntry(jobId, { status: "ready" }); stopPoll(); }
        else if (d.status === "error") { setState("error"); setError(d.error ?? "Erro de compilação."); updateEntry(jobId, { status: "error" }); stopPoll(); }
      } catch {}
    }, 4000);
    return stopPoll;
  }, [state, jobId, stopPoll]);

  const create = async () => {
    if (!description.trim()) return;
    setState("generating"); setError(""); setLog(""); setDlErr("");

    try {
      // 1. Generate files with AI
      const genRes = await fetch(`${COMPILE_SERVER}/gerar-mod`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim(), version, loader }),
      });
      const genData = await genRes.json();

      if (genRes.status === 503 && genData.setup) {
        setState("no-key");
        setNoKeyMsg(genData.error ?? "ForgeAI não configurado.");
        return;
      }
      if (!genRes.ok) throw new Error(genData.error ?? "Erro ao gerar código.");

      // 2. Compile
      setState("compiling");
      const compRes = await fetch(`${COMPILE_SERVER}/compilar`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: genData.files, version, loader }),
      });
      const compData = await compRes.json();
      if (!compRes.ok) throw new Error(compData.error ?? "Erro ao compilar.");
      setJobId(compData.jobId);
      saveEntry({ jobId: compData.jobId, modName: `mod-${loader}-${Date.now()}`, version, loader, status: "compiling", createdAt: Date.now() });

    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    }
  };

  const handleDownload = async () => {
    if (!jobId) return;
    setDlLoad(true); setDlErr("");
    try { await downloadJar(jobId, `modforge-${loader}-${version}.jar`); }
    catch (e) { setDlErr(e instanceof Error ? e.message : "Erro ao baixar."); }
    finally { setDlLoad(false); }
  };

  const reset = () => { stopPoll(); setState("idle"); setJobId(null); setError(""); setLog(""); setDlErr(""); };

  return (
    <div className="flex flex-col gap-4">

      {/* Input form (always visible) */}
      {state === "idle" && (
        <motion.div initial={{ opacity:0,y:10 }} animate={{ opacity:1,y:0 }}
          className="bg-card/50 border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/8 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary"/>
            <p className="font-bold text-white text-sm">ForgeAI — Criação com Inteligência Artificial</p>
            <span className="ml-auto text-[10px] bg-primary/20 text-primary border border-primary/30 rounded-full px-2 py-0.5 font-bold">BETA</span>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-2">Descreva o seu mod em detalhes:</label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Ex: Quero um mod de Fabric para Minecraft 1.20.4 que adiciona uma espada de esmeralda que causa efeito de fogo nos inimigos por 5 segundos, tem durabilidade dobrada e pode ser fabricada com 2 esmeraldas e 1 vara."
                className="min-h-[130px] bg-[#060912] border-white/10 text-sm text-white placeholder:text-muted-foreground/30 rounded-xl resize-none"/>
              <p className="text-[11px] text-muted-foreground mt-1">Quanto mais detalhes, melhor o resultado. Mencione itens, efeitos, comandos, etc.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Loader</label>
                <select value={loader} onChange={e => { setLoader(e.target.value); setVersion(VERSIONS[e.target.value]?.[0] ?? "1.20.4"); }}
                  className="w-full h-10 px-3 rounded-xl bg-[#060912] border border-white/12 text-white text-sm focus:border-primary/50 outline-none">
                  {MOD_TYPES.filter(m => ["fabric","forge","neoforge","spigot","cobblemon"].includes(m.id)).map(m => (
                    <option key={m.id} value={m.id}>{m.emoji} {m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Versão</label>
                <select value={version} onChange={e => setVersion(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#060912] border border-white/12 text-white text-sm focus:border-primary/50 outline-none">
                  {(VERSIONS[loader] ?? VERSIONS.fabric).map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
            <Button onClick={create} disabled={!description.trim()}
              className="w-full h-13 rounded-xl bg-gradient-to-r from-primary to-emerald-400 hover:opacity-90 text-black font-bold gap-2 text-base disabled:opacity-40 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              <Wand2 className="w-5 h-5"/> Criar e Compilar Automaticamente
            </Button>
          </div>
        </motion.div>
      )}

      {/* No API Key */}
      {state === "no-key" && (
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
          className="bg-card/50 border border-amber-500/30 rounded-2xl overflow-hidden">
          <div className="border-b border-amber-500/20 px-5 py-3.5 bg-amber-500/8 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400"/>
            <p className="font-bold text-white text-sm">ForgeAI precisa ser configurado</p>
          </div>
          <div className="p-5">
            <p className="text-sm text-muted-foreground mb-4">{noKeyMsg}</p>
            <div className="bg-[#060912] border border-white/10 rounded-xl p-4 mb-4 text-sm text-white">
              <p className="font-semibold mb-3">Para ativar o ForgeAI:</p>
              <ol className="space-y-2 text-muted-foreground">
                <li className="flex gap-2"><span className="text-primary font-bold">1.</span>
                  <span>Acesse <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">aistudio.google.com/apikey</a> e crie uma chave gratuita</span>
                </li>
                <li className="flex gap-2"><span className="text-primary font-bold">2.</span>
                  <span>No Railway, vá em Variables → New Variable</span>
                </li>
                <li className="flex gap-2"><span className="text-primary font-bold">3.</span>
                  <span>Adicione: <code className="text-primary bg-primary/10 px-1 rounded">GEMINI_API_KEY</code> = sua chave</span>
                </li>
                <li className="flex gap-2"><span className="text-primary font-bold">4.</span>
                  <span>Redeploy o serviço e tente novamente</span>
                </li>
              </ol>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Enquanto isso, use o <strong className="text-white">ForgeBot</strong> para gerar o prompt e compilar manualmente.</p>
            <Button onClick={reset} variant="outline" className="w-full h-11 rounded-xl border-white/15">Tentar novamente</Button>
          </div>
        </motion.div>
      )}

      {/* Generating */}
      {state === "generating" && (
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
          className="bg-card/50 border border-primary/25 rounded-2xl overflow-hidden">
          <div className="p-10 text-center">
            <div className="relative inline-flex mb-5">
              <div className="w-20 h-20 rounded-full border-4 border-white/8 border-t-primary animate-spin"/>
              <Sparkles className="absolute inset-0 m-auto w-9 h-9 text-primary"/>
            </div>
            <p className="font-bold text-xl text-white mb-2">ForgeAI está gerando seu mod...</p>
            <p className="text-muted-foreground text-sm">15–30 segundos</p>
          </div>
        </motion.div>
      )}

      {/* Compiling */}
      {state === "compiling" && (
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
          className="bg-card/50 border border-primary/25 rounded-2xl overflow-hidden">
          <div className="p-8 text-center">
            <div className="relative inline-flex mb-5">
              <div className="w-18 h-18 rounded-full border-4 border-white/8 border-t-primary animate-spin"/>
              <Hammer className="absolute inset-0 m-auto w-8 h-8 text-primary"/>
            </div>
            <p className="font-bold text-xl text-white mb-2">Compilando...</p>
            <p className="text-muted-foreground text-sm mb-4">2–5 minutos (primeira vez pode ser mais)</p>
            {log && <div className="bg-[#060912] rounded-xl border border-white/8 p-3 max-h-32 overflow-y-auto text-left">
              <pre className="text-xs font-mono text-muted-foreground/60 whitespace-pre-wrap">{log}</pre>
            </div>}
          </div>
        </motion.div>
      )}

      {/* Ready */}
      {state === "ready" && (
        <motion.div initial={{ opacity:0, scale:0.97 }} animate={{ opacity:1, scale:1 }}
          className="bg-card/50 border border-emerald-500/30 rounded-2xl overflow-hidden">
          <div className="border-b border-emerald-500/20 px-5 py-3.5 bg-emerald-500/8 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400"/>
            <p className="font-bold text-white text-sm">🎉 Mod criado e compilado!</p>
          </div>
          <div className="p-8 text-center">
            <div className="text-6xl mb-4">🎮</div>
            <p className="font-bold text-2xl text-white mb-2">Seu mod está pronto!</p>
            <p className="text-muted-foreground text-sm mb-8">A IA criou o código e o servidor compilou automaticamente</p>
            <Button onClick={handleDownload} disabled={dlLoading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-10 h-13 rounded-xl gap-2 text-base shadow-[0_0_20px_rgba(16,185,129,0.3)] mb-3">
              {dlLoading ? <Loader2 className="w-5 h-5 animate-spin"/> : <Download className="w-5 h-5"/>}
              {dlLoading ? "Baixando..." : "Baixar .jar do Mod"}
            </Button>
            {dlErr && <p className="text-red-400 text-xs mb-3">{dlErr} — <button onClick={() => { reset(); }} className="underline text-primary">Criar novamente</button></p>}
            <Button onClick={reset} variant="ghost" className="mt-2 text-muted-foreground hover:text-white gap-2 text-sm">
              <RefreshCw className="w-3.5 h-3.5"/> Criar outro mod
            </Button>
          </div>
        </motion.div>
      )}

      {/* Error */}
      {state === "error" && (
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
          className="bg-card/50 border border-red-500/25 rounded-2xl overflow-hidden">
          <div className="border-b border-red-500/20 px-5 py-3.5 bg-red-500/8 flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-400"/> <p className="font-bold text-white text-sm">Erro</p>
          </div>
          <div className="p-5">
            <div className="bg-[#060912] rounded-xl border border-red-500/15 p-4 mb-4 max-h-40 overflow-y-auto">
              <pre className="text-xs font-mono text-red-400 whitespace-pre-wrap">{error}</pre>
            </div>
            <Button onClick={reset} variant="outline" className="w-full h-11 rounded-xl border-white/15">
              <RefreshCw className="w-4 h-4 mr-2"/> Tentar novamente
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ── ForgeBot chat types & data ────────────────────────────────────────────────
type Message = {
  id: string; sender: "bot"|"user";
  type: "text"|"options"|"prompt"|"ai_links"|"warning";
  content: string; options?: string[]; prompt?: string;
};
type ModData = { type: string; version: string; description: string; extras: string };
type CV2 = "choice"|"auto"|"manual";

// ── Message bubble ────────────────────────────────────────────────────────────
function Bubble({ msg, onOption, onProceed, onAI }: {
  msg: Message; onOption:(o:string)=>void; onProceed:()=>void; onAI:()=>void;
}) {
  const isBot = msg.sender === "bot";
  const [editedPrompt, setEdited] = useState(msg.prompt ?? "");
  const [editing, setEditing]     = useState(false);
  const [copied, setCopied]       = useState(false);
  const copy = async () => { await navigator.clipboard.writeText(editedPrompt); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <motion.div initial={{ opacity:0,y:12 }} animate={{ opacity:1,y:0 }}
      className={`flex w-full ${isBot ? "justify-start" : "justify-end"}`}>
      <div className={`max-w-[88%] md:max-w-[78%]`}>
        {(msg.type === "text" || msg.type === "warning") && (
          <div className={`${isBot
            ? `bg-card/80 border border-white/8 rounded-2xl rounded-tl-sm border-l-2 ${msg.type==="warning" ? "border-l-amber-500" : "border-l-primary"}`
            : "bg-primary/20 border border-primary/20 rounded-2xl rounded-tr-sm"} px-4 py-3 text-sm leading-relaxed`}>
            {msg.type === "warning" && <AlertTriangle className="w-4 h-4 text-amber-400 inline mr-1.5 -mt-0.5"/>}
            {msg.content}
          </div>
        )}
        {msg.type === "options" && (
          <div className="bg-card/80 border-l-2 border-l-primary border border-white/8 rounded-2xl rounded-tl-sm px-4 py-3">
            <p className="text-sm leading-relaxed mb-3">{msg.content}</p>
            <div className="flex flex-col gap-2">
              {msg.options?.map(o => (
                <Button key={o} onClick={() => onOption(o)} variant="outline"
                  className="h-10 rounded-xl justify-start border-white/12 text-sm hover:border-primary/40 hover:text-primary text-left">
                  {o}
                </Button>
              ))}
            </div>
          </div>
        )}
        {msg.type === "prompt" && (
          <div className="bg-card/80 border-l-2 border-l-primary border border-white/8 rounded-2xl rounded-tl-sm overflow-hidden w-full max-w-[88vw]">
            <div className="px-4 py-3 border-b border-white/8"><p className="text-sm">{msg.content}</p></div>
            <div className="bg-[#060912] relative">
              <div className="absolute top-2 right-2 flex items-center gap-1.5 text-[10px] text-muted-foreground/60 bg-white/5 border border-white/10 rounded px-2 py-1">
                <Code className="w-3 h-3"/>PROMPT
              </div>
              {editing
                ? <Textarea value={editedPrompt} onChange={e => setEdited(e.target.value)} className="min-h-[260px] w-full bg-transparent border-0 font-mono text-sm text-emerald-400 focus-visible:ring-0 p-4 pt-8 resize-y"/>
                : <pre className="p-4 pt-8 text-sm font-mono text-emerald-400 whitespace-pre-wrap overflow-x-auto max-h-72 overflow-y-auto leading-relaxed">{editedPrompt}</pre>}
            </div>
            <div className="p-3 bg-white/2 flex gap-2">
              <Button variant="outline" onClick={() => setEditing(!editing)} className="flex-1 h-11 rounded-xl border-white/15 text-sm">{editing?"Salvar":"Editar"}</Button>
              <Button onClick={() => { copy(); if (!editing) onProceed(); }}
                className={`flex-1 h-11 rounded-xl font-medium text-sm ${copied?"bg-emerald-600 text-white":"bg-primary text-black"}`}>
                {copied ? <><Check className="w-4 h-4 mr-1.5"/>Copiado!</> : <><Copy className="w-4 h-4 mr-1.5"/>Copiar Prompt</>}
              </Button>
            </div>
          </div>
        )}
        {msg.type === "ai_links" && (
          <div className="bg-card/80 border-l-2 border-l-primary border border-white/8 rounded-2xl rounded-tl-sm px-4 py-3">
            <p className="text-sm mb-3">{msg.content}</p>
            <div className="flex flex-col sm:flex-row gap-2">
              {[
                { href:"https://claude.ai",         label:"Claude",  color:"hover:text-amber-300"  },
                { href:"https://chat.openai.com",   label:"ChatGPT", color:"hover:text-emerald-400"},
                { href:"https://gemini.google.com", label:"Gemini",  color:"hover:text-blue-400"   },
              ].map(({ href, label, color }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" onClick={onAI} className="flex-1">
                  <Button variant="outline" className={`w-full h-12 rounded-xl border-white/15 bg-white/3 font-semibold ${color}`}>{label}</Button>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── ForgeBot tab ──────────────────────────────────────────────────────────────
function ForgeBot() {
  const [msgs, setMsgs]           = useState<Message[]>([]);
  const [step, setStep]           = useState(0);
  const [modData, setModData]     = useState<ModData>({ type:"", version:"", description:"", extras:"" });
  const [inputVal, setInputVal]   = useState("");
  const [isTyping, setIsTyping]   = useState(false);
  const [showCompile, setShowC]   = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);
  const compileRef = useRef<HTMLDivElement>(null);

  const scrollDown = () => setTimeout(() => chatEnd.current?.scrollIntoView({ behavior:"smooth" }), 50);
  useEffect(() => { scrollDown(); }, [msgs, isTyping]);

  const bot = (msg: Omit<Message,"id"|"sender">, delay = 700) => {
    setIsTyping(true);
    setTimeout(() => { setIsTyping(false); setMsgs(p => [...p, { ...msg, id: crypto.randomUUID(), sender:"bot" }]); }, delay);
  };
  const user = (content: string) =>
    setMsgs(p => [...p, { id: crypto.randomUUID(), sender:"user", type:"text", content }]);

  useEffect(() => {
    if (step === 0) {
      bot({ type:"options", content:"Olá! Sou o ForgeBot 🤖 Que tipo de mod você quer criar?",
        options: MOD_TYPES.map(m => `${m.emoji} ${m.label} — ${m.desc}`) }, 400);
      setStep(1);
    }
  }, []);

  const generatePrompt = (data: ModData) => {
    setStep(5);
    const type = MOD_TYPES.find(m => m.id === data.type);
    const prompt = `Crie um mod de Minecraft para ${type?.label ?? data.type} versão ${data.version}.

O mod deve fazer:
${data.description}

Funcionalidades extras:
${data.extras || "Nenhuma especificada"}

Requisitos:
- Mod Loader: ${type?.label ?? data.type}
- Versão: ${data.version}
- Linguagem: Java${data.type === "bedrock" ? " / JavaScript" : ""}
- Código completo, comentado em português
- Package: com.modforge.mod
- Mod ID: modforge_mod

Gere TODOS os arquivos:
1. Arquivo principal .java
2. Arquivo Client .java (se necessário)
3. fabric.mod.json (ou mods.toml para Forge/NeoForge)
4. build.gradle completo com dependências corretas para ${data.version}
5. gradle.properties
6. settings.gradle

Use versões EXATAS e corretas das dependências para evitar erros de compilação.

---
Gerado pelo ModForge — site gratuito para criar mods de Minecraft pelo celular.`;

    bot({ type:"prompt", content:"✅ Seu prompt está pronto! Copie e cole em uma IA:", prompt });
  };

  const handleOption = (opt: string) => {
    user(opt);
    if (step === 1) {
      const found = MOD_TYPES.find(m => opt.startsWith(m.emoji) || opt.toLowerCase().includes(m.id));
      const type = found?.id ?? "fabric";
      setModData(p => ({ ...p, type }));
      bot({ type:"options", content:"Versão do Minecraft?", options: VERSIONS[type] ?? VERSIONS.fabric });
      setStep(2);
    } else if (step === 2) {
      setModData(p => ({ ...p, version: opt }));
      bot({ type:"text", content:"Descreva o mod. Quanto mais detalhes, melhor!" });
      setStep(3);
    } else if (step === 4) {
      const extras = opt;
      const data = { ...modData, extras };
      setModData(data);
      generatePrompt(data);
    }
  };

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputVal.trim() || step !== 3) return;
    user(inputVal);
    setModData(p => ({ ...p, description: inputVal }));
    setInputVal("");
    bot({ type:"options", content:"Funcionalidades extras?", options: EXTRAS });
    setStep(4);
  };

  const showAI = () => {
    if (step >= 6) return;
    setStep(6);
    bot({ type:"ai_links", content:"Abra uma dessas IAs, cole o prompt e aguarde:" });
  };

  const showComp = () => {
    if (step < 6) { setStep(6); bot({ type:"ai_links", content:"Abra uma IA, cole o prompt e depois volte aqui:" }); }
    bot({ type:"text", content:"Depois que a IA gerar os arquivos, use a opção de compilar abaixo! 🎉" }, 500);
    setStep(8);
    setTimeout(() => { setShowC(true); setTimeout(() => compileRef.current?.scrollIntoView({ behavior:"smooth" }), 300); }, 1200);
  };

  const reset = () => { setMsgs([]); setStep(0); setModData({ type:"",version:"",description:"",extras:"" }); setInputVal(""); setShowC(false); };

  return (
    <>
      <div className="bg-card/60 border border-white/8 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[calc(100vh-210px)] min-h-[450px]">
        <div className="h-13 border-b border-white/8 bg-card/80 flex items-center px-4 justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-8 h-8 bg-primary/15 rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary"/>
              </div>
              <div className="absolute bottom-0 right-0 w-2 h-2 bg-primary border-2 border-card rounded-full"/>
            </div>
            <div>
              <p className="font-semibold text-white text-sm">ForgeBot</p>
              <p className="text-[10px] text-primary/80">Online · Gratuito</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={reset} className="text-muted-foreground hover:text-white w-8 h-8">
            <RotateCcw className="w-4 h-4"/>
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <AnimatePresence initial={false}>
            {msgs.map(m => <Bubble key={m.id} msg={m} onOption={handleOption} onProceed={showAI} onAI={showComp}/>)}
            {isTyping && (
              <motion.div initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }} className="flex justify-start">
                <div className="bg-card/80 border-l-2 border-l-primary border border-white/8 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1">
                  {[0,.2,.4].map(d => <motion.div key={d} className="w-2 h-2 bg-primary/50 rounded-full" animate={{ y:[0,-4,0] }} transition={{ repeat:Infinity, duration:0.6, delay:d }}/>)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {step >= 6 && !showCompile && (
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="flex justify-center py-2">
              <Button onClick={() => { setShowC(true); setTimeout(() => compileRef.current?.scrollIntoView({ behavior:"smooth" }), 200); }}
                className="bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 rounded-full px-5 py-2 text-sm gap-2">
                <Hammer className="w-4 h-4"/> Ver opções de compilação
              </Button>
            </motion.div>
          )}
          <div ref={chatEnd} className="h-1"/>
        </div>

        <div className="p-3 border-t border-white/8 bg-card/50 shrink-0">
          <form onSubmit={handleSend} className="flex gap-2">
            <Input value={inputVal} onChange={e => setInputVal(e.target.value)}
              placeholder={step === 3 ? "Ex: Uma espada que causa fogo nos inimigos..." : "Aguarde..."}
              disabled={step !== 3 || isTyping}
              className="flex-1 bg-white/5 border-white/12 h-11 rounded-xl text-sm"/>
            <Button type="submit" disabled={step !== 3 || !inputVal.trim() || isTyping}
              className="w-11 h-11 rounded-xl bg-primary hover:bg-primary/90 text-black shrink-0 disabled:opacity-40">
              <Send className="w-4 h-4"/>
            </Button>
          </form>
        </div>
      </div>

      <AnimatePresence>
        {showCompile && (
          <motion.div ref={compileRef} initial={{ opacity:0,y:20 }} animate={{ opacity:1,y:0 }}>
            <CompileSection modData={modData}/>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Main Create page ──────────────────────────────────────────────────────────
type MainTab = "forgeai"|"forgebot";

export default function Create() {
  const [tab, setTab] = useState<MainTab>("forgeai");

  return (
    <div className="min-h-screen bg-[#070a12] text-white">
      <div className="sticky top-0 z-20 bg-[#070a12]/95 backdrop-blur-xl border-b border-white/8 px-4 pt-4 pb-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex gap-2">
            <button onClick={() => setTab("forgeai")}
              className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl font-semibold text-sm transition-all ${
                tab === "forgeai"
                  ? "bg-primary/20 text-primary border border-primary/40"
                  : "bg-white/5 text-muted-foreground border border-white/10 hover:border-white/20"
              }`}>
              <Sparkles className="w-4 h-4"/> ForgeAI
              <span className="text-[10px] bg-primary/30 text-primary rounded-full px-1.5 py-0.5 font-bold">NOVO</span>
            </button>
            <button onClick={() => setTab("forgebot")}
              className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl font-semibold text-sm transition-all ${
                tab === "forgebot"
                  ? "bg-primary/20 text-primary border border-primary/40"
                  : "bg-white/5 text-muted-foreground border border-white/10 hover:border-white/20"
              }`}>
              <Bot className="w-4 h-4"/> ForgeBot
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        <AnimatePresence mode="wait">
          {tab === "forgeai" ? (
            <motion.div key="ai" initial={{ opacity:0,x:-20 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:20 }}>
              <ForgeAI/>
            </motion.div>
          ) : (
            <motion.div key="bot" initial={{ opacity:0,x:20 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-20 }}>
              <ForgeBot/>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
