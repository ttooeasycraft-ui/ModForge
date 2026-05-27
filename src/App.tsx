import { Switch, Route, Router as WouterRouter, useLocation, Link } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Home as HomeIcon, Hammer, Compass, Download, User } from "lucide-react";
import { motion } from "framer-motion";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Create from "@/pages/create";
import Gallery from "@/pages/gallery";
import Downloads from "@/pages/downloads";
import Profile from "@/pages/profile";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 5 * 60 * 1000 } },
});

const NAV = [
  { path: "/",          icon: HomeIcon, label: "Início"    },
  { path: "/criar",     icon: Hammer,   label: "Criar"     },
  { path: "/galeria",   icon: Compass,  label: "Galeria"   },
  { path: "/downloads", icon: Download, label: "Downloads" },
  { path: "/perfil",    icon: User,     label: "Perfil"    },
];

function BottomNav() {
  const [location] = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/8 bg-[#070a12]/95 backdrop-blur-xl flex items-stretch h-[60px]">
      {NAV.map(({ path, icon: Icon, label }) => {
        const active = path === "/" ? location === "/" : location.startsWith(path);
        return (
          <Link key={path} href={path}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-all relative ${
              active ? "text-primary" : "text-muted-foreground hover:text-white/70"
            }`}>
            {active && (
              <motion.div layoutId="nav-indicator"
                className="absolute top-0 left-3 right-3 h-0.5 bg-primary rounded-full"
                initial={false} transition={{ type: "spring", stiffness: 600, damping: 35 }} />
            )}
            <Icon className={`w-5 h-5 transition-all ${active ? "scale-110" : ""}`} />
            <span className="text-[10px] font-medium leading-none tracking-wide">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function AppRouter() {
  return (
    <>
      <div className="pb-[60px] min-h-screen">
        <Switch>
          <Route path="/"          component={Home}      />
          <Route path="/criar"     component={Create}    />
          <Route path="/galeria"   component={Gallery}   />
          <Route path="/downloads" component={Downloads} />
          <Route path="/perfil"    component={Profile}   />
          <Route component={NotFound} />
        </Switch>
      </div>
      <BottomNav />
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {/* useHashLocation = URLs use #/path so GitHub Pages never 404s on refresh */}
        <WouterRouter hook={useHashLocation}>
          <AppRouter />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
