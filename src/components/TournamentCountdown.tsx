import { useEffect, useMemo, useState } from "react";
import { Clock3 } from "lucide-react";

const remainingLabel = (target: string | null | undefined, now: number) => {
  if (!target) return "Schedule pending";
  const remaining = new Date(target).getTime() - now;
  if (!Number.isFinite(remaining)) return "Schedule pending";
  if (remaining <= 0) return "Started";
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
};

export function TournamentCountdown({ tournament }: { tournament: any }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const target = tournament?.registration_deadline || tournament?.start_date;
  const label = useMemo(() => remainingLabel(target, now), [target, now]);
  const registrationOpen = tournament?.status === "registration" && (!tournament?.registration_deadline || new Date(tournament.registration_deadline).getTime() > now);
  return <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-xs"><span className={registrationOpen ? "text-green-400" : "text-amber-400"}>{registrationOpen ? "REGISTRATION OPEN" : "REGISTRATION CLOSED"}</span><span className="flex items-center gap-1 text-gray-400"><Clock3 className="size-3" />{target ? `${tournament?.registration_deadline ? "Registration closes" : "Starts"} in ${label}` : label}</span></div>;
}
