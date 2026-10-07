import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { useApp } from "@/lib/app";
import {
  activitiesRepo,
  contactsRepo,
  followupsRepo,
  leadsRepo,
  notesRepo,
  paymentsRepo,
  projectsRepo,
  tasksRepo,
} from "@/lib/repos";
import { Button, Dialog, Field, Input, NativeSelect, Textarea } from "@/components/ui/ui";
import { ACTIVITY_TYPES, LEAD_STATUSES, PROJECT_STAGES, type ActivityType, type Lead, type Tier } from "@/lib/types";
import { addDays, toLocalInputValue } from "@/lib/utils";

const TYPES = [
  { value: "lead", label: "Lead", emoji: "🏢" },
  { value: "followup", label: "Follow-up", emoji: "⏰" },
  { value: "note", label: "Note", emoji: "📝" },
  { value: "activity", label: "Activity", emoji: "📞" },
  { value: "task", label: "Task", emoji: "✅" },
  { value: "project", label: "Project", emoji: "🚧" },
  { value: "contact", label: "Contact", emoji: "👤" },
  { value: "payment", label: "Payment", emoji: "💰" },
];

export function QuickAdd() {
  const { quickAdd, setQuickAdd, quickAddLeadId, setQuickAddLeadId } = useApp();
  const leads = useLiveQuery(() => db.leads.toArray(), [], []);
  const projects = useLiveQuery(() => db.projects.toArray(), [], []);

  const [lead, setLead] = useState<any>({
    business_name: "",
    phone: "",
    category: "",
    city: "",
    email: "",
    website: "",
    google_maps_url: "",
    tier: 3,
    lead_score: 0,
    status: "New",
    potential_value: "",
  });
  const [fu, setFu] = useState<any>({
    lead_id: "",
    title: "",
    due: toLocalInputValue(addDays(new Date(), 1).toISOString()),
    notes: "",
  });
  const [note, setNote] = useState<any>({ lead_id: "", content: "" });
  const [act, setAct] = useState<any>({ lead_id: "", type: "Call", content: "" });
  const [task, setTask] = useState<any>({ project_id: "", title: "", status: "To Do", priority: "Medium" });
  const [proj, setProj] = useState<any>({ name: "", client_lead_id: "", stage: "Planning", value: 35000 });
  const [contact, setContact] = useState<any>({ lead_id: "", name: "", role: "Owner", phone: "", email: "" });
  const [pay, setPay] = useState<any>({ project_id: "", lead_id: "", amount: "", date: new Date().toISOString().slice(0, 10) });

  useEffect(() => {
    if (!quickAdd) return;
    setFu((f: any) => ({ ...f, lead_id: quickAddLeadId || f.lead_id }));
    setNote((n: any) => ({ ...n, lead_id: quickAddLeadId || n.lead_id }));
    setAct((a: any) => ({ ...a, lead_id: quickAddLeadId || a.lead_id }));
    setContact((c: any) => ({ ...c, lead_id: quickAddLeadId || c.lead_id }));
  }, [quickAdd, quickAddLeadId]);

  const close = () => {
    setQuickAdd(null);
    setQuickAddLeadId(null);
  };

  const activeLead: Lead | undefined = (leads || []).find((l) => l.id === quickAddLeadId);
  const title = TYPES.find((t) => t.value === quickAdd)?.label || "Add";

  const submit = async () => {
    switch (quickAdd) {
      case "lead": {
        if (!lead.business_name.trim()) return toast.error("Business name required");
        await leadsRepo.create({
          ...lead,
          lead_score: Number(lead.lead_score) || 0,
          tier: Number(lead.tier) as Tier,
          potential_value: lead.potential_value ? Number(lead.potential_value) : null,
          website_status: lead.website ? "has_website" : "no_website",
        });
        toast.success("Lead added");
        break;
      }
      case "followup": {
        if (!fu.lead_id) return toast.error("Pick a lead");
        const l = (leads || []).find((x) => x.id === fu.lead_id);
        await followupsRepo.create({
          lead_id: fu.lead_id,
          title: fu.title.trim() || `Follow up with ${l?.business_name || "lead"}`,
          due_date: new Date(fu.due).toISOString(),
          notes: fu.notes,
        });
        toast.success("Follow-up created");
        break;
      }
      case "note": {
        if (!note.lead_id) return toast.error("Pick a lead");
        if (!note.content.trim()) return toast.error("Write something");
        await notesRepo.create(note.lead_id, note.content.trim());
        toast.success("Note saved");
        break;
      }
      case "activity": {
        if (!act.lead_id) return toast.error("Pick a lead");
        if (!act.content.trim()) return toast.error("Describe the activity");
        await activitiesRepo.create(act.lead_id, act.type as ActivityType, act.content.trim());
        toast.success("Activity logged");
        break;
      }
      case "task": {
        if (!task.project_id) return toast.error("Pick a project");
        if (!task.title.trim()) return toast.error("Task title required");
        await tasksRepo.create({ ...task, project_id: task.project_id });
        toast.success("Task added");
        break;
      }
      case "project": {
        if (!proj.name.trim()) return toast.error("Project name required");
        await projectsRepo.create({ ...proj, value: Number(proj.value) || 0 });
        toast.success("Project created");
        break;
      }
      case "contact": {
        if (!contact.lead_id) return toast.error("Pick a lead");
        if (!contact.name.trim()) return toast.error("Contact name required");
        await contactsRepo.create(contact);
        toast.success("Contact added");
        break;
      }
      case "payment": {
        if (!pay.amount || Number(pay.amount) <= 0) return toast.error("Enter an amount");
        await paymentsRepo.create({
          project_id: pay.project_id || undefined,
          lead_id: pay.lead_id || undefined,
          amount: Number(pay.amount),
          date: new Date(pay.date).toISOString(),
        });
        toast.success("Payment recorded");
        break;
      }
    }
    close();
  };

  return (
    <Dialog
      open={Boolean(quickAdd)}
      onClose={close}
      title={activeLead ? `${title} · ${activeLead.business_name}` : `Quick add · ${title}`}
      size="md"
      footer={
        <>
          <div className="mr-auto flex flex-wrap gap-1">
            {TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setQuickAdd(t.value as any)}
                className={`rounded-lg px-2 py-1 text-[11.5px] font-medium transition ${
                  quickAdd === t.value
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300"
                }`}
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Save
          </Button>
        </>
      }
    >
      {quickAdd === "lead" && (
        <div className="space-y-3">
          <Field label="Business name">
            <Input autoFocus value={lead.business_name} onChange={(e) => setLead({ ...lead, business_name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <Input value={lead.phone} onChange={(e) => setLead({ ...lead, phone: e.target.value })} placeholder="+251 91 234 5678" />
            </Field>
            <Field label="Category / niche">
              <Input value={lead.category} onChange={(e) => setLead({ ...lead, category: e.target.value })} />
            </Field>
            <Field label="City">
              <Input value={lead.city} onChange={(e) => setLead({ ...lead, city: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} />
            </Field>
            <Field label="Website">
              <Input value={lead.website} onChange={(e) => setLead({ ...lead, website: e.target.value })} />
            </Field>
            <Field label="Google Maps URL">
              <Input value={lead.google_maps_url} onChange={(e) => setLead({ ...lead, google_maps_url: e.target.value })} />
            </Field>
            <Field label="Tier (manual)">
              <NativeSelect value={String(lead.tier)} onChange={(e) => setLead({ ...lead, tier: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5].map((t) => (
                  <option key={t} value={t}>
                    Tier {t}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Score (manual)">
              <Input type="number" min={0} max={100} value={lead.lead_score} onChange={(e) => setLead({ ...lead, lead_score: Number(e.target.value) })} />
            </Field>
            <Field label="Status">
              <NativeSelect value={lead.status} onChange={(e) => setLead({ ...lead, status: e.target.value })}>
                {LEAD_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Potential value (ETB)">
              <Input type="number" value={lead.potential_value} onChange={(e) => setLead({ ...lead, potential_value: e.target.value })} />
            </Field>
          </div>
        </div>
      )}

      {quickAdd === "followup" && (
        <div className="space-y-3">
          <Field label="Lead">
            <NativeSelect value={fu.lead_id} onChange={(e) => setFu({ ...fu, lead_id: e.target.value })}>
              <option value="">— select —</option>
              {(leads || []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.business_name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Title">
            <Input value={fu.title} onChange={(e) => setFu({ ...fu, title: e.target.value })} placeholder="Follow up with…" />
          </Field>
          <Field label="Due date">
            <Input type="datetime-local" value={fu.due} onChange={(e) => setFu({ ...fu, due: e.target.value })} />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: "Tomorrow", days: 1 },
              { label: "In 3 days", days: 3 },
              { label: "Next week", days: 7 },
            ].map((o) => (
              <Button key={o.label} size="xs" variant="outline" onClick={() => setFu({ ...fu, due: toLocalInputValue(addDays(new Date(), o.days).toISOString()) })}>
                {o.label}
              </Button>
            ))}
          </div>
          <Field label="Notes">
            <Textarea value={fu.notes} onChange={(e) => setFu({ ...fu, notes: e.target.value })} rows={2} />
          </Field>
        </div>
      )}

      {quickAdd === "note" && (
        <div className="space-y-3">
          <Field label="Lead">
            <NativeSelect value={note.lead_id} onChange={(e) => setNote({ ...note, lead_id: e.target.value })}>
              <option value="">— select —</option>
              {(leads || []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.business_name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Note">
            <Textarea autoFocus value={note.content} onChange={(e) => setNote({ ...note, content: e.target.value })} rows={4} />
          </Field>
        </div>
      )}

      {quickAdd === "activity" && (
        <div className="space-y-3">
          <Field label="Lead">
            <NativeSelect value={act.lead_id} onChange={(e) => setAct({ ...act, lead_id: e.target.value })}>
              <option value="">— select —</option>
              {(leads || []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.business_name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Type">
            <NativeSelect value={act.type} onChange={(e) => setAct({ ...act, type: e.target.value })}>
              {ACTIVITY_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="What happened">
            <Textarea autoFocus value={act.content} onChange={(e) => setAct({ ...act, content: e.target.value })} rows={3} />
          </Field>
        </div>
      )}

      {quickAdd === "task" && (
        <div className="space-y-3">
          <Field label="Project">
            <NativeSelect value={task.project_id} onChange={(e) => setTask({ ...task, project_id: e.target.value })}>
              <option value="">— select —</option>
              {(projects || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Task">
            <Input autoFocus value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <NativeSelect value={task.status} onChange={(e) => setTask({ ...task, status: e.target.value })}>
                {["To Do", "In Progress", "Review", "Done"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Priority">
              <NativeSelect value={task.priority} onChange={(e) => setTask({ ...task, priority: e.target.value })}>
                {["Low", "Medium", "High", "Urgent"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </NativeSelect>
            </Field>
          </div>
        </div>
      )}

      {quickAdd === "project" && (
        <div className="space-y-3">
          <Field label="Project name">
            <Input autoFocus value={proj.name} onChange={(e) => setProj({ ...proj, name: e.target.value })} />
          </Field>
          <Field label="Client">
            <NativeSelect value={proj.client_lead_id} onChange={(e) => setProj({ ...proj, client_lead_id: e.target.value })}>
              <option value="">— none —</option>
              {(leads || []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.business_name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stage">
              <NativeSelect value={proj.stage} onChange={(e) => setProj({ ...proj, stage: e.target.value })}>
                {PROJECT_STAGES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Value (ETB)">
              <Input type="number" value={proj.value} onChange={(e) => setProj({ ...proj, value: Number(e.target.value) })} />
            </Field>
          </div>
        </div>
      )}

      {quickAdd === "contact" && (
        <div className="space-y-3">
          <Field label="Lead">
            <NativeSelect value={contact.lead_id} onChange={(e) => setContact({ ...contact, lead_id: e.target.value })}>
              <option value="">— select —</option>
              {(leads || []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.business_name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name">
              <Input autoFocus value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
            </Field>
            <Field label="Role">
              <NativeSelect value={contact.role} onChange={(e) => setContact({ ...contact, role: e.target.value })}>
                {["Owner", "Manager", "Marketing", "Other"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Phone">
              <Input value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
            </Field>
          </div>
        </div>
      )}

      {quickAdd === "payment" && (
        <div className="space-y-3">
          <Field label="Project">
            <NativeSelect value={pay.project_id} onChange={(e) => setPay({ ...pay, project_id: e.target.value })}>
              <option value="">— none —</option>
              {(projects || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Client / lead (optional)">
            <NativeSelect value={pay.lead_id} onChange={(e) => setPay({ ...pay, lead_id: e.target.value })}>
              <option value="">— none —</option>
              {(leads || []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.business_name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (ETB)">
              <Input type="number" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
            </Field>
            <Field label="Date">
              <Input type="date" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} />
            </Field>
          </div>
        </div>
      )}
    </Dialog>
  );
}
