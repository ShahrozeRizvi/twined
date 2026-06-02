import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTwined, type Profile } from "@/lib/use-twined";
import { PixelAvatar, type AvatarPreset } from "@/components/PixelAvatar";
import { AppShell } from "@/components/AppShell";
import { Plus, Check, GripVertical, Trash2, Pencil } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

// Shared across parent (realtime) and child (drag list) so realtime UPDATE
// events don't clobber the optimistic order while a drag is settling.
const isDraggingRef = { current: false };

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

const DEFAULT_TAB = "General";

type MenuTarget = { list: ListRow; x: number; y: number };

function TodayPage() {
  const { profile, partner } = useTwined();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [lists, setLists] = useState<ListRow[]>([]);
  const [activeTab, setActiveTab] = useState<string>(DEFAULT_TAB);
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
  const [renamingListId, setRenamingListId] = useState<string | null>(null);
  const [confirmList, setConfirmList] = useState<ListRow | null>(null);

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

  useEffect(() => {
    const handler = () => {
      if (!profile?.space_id) return;
      supabase
        .from("tasks")
        .select("*")
        .eq("space_id", profile.space_id)
        .order("position", { ascending: true })
        .then(({ data }) => {
          if (data) setTasks(data as Task[]);
        });
    };
    window.addEventListener("twined:reconnect", handler);
    return () => {
      window.removeEventListener("twined:reconnect", handler);
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
              // Skip updates while a drag is settling to prevent
              // out-of-order position events from reverting state.
              if (isDraggingRef.current) return prev;
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
    (t) =>
      t.user_id === profile.id &&
      ((t.category || DEFAULT_TAB) === activeTab ||
        (activeTab === DEFAULT_TAB && t.category === "Today"))
  );
  const partnerTasks = partner
    ? tasks.filter(
        (t) =>
          t.user_id === partner.id &&
          ((t.category || DEFAULT_TAB) === activeTab ||
            (activeTab === DEFAULT_TAB && t.category === "Today"))
      )
    : [];

  const canDeleteMenu = lists.length > 1;
  const popupLeft = menuTarget
    ? Math.min(menuTarget.x, window.innerWidth - 170)
    : 0;

  const doDelete = async (list: ListRow) => {
    const listName = list.name;

    // Step 1: Optimistically remove list from local state
    setLists((prev) => prev.filter((l) => l.id !== list.id));

    // Step 2: Optimistically remove tasks from local state
    setTasks((prev) => prev.filter((t) => t.category !== listName));

    // Step 3: Switch active tab to the first remaining list
    setActiveTab(lists.find((l) => l.id !== list.id)?.name ?? DEFAULT_TAB);

    // Step 4: Close the confirmation dialog immediately
    setConfirmList(null);

    // Step 5: Delete tasks from Supabase first
    await sb
      .from("tasks")
      .delete()
      .eq("space_id", profile!.space_id!)
      .eq("category", listName);

    // Step 6: Delete the list from Supabase
    await sb.from("lists").delete().eq("id", list.id);
  };

  const saveRename = async (list: ListRow, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === list.name) {
      setRenamingListId(null);
      return;
    }
    const oldName = list.name;
    setLists((prev) =>
      prev.map((l) => (l.id === list.id ? { ...l, name: trimmed } : l)),
    );
    setTasks((prev) =>
      prev.map((t) => (t.category === oldName ? { ...t, category: trimmed } : t)),
    );
    if (activeTab === oldName) setActiveTab(trimmed);
    setRenamingListId(null);
    await sb.from("lists").update({ name: trimmed }).eq("id", list.id);
    await sb
      .from("tasks")
      .update({ category: trimmed })
      .eq("space_id", profile.space_id!)
      .eq("category", oldName);
  };

  return (
    <div className="flex flex-col min-h-full">
      <TabBar
        lists={lists}
        activeTab={activeTab}
        onSelect={setActiveTab}
        onListAdded={(l) => {
          setLists((prev) => (prev.some((x) => x.id === l.id) ? prev : [...prev, l]));
          setActiveTab(l.name);
        }}
        renamingListId={renamingListId}
        onRenameDone={() => setRenamingListId(null)}
        onRename={saveRename}
        onOpenMenu={(list, rect) =>
          setMenuTarget({ list, x: rect.left, y: rect.bottom + 8 })
        }
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
          onLocalRemove={(id) => setTasks((prev) => prev.filter((x) => x.id !== id))}
        />
        <TaskColumn
          title={partner?.name || "Them"}
          accent="partner"
          person={partner}
          tasks={partnerTasks}
          canEdit={false}
          loaded={loaded}
          activeCategory={activeTab}
          onLocalRemove={(id) => setTasks((prev) => prev.filter((x) => x.id !== id))}
        />
      </div>

      {menuTarget && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuTarget(null)}
            onTouchStart={() => setMenuTarget(null)}
          />
          <div
            className="fixed z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden"
            style={{ top: menuTarget.y, left: popupLeft, minWidth: 160 }}
          >
            <button
              onClick={() => {
                setRenamingListId(menuTarget.list.id);
                setMenuTarget(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted text-left"
            >
              <Pencil size={13} />
              <span>Rename</span>
            </button>
            {canDeleteMenu ? (
              <button
                onClick={() => {
                  setConfirmList(menuTarget.list);
                  setMenuTarget(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted text-left text-destructive"
              >
                <Trash2 size={13} />
                <span>Delete</span>
              </button>
            ) : (
              <div
                title="You need at least one list"
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground opacity-50 cursor-not-allowed"
              >
                <Trash2 size={13} />
                <span>Delete</span>
              </div>
            )}
          </div>
        </>
      )}

      <AlertDialog open={!!confirmList} onOpenChange={(o) => !o && setConfirmList(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmList?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              All tasks in this list will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmList && doDelete(confirmList)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


function TabBar({
  lists,
  activeTab,
  onSelect,
  onListAdded,
  renamingListId,
  onRenameDone,
  onRename,
  onOpenMenu,
  spaceId,
  userId,
}: {
  lists: ListRow[];
  activeTab: string;
  onSelect: (name: string) => void;
  onListAdded: (l: ListRow) => void;
  renamingListId: string | null;
  onRenameDone: () => void;
  onRename: (list: ListRow, newName: string) => void | Promise<void>;
  onOpenMenu: (list: ListRow, rect: DOMRect) => void;
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
    if (data) onListAdded(data as ListRow);
  };

  return (
    <div className="flex gap-1.5 overflow-x-auto px-3 py-2 no-scrollbar">
      {lists.map((l) => (
        <TabPill
          key={l.id}
          list={l}
          active={l.name === activeTab}
          renaming={renamingListId === l.id}
          onSelect={() => onSelect(l.name)}
          onRename={(newName) => onRename(l, newName)}
          onRenameCancel={onRenameDone}
          onOpenMenu={(rect) => onOpenMenu(l, rect)}
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
  renaming,
  onSelect,
  onRename,
  onRenameCancel,
  onOpenMenu,
}: {
  list: ListRow;
  active: boolean;
  renaming: boolean;
  onSelect: () => void;
  onRename: (newName: string) => void | Promise<void>;
  onRenameCancel: () => void;
  onOpenMenu: (rect: DOMRect) => void;
}) {
  const [editName, setEditName] = useState(list.name);
  const editRef = useRef<HTMLInputElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  useEffect(() => {
    if (renaming) {
      setEditName(list.name);
      setTimeout(() => editRef.current?.focus(), 0);
    }
  }, [renaming, list.name]);

  const triggerMenu = () => {
    longPressed.current = true;
    if (btnRef.current) onOpenMenu(btnRef.current.getBoundingClientRect());
  };

  const startPress = () => {
    longPressed.current = false;
    pressTimer.current = setTimeout(triggerMenu, 500);
  };
  const endPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const commitRename = () => {
    onRename(editName);
  };

  if (renaming) {
    return (
      <input
        ref={editRef}
        value={editName}
        onChange={(e) => setEditName(e.target.value)}
        onBlur={commitRename}
        onKeyDown={(e) => {
          if (e.key === "Enter") commitRename();
          if (e.key === "Escape") {
            setEditName(list.name);
            onRenameCancel();
          }
        }}
        maxLength={40}
        className="px-3 py-1 rounded-full text-xs bg-card border border-foreground focus:outline-none min-w-[100px]"
      />
    );
  }

  return (
    <button
      ref={btnRef}
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
        e.preventDefault();
        triggerMenu();
      }}
      className="px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0"
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
  onLocalRemove,
}: {
  title: string;
  accent: "mine" | "partner";
  person: Profile | null;
  tasks: Task[];
  canEdit: boolean;
  loaded: boolean;
  activeCategory: string;
  onLocalRemove: (id: string) => void;
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
    onLocalRemove(t.id);
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

  const handleDragStart = () => {
    isDraggingRef.current = true;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    isDraggingRef.current = false;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localTasks.findIndex((t) => t.id === active.id);
    const newIndex = localTasks.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(localTasks, oldIndex, newIndex);
    setLocalTasks(reordered);

    // Only update tasks whose index actually changed
    const updates = reordered
      .map((t, index) => ({ id: t.id, position: index }))
      .filter((item, index) => localTasks[index]?.id !== item.id);

    const spaceId = reordered[0]?.space_id;

    Promise.all(
      updates.map(({ id, position }) =>
        supabase.from("tasks").update({ position }).eq("id", id)
      )
    ).then(async () => {
      if (!spaceId) return;
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("space_id", spaceId)
        .order("position", { ascending: true });
      if (data) setLocalTasks(data as Task[]);
    });
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
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && editInputRef.current) {
      const input = editInputRef.current;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }, [editing]);

  const saveEdit = async () => {
    if (editText.trim() && editText.trim() !== t.text) {
      await supabase.from("tasks").update({ text: editText.trim() }).eq("id", t.id);
    }
    setEditing(false);
  };

  return (
    <li className="group flex items-start gap-2 px-1.5 py-1.5 rounded-lg">
      <button
        onClick={() => onToggle(t)}
        disabled={!canEdit}
        className="mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 touch-manipulation"
        style={{
          borderColor: t.completed ? accentVar : "var(--border)",
          background: t.completed ? accentVar : "transparent",
        }}
      >
        {t.completed && <Check size={11} className="text-background" strokeWidth={3} />}
      </button>
      {editing ? (
        <input
          ref={editInputRef}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveEdit();
            if (e.key === "Escape") {
              setEditing(false);
              setEditText(t.text);
            }
          }}
          maxLength={280}
          className="flex-1 bg-transparent text-sm px-1 py-0.5 focus:outline-none border-b border-foreground"
        />
      ) : (
        <span
          onClick={() => {
            if (!canEdit) return;
            setEditing(true);
            setEditText(t.text);
          }}
          className={`text-sm leading-tight flex-1 break-words select-none touch-manipulation ${
            canEdit ? "cursor-text" : "cursor-default"
          } ${t.completed ? "line-through opacity-40" : ""}`}
        >
          {t.text}
        </span>
      )}
      {canEdit && !editing && (
        <button
          onClick={() => onRemove(t)}
          className="text-muted-foreground opacity-0 group-hover:opacity-100 active:opacity-100 text-xs touch-manipulation"
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

  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && editInputRef.current) {
      const input = editInputRef.current;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }, [editing]);

  const saveEdit = async () => {
    if (editText.trim() && editText.trim() !== t.text) {
      await supabase.from("tasks").update({ text: editText.trim() }).eq("id", t.id);
    }
    setEditing(false);
  };

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
        className="group flex items-start gap-2 px-1.5 py-1.5 bg-card relative"
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
          className="mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 touch-manipulation"
          style={{
            borderColor: t.completed ? accentVar : "var(--border)",
            background: t.completed ? accentVar : "transparent",
          }}
        >
          {t.completed && <Check size={11} className="text-background" strokeWidth={3} />}
        </button>
        {editing ? (
          <input
            ref={editInputRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit();
              if (e.key === "Escape") {
                setEditing(false);
                setEditText(t.text);
              }
            }}
            maxLength={280}
            className="flex-1 bg-transparent text-sm px-1 py-0.5 focus:outline-none border-b border-foreground"
          />
        ) : (
          <span
            onClick={() => {
              setEditing(true);
              setEditText(t.text);
            }}
            className={`text-sm leading-tight flex-1 break-words select-none cursor-text touch-manipulation ${
              t.completed ? "line-through opacity-40" : ""
            }`}
          >
            {t.text}
          </span>
        )}
        {!editing && (
          <button
            onClick={() => onRemove(t)}
            className="text-muted-foreground opacity-0 group-hover:opacity-100 active:opacity-100 text-xs touch-manipulation"
            aria-label="Delete"
          >
            ✕
          </button>
        )}
      </div>
    </li>
  );
}
