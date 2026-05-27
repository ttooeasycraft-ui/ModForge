import { Link } from "wouter";
import { motion } from "framer-motion";
import { Hammer, Zap, Smartphone, Star, ArrowRight, Download, ExternalLink, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  { icon: "🤖", title: "ForgeBot Inteligente", desc: "Chat passo a passo. Descreve o que quer e o ForgeBot gera o prompt perfeito para qualquer IA." },
  { icon: "⚡", title: "Compilação Automática", desc: "Servidor Railway 24h compila seu mod. Só baixar o .jar. Sem Termux, sem PC, sem complicação." },
  { icon: "📱", title: "100% Mobile", desc: "Feito para PojavLauncher e MojoLauncher. Funciona no celular, tablet e PC igualmente." },
  { icon: "🆓", title: "Gratuito para sempre", desc: "Sem cadastro, sem mensalidade, sem limite. Código aberto e sempre livre." },
];

const FAMOUS_MODS = [
  { name: "Sodium",        emoji: "⚡", desc: "Máximo FPS",          slug: "sodium",        cat: "Performance" },
  { name: "Iris Shaders",  emoji: "🌅", desc: "Shaders lindos",     slug: "iris",          cat: "Visual"      },
  { name: "Fabric API",    emoji: "🧵", desc: "Base essencial",     slug: "fabric-api",    cat: "Base"        },
  { name: "JEI",           emoji: "📖", desc: "Ver receitas",       slug: "jei",           cat: "Utilidade"   },
  { name: "Xaero's Map",   emoji: "🗺️", desc: "Minimapa no HUD",   slug: "xaeros-minimap",cat: "Utilidade"   },
  { name: "ModMenu",       emoji: "⚙️", desc: "Gerenciar mods",    slug: "modmenu",       cat: "Utilidade"   },
  { name: "Lithium",       emoji: "🔋", desc: "Servidor mais rápido",slug: "lithium",      cat: "Performance" },
  { name: "REI",           emoji: "🔍", desc: "Receitas avançadas", slug: "rei",           cat: "Utilidade"   },
  { name: "Cobblemon",     emoji: "🐉", desc: "Pokémon no Minecraft",slug: "cobblemon",    cat: "Gameplay"    },
  { name: "Create",        emoji: "⚙️", desc: "Automação e máquinas",slug: "create",       cat: "Gameplay"    },
  { name: "Biomes O' Plenty",emoji:"🌳",desc: "100+ biomas novos", slug: "biomes-o-plenty",cat: "Mundo"      },
  { name: "Waystones",     emoji: "🪨", desc: "Teletransporte fácil",slug: "waystones",    cat: "Utilidade"   },
];

const STATS = [
  { value: "24h",    label: "Servidor ativo"     },
  { value: "100%",   label: "Gratuito"           },
  { value: "Rápido", label: "2-5 min por mod"    },
  { value: "0",      label: "Dados coletados"    },
];

const floatingItems = ["⛏️","🗡️","🛡️","🎮","🧱","🌟","🔮","⚔️"];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#070a12] text-white overflow-x-hidden">

      {/* ── Hero ── */}
      <section className="relative min-h-[88vh] flex flex-col items-center justify-center px-6 text-center overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {floatingItems.map((item, i) => (
            <motion.div key={i} className="absolute text-2xl select-none"
              style={{ left: `${8 + (i * 12)}%`, top: `${15 + (i % 3) * 20}%` }}
              animate={{ y: [0, -20, 0], rotate: [0, i % 2 === 0 ? 10 : -10, 0], opacity: [0.15, 0.35, 0.15] }}
              transition={{ duration: 3 + i * 0.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}>
              {item}
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
          className="relative z-10 flex flex-col items-center">

          {/* Logo */}
          <motion.div className="flex items-center gap-3 mb-6"
            initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, delay: 0.2 }}>
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.5)]">
              <Hammer className="w-8 h-8 text-black" />
            </div>
            <h1 className="font-pixel text-3xl md:text-4xl text-white drop-shadow-[0_0_20px_rgba(16,185,129,0.4)] mt-2">
              ModForge
            </h1>
          </motion.div>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            className="text-2xl md:text-3xl font-bold text-white mb-3 leading-tight">
            Crie mods de Minecraft<br />
            <span className="text-primary">pelo celular, de graça</span>
          </motion.p>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            className="text-muted-foreground text-base max-w-md mb-10 leading-relaxed">
            Descreve o que quer, a IA cria o código, o servidor compila automaticamente.
            Você só baixa o <code className="text-primary bg-primary/10 px-1 rounded">.jar</code> pronto.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 items-center">
            <Link href="/criar">
              <Button size="lg"
                className="bg-primary hover:bg-primary/90 text-black font-bold px-10 h-14 rounded-2xl text-lg gap-2 shadow-[0_0_30px_rgba(16,185,129,0.4)] hover:shadow-[0_0_40px_rgba(16,185,129,0.6)] transition-all">
                <Hammer className="w-5 h-5" /> Criar Meu Mod
              </Button>
            </Link>
            <Link href="/galeria">
              <Button variant="outline" size="lg"
                className="border-white/20 bg-white/5 hover:bg-white/10 h-14 px-8 rounded-2xl text-base gap-2">
                <TrendingUp className="w-4 h-4" /> Ver Mods Populares
              </Button>
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
            className="flex gap-8 mt-14 flex-wrap justify-center">
            {STATS.map(s => (
              <div key={s.label} className="text-center">
                <p className="text-2xl font-bold text-primary">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ── Como funciona ── */}
      <section className="px-6 py-16 max-w-4xl mx-auto">
        <motion.h2 initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          className="text-center text-xs font-bold text-muted-foreground tracking-[0.2em] uppercase mb-10">
          Como funciona
        </motion.h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { n: 1, icon: "💬", t: "Converse com o ForgeBot", d: "Responde perguntas simples sobre o mod" },
            { n: 2, icon: "🤖", t: "IA cria o código",        d: "Cole o prompt no Claude, ChatGPT ou Gemini" },
            { n: 3, icon: "⚡", t: "Servidor compila",        d: "Cole os arquivos, compilação automática 24h" },
            { n: 4, icon: "📱", t: "Baixe o .jar",           d: "Instale direto no launcher do celular" },
          ].map((step, i) => (
            <motion.div key={step.n} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="relative bg-card/50 border border-white/8 rounded-2xl p-5 flex flex-col gap-3 hover:border-primary/30 hover:bg-card/70 transition-all group">
              <div className="absolute -top-3 -left-1 w-7 h-7 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-xs font-bold text-primary">
                {step.n}
              </div>
              <span className="text-3xl">{step.icon}</span>
              <h3 className="font-semibold text-white text-sm leading-snug">{step.t}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{step.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="px-6 py-8 pb-16 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
              whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="bg-card/40 border border-white/8 rounded-2xl p-6 hover:border-primary/20 hover:bg-card/60 transition-all group">
              <span className="text-3xl mb-4 block">{f.icon}</span>
              <h3 className="font-bold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Mods famosos ── */}
      <section className="px-6 py-16 bg-white/2 border-y border-white/6">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-bold text-white text-xl">Mods prontos para baixar</h2>
              <p className="text-sm text-muted-foreground mt-1">Os mods mais populares da comunidade</p>
            </div>
            <Link href="/galeria">
              <Button variant="ghost" size="sm" className="gap-1 text-primary hover:text-primary/80">
                Ver todos <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {FAMOUS_MODS.map((mod, i) => (
              <motion.a key={mod.slug}
                href={`https://modrinth.com/mod/${mod.slug}`} target="_blank" rel="noopener noreferrer"
                initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                whileHover={{ scale: 1.03, transition: { duration: 0.15 } }}
                className="bg-card/50 border border-white/8 rounded-xl p-4 flex flex-col gap-2 hover:border-primary/30 hover:bg-card/80 transition-all group cursor-pointer">
                <div className="flex items-start justify-between">
                  <span className="text-2xl">{mod.emoji}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary/80 border border-primary/20 font-medium">
                    {mod.cat}
                  </span>
                </div>
                <h3 className="font-semibold text-white text-sm leading-snug group-hover:text-primary transition-colors">{mod.name}</h3>
                <p className="text-xs text-muted-foreground">{mod.desc}</p>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60 mt-auto pt-1">
                  <Download className="w-3 h-3" />
                  <span>Modrinth</span>
                  <ExternalLink className="w-2.5 h-2.5 ml-auto" />
                </div>
              </motion.a>
            ))}
          </div>
        </div>
      </section>

      {/* ── Diferenciais ── */}
      <section className="px-6 py-16 max-w-3xl mx-auto text-center">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <h2 className="font-bold text-xl text-white mb-3">Por que ModForge?</h2>
          <p className="text-muted-foreground mb-10 text-sm max-w-xl mx-auto">
            O único site 100% gratuito em português, feito para mobile, com compilação automática — sem precisar instalar nada.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            {[
              { icon: "🇧🇷", t: "Em Português", d: "Interface toda em PT-BR, feita pra quem joga no Brasil" },
              { icon: "🚀", t: "Zero Instalação", d: "Não precisa de Java, Gradle ou IntelliJ. Tudo no browser." },
              { icon: "⚓", t: "Pirate-friendly",d: "Suporta PojavLauncher, MojoLauncher e launchers não-oficiais" },
            ].map(item => (
              <div key={item.t} className="bg-card/40 border border-white/8 rounded-2xl p-5">
                <span className="text-2xl mb-3 block">{item.icon}</span>
                <h3 className="font-semibold text-white text-sm mb-1">{item.t}</h3>
                <p className="text-xs text-muted-foreground">{item.d}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── CTA final ── */}
      <section className="px-6 py-16 text-center bg-gradient-to-b from-transparent to-primary/5">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}>
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-full px-4 py-1.5 text-primary text-sm font-medium mb-6">
            <Star className="w-4 h-4" /> Gratuito para sempre
          </div>
          <h2 className="font-bold text-2xl text-white mb-4">Pronto para criar seu primeiro mod?</h2>
          <p className="text-muted-foreground text-sm mb-8 max-w-sm mx-auto">Leva menos de 5 minutos do zero até ter o .jar instalado.</p>
          <Link href="/criar">
            <Button size="lg"
              className="bg-primary hover:bg-primary/90 text-black font-bold px-10 h-14 rounded-2xl text-lg gap-2 shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_50px_rgba(16,185,129,0.5)] transition-all">
              <Hammer className="w-5 h-5" /> Criar Meu Mod Agora
            </Button>
          </Link>
        </motion.div>
      </section>

      <footer className="text-center py-8 text-muted-foreground/50 text-xs border-t border-white/5">
        <p>ModForge — Gratuito para sempre · Código aberto · Feito com ❤️ para a comunidade</p>
      </footer>
    </div>
  );
}
