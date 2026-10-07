import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Check,
  CalendarDays,
  Wallet,
  FileText,
  Paperclip,
  Upload,
  Download,
  Eye,
  Copy,
  ExternalLink,
  GripVertical,
  Sparkles,
  ListChecks,
  StickyNote,
  Activity as ActivityIcon,
  Cloud,
  CloudOff,
  Loader2,
} from "lucide-react";
import { db } from "@/lib/db";
import { useApp } from "@/lib/app";
import {
  duplicateProject,
  paymentsRepo,
  projectNotesRepo,
  projectsRepo,
  recalcProjectProgress,
  tasksRepo,
} from "@/lib/repos";
import { attachFile, deleteFile, downloadFile, fileKind, formatSize, isUploadPending, openFile } from "@/lib/files";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  Input,
  NativeSelect,
  Progress,
  SectionTitle,
  Tabs,
  Textarea,
} from "@/components/ui/ui";
import {
  PROJECT_STAGES,
  type Project,
  type ProjectTask,
  type TaskPriority,
  type TaskStatus,
  type ProjectStage,
} from "@/lib/types";
import { STAGE_STYLES, addDays, cn, formatDate, formatETB, timeAgo, toLocalInputValue } from "@/lib/utils";

const TASK_STATUS: TaskStatus[] = ["To Do", "In Progress", "Review", "Done"];

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  Low: "bg-slate-500/12 text-slate-500 ring-slate-500/20",
  Medium: "bg-blue-500/12 text-blue-600 ring-blue-500/20 dark:text-blue-400",
  High: "bg-orange-500/12 text-orange-600 ring-orange-500/20 dark:text-orange-400",
  Urgent: "bg-red-500/12 text-red-600 ring-red-500/20 dark:text-red-400",
};

export function ProjectDetailPage() {
  const { projectId, closeProject, navigate, openLead } = useApp();

  const project = useLiveQuery<Project | undefined>(
    async () => (projectId ? db.projects.get(projectId) : undefined),
    [projectId],
  );
  const lead = useLiveQuery(async () => {
    if (!project?.client_lead_id) return undefined;
    return db.leads.get(project.client_lead_id);
  }, [project?.client_lead_id]);
  const tasks = useLiveQuery<ProjectTask[] | undefined>(
    async () => (projectId ? db.project_tasks.where("project_id").equals(projectId).toArray() : []),
    [projectId],
  );
  const notes = useLiveQuery<any[] | undefined>(
    async () => (projectId ? db.project_notes.where("project_id").equals(projectId).reverse().sortBy("created_at") : []),
    [projectId],
  );
  const payments = useLiveQuery<any[] | undefined>(
    async () => (projectId ? db.payments.where("project_id").equals(projectId).reverse().sortBy("date") : []),
    [projectId],
  );
  const files = useLiveQuery<any[] | undefined>(
    async () => (projectId ? db.project_files_meta.where("project_id").equals(projectId).reverse().sortBy("created_at") : []),
    [projectId],
  );

  const [tab, setTab] = useState("tasks");
  const [taskOpen, setTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState<any>({ amount: "", date: new Date().toISOString().slice(0, 10), notes: "" });
  const [noteText, setNoteText] = useState("");
  const [draggingFile, setDraggingFile] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const blankTask = { title: "", description: "", status: "To Do" as TaskStatus, priority: "Medium" as TaskPriority, due_date: "", notes: "", subtasks: [] as { id: string; text: string; done: boolean }[] };
  const [taskForm, setTaskForm] = useState<any>(blankTask);
  const [subtaskDraft, setSubtaskDraft] = useState("");

  if (!projectId) return null;

  if (!project) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Card className="p-8 text-center">
          <p className="text-[14px] text-slate-500">Project not found.</p>
          <Button className="mt-4" variant="secondary" onClick={closeProject}>
            Back to projects
          </Button>
        </Card>
      </div>
    );
  }

  const remaining = (project.value || 0) - (project.paid || 0);
  const doneTasks = (tasks || []).filter((t) => t.status === "Done").length;
  const stageIndex = PROJECT_STAGES.indexOf(project.stage);

  const onDragEnd = async (e: DragEndEvent) => {
    setDragId(null);
    const over = String(e.over?.id || "");
    if (!over || !TASK_STATUS.includes(over as TaskStatus)) return;
    const id = String(e.active.id);
    const task = (tasks || []).find((t) => t.id === id);
    if (!task || task.status === over) return;
    await tasksRepo.update(id, { status: over as TaskStatus });
    toast.success(`${task.title} → ${over}`);
  };

  const saveTask = async () => {
    if (!taskForm.title.trim()) return toast.error("Task title required");
    const payload = {
      title: taskForm.title.trim(),
      description: taskForm.description,
      status: taskForm.status,
      priority: taskForm.priority,
      due_date: taskForm.due_date ? new Date(taskForm.due_date).toISOString() : null,
      notes: taskForm.notes,
      subtasks: taskForm.subtasks,
    };
    if (editingTask) {
      await tasksRepo.update(editingTask.id, payload);
      toast.success("Task updated");
    } else {
      await tasksRepo.create({ ...payload, project_id: project.id });
      toast.success("Task added");
    }
    setTaskOpen(false);
    setEditingTask(null);
    setTaskForm(blankTask);
  };

  const openTask = (t: ProjectTask | null) => {
    setEditingTask(t);
    setTaskForm(
      t
        ? {
            title: t.title,
            description: t.description || "",
            status: t.status,
            priority: t.priority,
            due_date: t.due_date ? toLocalInputValue(t.due_date).slice(0, 10) : "",
            notes: t.notes || "",
            subtasks: t.subtasks || [],
          }
        : blankTask,
    );
    setTaskOpen(true);
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    for (const f of Array.from(fileList)) {
      await attachFile(project.id, f);
    }
    toast.success(`${fileList.length} file${fileList.length === 1 ? "" : "s"} attached`);
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-5 md:px-7 md:py-7">
      {/* Header */}
      <div className="mb-5">
        <button
          onClick={closeProject}
          className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-slate-500 transition hover:text-slate-800 dark:hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" /> Projects
        </button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[24px] font-semibold tracking-tight text-slate-900 dark:text-white">{project.name}</h1>
              <span className={cn("rounded-full px-2.5 py-0.5 text-[11.5px] font-medium", STAGE_STYLES[project.stage])}>
                {project.stage}
              </span>
              <span className="text-[15px] font-semibold text-slate-500 dark:text-slate-400">{project.progress}%</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-500 dark:text-slate-400">
              {lead && (
                <button onClick={() => openLead(lead.id)} className="hover:underline">
                  👤 {lead.business_name}
                </button>
              )}
              {project.deadline && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" /> {formatDate(project.deadline)}
                </span>
              )}
              <span>
                {doneTasks}/{(tasks || []).length} tasks · {(notes || []).length} notes · {(files || []).length} files
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => openTask(null)}>
              <Plus className="h-3.5 w-3.5" /> Task
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPayOpen(true)}>
              <Wallet className="h-3.5 w-3.5" /> Payment
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const copy = await duplicateProject(project.id);
                if (copy) {
                  toast.success("Project duplicated with tasks");
                  navigate("projects");
                }
              }}
            >
              <Copy className="h-3.5 w-3.5" /> Duplicate
            </Button>
            <Button variant="danger" size="sm" onClick={() => setDeleteId(project.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <MiniCard label="Value" value={formatETB(project.value)} />
        <MiniCard label="Paid" value={formatETB(project.paid)} tone="emerald" />
        <MiniCard label="Remaining" value={formatETB(remaining)} tone="amber" />
        <MiniCard
          label="Payment status"
          value={project.payment_status}
          tone={project.payment_status === "Paid" ? "emerald" : project.payment_status === "Unpaid" ? "amber" : undefined}
        />
      </div>

      {/* Stage stepper */}
      <Card className="mb-4 p-4">
        <SectionTitle>Stage</SectionTitle>
        <div className="mt-3 flex items-center gap-1 overflow-x-auto pb-1">
          {PROJECT_STAGES.map((s, i) => {
            const isPast = i < stageIndex;
            const isCurrent = i === stageIndex;
            return (
              <button
                key={s}
                onClick={() => projectsRepo.update(project.id, { stage: s as ProjectStage, progress: s === "Completed" ? 100 : project.progress })}
                className="group flex min-w-0 flex-1 items-center gap-1.5"
                title={`Set stage to ${s}`}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold transition",
                    isCurrent
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : isPast
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-100 text-slate-400 dark:bg-white/10",
                  )}
                >
                  {isPast ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "hidden truncate text-[12px] font-medium sm:inline",
                    isCurrent ? "text-slate-900 dark:text-white" : "text-slate-400",
                  )}
                >
                  {s}
                </span>
                {i < PROJECT_STAGES.length - 1 && (
                  <span className={cn("h-0.5 flex-1 rounded", isPast ? "bg-emerald-500" : "bg-slate-200 dark:bg-white/10")} />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="min-w-[220px] flex-1">
            <div className="mb-1 flex items-center justify-between text-[11.5px] text-slate-400">
              <span>Progress</span>
              <span className="font-medium text-slate-600 dark:text-slate-300">{project.progress}%</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                value={project.progress}
                onChange={(e) => projectsRepo.update(project.id, { progress: Number(e.target.value) })}
                className="flex-1"
              />
              <input
                type="number"
                min={0}
                max={100}
                defaultValue={project.progress}
                key={project.progress}
                onBlur={(e) =>
                  projectsRepo.update(project.id, {
                    progress: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                  })
                }
                className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-center text-[13px] dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const p = await recalcProjectProgress(project.id);
              toast.success(`Progress recalculated from tasks · ${p}%`);
            }}
          >
            <Sparkles className="h-3.5 w-3.5" /> Calculate from tasks
          </Button>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "tasks", label: `Tasks (${(tasks || []).length})` },
          { value: "files", label: `Files (${(files || []).length})` },
          { value: "notes", label: `Notes (${(notes || []).length})` },
          { value: "payments", label: `Payments (${(payments || []).length})` },
          { value: "activity", label: "Activity" },
        ]}
      />

      {tab === "tasks" && (
        <DndContext
          sensors={sensors}
          onDragStart={(e: DragStartEvent) => setDragId(String(e.active.id))}
          onDragEnd={onDragEnd}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {TASK_STATUS.map((status) => {
              const items = (tasks || []).filter((t) => t.status === status);
              return (
                <TaskColumn key={status} status={status} items={items} onOpen={openTask} onAdd={() => openTask(null)} />
              );
            })}
          </div>
          <DragOverlay>
            {dragId && (tasks || []).find((t) => t.id === dragId) ? (
              <div className="w-[240px] rotate-2 opacity-95">
                <TaskCard task={(tasks || []).find((t) => t.id === dragId)!} onOpen={() => {}} dragging />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {tab === "files" && (
        <div className="space-y-3">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDraggingFile(true);
            }}
            onDragLeave={() => setDraggingFile(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDraggingFile(false);
              void handleFiles(e.dataTransfer.files);
            }}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition",
              draggingFile
                ? "border-slate-900 bg-slate-50 dark:border-white dark:bg-white/5"
                : "border-slate-200 hover:border-slate-300 dark:border-white/10",
            )}
          >
            <Upload className="mb-2 h-6 w-6 text-slate-400" />
            <div className="text-[14px] font-medium text-slate-900 dark:text-white">Drop files here</div>
            <div className="mt-0.5 text-[12.5px] text-slate-500">
              Logos, images, documents, client assets — cached locally, uploaded when online
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => void handleFiles(e.target.files)}
            />
          </div>

          {!isSupabaseOn() && (
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-[12px] text-slate-500 dark:bg-white/5 dark:text-slate-400">
              Supabase Storage is not configured — files stay cached on this device only.
            </div>
          )}

          {(files || []).length === 0 ? (
            <Card className="p-8 text-center text-[13px] text-slate-400">No files attached yet.</Card>
          ) : (
            <div className="space-y-2">
              {(files || []).map((f) => {
                const pending = isUploadPending(f) && isSupabaseOn();
                return (
                  <Card key={f.id} className="flex flex-wrap items-center gap-3 p-3.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-white/5">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-medium text-slate-900 dark:text-white">{f.file_name}</div>
                      <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-slate-400">
                        <span>{formatSize(f.file_size)}</span>
                        <span>· {fileKind(f.file_name, f.file_type)}</span>
                        <span>· {formatDate(f.created_at)}</span>
                      </div>
                    </div>
                    {pending ? (
                      <Badge className="bg-amber-500/12 text-amber-600 dark:text-amber-400">
                        <Loader2 className="h-3 w-3 animate-spin" /> Waiting to upload
                      </Badge>
                    ) : f.is_cached_locally ? (
                      <Badge className="bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
                        <CloudOff className="h-3 w-3" /> Offline available
                      </Badge>
                    ) : (
                      <Badge className="bg-slate-500/12 text-slate-500">
                        <Cloud className="h-3 w-3" /> Cloud only
                      </Badge>
                    )}
                    <div className="flex gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        title="Open"
                        onClick={async () => {
                          const r = await openFile(f);
                          if (!r.ok) toast.error(r.message);
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        title="Download"
                        onClick={async () => {
                          const r = await downloadFile(f);
                          if (!r.ok) toast.error(r.message);
                        }}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        title="Delete"
                        onClick={async () => {
                          await deleteFile(f);
                          toast.success("File deleted");
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "notes" && (
        <div className="space-y-3">
          <Card className="p-3.5">
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
              placeholder="Project note — client feedback, credentials, scope changes…"
            />
            <div className="mt-2 flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={async () => {
                  if (!noteText.trim()) return;
                  await projectNotesRepo.create(project.id, noteText.trim());
                  setNoteText("");
                  toast.success("Note saved");
                }}
              >
                <StickyNote className="h-3.5 w-3.5" /> Save note
              </Button>
            </div>
          </Card>
          {(notes || []).length === 0 ? (
            <Card className="p-8 text-center text-[13px] text-slate-400">No project notes yet.</Card>
          ) : (
            (notes || []).map((n) => (
              <Card key={n.id} className="p-3.5">
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700 dark:text-slate-200">
                  {n.content}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">{timeAgo(n.created_at)}</span>
                  <Button size="xs" variant="ghost" onClick={async () => projectNotesRepo.remove(n.id)}>
                    Delete
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === "payments" && (
        <div className="space-y-3">
          <Card className="flex flex-wrap items-center gap-3 p-4">
            <div className="flex-1">
              <SectionTitle>Payment summary</SectionTitle>
              <div className="mt-2 flex flex-wrap gap-4 text-[13px]">
                <span className="text-slate-500">
                  Value <b className="text-slate-900 dark:text-white">{formatETB(project.value)}</b>
                </span>
                <span className="text-slate-500">
                  Paid <b className="text-emerald-600 dark:text-emerald-400">{formatETB(project.paid)}</b>
                </span>
                <span className="text-slate-500">
                  Remaining <b className="text-amber-600 dark:text-amber-400">{formatETB(remaining)}</b>
                </span>
              </div>
            </div>
            <Button variant="primary" size="sm" onClick={() => setPayOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add payment
            </Button>
          </Card>
          {(payments || []).length === 0 ? (
            <Card className="p-8 text-center text-[13px] text-slate-400">No payments recorded.</Card>
          ) : (
            (payments || []).map((p) => (
              <Card key={p.id} className="flex items-center justify-between p-3.5">
                <div>
                  <div className="text-[14px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatETB(p.amount)}
                  </div>
                  <div className="text-[11.5px] text-slate-400">
                    {formatDate(p.date)} {p.notes ? `· ${p.notes}` : ""}
                  </div>
                </div>
                <Button size="icon-sm" variant="ghost" onClick={async () => paymentsRepo.remove(p.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-slate-400" />
                </Button>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === "activity" && (
        <Card className="divide-y divide-slate-100 dark:divide-white/5">
          {!lead ? (
            <div className="p-8 text-center text-[13px] text-slate-400">Link a client to see communication history.</div>
          ) : (
            <ProjectActivity leadId={lead.id} />
          )}
          <div className="p-4">
            <div className="flex flex-wrap gap-2 text-[12.5px] text-slate-500">
              <span className="inline-flex items-center gap-1">
                <ListChecks className="h-3.5 w-3.5" /> {(tasks || []).length} tasks
              </span>
              <span className="inline-flex items-center gap-1">
                <Paperclip className="h-3.5 w-3.5" /> {(files || []).length} files
              </span>
              <span className="inline-flex items-center gap-1">
                <StickyNote className="h-3.5 w-3.5" /> {(notes || []).length} notes
              </span>
              <span className="inline-flex items-center gap-1">
                <ActivityIcon className="h-3.5 w-3.5" /> Created {formatDate(project.created_at)}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Task dialog */}
      <Dialog
        open={taskOpen}
        onClose={() => {
          setTaskOpen(false);
          setEditingTask(null);
        }}
        title={editingTask ? "Edit task" : "New task"}
        size="md"
        footer={
          <>
            {editingTask && (
              <Button
                variant="ghost"
                className="mr-auto text-red-500"
                onClick={async () => {
                  await tasksRepo.remove(editingTask.id);
                  setTaskOpen(false);
                  setEditingTask(null);
                  toast.success("Task deleted");
                }}
              >
                Delete
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                setTaskOpen(false);
                setEditingTask(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={saveTask}>
              Save task
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Title">
            <Input autoFocus value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="Build homepage hero section" />
          </Field>
          <Field label="Description">
            <Textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} rows={2} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <NativeSelect value={taskForm.status} onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value as TaskStatus })}>
                {TASK_STATUS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Priority">
              <NativeSelect value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as TaskPriority })}>
                {["Low", "Medium", "High", "Urgent"].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field label="Due date">
            <Input type="date" value={taskForm.due_date} onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })} />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: "Tomorrow", days: 1 },
              { label: "In 3 days", days: 3 },
              { label: "Next week", days: 7 },
            ].map((o) => (
              <Button
                key={o.label}
                size="xs"
                variant="outline"
                onClick={() => setTaskForm({ ...taskForm, due_date: addDays(new Date(), o.days).toISOString().slice(0, 10) })}
              >
                {o.label}
              </Button>
            ))}
            {taskForm.due_date && (
              <Button size="xs" variant="ghost" onClick={() => setTaskForm({ ...taskForm, due_date: "" })}>
                Clear
              </Button>
            )}
          </div>
          <Field label="Subtasks">
            <div className="space-y-1.5">
              {(taskForm.subtasks || []).map((s: any, i: number) => (
                <div key={s.id || i} className="flex items-center gap-2">
                  <Checkbox
                    checked={s.done}
                    onChange={(v) => {
                      const next = [...taskForm.subtasks];
                      next[i] = { ...s, done: v };
                      setTaskForm({ ...taskForm, subtasks: next });
                    }}
                  />
                  <span className={cn("flex-1 text-[13px]", s.done && "text-slate-400 line-through")}>{s.text}</span>
                  <button
                    onClick={() => setTaskForm({ ...taskForm, subtasks: taskForm.subtasks.filter((_: any, j: number) => j !== i) })}
                    className="text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  value={subtaskDraft}
                  onChange={(e) => setSubtaskDraft(e.target.value)}
                  placeholder="Add a subtask…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && subtaskDraft.trim()) {
                      setTaskForm({
                        ...taskForm,
                        subtasks: [...(taskForm.subtasks || []), { id: crypto.randomUUID(), text: subtaskDraft.trim(), done: false }],
                      });
                      setSubtaskDraft("");
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    if (!subtaskDraft.trim()) return;
                    setTaskForm({
                      ...taskForm,
                      subtasks: [...(taskForm.subtasks || []), { id: crypto.randomUUID(), text: subtaskDraft.trim(), done: false }],
                    });
                    setSubtaskDraft("");
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </Field>
          <Field label="Notes">
            <Textarea value={taskForm.notes} onChange={(e) => setTaskForm({ ...taskForm, notes: e.target.value })} rows={2} />
          </Field>
        </div>
      </Dialog>

      {/* Payment dialog */}
      <Dialog
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Record payment"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPayOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (!payForm.amount || Number(payForm.amount) <= 0) return toast.error("Enter an amount");
                await paymentsRepo.create({
                  project_id: project.id,
                  lead_id: project.client_lead_id,
                  amount: Number(payForm.amount),
                  date: new Date(payForm.date).toISOString(),
                  notes: payForm.notes,
                });
                setPayForm({ amount: "", date: new Date().toISOString().slice(0, 10), notes: "" });
                setPayOpen(false);
                toast.success("Payment recorded");
              }}
            >
              Record
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Amount (ETB)">
            <Input type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
          </Field>
          <Field label="Date">
            <Input type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} />
          </Field>
          <Field label="Notes">
            <Input value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} placeholder="50% advance" />
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
          closeProject();
        }}
      />
    </div>
  );
}

function isSupabaseOn() {
  return Boolean((import.meta.env.VITE_SUPABASE_URL || "").trim());
}

function MiniCard({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "amber" }) {
  return (
    <Card className="p-3.5">
      <div className="text-[10.5px] uppercase tracking-wide text-slate-400">{label}</div>
      <div
        className={cn(
          "mt-1 text-[17px] font-semibold",
          tone === "emerald"
            ? "text-emerald-600 dark:text-emerald-400"
            : tone === "amber"
              ? "text-amber-600 dark:text-amber-400"
              : "text-slate-900 dark:text-white",
        )}
      >
        {value}
      </div>
    </Card>
  );
}

function TaskColumn({
  status,
  items,
  onOpen,
  onAdd,
}: {
  status: TaskStatus;
  items: ProjectTask[];
  onOpen: (t: ProjectTask) => void;
  onAdd: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-2xl border p-2 transition-colors",
        isOver ? "border-slate-400 bg-slate-100/70 dark:border-white/30 dark:bg-white/[0.07]" : "border-slate-200/70 bg-slate-50/60 dark:border-white/[0.06] dark:bg-white/[0.02]",
      )}
    >
      <div className="flex items-center gap-2 px-1.5 py-1.5">
        <span className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          {status}
        </span>
        <span className="rounded-full bg-white px-1.5 text-[11px] font-semibold text-slate-500 dark:bg-white/10">
          {items.length}
        </span>
        <button onClick={onAdd} className="ml-auto rounded-md p-1 text-slate-400 hover:bg-white hover:text-slate-700 dark:hover:bg-white/10">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="min-h-[80px] space-y-2">
        {items.map((t) => (
          <DraggableTask key={t.id} task={t} onOpen={onOpen} />
        ))}
        {items.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 py-5 text-center text-[11.5px] text-slate-400 dark:border-white/10">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

function DraggableTask({ task, onOpen }: { task: ProjectTask; onOpen: (t: ProjectTask) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  if (isDragging) return <div ref={setNodeRef} className="h-[70px] rounded-xl border border-dashed border-slate-300 dark:border-white/20" />;
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className="touch-none">
      <TaskCard task={task} onOpen={onOpen} />
    </div>
  );
}

export function TaskCard({
  task,
  onOpen,
  dragging,
  projectName,
}: {
  task: ProjectTask;
  onOpen: (t: ProjectTask) => void;
  dragging?: boolean;
  projectName?: string;
}) {
  const overdue = task.due_date && task.status !== "Done" && new Date(task.due_date) < new Date(new Date().setHours(0, 0, 0, 0));
  const subs = task.subtasks || [];
  const subsDone = subs.filter((s) => s.done).length;
  return (
    <Card
      onClick={() => onOpen(task)}
      className={cn("cursor-pointer p-2.5 transition hover:border-slate-300 dark:hover:border-white/20", dragging && "shadow-xl")}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300 dark:text-slate-600" />
        <div className="min-w-0 flex-1">
          <div className={cn("text-[13px] font-medium text-slate-900 dark:text-white", task.status === "Done" && "text-slate-400 line-through")}>
            {task.title}
          </div>
          {projectName && <div className="truncate text-[11px] text-slate-400">{projectName}</div>}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge className={PRIORITY_STYLE[task.priority]}>{task.priority}</Badge>
            {task.due_date && (
              <span className={cn("text-[11px]", overdue ? "font-medium text-red-500" : "text-slate-400")}>
                {formatDate(task.due_date)}
              </span>
            )}
            {subs.length > 0 && (
              <span className="text-[11px] text-slate-400">
                ☑ {subsDone}/{subs.length}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function ProjectActivity({ leadId }: { leadId: string }) {
  const activities = useLiveQuery<any[] | undefined>(
    async () => db.lead_activities.where("lead_id").equals(leadId).reverse().sortBy("created_at"),
    [leadId],
  );
  if (!activities?.length) return <div className="p-8 text-center text-[13px] text-slate-400">No activity yet.</div>;
  return (
    <>
      {activities.slice(0, 30).map((a) => (
        <div key={a.id} className="flex items-start justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge>{a.type}</Badge>
              <span className="text-[11px] text-slate-400">{timeAgo(a.created_at)}</span>
            </div>
            <p className="mt-1 text-[13px] text-slate-700 dark:text-slate-200">{a.content}</p>
          </div>
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-300" />
        </div>
      ))}
    </>
  );
}

export { EmptyState, Progress, SectionTitle };
