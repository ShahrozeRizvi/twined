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

// supabase client cast to allow access to lists table + category column
// (types.ts is auto-generated and may not include them yet)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

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
  category: string;
}

interface ListRow {
  id: string;
  space_id: string;
  name: string;
  position: number;
  created_by: string;
  created_at: string;
}

const DEFAULT_TAB = "Today";

function TodayPage() {
  const { profile, partner } = useTwined();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [lists, setLists] = useState<ListRow[]>([]);
  const [activeTab, setActiveTab] = useState<string>(DEFAULT_TAB);

  // load lists, ensure default "Today" exists
  useEffect(() => {
    if (!profile?.space_id) return;
    let cancelled = false;
    (async () => {
      const { data } = await sb
        .from("lists")
        .select("*")
        .eq("space_id", profile.space_id!)
        .order("position", { ascending: true });
      if (cancelled) return;
      let rows = (data as ListRow[]) || [];
      if (!rows.some((l) => l.name === DEFAULT_TAB)) {
        const { data: inserted } = await sb
          .from("lists")
          .insert({
            space_id: profile.space_id,
            name: DEFAULT_TAB,
            position: 0,
            created_by: profile.id,
          })
          .select()
          .single();
        if (inserted) rows = [inserted as ListRow, ...rows];
      }
      setLists(rows);
      setActiveTab((cur) => (rows.some((l) => l.name === cur) ? cur : rows[0]?.name || DEFAULT_TAB));
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.space_id, profile?.id]);

  // realtime: lists
  useEffect(() => {
    if (!profile?.space_id) return;
    const ch = supabase
      .channel(`lists:${profile.space_id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lists",
          filter: `space_id=eq.${profile.space_id}`,
        },
        (payload) => {
          setLists((prev) => {
            if (payload.eventType === "INSERT") {
              const l = payload.new as ListRow;
              if (prev.some((x) => x.id === l.id)) return prev;
              return [...prev, l].sort((a, b) => a.position - b.position);
            }
            if (payload.eventType === "UPDATE") {
              const l = payload.new as ListRow;
              return prev.map((x) => (x.id === l.id ? l : x));
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((x) => x.id !== (payload.old as ListRow).id);
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

  // realtime: tasks
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

  const myTasks = tasks.filter(
    (t) => t.user_id === profile.id && (t.category || DEFAULT_TAB) === activeTab
  );
  const partnerTasks = partner
    ? tasks.filter(
        (t) => t.user_id === partner.id && (t.category || DEFAULT_TAB) === activeTab
      )
    : [];

  return (
    <div className="flex flex-col min-h-full">
      <TabBar
        lists={lists}
        activeTab={activeTab}
        onSelect={setActiveTab}
        spaceId={profile.space_id!}
        userId={profile.id}
      />
      <div className="grid grid-cols-2 gap-2 p-3 pt-2 flex-1">
        <TaskColumn
          title={profile.name || "You"}
          accent="mine"
          person={profile}
          tasks={myTasks}
          canEdit
          loaded={loaded}
          activeCategory={activeTab}
        />
        <TaskColumn
          title={partner?.name || "Them"}
          accent="partner"
          person={partner}
          tasks={partnerTasks}
          canEdit={false}
          loaded={loaded}
          activeCategory={activeTab}
        />
      </div>
    </div>
  );
}

function TabBar({
  lists,
  activeTab,
  onSelect,
  spaceId,
  userId,
}: {
  lists: ListRow[];
  activeTab: string;
  onSelect: (name: string) => void;
  spaceId: string;
  userId: string;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const addRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) addRef.current?.focus();
  }, [adding]);

  const commitAdd = async () => {
    const name = newName.trim();
    if (!name) {
      setAdding(false);
      setNewName("");
      return;
    }
    const pos = lists.length;
    const { data } = await sb
      .from("lists")
      .insert({ space_id: spaceId, name, position: pos, created_by: userId })
      .select()
      .single();
    setAdding(false);
    setNewName("");
    if (data) onSelect((data as ListRow).name);
  };

  return (
    <div className="flex gap-1.5 overflow-x-auto px-3 py-2 no-scrollbar">
      {lists.map((l) => (
        <TabPill
          key={l.id}
          list={l}
          active={l.name === activeTab}
          onSelect={() => onSelect(l.name)}
          onRenamed={(newName) => onSelect(newName)}
          onDeleted={() => onSelect(DEFAULT_TAB)}
          spaceId={spaceId}
        />
      ))}
      {adding ? (
        <input
          ref={addRef}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onBlur={commitAdd}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitAdd();
            if (e.key === "Escape") {
              setAdding(false);
              setNewName("");
            }
          }}
          placeholder="List name"
          maxLength={40}
          className="px-3 py-1 rounded-full text-xs bg-card border border-border focus:outline-none focus:border-foreground min-w-[100px]"
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="px-2.5 py-1 rounded-full text-xs border border-border text-muted-foreground hover:text-foreground flex items-center gap-1 flex-shrink-0"
          aria-label="Add list"
        >
          <Plus size={12} strokeWidth={2.6} />
        </button>
      )}
    </div>
  );
}

function TabPill({
  list,
  active,
  onSelect,
  onRenamed,
  onDeleted,
  spaceId,
}: {
  list: ListRow;
  active: boolean;
  onSelect: () => void;
  onRenamed: (newName: string) => void;
  onDeleted: () => void;
  spaceId: string;
}) {
  const [mode, setMode] = useState<"view" | "menu" | "rename" | "confirmDelete">("view");
  const [editName, setEditName] = useState(list.name);
  const editRef = useRef<HTMLInputElement>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const isDefault = list.name === DEFAULT_TAB;

  useEffect(() => {
    if (mode === "rename") editRef.current?.focus();
  }, [mode]);

  const startPress = () => {
    if (isDefault) return;
    longPressed.current = false;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      setMode("menu");
    }, 500);
  };
  const endPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const commitRename = async () => {
    const name = editName.trim();
    if (!name || name === list.name) {
      setMode("view");
      setEditName(list.name);
      return;
    }
    await sb.from("lists").update({ name }).eq("id", list.id);
    await sb
      .from("tasks")
      .update({ category: name })
      .eq("space_id", spaceId)
      .eq("category", list.name);
    setMode("view");
    onRenamed(name);
  };

  const doDelete = async () => {
    await sb
      .from("tasks")
      .update({ category: DEFAULT_TAB })
      .eq("space_id", spaceId)
      .eq("category", list.name);
    await sb.from("lists").delete().eq("id", list.id);
    setMode("view");
    onDeleted();
  };

  if (mode === "rename") {
    return (
      <input
        ref={editRef}
        value={editName}
        onChange={(e) => setEditName(e.target.value)}
        onBlur={commitRename}
        onKeyDown={(e) => {
          if (e.key === "Enter") commitRename();
          if (e.key === "Escape") {
            setMode("view");
            setEditName(list.name);
          }
        }}
        maxLength={40}
        className="px-3 py-1 rounded-full text-xs bg-card border border-foreground focus:outline-none min-w-[100px]"
      />
    );
  }

  if (mode === "menu") {
    return (
      <div className="flex gap-1 flex-shrink-0">
        <button
          onClick={() => setMode("rename")}
          className="px-2.5 py-1 rounded-full text-xs bg-card border border-border"
        >
          Rename
        </button>
        <button
          onClick={() => setMode("confirmDelete")}
          className="px-2.5 py-1 rounded-full text-xs bg-card border border-border text-destructive"
        >
          Delete
        </button>
        <button
          onClick={() => setMode("view")}
          className="px-2 py-1 rounded-full text-xs text-muted-foreground"
        >
          ✕
        </button>
      </div>
    );
  }

  if (mode === "confirmDelete") {
    return (
      <div className="flex gap-1 flex-shrink-0">
        <button
          onClick={doDelete}
          className="px-2.5 py-1 rounded-full text-xs text-white"
          style={{ background: "#EF4444" }}
        >
          Confirm delete
        </button>
        <button
          onClick={() => setMode("view")}
          className="px-2.5 py-1 rounded-full text-xs bg-card border border-border"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        if (longPressed.current) {
          longPressed.current = false;
          return;
        }
        onSelect();
      }}
      onMouseDown={startPress}
      onMouseUp={endPress}
      onMouseLeave={endPress}
      onTouchStart={startPress}
      onTouchEnd={endPress}
      onContextMenu={(e) => {
        if (!isDefault) {
          e.preventDefault();
          setMode("menu");
        }
      }}
      className="px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors"
      style={
        active
          ? { background: "var(--mine)", color: "#ffffff", border: "1px solid transparent" }
          : {
              background: "transparent",
              color: "var(--muted-foreground)",
              border: "1px solid var(--border)",
            }
      }
    >
      {list.name}
    </button>
  );
}

function TaskColumn({
  title,
  accent,
  person,
  tasks,
  canEdit,
  loaded,
  activeCategory,
}: {
  title: string;
  accent: "mine" | "partner";
  person: Profile | null;
  tasks: Task[];
  canEdit: boolean;
  loaded: boolean;
  activeCategory: string;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { profile } = useTwined();

  const accentVar = accent === "mine" ? "var(--mine)" : "var(--partner)";

  const toggle = async (t: Task) => {
    if (!canEdit) return;
    await supabase.from("tasks").update({ completed: !t.completed }).eq("id", t.id);
  };

  const addTask = async () => {
    if (!profile?.space_id || !text.trim()) return;
    setBusy(true);
    try {
      const nextPos = (tasks[tasks.length - 1]?.position ?? -1) + 1;
      await sb.from("tasks").insert({
        space_id: profile.space_id,
        user_id: profile.id,
        text: text.trim(),
        position: nextPos,
        category: activeCategory,
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

  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startXRef = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    setSwiping(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startXRef.current === null) return;
    const dx = e.touches[0].clientX - startXRef.current;
    if (dx < 0) setSwipeX(Math.max(dx, -160));
  };
  const onTouchEnd = () => {
    setSwiping(false);
    if (swipeX < -80) {
      setSwipeX(-400);
      onRemove(t);
    } else {
      setSwipeX(0);
    }
    startXRef.current = null;
  };

  const revealed = swipeX < -10;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="relative rounded-lg overflow-hidden"
    >
      {revealed && (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-end pr-4"
          style={{ background: "#EF4444", width: Math.min(-swipeX, 160) }}
          aria-hidden
        >
          <Trash2 size={18} className="text-white" />
        </div>
      )}
      <div
        className="group flex items-start gap-1 px-1.5 py-1.5 bg-card relative"
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: swiping ? "none" : "transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
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
      </div>
    </li>
  );
}
