import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTwined, type Profile } from "@/lib/use-twined";
import { localDateString } from "@/lib/twined";
import { PixelAvatar, type AvatarPreset } from "@/components/PixelAvatar";
import { AppShell } from "@/components/AppShell";
import { Plus, Check } from "lucide-react";

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

  const myDate = useMemo(
    () => (profile ? localDateString(profile.timezone) : null),
    [profile]
  );
  const partnerDate = useMemo(
    () => (partner ? localDateString(partner.timezone) : null),
    [partner]
  );

  // initial load: today's tasks for both
  useEffect(() => {
    if (!profile?.space_id || !myDate) return;
    let cancelled = false;
    const dates = [myDate, partnerDate].filter(Boolean) as string[];
    (async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("space_id", profile.space_id!)
        .in("task_date", dates)
        .order("position", { ascending: true });
      if (!cancelled) {
        setTasks((data as Task[]) || []);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.space_id, myDate, partnerDate]);

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
      <div className="px-4 pt-3 pb-1 flex justify-end">
        <button
          onClick={() => setShowYesterday(true)}
          className="text-xs text-muted-foreground hover:text-foreground transition"
        >
          ← Yesterday
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3 pt-1 flex-1">
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
      {showYesterday && (
        <YesterdaySheet
          spaceId={profile.space_id!}
          me={profile}
          partner={partner}
          onClose={() => setShowYesterday(false)}
        />
      )}
    </div>
  );
}

function YesterdaySheet({
  spaceId,
  me,
  partner,
  onClose,
}: {
  spaceId: string;
  me: Profile;
  partner: Profile | null;
  onClose: () => void;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);

  const yesterday = (tz: string) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    return localDateString(tz, d);
  };
  const myYday = yesterday(me.timezone);
  const partnerYday = partner ? yesterday(partner.timezone) : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const dates = [myYday, partnerYday].filter(Boolean) as string[];
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("space_id", spaceId)
        .in("task_date", dates)
        .order("position", { ascending: true });
      if (!cancelled) {
        setTasks((data as Task[]) || []);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spaceId, myYday, partnerYday]);

  const myTasks = tasks.filter((t) => t.user_id === me.id && t.task_date === myYday);
  const partnerTasks = partner
    ? tasks.filter((t) => t.user_id === partner.id && t.task_date === partnerYday)
    : [];

  return (
    <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center">
      <div
        className="w-full max-w-md bg-background border-t sm:border border-border rounded-t-3xl sm:rounded-3xl flex flex-col max-h-[85vh]"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="font-serif text-lg">Yesterday</h2>
          <button onClick={onClose} className="text-muted-foreground text-sm" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 p-3 overflow-y-auto">
          <TaskColumn
            title={me.name || "You"}
            accent="mine"
            person={me}
            tasks={myTasks}
            canEdit={false}
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

      <ul className="flex-1 px-2 pb-2 space-y-1 overflow-y-auto min-h-[200px]">
        {loaded && tasks.length === 0 && (
          <li className="flex flex-col items-center justify-center text-center py-10 px-2 gap-3">
            {person && <PixelAvatar preset={person.avatar_preset as AvatarPreset} size={48} />}
            <p className="text-xs text-muted-foreground">
              {canEdit ? "What's on your plate today?" : "Nothing here yet."}
            </p>
          </li>
        )}
        {tasks.map((t) => (
          <li key={t.id} className="group flex items-start gap-2 px-1.5 py-1.5 rounded-lg">
            <button
              onClick={() => toggle(t)}
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
                onClick={() => remove(t)}
                className="text-muted-foreground opacity-0 group-hover:opacity-100 active:opacity-100 text-xs"
                aria-label="Delete"
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>

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
