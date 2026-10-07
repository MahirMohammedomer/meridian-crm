import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { Plus, Phone, MessageCircle, Check, Clock, CalendarClock, ExternalLink, X } from "lucide-react";
import { db } from "@/lib/db";
import { useApp } from "@/lib/app";
import { followupsRepo } from "@/lib/repos";
import { Button, Card, ConfirmDialog, Dialog, Dropdown, EmptyState, Field, Input, MenuItem, MenuLabel, Tabs, Textarea } from "@/components/ui/ui";
import { TelegramButton } from "@/components/common/QuickActions";
import { TierBadge } from "@/components/leads/controls";
import { addDays, dueLabel, startOfDay, telHref, toLocalInputValue, waHref } from "@/lib/utils";

export function FollowUps() {
  const { openLead, setQuickAdd, setQuickAddLeadId } = useApp();
  const [view, setView] = useState("today");
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const leads = useLiveQuery(() => db.leads.toArray(), [], []);
  const all = useLiveQuery(() => db.follow_ups.toArray(), [], []);

  const [form, setForm] = useState<any>({
    lead_id: "",
    title: "",
    due: toLocalInputValue(addDays(new Date(), 1).toISOString()),
    notes: "",
  });

  const leadMap = useMemo(() => new Map((leads || []).map((l) => [l.id, l])), [leads]);

  const groups = useMemo(() => {
    const today = startOfDay(new Date());
    const tomorrow = addDays(today, 1);
    const week = addDays(today, 8);
    const pending = (all || []).filter((f) => f.status === "Pending" || f.status === "Overdue");
    const sorted = [...pending].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    return {
      today: sorted.filter((f) => {
        const d = new Date(f.due_date);
        return d >= today && d < tomorrow;
      }),
      overdue: sorted.filter((f) => new Date(f.due_date) < today),
      upcoming: sorted.filter((f) => {
        const d = new Date(f.due_date);
        return d >= tomorrow && d < week;
      }),
      all: sorted,
      done: (all || [])
        .filter((f) => f.status === "Done" || f.status === "Cancelled")
        .sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime()),
    };
  }, [all]);

  const items = (groups as any)[view] || [];

  const create = async () => {
    if (!form.lead_id) return toast.error("Pick a lead");
    const lead = leadMap.get(form.lead_id);
    await followupsRepo.create({
      lead_id: form.lead_id,
      title: form.title.trim() || `Follow up with ${lead?.business_name || "lead"}`,
      due_date: new Date(form.due).toISOString(),
      notes: form.notes,
    });
    toast.success("Follow-up created");
    setOpen(false);
    setForm({ lead_id: "", title: "", due: toLocalInputValue(addDays(new Date(), 1).toISOString()), notes: "" });
  };

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-5 md:px-7 md:py-7">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-slate-900 dark:text-white">Follow-ups</h1>
          <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
            {groups.overdue.length} overdue · {groups.today.length} today · {groups.upcoming.length} this week
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setQuickAddLeadId(null);
            setQuickAdd("followup");
          }}
        >
          <Plus className="h-4 w-4" /> New follow-up
        </Button>
      </div>

      <Tabs
        className="mb-4"
        value={view}
        onChange={setView}
        tabs={[
          { value: "today", label: `Today (${groups.today.length})` },
          { value: "overdue", label: `Overdue (${groups.overdue.length})` },
          { value: "upcoming", label: `Upcoming (${groups.upcoming.length})` },
          { value: "all", label: `All open (${groups.all.length})` },
          { value: "done", label: `Done (${groups.done.length})` },
        ]}
      />

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarClock className="h-6 w-6" />}
            title={view === "done" ? "Nothing completed yet" : "Nothing scheduled"}
            description="Create a follow-up from a lead profile with Tomorrow, In 3 days or Next week."
            action={
              <Button
                variant="primary"
                onClick={() => {
                  setQuickAddLeadId(null);
                  setQuickAdd("followup");
                }}
              >
                <Plus className="h-4 w-4" /> New follow-up
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {items.map((f: any) => {
            const lead = leadMap.get(f.lead_id);
            const overdue = f.status !== "Done" && f.status !== "Cancelled" && new Date(f.due_date) < startOfDay(new Date());
            return (
              <Card key={f.id} className={`p-4 ${f.status === "Done" || f.status === "Cancelled" ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => lead && openLead(lead.id)}
                        className="truncate text-[14.5px] font-semibold text-slate-900 hover:underline dark:text-white"
                      >
                        {lead?.business_name || f.title}
                      </button>
                      {lead && <TierBadge lead={lead} size="xs" />}
                      {f.status === "Done" && (
                        <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10.5px] font-medium text-emerald-600 dark:text-emerald-400">
                          Done
                        </span>
                      )}
                      {f.status === "Cancelled" && (
                        <span className="rounded-full bg-slate-500/12 px-2 py-0.5 text-[10.5px] font-medium text-slate-500">
                          Cancelled
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[12.5px]">
                      <span className={overdue ? "font-medium text-red-500" : "text-slate-500 dark:text-slate-400"}>
                        <Clock className="mr-1 inline h-3 w-3" />
                        {dueLabel(f.due_date)}
                      </span>
                      {lead?.phone && <span className="text-slate-500 dark:text-slate-400">{lead.phone}</span>}
                    </div>
                    {f.title && lead && f.title !== `Follow up with ${lead.business_name}` && (
                      <div className="mt-1 text-[12.5px] text-slate-600 dark:text-slate-300">{f.title}</div>
                    )}
                    {f.notes && <p className="mt-1.5 text-[12.5px] text-slate-500 dark:text-slate-400">{f.notes}</p>}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {lead?.phone && (
                      <>
                        <a href={telHref(lead.phone)}>
                          <Button size="sm" variant="outline">
                            <Phone className="h-3.5 w-3.5" /> Call
                          </Button>
                        </a>
                        <a href={waHref(lead.phone)} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="outline">
                            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                          </Button>
                        </a>
                        <TelegramButton lead={lead} size="sm" />
                      </>
                    )}
                    {f.status !== "Done" && (
                      <Button
                        size="sm"
                        variant="success"
                        onClick={async () => {
                          await followupsRepo.complete(f.id);
                          toast.success("Marked done");
                        }}
                      >
                        <Check className="h-3.5 w-3.5" /> Done
                      </Button>
                    )}
                    <Dropdown
                      trigger={({ toggle }) => (
                        <Button size="sm" variant="outline" onClick={toggle}>
                          Reschedule
                        </Button>
                      )}
                    >
                      {({ close }) => (
                        <>
                          <MenuLabel>Move to</MenuLabel>
                          {[
                            { label: "Tomorrow", days: 1 },
                            { label: "In 3 days", days: 3 },
                            { label: "Next week", days: 7 },
                            { label: "In 2 weeks", days: 14 },
                          ].map((o) => (
                            <MenuItem
                              key={o.label}
                              onClick={async () => {
                                await followupsRepo.update(f.id, {
                                  due_date: addDays(new Date(), o.days).toISOString(),
                                  status: "Pending",
                                });
                                toast.success(`Rescheduled · ${o.label.toLowerCase()}`);
                                close();
                              }}
                            >
                              {o.label}
                            </MenuItem>
                          ))}
                        </>
                      )}
                    </Dropdown>
                    <Button size="icon-sm" variant="ghost" onClick={() => lead && openLead(lead.id)} title="Open lead">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon-sm" variant="ghost" onClick={() => setDeleteId(f.id)} title="Delete">
                      <X className="h-3.5 w-3.5 text-slate-400" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        title="Delete follow-up?"
        message="The follow-up will be removed from this device."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (deleteId) await followupsRepo.remove(deleteId);
          toast.success("Follow-up deleted");
        }}
      />

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="New follow-up"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={create}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Lead">
            <Input
              value={form.lead_id}
              onChange={(e) => setForm({ ...form, lead_id: e.target.value })}
              list="lead-options"
              placeholder="Search lead name…"
            />
            <datalist id="lead-options">
              {(leads || []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.business_name}
                </option>
              ))}
            </datalist>
          </Field>
          <Field label="Title">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Due">
            <Input type="datetime-local" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} />
          </Field>
          <Field label="Notes">
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
