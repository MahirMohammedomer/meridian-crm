import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { Plus, FolderKanban, CalendarDays, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { useApp } from "@/lib/app";
import { projectsRepo } from "@/lib/repos";
import { Badge, Button, Card, ConfirmDialog, Dialog, Dropdown, EmptyState, Field, Input, MenuItem, NativeSelect, Progress, SectionTitle, Tabs, Textarea } from "@/components/ui/ui";
import { PROJECT_STAGES } from "@/lib/types";
import { STAGE_STYLES, cn, formatDate, formatETB } from "@/lib/utils";

export function Projects() {
  const { openProject, openLead, navigate } = useApp();
  const [filter, setFilter] = useState("active");
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({
    name: "",
    description: "",
    stage: "Planning",
    value: 35000,
    deadline: "",
    client_lead_id: "",
  });

  const projects = useLiveQuery(async () => db.projects.toArray(), [], []);
  const leads = useLiveQuery(async () => db.leads.toArray(), [], []);
  const tasks = useLiveQuery(async () => db.project_tasks.toArray(), [], []);
  const clients = useMemo(() => (leads || []).filter((l) => !l.deleted_at), [leads]);

  const visible = useMemo(() => {
    const list = [...(projects || [])];
    if (filter === "active") return list.filter((p) => p.stage !== "Completed");
    if (filter === "completed") return list.filter((p) => p.stage === "Completed");
    return list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [projects, filter]);

  const totals = useMemo(() => {
    const value = (projects || []).reduce((s, p) => s + (p.value || 0), 0);
    const paid = (projects || []).reduce((s, p) => s + (p.paid || 0), 0);
    return { value, paid, remaining: value - paid };
  }, [projects]);

  const onClientChange = (id: string) => {
    const lead = (clients || []).find((c) => c.id === id);
    setForm((f: any) => ({
      ...f,
      client_lead_id: id,
      name: f.name || (lead ? `${lead.business_name} Website` : f.name),
    }));
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-5 md:px-7 md:py-7">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-slate-900 dark:text-white">Projects</h1>
          <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
            {formatETB(totals.value)} value · {formatETB(totals.paid)} paid · {formatETB(totals.remaining)} outstanding
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("tasks")}>
            All tasks
          </Button>
          <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New project
          </Button>
        </div>
      </div>

      <Tabs
        className="mb-4 max-w-md"
        value={filter}
        onChange={setFilter}
        tabs={[
          { value: "active", label: "Active" },
          { value: "completed", label: "Completed" },
          { value: "all", label: "All" },
        ]}
      />

      {visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FolderKanban className="h-6 w-6" />}
            title="No projects yet"
            description="Create a project when you win a client. Track stages, tasks, notes, files and payments."
            action={
              <Button variant="primary" onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" /> New project
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((p) => {
            const lead = (leads || []).find((l) => l.id === p.client_lead_id);
            const pTasks = (tasks || []).filter((t) => t.project_id === p.id);
            const done = pTasks.filter((t) => t.status === "Done").length;
            const overdueDeadline = p.deadline && p.stage !== "Completed" && new Date(p.deadline) < new Date();
            return (
              <Card key={p.id} className="p-4 transition hover:border-slate-300 dark:hover:border-white/20">
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => openProject(p.id)} className="min-w-0 text-left">
                    <div className="truncate text-[15px] font-semibold text-slate-900 dark:text-white">{p.name}</div>
                    <div className="truncate text-[12px] text-slate-500 dark:text-slate-400">
                      {lead?.business_name || "No client linked"}
                    </div>
                  </button>
                  <Dropdown
                    trigger={({ toggle }) => (
                      <Button variant="ghost" size="icon-sm" onClick={toggle}>
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                          <circle cx="12" cy="5" r="1.7" />
                          <circle cx="12" cy="12" r="1.7" />
                          <circle cx="12" cy="19" r="1.7" />
                        </svg>
                      </Button>
                    )}
                  >
                    {({ close }) => (
                      <>
                        <SectionTitle className="px-2.5 py-1">Stage</SectionTitle>
                        {PROJECT_STAGES.map((s) => (
                          <MenuItem
                            key={s}
                            className={p.stage === s ? "bg-slate-100 dark:bg-white/10" : ""}
                            onClick={async () => {
                              await projectsRepo.update(p.id, { stage: s, progress: s === "Completed" ? 100 : p.progress });
                              close();
                            }}
                          >
                            {s}
                          </MenuItem>
                        ))}
                        <MenuItem
                          danger
                          onClick={() => {
                            setDeleteId(p.id);
                            close();
                          }}
                        >
                          Delete project
                        </MenuItem>
                      </>
                    )}
                  </Dropdown>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge className={STAGE_STYLES[p.stage]}>{p.stage}</Badge>
                  {p.deadline && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-[11.5px]",
                        overdueDeadline ? "font-medium text-red-500" : "text-slate-400",
                      )}
                    >
                      <CalendarDays className="h-3 w-3" /> {formatDate(p.deadline)}
                    </span>
                  )}
                </div>

                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      {p.progress}% · {done}/{pTasks.length} tasks
                    </span>
                    <span>
                      {formatETB(p.paid)} / {formatETB(p.value)}
                    </span>
                  </div>
                  <Progress value={p.progress} />
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Badge
                    className={
                      p.payment_status === "Paid"
                        ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                        : p.payment_status === "Partially Paid"
                          ? "bg-amber-500/12 text-amber-600 dark:text-amber-400"
                          : p.payment_status === "Overdue"
                            ? "bg-red-500/12 text-red-600 dark:text-red-400"
                            : "bg-slate-500/12 text-slate-500"
                    }
                  >
                    {p.payment_status}
                  </Badge>
                  <Button size="sm" variant="outline" className="ml-auto" onClick={() => openProject(p.id)}>
                    Open <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                  {lead && (
                    <Button size="sm" variant="ghost" onClick={() => openLead(lead.id)}>
                      Client
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="New project"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (!form.name.trim()) return toast.error("Name required");
                const created = await projectsRepo.create({
                  ...form,
                  deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
                });
                toast.success("Project created");
                setOpen(false);
                setForm({ name: "", description: "", stage: "Planning", value: 35000, deadline: "", client_lead_id: "" });
                openProject(created.id);
              }}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Client">
            <NativeSelect value={form.client_lead_id} onChange={(e) => onClientChange(e.target.value)}>
              <option value="">— none —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.business_name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Project name">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="ABC Construction Website"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stage">
              <NativeSelect value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
                {PROJECT_STAGES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Value (ETB)">
              <Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} />
            </Field>
          </div>
          <Field label="Deadline">
            <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          </Field>
          <Field label="Description">
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </Field>
        </div>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        title="Delete project?"
        message="Tasks, notes and payment history for this project will be removed from this device."
        onConfirm={async () => {
          if (deleteId) await projectsRepo.remove(deleteId);
          toast.success("Project deleted");
        }}
      />
    </div>
  );
}
