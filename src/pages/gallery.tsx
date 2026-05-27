import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Download, Star, Filter, ExternalLink,
  TrendingUp, Zap, RefreshCw, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type ModrinthMod = {
  project_id: string; slug: string; title: string; description: string;
  icon_url?: string; downloads: number; follows: number; author: string;
  categories: string[]; versions: string[]; date_created: string; date_modified: string;
};

const LOADERS = ["all","fabric","forge","neoforge","quilt","spigot"] as const;
type LoaderId = typeof LOADERS[number];

const TABS = [
  { id: "downloads", label: "Mais Baixados", icon: TrendingUp },
  { id: "newest",    label: "Mais Novos",    icon: Zap        },
  { id: "updated",   label: "Atualizados",   icon: RefreshCw  },
] as const;
type TabId = typeof TABS[number]["id"];

const CAT_CLR: Record<string, string> = {
  optimization: "bg-green-500/15 text-green-400 border-green-500/25",
  utility:      "bg-blue-500/15 text-blue-400 border-blue-500/25",
  decoration:   "bg-pink-500/15 text-pink-400 border-pink-500/25",
  library:      "bg-purple-500/15 text-purple-400 border-purple-500/25",
  adventure:    "bg-amber-500/15 text-amber-400 border-amber-500/25",
  magic:        "bg-violet-500/15 text-violet-400 border-violet-500/25",
  technology:   "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
};

function fmt(n: number) {
  return n >= 1_000_000 ? `${(n/1e6).toFixed(1)}M`
       : n >= 1_000     ? `${(n/1e3).toFixed(0)}K`
       : String(n);
}

function ModCard({ mod, i }: { mod: ModrinthMod; i: number }) {
  const cats = mod.categories.filter(c => !LOADERS.includes(c as LoaderId)).slice(0, 2);
  return (
    <motion.a href={`https://modrinth.com/mod/${mod.slug}`} target="_blank" rel="noopener noreferrer"
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.035 }}
      whileHover={{ y: -3, transition: { duration: 0.12 } }}
      className="bg-card/50 border border-white/8 rounded-2xl p-4 flex flex-col gap-3 hover:border-primary/30 hover:bg-card/80 transition-colors group cursor-pointer">
      <div className="flex items-start gap-3">
        {mod.icon_url
          ? <img src={mod.icon_url} alt={mod.title} className="w-12 h-12 rounded-xl object-cover shrink-0 bg-white/5" />
          : <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-xl shrink-0">🧩</div>}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white text-sm truncate group-hover:text-primary transition-colors">{mod.title}</h3>
          <p className="text-[11px] text-muted-foreground">por {mod.author}</p>
        </div>
        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0 group-hover:text-primary/50 transition-colors" />
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{mod.description}</p>
      <div className="flex flex-wrap gap-1">
        {cats.map(c => (
          <span key={c} className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${CAT_CLR[c] ?? "bg-white/5 text-white/40 border-white/10"}`}>{c}</span>
        ))}
        {mod.versions.slice(-1).map(v => (
          <span key={v} className="text-[10px] px-1.5 py-0.5 rounded border bg-primary/8 text-primary/70 border-primary/20">{v}</span>
        ))}
      </div>
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground border-t border-white/5 pt-2 mt-auto">
        <span className="flex items-center gap-1"><Download className="w-3 h-3" />{fmt(mod.downloads)}</span>
        <span className="flex items-center gap-1"><Star className="w-3 h-3" />{fmt(mod.follows)}</span>
        <span className="ml-auto opacity-60 text-[10px]">{new Date(mod.date_modified).toLocaleDateString("pt-BR")}</span>
      </div>
    </motion.a>
  );
}

export default function Gallery() {
  const [tabIndex, setTabIndex] = useState(0);
  const tab = TABS[tabIndex].id as TabId;
  const [loader, setLoader] = useState<LoaderId>("fabric");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartX = useRef(0);

  const handleSearch = (v: string) => {
    setSearch(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(v), 500);
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["modrinth", tab, loader, debouncedSearch],
    queryFn: async () => {
      const facets: string[][] = [["project_type:mod"]];
      if (loader !== "all") facets.push([`categories:${loader}`]);
      const url = new URL("https://api.modrinth.com/v2/search");
      url.searchParams.set("limit", "24");
      url.searchParams.set("index", tab);
      if (debouncedSearch) url.searchParams.set("query", debouncedSearch);
      url.searchParams.set("facets", JSON.stringify(facets));
      const r = await fetch(url.toString(), { headers: { "User-Agent": "ModForge/2.0" } });
      if (!r.ok) throw new Error("Erro ao buscar mods");
      return r.json() as Promise<{ hits: ModrinthMod[]; total_hits: number }>;
    },
  });

  const mods = data?.hits ?? [];

  const goTab = (dir: number) => {
    setTabIndex(i => Math.max(0, Math.min(TABS.length - 1, i + dir)));
  };

  return (
    <div className="min-h-screen bg-[#070a12] text-white">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-[#070a12]/95 backdrop-blur-xl border-b border-white/8 px-4 pt-4 pb-2">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <h1 className="font-bold text-white text-lg flex-1">Galeria de Mods</h1>
            <button onClick={() => setShowFilters(p => !p)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                showFilters ? "border-primary bg-primary/15 text-primary" : "border-white/15 text-muted-foreground hover:border-white/30"
              }`}>
              <Filter className="w-3.5 h-3.5" /> Filtros
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => handleSearch(e.target.value)}
              placeholder="Buscar mods..."
              className="pl-9 bg-white/5 border-white/12 h-10 rounded-xl" />
          </div>

          {/* Filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="flex gap-2 flex-wrap pb-3">
                  {LOADERS.map(l => (
                    <button key={l} onClick={() => setLoader(l)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all capitalize ${
                        loader === l ? "bg-primary text-black border-primary" : "border-white/15 text-muted-foreground hover:border-white/30"
                      }`}>
                      {l === "all" ? "Todos" : l}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Swipeable tab buttons */}
          <div className="flex items-center gap-1 relative">
            <button onClick={() => goTab(-1)} disabled={tabIndex === 0}
              className="p-1 text-muted-foreground hover:text-white disabled:opacity-30 transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex gap-1 flex-1">
              {TABS.map((t, i) => {
                const Icon = t.icon;
                return (
                  <button key={t.id} onClick={() => setTabIndex(i)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-1 justify-center ${
                      tabIndex === i ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground hover:text-white"
                    }`}>
                    <Icon className="w-3.5 h-3.5" /> {t.label}
                  </button>
                );
              })}
            </div>
            <button onClick={() => goTab(1)} disabled={tabIndex === TABS.length - 1}
              className="p-1 text-muted-foreground hover:text-white disabled:opacity-30 transition-all">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Swipeable content area */}
      <div className="max-w-4xl mx-auto px-4 py-5"
        onTouchStart={e => { dragStartX.current = e.touches[0].clientX; }}
        onTouchEnd={e => {
          const diff = dragStartX.current - e.changedTouches[0].clientX;
          if (Math.abs(diff) > 60) goTab(diff > 0 ? 1 : -1);
        }}>

        <AnimatePresence mode="wait">
          <motion.div key={tab}
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.18 }}>

            {isLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="bg-card/30 rounded-2xl p-4 animate-pulse h-48 border border-white/5" />
                ))}
              </div>
            )}

            {!!error && (
              <div className="text-center py-20">
                <p className="text-red-400 mb-2">Erro ao carregar mods</p>
                <p className="text-muted-foreground text-sm mb-6">Verifique sua conexão</p>
                <Button onClick={() => refetch()} variant="outline" className="gap-2">
                  <RefreshCw className="w-4 h-4" /> Tentar novamente
                </Button>
              </div>
            )}

            {!isLoading && !error && mods.length === 0 && (
              <div className="text-center py-20">
                <p className="text-4xl mb-4">🔍</p>
                <p className="text-white font-semibold mb-1">Nenhum mod encontrado</p>
                <p className="text-muted-foreground text-sm">Mude os filtros ou a busca</p>
              </div>
            )}

            {!isLoading && mods.length > 0 && (
              <>
                <p className="text-xs text-muted-foreground mb-4">
                  {data?.total_hits?.toLocaleString("pt-BR")} mods · via{" "}
                  <a href="https://modrinth.com" target="_blank" rel="noopener noreferrer" className="text-primary/80 hover:text-primary">Modrinth</a>
                  {" · "}
                  <a href="https://www.curseforge.com/minecraft/mc-mods" target="_blank" rel="noopener noreferrer" className="text-amber-400/80 hover:text-amber-400">CurseForge ↗</a>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {mods.map((mod, i) => <ModCard key={mod.project_id} mod={mod} i={i} />)}
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
