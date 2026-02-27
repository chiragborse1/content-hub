import { useState, useEffect } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Sun, Moon } from "lucide-react";

function getInitialTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  return "dark"; // default
}

function applyTheme(theme: "dark" | "light") {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  localStorage.setItem("theme", theme);
}

export default function SettingsPage() {
  const [theme, setTheme] = useState<"dark" | "light">(getInitialTheme);

  // Apply on mount and whenever theme changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-lg px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
      </header>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        {/* Theme toggle */}
        <div className="rounded-lg bg-card border border-border p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Appearance</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {theme === "dark" ? "Dark mode is on" : "Light mode is on"}
            </p>
          </div>

          <button
            onClick={toggle}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background hover:bg-accent transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="w-5 h-5 text-yellow-400" />
            ) : (
              <Moon className="w-5 h-5 text-primary" />
            )}
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
