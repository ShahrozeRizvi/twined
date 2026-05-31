import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTwined, type Profile } from "@/lib/use-twined";
import { PixelAvatar, type AvatarPreset } from "@/components/PixelAvatar";
import { AppShell } from "@/components/AppShell";
import { Plus, Check, GripVertical, Trash2 } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export const Route = createFileRoute("/today")({
  component: () => <AppShell><TodayPage /></AppShell>,
});

interface Task {
  id: string;
  space_id: string;
  user_id: string;
  text: string;
  completed: boolean;
  position: number;
  task_date: string;
  created_at: string;
}

function TodayPage() {
  const { profile, partner } = useTwined();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);

  // initial load: all tasks for the space
  useEffect(() => {
    if (!profile?.space_id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("space_id", profile.space_id!)
        .order("position", { ascending: true });
      if (!cancelled) {
        setTasks((data as Task[]) || []);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.space_id]);

  // realtime
  useEffect(() => {
    if (!profile?.space_id) return;
    const ch = supabase
      .channel(`tasks:${profile.space_id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `space_id=eq.${profile.space_id}`,
        },
        (payload) => {
          setTasks((prev) => {
            if (payload.eventType === "INSERT") {
              const t = payload.new as Task;
              if (prev.some((x) => x.id === t.id)) return prev;
              return [...prev, t].sort((a, b) => a.position - b.position);
            }
            if (payload.eventType === "UPDATE") {
              const t = payload.new as Task;
              return prev.map((x) => (x.id === t.id ? t : x));
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((x) => x.id !== (payload.old as Task).id);
            }
            return prev;
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [profile?.space_id]);

  if (!profile) return null;

  const myTasks = tasks.filter((t) => t.user_id === profile.id && t.task_date === myDate);
  const partnerTasks = partner
    ? tasks.filter((t) => t.user_id === partner.id && t.task_date === partnerDate)
    : [];

  return (
    <div className="flex flex-col min-h-full">
      <div className="grid grid-cols-2 gap-2 p-3 pt-4 flex-1">
        <TaskColumn
          title={profile.name || "You"}
          accent="mine"
          person={profile}
          tasks={myTasks}
          canEdit
          loaded={loaded}
        />
        <TaskColumn
          title={partner?.name || "Them"}
          accent="partner"
          person={partner}
          tasks={partnerTasks}
          canEdit={false}
          loaded={loaded}
        />
      </div>
    </div>
  );
}

function TaskColumn({
  title,
  accent,
  person,
  tasks,
  canEdit,
  loaded,
}: {
  title: string;
  accent: "mine" | "partner";
  person: Profile | null;
  tasks: Task[];
  canEdit: boolean;
  loaded: boolean;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { profile } = useTwined();

  const accentVar = accent === "mine" ? "var(--mine)" : "var(--partner)";

  const toggle = async (t: Task) => {
    if (!canEdit) return;
    // optimistic
    await supabase.from("tasks").update({ completed: !t.completed }).eq("id", t.id);
  };

  const addTask = async () => {
    if (!profile?.space_id || !text.trim()) return;
    setBusy(true);
    try {
      const today = localDateString(profile.timezone);
      const nextPos = (tasks[tasks.length - 1]?.position ?? -1) + 1;
      await supabase.from("tasks").insert({
        space_id: profile.space_id,
        user_id: profile.id,
        text: text.trim(),
        position: nextPos,
        task_date: today,
      });
      setText("");
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (t: Task) => {
    if (!canEdit) return;
    await supabase.from("tasks").delete().eq("id", t.id);
  };

  return (
    <div
      className="rounded-2xl bg-card border border-border flex flex-col overflow-hidden"
      style={{ borderTopColor: accentVar, borderTopWidth: 2 }}
    >
      <div className="px-3 pt-3 pb-2 flex items-center gap-2">
        {person && <PixelAvatar preset={person.avatar_preset as AvatarPreset} size={20} animated={false} />}
        <span className="text-xs font-medium tracking-wide truncate">{title}</span>
      </div>

      <TaskList
        tasks={tasks}
        canEdit={canEdit}
        loaded={loaded}
        accentVar={accentVar}
        person={person}
        onToggle={toggle}
        onRemove={remove}
      />

      {canEdit && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addTask();
          }}
          className="border-t border-border p-2 flex gap-1.5"
        >
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a task…"
            maxLength={280}
            className="flex-1 bg-transparent text-sm px-2 py-1.5 focus:outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={!text.trim() || busy}
            className="w-7 h-7 rounded-md flex items-center justify-center disabled:opacity-30"
            style={{ background: accentVar, color: "var(--primary-foreground)" }}
            aria-label="Add"
          >
            <Plus size={14} strokeWidth={2.6} />
          </button>
        </form>
      )}
    </div>
  );
}

function TaskList({
  tasks,
  canEdit,
  loaded,
  accentVar,
  person,
  onToggle,
  onRemove,
}: {
  tasks: Task[];
  canEdit: boolean;
  loaded: boolean;
  accentVar: string;
  person: Profile | null;
  onToggle: (t: Task) => void;
  onRemove: (t: Task) => void;
}) {
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);

  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localTasks.findIndex((t) => t.id === active.id);
    const newIndex = localTasks.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(localTasks, oldIndex, newIndex);
    setLocalTasks(reordered);
    await Promise.all(
      reordered.map((t, i) =>
        t.position === i
          ? Promise.resolve()
          : supabase.from("tasks").update({ position: i }).eq("id", t.id)
      )
    );
  };

  const emptyState = loaded && localTasks.length === 0 && (
    <li className="flex flex-col items-center justify-center text-center py-10 px-2 gap-3">
      {person && <PixelAvatar preset={person.avatar_preset as AvatarPreset} size={48} />}
      <p className="text-xs text-muted-foreground">
        {canEdit ? "What's on your plate today?" : "Nothing here yet."}
      </p>
    </li>
  );

  if (!canEdit) {
    return (
      <ul className="flex-1 px-2 pb-2 space-y-1 overflow-y-auto min-h-[200px]">
        {emptyState}
        {localTasks.map((t) => (
          <StaticTaskItem
            key={t.id}
            task={t}
            accentVar={accentVar}
            canEdit={false}
            onToggle={onToggle}
            onRemove={onRemove}
          />
        ))}
      </ul>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={localTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex-1 px-2 pb-2 space-y-1 overflow-y-auto min-h-[200px]">
          {emptyState}
          {localTasks.map((t) => (
            <SortableTaskItem
              key={t.id}
              task={t}
              accentVar={accentVar}
              onToggle={onToggle}
              onRemove={onRemove}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function StaticTaskItem({
  task: t,
  accentVar,
  canEdit,
  onToggle,
  onRemove,
}: {
  task: Task;
  accentVar: string;
  canEdit: boolean;
  onToggle: (t: Task) => void;
  onRemove: (t: Task) => void;
}) {
  return (
    <li className="group flex items-start gap-2 px-1.5 py-1.5 rounded-lg">
      <button
        onClick={() => onToggle(t)}
        disabled={!canEdit}
        className="mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0"
        style={{
          borderColor: t.completed ? accentVar : "var(--border)",
          background: t.completed ? accentVar : "transparent",
        }}
      >
        {t.completed && <Check size={11} className="text-background" strokeWidth={3} />}
      </button>
      <span
        className={`text-sm leading-tight flex-1 break-words ${
          t.completed ? "line-through opacity-40" : ""
        }`}
      >
        {t.text}
      </span>
      {canEdit && (
        <button
          onClick={() => onRemove(t)}
          className="text-muted-foreground opacity-0 group-hover:opacity-100 active:opacity-100 text-xs"
          aria-label="Delete"
        >
          ✕
        </button>
      )}
    </li>
  );
}

function SortableTaskItem({
  task: t,
  accentVar,
  onToggle,
  onRemove,
}: {
  task: Task;
  accentVar: string;
  onToggle: (t: Task) => void;
  onRemove: (t: Task) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: t.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="group flex items-start gap-1 px-1.5 py-1.5 rounded-lg bg-card"
    >
      <button
        {...attributes}
        {...listeners}
        className="mt-0.5 text-muted-foreground opacity-0 group-hover:opacity-60 active:opacity-100 cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
        aria-label="Drag to reorder"
      >
        <GripVertical size={14} />
      </button>
      <button
        onClick={() => onToggle(t)}
        className="mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0"
        style={{
          borderColor: t.completed ? accentVar : "var(--border)",
          background: t.completed ? accentVar : "transparent",
        }}
      >
        {t.completed && <Check size={11} className="text-background" strokeWidth={3} />}
      </button>
      <span
        className={`text-sm leading-tight flex-1 break-words ${
          t.completed ? "line-through opacity-40" : ""
        }`}
      >
        {t.text}
      </span>
      <button
        onClick={() => onRemove(t)}
        className="text-muted-foreground opacity-0 group-hover:opacity-100 active:opacity-100 text-xs"
        aria-label="Delete"
      >
        ✕
      </button>
    </li>
  );
}
