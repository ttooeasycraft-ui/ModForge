import { motion } from "framer-motion";
import { User, Hammer, Download, Star, Github, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadHistory } from "./downloads";

export default function Profile() {
  const history = loadHistory();
  const ready = history.filter(h => h.status === "ready").length;

  return (
    <div className="min-h-screen bg-[#070a12] text-white">
      <div className="sticky top-0 z-20 bg-[#070a12]/95 backdrop-blur-xl border-b border-white/8 px-4 pt-4 pb-3">
        <h1 className="font-bold text-white text-lg max-w-2xl mx-auto">Perfil</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Avatar */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center text-center mb-10">
          <div className="w-24 h-24 rounded-3xl bg-primary/15 border border-primary/30 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
            <User className="w-12 h-12 text-primary" />
          </div>
          <h2 className="font-bold text-white text-xl">Jogador Anônimo</h2>
          <p className="text-muted-foreground text-sm mt-1">Membro do ModForge · Criador de mods</p>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
          className="grid grid-cols-3 gap-3 mb-8">
          {[
            { icon: Hammer,   value: history.length, label: "Mods criados"  },
            { icon: Download, value: ready,          label: "Compilados"    },
            { icon: Star,     value: 0,              label: "Favoritos"     },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="bg-card/40 border border-white/8 rounded-2xl p-4 text-center">
              <Icon className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="font-bold text-white text-xl">{value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </motion.div>

        {/* Coming soon features */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
          className="bg-card/40 border border-white/8 rounded-2xl p-6 mb-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Star className="w-4 h-4 text-primary" /> Em breve
          </h3>
          <div className="space-y-3">
            {[
              "Foto e nome personalizados",
              "Galeria pública dos seus mods",
              "Seguir outros criadores",
              "Avaliações e comentários",
              "Integração com Modrinth e CurseForge",
              "Histórico completo de compilações",
            ].map(item => (
              <div key={item} className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Links */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
          className="space-y-3">
          <a href="https://github.com/ttooeasycraft-ui/ModForge" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="w-full h-12 rounded-xl border-white/15 justify-start gap-3">
              <Github className="w-4 h-4" /> Contribuir no GitHub
              <ExternalLink className="w-3.5 h-3.5 ml-auto text-muted-foreground/50" />
            </Button>
          </a>
          <a href="https://modrinth.com" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="w-full h-12 rounded-xl border-white/15 justify-start gap-3">
              <Download className="w-4 h-4" /> Minha conta no Modrinth
              <ExternalLink className="w-3.5 h-3.5 ml-auto text-muted-foreground/50" />
            </Button>
          </a>
        </motion.div>

        <p className="text-center text-xs text-muted-foreground/40 mt-10">
          ModForge v2.0 · Seus dados ficam só no seu dispositivo
        </p>
      </div>
    </div>
  );
}
