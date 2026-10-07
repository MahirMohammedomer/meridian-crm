export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(p: BeforeInstallPromptEvent | null) => void>();
let installed = false;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l(deferredPrompt));
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferredPrompt = null;
    listeners.forEach((l) => l(null));
  });
  if (window.matchMedia("(display-mode: standalone)").matches) installed = true;
}

export function onInstallPromptChange(fn: (p: BeforeInstallPromptEvent | null) => void) {
  listeners.add(fn);
  fn(deferredPrompt);
  return () => listeners.delete(fn);
}

export function isInstalled() {
  return installed;
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredPrompt) return "unavailable";
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return choice.outcome;
}

export function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && location.hostname !== "localhost") return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        reg.addEventListener("updatefound", () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) {
              nw.postMessage("SKIP_WAITING");
            }
          });
        });
      })
      .catch(() => {
        /* SW registration failed — app still works from Dexie */
      });
    navigator.serviceWorker.addEventListener("message", (e) => {
      if ((e.data as any)?.type === "MERIDIAN_SYNC") {
        window.dispatchEvent(new CustomEvent("meridian:sync-request"));
      }
    });
  });
}

export async function requestBackgroundSync() {
  if (typeof navigator === "undefined") return;
  try {
    const reg = await navigator.serviceWorker?.ready;
    const swReg = reg as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } };
    if (swReg?.sync) await swReg.sync.register("meridian-sync");
  } catch {
    /* Background Sync unsupported — not required */
  }
}
