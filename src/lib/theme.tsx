"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeCtx {
  theme: Theme;        // user preference (light | dark | system)
  resolved: "light" | "dark"; // actual applied theme
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeCtx>({ theme: "light", resolved: "light", setTheme: () => {} });

export function useTheme() { return useContext(ThemeContext); }

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  // Resolve "system" to actual light/dark
  const resolve = useCallback((t: Theme): "light" | "dark" => {
    if (t === "system") {
      return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return t;
  }, []);

  // Apply the dark class on <html>
  const apply = useCallback((r: "light" | "dark") => {
    const root = document.documentElement;
    if (r === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    setResolved(r);
  }, []);

  // Load saved preference on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("pixsign_theme") as Theme | null;
      const t = saved && ["light", "dark", "system"].includes(saved) ? saved : "light";
      setThemeState(t);
      apply(resolve(t));
    } catch {
      apply("light");
    }
  }, [apply, resolve]);

  // Listen for system theme changes when "system" is selected
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => apply(e.matches ? "dark" : "light");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme, apply]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem("pixsign_theme", t);
    apply(resolve(t));
    // Dispatch event so other components can react
    window.dispatchEvent(new Event("pixsign_theme_changed"));
  }, [apply, resolve]);

  return <ThemeContext.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeContext.Provider>;
}
