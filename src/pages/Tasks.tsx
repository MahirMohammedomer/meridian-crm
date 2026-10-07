import { useMemo, useState } from "react";
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
import { ListChecks, Plus, KanbanSquare, List, Filter } from "lucide-react";
import { db } from "@/lib/db";
import { useApp } from "@/lib/app";
import { tasksRepo } from "@/lib/repos";
import { Badge, Button, Card, EmptyState, Select, Tabs } from "@/components/ui/ui";
import { TaskCard } from "@/pages/ProjectDetail";
import type { ProjectTask, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUSES: TaskStatus[] = ["To Do", "In Progress", "Review", "Done"];

export function TasksPage() {
  const { openProject } = useApp();
  const [view, setView] = useState("list");
  const [project, setProject] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [group, setGroup] = useState<"status" | "project">("status");
  const [dragId, setDragId] = useState<string | null>(null);

  const tasks = useLiveQuery<ProjectTask[] | undefined>(async () => db.project_tasks.toArray(), []);
  const projects = useLiveQuery(async () => db.projects.toArray(), [], []);
  const projectMap = useMemo(() => new Map((projects || []).map((p) => [p.id, p])), [projects]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const filtered = useMemo(
    () =>
      (tasks || []).filter((t) => {
        if (project && t.project_id !== project) return false;
        if (status && t.status !== status) return false;
        if (priority && t.priority !== priority) return false;
        return true;
      }),
    [tasks, project, status, priority],
  );

  const counts = useMemo(
    () => ({
      total: filtered.length,
      done: filtered.filter((t) => t.status === "Done").length,
      overdue: filtered.filter(
        (t) => t.due_date && t.status !== "Done" && new Date(t.due_date) < new Date(new Date().setHours(0, 0, 0, 0)),
      ).length,
      dueToday: filtered.filter((t) => {
        if (!t.due_date || t.status === "Done") return false;
        const d = new Date(t.due_date);
        const n = new Date();
        return d.toDateString() === n.toDateString();
      }).length,
    }),
    [filtered],
  );

  const onDragEnd = async (e: DragEndEvent) => {
    setDragId(null);
    const over = String(e.over?.id || "");
    const id = String(e.active.id);
    const task = (tasks || []).find((t) => t.id === id);
    if (!task) return;
    if (group === "status" && STATUSES.includes(over as TaskStatus)) {
      if (task.status === over) return;
      await tasksRepo.update(id, { status: over as TaskStatus });
      toast.success(`${task.title} → ${over}`);
    } else if (group === "project" && over) {
      if (task.project_id === over) return;
      await tasksRepo.update(id, { project_id: over });
      toast.success(`Moved to ${projectMap.get(over)?.name || "project"}`);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-5 md:px-7 md:py-7">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-slate-900 dark:text-white">Tasks</h1>
          <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
            {counts.total} tasks · {counts.done} done · {counts.overdue} overdue · {counts.dueToday} due today
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            className="w-[160px]"
            size="sm"
            value={project}
            onChange={setProject}
            placeholder="All projects"
            options={(projects || []).map((p) => ({ value: p.id, label: p.name }))}
          />
          <Select
            className="w-[130px]"
            size="sm"
            value={status}
            onChange={setStatus}
            placeholder="All statuses"
            options={STATUSES.map((s) => ({ value: s, label: s }))}
          />
          <Select
            className="w-[120px]"
            size="sm"
            value={priority}
            onChange={setPriority}
            placeholder="All priorities"
            options={["Low", "Medium", "High", "Urgent"].map((p) => ({ value: p, label: p }))}
          />
          <Tabs
            className="w-[180px]"
            value={view}
            onChange={setView}
            tabs={[
              { value: "list", label: <span className="flex items-center justify-center gap-1"><List className="h-3.5 w-3.5" />List</span> },
              { value: "board", label: <span className="flex items-center justify-center gap-1"><KanbanSquare className="h-3.5 w-3.5" />Board</span> },
            ]}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ListChecks className="h-6 w-6" />}
            title="No tasks match"
            description="Tasks live inside projects. Open a project to add tasks, or clear the filters above."
            action={
              <Button variant="primary" onClick={() => (window.location.hash = "#/projects")}>
                Go to projects
              </Button>
            }
          />
        </Card>
      ) : view === "list" ? (
        <Card className="divide-y divide-slate-100 dark:divide-white/5">
          {filtered
            .slice()
            .sort((a, b) => {
              const rank = { Urgent: 0, High: 1, Medium: 2, Low: 3 } as any;
              if (a.status === "Done" !== (b.status === "Done")) return a.status === "Done" ? 1 : -1;
              return rank[a.priority] - rank[b.priority];
            })
            .map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                projectName={projectMap.get(t.project_id)?.name}
                onOpen={() => openProject(t.project_id)}
                onToggle={async () => tasksRepo.update(t.id, { status: t.status === "Done" ? "To Do" : "Done" })}
              />
            ))}
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={(e: DragStartEvent) => setDragId(String(e.active.id))}
          onDragEnd={onDragEnd}
        >
          <div className="mb-2 flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[12.5px] text-slate-500">Group board by</span>
            <Tabs
              className="w-[220px]"
              value={group}
              onChange={(v) => setGroup(v as "status" | "project")}
              tabs={[
                { value: "status", label: "Status" },
                { value: "project", label: "Project" },
              ]}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {group === "status"
              ? STATUSES.map((s) => (
                  <BoardColumn
                    key={s}
                    id={s}
                    title={s}
                    items={filtered.filter((t) => t.status === s)}
                    onOpen={(t) => openProject(t.project_id)}
                    projectName={(id) => projectMap.get(id)?.name}
                  />
                ))
              : (projects || []).map((p) => (
                  <BoardColumn
                    key={p.id}
                    id={p.id}
                    title={p.name}
                    items={filtered.filter((t) => t.project_id === p.id)}
                    onOpen={(t) => openProject(t.project_id)}
                    projectName={() => undefined}
                  />
                ))}
          </div>
          <DragOverlay>
            {dragId && (tasks || []).find((t) => t.id === dragId) ? (
              <div className="w-[250px] rotate-2 opacity-95">
                <TaskCard task={(tasks || []).find((t) => t.id === dragId)!} onOpen={() => {}} dragging />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

function TaskRow({
  task,
  projectName,
  onOpen,
  onToggle,
}: {
  task: ProjectTask;
  projectName?: string;
  onOpen: () => void;
  onToggle: () => void;
}) {
  const overdue = task.due_date && task.status !== "Done" && new Date(task.due_date) < new Date(new Date().setHours(0, 0, 0, 0));
  const subs = task.subtasks || [];
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <input
        type="checkbox"
        checked={task.status === "Done"}
        onChange={onToggle}
        className="h-4 w-4 shrink-0 rounded"
        aria-label="Complete task"
      />
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className={cn("truncate text-[13.5px] font-medium text-slate-900 dark:text-white", task.status === "Done" && "text-slate-400 line-through")}>
          {task.title}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-slate-400">
          {projectName && <span>{projectName}</span>}
          {task.due_date && <span className={overdue ? "font-medium text-red-500" : ""}>{task.due_date.slice(0, 10)}</span>}
          {subs.length > 0 && (
            <span>
              ☑ {subs.filter((s) => s.done).length}/{subs.length}
            </span>
          )}
        </div>
      </button>
      <Badge
        className={
          task.priority === "Urgent"
            ? "bg-red-500/12 text-red-600 dark:text-red-400"
            : task.priority === "High"
              ? "bg-orange-500/12 text-orange-600 dark:text-orange-400"
              : task.priority === "Medium"
                ? "bg-blue-500/12 text-blue-600 dark:text-blue-400"
                : "bg-slate-500/12 text-slate-500"
        }
      >
        {task.priority}
      </Badge>
      <Badge>{task.status}</Badge>
    </div>
  );
}

function BoardColumn({
  id,
  title,
  items,
  onOpen,
  projectName,
}: {
  id: string;
  title: string;
  items: ProjectTask[];
  onOpen: (t: ProjectTask) => void;
  projectName: (id: string) => string | undefined;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-2xl border p-2 transition-colors",
        isOver
          ? "border-slate-400 bg-slate-100/70 dark:border-white/30 dark:bg-white/[0.07]"
          : "border-slate-200/70 bg-slate-50/60 dark:border-white/[0.06] dark:bg-white/[0.02]",
      )}
    >
      <div className="flex items-center gap-2 px-1.5 py-1.5">
        <span className="truncate text-[11.5px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          {title}
        </span>
        <span className="rounded-full bg-white px-1.5 text-[11px] font-semibold text-slate-500 dark:bg-white/10">
          {items.length}
        </span>
      </div>
      <div className="min-h-[80px] space-y-2">
        {items.map((t) => (
          <DraggableTask key={t.id} task={t} onOpen={onOpen} projectName={projectName(t.project_id)} />
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

function DraggableTask({
  task,
  onOpen,
  projectName,
}: {
  task: ProjectTask;
  onOpen: (t: ProjectTask) => void;
  projectName?: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  if (isDragging) return <div ref={setNodeRef} className="h-[70px] rounded-xl border border-dashed border-slate-300 dark:border-white/20" />;
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className="touch-none">
      <TaskCard task={task} onOpen={onOpen} projectName={projectName} />
    </div>
  );
}

export { Plus };
