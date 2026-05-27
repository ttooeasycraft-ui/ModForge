import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Clock, CheckCircle2, XCircle, RefreshCw, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const COMPILE_SERVER =
  ((import.meta.env.VITE_COMPILE_SERVER_URL as string | undefined) || "https://modforge-compile-production.up.railway.app")
    .replace(/\/$/, "");

type DownloadEntry = {
  jobId: string;
  modName: string;
  version: string;
  loader: string;
  status: "compiling" | "ready" | "error";
  createdAt: number;
  jarName?: string;
  error?: string;
};

const STORAGE_KEY = "modforge_downloads";

function loadHistory(): DownloadEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch { return []; }
}

function saveHistory(entries: DownloadEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 20)));
}

export { loadHistory, saveHistory };
export type { DownloadEntry };

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return "agora mesmo";
  if (mins < 60) return `há ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `há ${hrs}h`;
  return `há ${Math.floor(hrs / 24)} dias`;
}

export default function Downloads() {
  const [entries, setEntries] = useState<DownloadEntry[]>([]);

  useEffect(() => {
    setEntries(loadHistory());
    // poll compiling entries
    const interval = setInterval(async () => {
      const current = loadHistory();
      const compiling = current.filter(e => e.status === "compiling");
      if (!compiling.length) return;
      const updated = await Promise.all(current.map(async entry => {
        if (entry.status !== "compiling") return entry;
        try {
          const res = await fetch(`${COMPILE_SERVER}/status/${entry.jobId}`);
          const data = await res.json();
          if (data.status === "ready")  return { ...entry, status: "ready"  as const };
          if (data.status === "error")  return { ...entry, status: "error"  as const, error: data.error };
        } catch {}
        return entry;
      }));
      saveHistory(updated);
      setEntries(updated);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const clear = () => {
    localStorage.removeItem(STORAGE_KEY);
    setEntries([]);
  };

  const remove = (jobId: string) => {
    const updated = entries.filter(e => e.jobId !== jobId);
    saveHistory(updated);
    setEntries(updated);
  };

  return (
    <div className="min-h-screen bg-[#070a12] text-white">
      <div className="sticky top-0 z-20 bg-[#070a12]/95 backdrop-blur-xl border-b border-white/8 px-4 pt-4 pb-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="font-bold text-white text-lg">Meus Downloads</h1>
          {entries.length > 0 && (
            <Button onClick={clear} variant="ghost" size="sm" className="text-red-400 hover:text-red-300 gap-1.5">
              <Trash2 className="w-3.5 h-3.5" /> Limpar
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {entries.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="text-center py-24">
            <div className="text-6xl mb-6">📦</div>
            <p className="font-semibold text-white text-lg mb-2">Nenhum download ainda</p>
            <p className="text-muted-foreground text-sm mb-8 max-w-xs mx-auto">
              Quando você compilar um mod pelo site, ele vai aparecer aqui.
            </p>
            <a href="criar" className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-black font-bold px-6 h-11 rounded-xl text-sm transition-all">
              Criar meu primeiro mod
            </a>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground mb-4">{entries.length} mod{entries.length > 1 ? "s" : ""} compilado{entries.length > 1 ? "s" : ""}</p>
            <AnimatePresence>
              {entries.map(entry => (
                <motion.div key={entry.jobId}
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                  className={`bg-card/50 border rounded-2xl p-4 ${
                    entry.status === "ready"     ? "border-emerald-500/25"
                    : entry.status === "error"  ? "border-red-500/25"
                    : "border-white/8"
                  }`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      entry.status === "ready"    ? "bg-emerald-500/15"
                      : entry.status === "error" ? "bg-red-500/15"
                      : "bg-white/5"
                    }`}>
                      {entry.status === "ready"     ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                       : entry.status === "error"  ? <XCircle className="w-5 h-5 text-red-400" />
                       : <RefreshCw className="w-5 h-5 text-primary animate-spin" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <p className="font-semibold text-white text-sm truncate">{entry.modName}</p>
                        <span className="text-[10px] text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded capitalize">{entry.loader}</span>
                        <span className="text-[10px] text-muted-foreground">{entry.version}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Clock className="w-3 h-3 text-muted-foreground/50" />
                        <span className="text-[11px] text-muted-foreground">{timeAgo(entry.createdAt)}</span>
                        <span className={`ml-1 text-[10px] font-medium ${
                          entry.status === "ready"    ? "text-emerald-400"
                          : entry.status === "error" ? "text-red-400"
                          : "text-primary"
                        }`}>
                          {entry.status === "ready"    ? "Pronto"
                           : entry.status === "error" ? "Erro"
                           : "Compilando..."}
                        </span>
                      </div>
                      {entry.status === "error" && entry.error && (
                        <p className="text-xs text-red-400/80 mt-2 line-clamp-2">{entry.error.slice(0, 200)}</p>
                      )}
                    </div>
                    <button onClick={() => remove(entry.jobId)} className="text-muted-foreground/40 hover:text-red-400 transition-colors shrink-0 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {entry.status === "ready" && (
                    <div className="mt-3 pt-3 border-t border-white/5 flex gap-2">
                      <a href={`${COMPILE_SERVER}/baixar/${entry.jobId}`} download
                        className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold h-9 rounded-xl text-sm transition-colors">
                        <Download className="w-4 h-4" /> Baixar .jar
                      </a>
                      <a href={`https://modrinth.com`} target="_blank" rel="noopener noreferrer"
                        className="px-3 h-9 flex items-center justify-center border border-white/15 hover:border-white/30 rounded-xl text-muted-foreground hover:text-white transition-all">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
