import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type Profile } from "@/lib/use-twined";
import { localDateString } from "@/lib/twined";
import { PixelAvatar, type AvatarPreset } from "@/components/PixelAvatar";
import { Check } from "lucide-react";

interface Task {
  id: string;
  user_id: string;
  text: string;
  completed: boolean;
  position: number;
  task_date: string;
}

export function YesterdaySheet({
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
          <ReadOnlyColumn title={me.name || "You"} accent="mine" person={me} tasks={myTasks} loaded={loaded} />
          <ReadOnlyColumn
            title={partner?.name || "Them"}
            accent="partner"
            person={partner}
            tasks={partnerTasks}
            loaded={loaded}
          />
        </div>
      </div>
    </div>
  );
}

function ReadOnlyColumn({
  title,
  accent,
  person,
  tasks,
  loaded,
}: {
  title: string;
  accent: "mine" | "partner";
  person: Profile | null;
  tasks: Task[];
  loaded: boolean;
}) {
  const accentVar = accent === "mine" ? "var(--mine)" : "var(--partner)";
  return (
    <div
      className="rounded-2xl bg-card border border-border flex flex-col overflow-hidden"
      style={{ borderTopColor: accentVar, borderTopWidth: 2 }}
    >
      <div className="px-3 pt-3 pb-2 flex items-center gap-2">
        {person && <PixelAvatar preset={person.avatar_preset as AvatarPreset} size={20} animated={false} />}
        <span className="text-xs font-medium tracking-wide truncate">{title}</span>
      </div>
      <ul className="flex-1 px-2 pb-2 space-y-1 min-h-[120px]">
        {loaded && tasks.length === 0 && (
          <li className="text-xs text-muted-foreground text-center py-6">Nothing.</li>
        )}
        {tasks.map((t) => (
          <li key={t.id} className="flex items-start gap-2 px-1.5 py-1.5">
            <span
              className="mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0"
              style={{
                borderColor: t.completed ? accentVar : "var(--border)",
                background: t.completed ? accentVar : "transparent",
              }}
            >
              {t.completed && <Check size={11} className="text-background" strokeWidth={3} />}
            </span>
            <span className={`text-sm leading-tight flex-1 break-words ${t.completed ? "line-through opacity-40" : ""}`}>
              {t.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
