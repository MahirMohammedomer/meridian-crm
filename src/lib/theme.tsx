import React, { createContext, useContext, useEffect, useState } from "react";
import { getSetting, setSetting } from "./db";

export type ThemeMode = "light" | "dark" | "system";

const Ctx = createContext<{ mode: ThemeMode; resolved: "light" | "dark"; setMode: (m: ThemeMode) => void }>({
  mode: "system",
  resolved: "light",
  setMode: () => {},
});

function apply(resolved: "light" | "dark") {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = typeof localStorage !== "undefined" ? (localStorage.getItem("meridian-theme") as ThemeMode) : null;
    return stored || "system";
  });
  const [resolved, setResolved] = useState<"light" | "dark">(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      const next = mode === "system" ? (mq.matches ? "dark" : "light") : mode;
      setResolved(next);
      apply(next);
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [mode]);

  useEffect(() => {
    void getSetting<ThemeMode>("theme").then((t) => {
      if (t) setModeState(t);
    });
  }, []);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    try {
      localStorage.setItem("meridian-theme", m);
    } catch {
      /* ignore */
    }
    void setSetting("theme", m);
  };

  return <Ctx.Provider value={{ mode, resolved, setMode }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  return useContext(Ctx);
}
