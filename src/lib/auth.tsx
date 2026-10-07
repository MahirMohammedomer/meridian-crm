import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { db, getSetting, setSetting } from "./db";
import { supabase, isSupabaseConfigured, cloudStatus } from "./supabase";

export interface OwnerUser {
  id: string;
  email: string;
  source: "supabase" | "local";
}

interface AuthCtx {
  user: OwnerUser | null;
  ready: boolean;
  mode: "supabase" | "local";
  cloudMessage: string | null;
  hasLock: boolean | null;
  offlineReady: boolean;
  /** True when user opened a Supabase recovery link and must set a new password */
  recoveryMode: boolean;
  unlockOffline: () => Promise<{ error?: string }>;
  signIn: (email: string, password: string, keepSignedIn: boolean) => Promise<{ error?: string }>;
  createLocalLock: (email: string, password: string) => Promise<{ error?: string }>;
  /** Replace the device lock password (no old password required) */
  resetLocalPassword: (newPassword: string) => Promise<{ error?: string }>;
  /**
   * Owner recovery: unlock without the old password using a one-time recovery code.
   * After unlock, set a new password immediately.
   */
  emergencyUnlock: (code: string) => Promise<{ error?: string; ok?: boolean }>;
  signOut: (opts?: { wipeLocal?: boolean }) => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string; ok?: boolean }>;
  updatePassword: (newPassword: string) => Promise<{ error?: string; ok?: boolean }>;
  clearRecoveryMode: () => void;
}

/** Single-owner recovery code — remove or change after you regain access */
export const EMERGENCY_RECOVERY_CODE = "MERIDIAN-UNLOCK-2026";

const Ctx = createContext<AuthCtx | null>(null);

async function sha256(text: string) {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // fallback (non-crypto) hash
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (h * 33) ^ text.charCodeAt(i);
  return "h" + (h >>> 0).toString(16);
}

function appOrigin(): string {
  const fromEnv = (import.meta.env.VITE_APP_URL || "").trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof location !== "undefined" && location.origin && !/localhost|127\.0\.0\.1/.test(location.hostname)) {
    return location.origin;
  }
  if (typeof location !== "undefined") return location.origin;
  return "";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<OwnerUser | null>(null);
  const [ready, setReady] = useState(false);
  const [hasLock, setHasLock] = useState<boolean | null>(null);
  const [offlineReady, setOfflineReady] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);

  // Session bootstrap — cached session in IndexedDB makes offline access possible
  useEffect(() => {
    (async () => {
      const cached = await getSetting<OwnerUser>("session");
      // Don't restore a fake local emergency session when Supabase is configured —
      // that shows an empty "guest" workspace. Prefer a real cloud login.
      if (cached && !(isSupabaseConfigured && cached.source === "local" && cached.id === "emergency-owner")) {
        setUser(cached);
        setOfflineReady(true);
      }

      if (isSupabaseConfigured && supabase) {
        setHasLock(true);
        try {
          // Recovery / magic links often arrive as:
          //   https://your.app/#access_token=…&refresh_token=…&type=recovery
          // or with PKCE: ?code=…
          const rawHash = typeof location !== "undefined" ? location.hash.replace(/^#/, "") : "";
          const hashQuery = rawHash.includes("access_token") || rawHash.includes("type=")
            ? rawHash
            : rawHash.includes("?")
              ? rawHash.slice(rawHash.indexOf("?") + 1)
              : "";
          const search = typeof location !== "undefined" ? location.search.replace(/^\?/, "") : "";
          const params = new URLSearchParams(hashQuery || search);
          const access_token = params.get("access_token");
          const refresh_token = params.get("refresh_token");
          const type = params.get("type");
          const code = params.get("code");

          if (type === "recovery") setRecoveryMode(true);

          if (access_token && refresh_token) {
            const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (!error && data.session?.user) {
              if (type === "recovery" || data.session) setRecoveryMode(type === "recovery");
              const s = data.session.user;
              const u: OwnerUser = { id: s.id, email: s.email || "owner", source: "supabase" };
              setUser(u);
              await setSetting("session", u);
              // Clean tokens out of the URL so the hash router works again
              try {
                history.replaceState(null, "", `${location.pathname}${location.search || ""}#/`);
              } catch {
                /* ignore */
              }
            }
          } else if (code) {
            // PKCE exchange (detectSessionInUrl also handles this; call explicitly for reliability)
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            if (!error && data.session?.user) {
              const s = data.session.user;
              const u: OwnerUser = { id: s.id, email: s.email || "owner", source: "supabase" };
              setUser(u);
              await setSetting("session", u);
              if (type === "recovery") setRecoveryMode(true);
            }
          } else {
            const { data } = await supabase.auth.getSession();
            const s = data?.session?.user;
            if (s) {
              const u: OwnerUser = { id: s.id, email: s.email || cached?.email || "owner", source: "supabase" };
              setUser(u);
              await setSetting("session", u);
            } else if (!cached || cached.source === "local") {
              setUser(null);
              if (cached?.source === "local") await setSetting("session", null);
            }
          }
        } catch {
          /* offline — keep cached real session only */
        }
        supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === "PASSWORD_RECOVERY") {
            setRecoveryMode(true);
          }
          const s = session?.user;
          if (s) {
            const u: OwnerUser = { id: s.id, email: s.email || "owner", source: "supabase" };
            setUser(u);
            await setSetting("session", u);
            await setSetting("last_online_auth", new Date().toISOString());
          } else {
            const stillCached = await getSetting<OwnerUser>("session");
            if (!navigator.onLine && stillCached && stillCached.source === "supabase") {
              setUser(stillCached);
              setOfflineReady(true);
              return;
            }
            setUser(null);
            setOfflineReady(false);
            await setSetting("session", null);
          }
        });
      } else {
        const lock = await getSetting<{ hash: string; email: string }>("owner_lock");
        setHasLock(Boolean(lock));
      }
      setReady(true);
    })();
  }, []);

  const unlockOffline = useCallback(async () => {
    if (navigator.onLine) return { error: "You are online — use your normal sign in." };
    const cached = await getSetting<OwnerUser>("session");
    if (!cached) return { error: "This device has not been trusted for offline use yet. Sign in once while online." };
    setUser(cached);
    setOfflineReady(true);
    return {};
  }, []);

  const signIn = useCallback(
    async (email: string, password: string, keepSignedIn: boolean) => {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) return { error: error.message };
          const u: OwnerUser = { id: data.user!.id, email: data.user!.email || email, source: "supabase" };
          setUser(u);
          setOfflineReady(true);
          await setSetting("session", u);
          await setSetting("keep_signed_in", keepSignedIn);
          await setSetting("last_online_auth", new Date().toISOString());
          return {};
        } catch (e: any) {
          // offline: fall back to cached session if one exists
          const cached = await getSetting<OwnerUser>("session");
          if (cached && !navigator.onLine) {
                setUser(cached);
            return {};
          }
          return { error: e?.message || "Sign in failed" };
        }
      }
      const lock = await getSetting<{ hash: string; email: string }>("owner_lock");
      if (!lock) return { error: "No owner account on this device" };
      const h = await sha256(password + "::meridian");
      if (h !== lock.hash) return { error: "Incorrect password" };
      const u: OwnerUser = { id: "local-owner", email: lock.email || email, source: "local" };
      setUser(u);
      await setSetting("session", u);
      await setSetting("keep_signed_in", keepSignedIn);
      return {};
    },
    [],
  );

  const createLocalLock = useCallback(async (email: string, password: string) => {
    const hash = await sha256(password + "::meridian");
    await setSetting("owner_lock", { hash, email });
    const u: OwnerUser = { id: "local-owner", email, source: "local" };
    setUser(u);
    await setSetting("session", u);
    await setSetting("keep_signed_in", true);
    setHasLock(true);
    return {};
  }, []);

  const resetLocalPassword = useCallback(async (newPassword: string) => {
    if (!newPassword || newPassword.length < 6) return { error: "Use at least 6 characters" };
    const lock = await getSetting<{ hash: string; email: string }>("owner_lock");
    const cached = await getSetting<OwnerUser>("session");
    const email = lock?.email || cached?.email || "owner@meridian";
    const hash = await sha256(newPassword + "::meridian");
    await setSetting("owner_lock", { hash, email });
    // Prefer local lock after recovery so this device always has a working password
    const u: OwnerUser = { id: cached?.id || "local-owner", email, source: "local" };
    setUser(u);
    await setSetting("session", u);
    await setSetting("keep_signed_in", true);
    setHasLock(true);
    setOfflineReady(true);
    setRecoveryMode(false);
    return {};
  }, []);

  const emergencyUnlock = useCallback(async (code: string) => {
    const normalized = (code || "").trim().toUpperCase().replace(/\s+/g, "");
    if (normalized !== EMERGENCY_RECOVERY_CODE) {
      return { error: "Invalid recovery code" };
    }
    // Cloud account: emergency code cannot impersonate your Supabase user (RLS needs auth.uid()).
    // Point the owner at the real recovery paths instead of opening an empty guest workspace.
    if (isSupabaseConfigured) {
      return {
        error:
          "Your data is on the email account. Use Forgot password (fix Site URL in Supabase first), or set a new password in the Supabase Dashboard → Authentication → Users. Do not use guest unlock — it has no cloud data.",
      };
    }
    const lock = await getSetting<{ hash: string; email: string }>("owner_lock");
    const cached = await getSetting<OwnerUser>("session");
    const email = lock?.email || cached?.email || "owner@meridian";
    const u: OwnerUser = { id: "local-owner", email, source: "local" };
    setUser(u);
    await setSetting("session", u);
    await setSetting("keep_signed_in", true);
    setOfflineReady(true);
    setHasLock(true);
    setRecoveryMode(false);
    return { ok: true };
  }, []);

  const signOut = useCallback(async (opts?: { wipeLocal?: boolean }) => {
    try {
      if (isSupabaseConfigured && supabase) await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
    await setSetting("session", null);
    await setSetting("last_online_auth", null);
    setOfflineReady(false);
    setUser(null);
    setRecoveryMode(false);
    if (opts?.wipeLocal) {
      await db.delete();
      await db.open();
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (!isSupabaseConfigured || !supabase) {
      return {
        error:
          "Cloud password reset needs Supabase. For the on-device lock, use “Reset device password” on the login screen.",
      };
    }
    const origin = appOrigin();
    // Must match a URL allow-listed in Supabase Auth → URL Configuration
    const redirectTo = origin ? `${origin}/` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) return { error: error.message };
    return { ok: true };
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    if (!isSupabaseConfigured || !supabase) return { error: "Not available in local-only mode." };
    if (!newPassword || newPassword.length < 6) return { error: "Use at least 6 characters" };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error: error.message };
    setRecoveryMode(false);
    // Clean recovery tokens from the address bar without a full reload
    try {
      if (typeof history !== "undefined" && location.hash.includes("access_token")) {
        history.replaceState(null, "", location.pathname + (location.search || "") + "#/dashboard");
      }
    } catch {
      /* ignore */
    }
    return { ok: true };
  }, []);

  const clearRecoveryMode = useCallback(() => setRecoveryMode(false), []);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      ready,
      mode: isSupabaseConfigured ? "supabase" : "local",
      cloudMessage: cloudStatus,
      hasLock,
      offlineReady,
      recoveryMode,
      unlockOffline,
      signIn,
      createLocalLock,
      resetLocalPassword,
      emergencyUnlock,
      signOut,
      resetPassword,
      updatePassword,
      clearRecoveryMode,
    }),
    [
      user,
      ready,
      hasLock,
      offlineReady,
      recoveryMode,
      unlockOffline,
      signIn,
      createLocalLock,
      resetLocalPassword,
      emergencyUnlock,
      signOut,
      resetPassword,
      updatePassword,
      clearRecoveryMode,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
