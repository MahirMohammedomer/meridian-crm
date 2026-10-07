import { useState } from "react";
import { toast } from "sonner";
import { Lock, Mail, Eye, EyeOff, WifiOff, ShieldCheck, KeyRound, LifeBuoy } from "lucide-react";
import { Button, Card, Input, Field, Checkbox } from "@/components/ui/ui";
import { useAuth } from "@/lib/auth";
import { MeridianMark } from "@/components/layout/AppShell";

export function Login() {
  const {
    mode,
    hasLock,
    offlineReady,
    recoveryMode,
    unlockOffline,
    signIn,
    createLocalLock,
    resetPassword,
    resetLocalPassword,
    emergencyUnlock,
    updatePassword,
  } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [keep, setKeep] = useState(true);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** local: set new device password */
  const [localReset, setLocalReset] = useState(false);
  /** enter recovery code → then set new password */
  const [emergency, setEmergency] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  /** after successful emergency unlock, force set password before leaving login */
  const [mustSetPassword, setMustSetPassword] = useState(false);

  const isSetup = mode === "local" && hasLock === false;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Emergency: step 1 — validate recovery code
    if (emergency && !mustSetPassword) {
      if (!recoveryCode.trim()) return setError("Enter the recovery code");
      setBusy(true);
      const r = await emergencyUnlock(recoveryCode);
      setBusy(false);
      if (r.error) return setError(r.error);
      toast.success("Unlocked — set a new password now");
      setMustSetPassword(true);
      setPassword("");
      setConfirm("");
      return;
    }

    // Emergency step 2 or local reset or recovery link: set new password
    if (recoveryMode || localReset || mustSetPassword) {
      if (password.length < 6) return setError("Use at least 6 characters");
      if (password !== confirm) return setError("Passwords do not match");
      setBusy(true);
      if (recoveryMode) {
        const r = await updatePassword(password);
        setBusy(false);
        if (r.error) setError(r.error);
        else toast.success("Password updated — you’re signed in");
        return;
      }
      const r = await resetLocalPassword(password);
      setBusy(false);
      if (r.error) setError(r.error);
      else {
        toast.success("New password saved — you’re in");
        setLocalReset(false);
        setEmergency(false);
        setMustSetPassword(false);
      }
      return;
    }

    if (!password) return setError("Enter your password");
    if (isSetup) {
      if (password.length < 6) return setError("Use at least 6 characters");
      if (password !== confirm) return setError("Passwords do not match");
    }
    setBusy(true);
    const res = isSetup ? await createLocalLock(email || "owner@meridian", password) : await signIn(email, password, keep);
    setBusy(false);
    if (res?.error) setError(res.error);
  };

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="mb-7 flex flex-col items-center text-center">
          <MeridianMark size={46} />
          <h1 className="mt-4 text-[22px] font-semibold tracking-tight text-slate-900 dark:text-white">Meridian</h1>
          <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">Personal Agency Command Center</p>
        </div>

        <Card className="p-6">
          <form onSubmit={submit} className="space-y-4">
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-[12px] text-slate-500 dark:bg-white/5 dark:text-slate-400">
              {recoveryMode || mustSetPassword ? (
                <>
                  <KeyRound className="h-4 w-4 shrink-0 text-violet-500" />
                  <span>Choose a new password for your account</span>
                </>
              ) : emergency ? (
                <>
                  <LifeBuoy className="h-4 w-4 shrink-0 text-amber-500" />
                  <span>Owner recovery — enter the code, then set a new password</span>
                </>
              ) : mode === "supabase" ? (
                <>
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
                  <span>Private owner account · cloud sync enabled</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 shrink-0 text-amber-500" />
                  <span>On-device lock · works fully offline</span>
                </>
              )}
            </div>

            {mode === "supabase" && !recoveryMode && !emergency && !mustSetPassword && (
              <Field label="Email">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    className="pl-9"
                  />
                </div>
              </Field>
            )}

            {isSetup && !localReset && !emergency && (
              <Field label="Owner email (optional)">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
              </Field>
            )}

            {emergency && !mustSetPassword && (
              <Field label="Recovery code">
                <Input
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value)}
                  placeholder="MERIDIAN-…"
                  autoComplete="off"
                  className="font-mono tracking-wide"
                />
              </Field>
            )}

            {(localReset || mustSetPassword) && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] leading-relaxed text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                Set a new password now. You’ll use it on this device (and the other one after you open it and sign in
                the same way once).
              </p>
            )}

            {!emergency || mustSetPassword ? (
              <>
                {!(emergency && !mustSetPassword) && (
                  <Field label={recoveryMode || localReset || mustSetPassword || isSetup ? "New password" : "Password"}>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        type={show ? "text" : "password"}
                        autoComplete={recoveryMode || localReset || mustSetPassword || isSetup ? "new-password" : "current-password"}
                        required={!emergency || mustSetPassword}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="pl-9 pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600"
                        onClick={() => setShow((v) => !v)}
                        tabIndex={-1}
                      >
                        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </Field>
                )}

                {(isSetup || recoveryMode || localReset || mustSetPassword) && (
                  <Field label="Confirm password">
                    <Input
                      type={show ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="••••••••"
                    />
                  </Field>
                )}
              </>
            ) : null}

            {!isSetup && !recoveryMode && !localReset && !emergency && !mustSetPassword && mode === "supabase" && (
              <label className="flex items-center gap-2 text-[13px] text-slate-600 dark:text-slate-300">
                <Checkbox checked={keep} onChange={setKeep} />
                Keep me signed in on this device
              </label>
            )}

            {!navigator.onLine && offlineReady && !recoveryMode && !localReset && !emergency && (
              <div className="space-y-2">
                <p className="text-[12.5px] text-slate-500">You’re offline. Open with the trusted session on this device.</p>
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={async () => {
                    const r = await unlockOffline();
                    if (r.error) setError(r.error);
                  }}
                >
                  Open Meridian Offline
                </Button>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-600 dark:bg-red-500/10 dark:text-red-400">
                {error}
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
              {busy
                ? "Please wait…"
                : emergency && !mustSetPassword
                  ? "Unlock with code"
                  : recoveryMode || mustSetPassword || localReset
                    ? "Save new password"
                    : isSetup
                      ? "Create owner password"
                      : "Sign in"}
            </Button>

            {mode === "supabase" && !isSetup && !recoveryMode && !emergency && !mustSetPassword && (
              <button
                type="button"
                onClick={async () => {
                  if (!email) return setError("Enter your email first");
                  setError(null);
                  const r = await resetPassword(email);
                  if (r.error) {
                    toast.error(r.error);
                    setError(r.error);
                  } else {
                    toast.success(
                      "Reset email sent. If the link opens localhost, fix Supabase Site URL — or use Locked out below.",
                    );
                  }
                }}
                className="w-full text-center text-[12.5px] text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
              >
                Forgot password?
              </button>
            )}

            {mode === "local" && hasLock && !isSetup && !localReset && !emergency && (
              <button
                type="button"
                onClick={() => {
                  setLocalReset(true);
                  setPassword("");
                  setConfirm("");
                  setError(null);
                }}
                className="w-full text-center text-[12.5px] text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
              >
                Forgot device password?
              </button>
            )}

            {!recoveryMode && !mustSetPassword && !isSetup && (
              <button
                type="button"
                onClick={() => {
                  setEmergency((v) => !v);
                  setLocalReset(false);
                  setMustSetPassword(false);
                  setRecoveryCode("");
                  setPassword("");
                  setConfirm("");
                  setError(null);
                }}
                className="w-full text-center text-[12.5px] font-medium text-amber-700 underline-offset-2 hover:underline dark:text-amber-400"
              >
                {emergency ? "Back to sign in" : "Locked out? Owner recovery"}
              </button>
            )}
          </form>
        </Card>

        <p className="mt-5 text-center text-[11.5px] leading-relaxed text-slate-400 dark:text-slate-600">
          Meridian is a private, single-owner workspace.
          <br />
          Your data lives on this device first — cloud sync is optional.
        </p>
      </div>
    </div>
  );
}
