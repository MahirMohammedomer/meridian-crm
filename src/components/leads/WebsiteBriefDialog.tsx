import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ClipboardCopy } from "lucide-react";
import { Button, Dialog, Field, Input, Switch } from "@/components/ui/ui";
import { copyWebsiteBrief } from "@/lib/websiteBrief";
import type { Lead } from "@/lib/types";

export function WebsiteBriefDialog({
  open,
  onClose,
  lead,
}: {
  open: boolean;
  onClose: () => void;
  lead: Lead | null;
}) {
  const [markReady, setMarkReady] = useState(true);
  const [prototypeUrl, setPrototypeUrl] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && lead) {
      setPrototypeUrl(lead.custom_fields?.prototype_url || "");
      setMarkReady(true);
      setBusy(false);
    }
  }, [open, lead?.id]);

  if (!lead) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Copy website brief"
      description="Fills your template (Settings → Website brief) for Arena / Vercel."
    >
      <div className="space-y-3">
        <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-white/10">
          <div>
            <div className="text-[13px] font-medium text-slate-800 dark:text-slate-100">
              Mark as Prototype Ready
            </div>
            <div className="text-[11.5px] text-slate-400">
              After copy, status → Prototype Ready (built, not called yet)
            </div>
          </div>
          <Switch checked={markReady} onChange={setMarkReady} />
        </label>
        <Field label="Prototype URL (optional)">
          <Input
            value={prototypeUrl}
            onChange={(e) => setPrototypeUrl(e.target.value)}
            placeholder="https://….vercel.app or Arena link"
          />
        </Field>
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const { missing } = await copyWebsiteBrief(lead, {
                  markProposal: markReady,
                  prototypeUrl,
                });
                toast.success(
                  missing.length
                    ? `Brief copied — missing: ${missing.join(", ")}`
                    : "Website brief copied — paste into Arena",
                );
                onClose();
              } catch (e: any) {
                toast.error(e?.message || "Copy failed");
              }
              setBusy(false);
            }}
          >
            <ClipboardCopy className="h-3.5 w-3.5" />
            {busy ? "Copying…" : "Copy brief"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
