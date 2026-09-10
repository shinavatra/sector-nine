import { useEffect, useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import {
  Award,
  CheckCircle2,
  Crosshair,
  Crown,
  ExternalLink,
  Flame,
  Loader2,
  Settings,
  Swords,
  Target,
  Trophy,
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { useUser } from "../contexts/UserContext";
import { achievementAPI } from "../utils/api";
import { MatchHistory } from "../components/MatchHistory";
import { FramedAvatar } from "../components/FramedAvatar";
import { displayPlayerName } from "../utils/displayName";

interface ProfileProps {
  onNavigate?: (page: string) => void;
  isPremium?: boolean;
}

type CatalogBadge = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  rarity?: string;
};

const rarityClass: Record<string, string> = {
  COMMON: "border-gray-700 text-gray-300",
  UNCOMMON: "border-green-700 text-green-300",
  RARE: "border-blue-700 text-blue-300",
  EPIC: "border-purple-700 text-purple-300",
  LEGENDARY: "border-orange-600 text-orange-300",
  VIP_EXCLUSIVE: "border-yellow-600 text-yellow-300",
};

export function Profile({ onNavigate, isPremium }: ProfileProps) {
  const { user } = useUser();
  const [catalog, setCatalog] = useState<CatalogBadge[]>([]);
  const [achievementsLoading, setAchievementsLoading] = useState(true);
  const [achievementsError, setAchievementsError] = useState("");

  useEffect(() => {
    let active = true;
    achievementAPI
      .getBadges()
      .then((response: any) => {
        if (!active) return;
        setCatalog(Array.isArray(response?.badges) ? response.badges : []);
        setAchievementsError("");
      })
      .catch((error: unknown) => {
        if (active) {
          setAchievementsError(error instanceof Error ? error.message : "Unable to load achievements.");
        }
      })
      .finally(() => {
        if (active) setAchievementsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const ownedBadgeIds = useMemo(() => new Set(user?.ownedBadges || []), [user?.ownedBadges]);
  const earnedAchievements = useMemo(
    () => catalog.filter((achievement) => ownedBadgeIds.has(achievement.id)),
    [catalog, ownedBadgeIds],
  );

  if (!user) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-4">
        <Card className="w-full max-w-lg border-orange-900/20 bg-black/40">
          <CardContent className="p-8 text-center font-mono text-gray-300">
            Sign in to view your personnel profile.
          </CardContent>
        </Card>
      </div>
    );
  }

  const name = displayPlayerName(user);
  const wins = Number(user.stats?.wins || 0);
  const losses = Number(user.stats?.losses || 0);
  const matches = Number(user.stats?.matchesPlayed || wins + losses);
  const kills = Number(user.stats?.kills || 0);
  const deaths = Number(user.stats?.deaths || 0);
  const winRate = matches > 0 ? Math.round((wins / matches) * 100) : 0;
  const kda = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2);

  // PostgreSQL calculates level as floor(sqrt(xp / 100)). These bounds express
  // progress through the current level without inventing a separate XP system.
  const level = Math.max(0, Number(user.level || 0));
  const experience = Math.max(0, Number(user.experience || 0));
  const levelStartXp = level * level * 100;
  const nextLevelXp = (level + 1) * (level + 1) * 100;
  const xpIntoLevel = Math.max(0, experience - levelStartXp);
  const xpForLevel = Math.max(1, nextLevelXp - levelStartXp);
  const xpProgress = Math.min(100, Math.round((xpIntoLevel / xpForLevel) * 100));
  const onlineVisible = user.showOnlineStatus !== false;
  const vipActive = Boolean(isPremium || user.isPremium);
  const socialLinks = Object.entries(user.socialLinks).filter(
    (entry): entry is [string, string] => Boolean(entry[1]),
  );

  return (
    <main className="profile-page container mx-auto w-full max-w-7xl px-4 py-8">
      <div className="profile-heading flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-mono text-3xl font-bold text-orange-400">PERSONNEL PROFILE</h1>
          <p className="mt-1 font-mono text-sm text-gray-400">
            Identity, clearance, performance, and achievement record
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => onNavigate?.("configuration")}
          className="border-orange-900/40 font-mono text-orange-300"
        >
          <Settings className="mr-2 h-4 w-4" />
          Configuration
        </Button>
      </div>

      <div className="profile-top-grid min-w-0">
        <div className="profile-primary-column min-w-0">
        <Card className="profile-main-card min-w-0 border-orange-900/20 bg-black/40">
          <CardContent className="space-y-5 p-6">
            <div className="profile-identity flex min-w-0 items-start gap-4 sm:gap-6">
              <div className="profile-avatar rounded-lg border-2 border-orange-800/50 bg-orange-950/20">
                <FramedAvatar frameId={user.equippedFrame} className="h-full w-full rounded-lg">
                  {user.resolvedAvatar ? (
                    <img src={user.resolvedAvatar} alt={name} className="profile-avatar-image" />
                  ) : (
                    <div className="grid h-full w-full place-items-center font-mono text-3xl text-orange-300">
                      {name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </FramedAvatar>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-3">
                  <p className="truncate text-3xl font-semibold text-orange-300">{name}</p>
                  {user.role === "admin" ? (
                    <Badge className="border border-red-700/50 bg-red-950/50 font-mono text-red-200">ADMIN</Badge>
                  ) : vipActive ? (
                    <Badge className="border border-yellow-700/50 bg-yellow-950/40 font-mono text-yellow-200">
                      <Crown className="mr-1 h-3.5 w-3.5" /> VIP
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusPill
                    active={onlineVisible}
                    activeLabel="Online"
                    inactiveLabel="Status hidden"
                    icon={<span className={`h-2 w-2 rounded-full ${onlineVisible ? "bg-green-400" : "bg-gray-500"}`} />}
                  />
                </div>
              </div>
            </div>

            {user.bio && (
              <p className="rounded-lg border border-orange-900/20 bg-black/30 p-4 text-sm leading-6 text-gray-300">
                {user.bio}
              </p>
            )}

            <div className="profile-xp">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 font-mono text-sm">
                <span className="text-green-300">LEVEL {level}</span>
                <span className="text-orange-300">
                  {experience.toLocaleString()} XP · {xpIntoLevel.toLocaleString()}/{xpForLevel.toLocaleString()} TO LEVEL {level + 1}
                </span>
              </div>
              <Progress value={xpProgress} className="h-3 bg-gray-800" />
              <p className="mt-2 text-right font-mono text-xs text-gray-500">{xpProgress}% complete</p>
            </div>
          </CardContent>
        </Card>

        <div className="profile-history min-w-0">
          <MatchHistory />
        </div>
        </div>

        <Card className="profile-achievements min-w-0 border-orange-900/20 bg-black/40">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="font-mono text-orange-400">ACHIEVEMENTS</CardTitle>
                <p className="mt-1 text-sm text-gray-500">
                  {earnedAchievements.length} earned from {catalog.length} available
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => onNavigate?.("achievements")}>
                View all
              </Button>
            </div>
          </CardHeader>
          <CardContent>
          {achievementsLoading ? (
            <div className="flex items-center justify-center gap-3 py-6 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin text-orange-400" />
              Loading achievements...
            </div>
          ) : achievementsError ? (
            <div className="rounded border border-red-900/40 bg-red-950/20 p-4 text-sm text-red-200">
              {achievementsError}
            </div>
          ) : earnedAchievements.length ? (
            <div className="grid min-w-0 gap-3">
              {earnedAchievements.slice(0, 3).map((achievement) => {
                const rarity = String(achievement.rarity || "COMMON").toUpperCase();
                return (
                  <article
                    key={achievement.id}
                    className="min-w-0 rounded-lg border border-orange-900/25 bg-black/30 p-3"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded border border-orange-900/30 text-xl">
                        {achievement.icon || <Award className="h-5 w-5 text-orange-400" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-start justify-between gap-2">
                          <p className="truncate font-medium text-orange-300">{achievement.name}</p>
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
                        </div>
                        <Badge variant="outline" className={`mt-2 text-[10px] ${rarityClass[rarity] || rarityClass.COMMON}`}>
                          {rarity.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm text-gray-400">
                      {achievement.description || "Achievement earned."}
                    </p>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-orange-900/30 p-5 text-center">
              <Award className="mx-auto mb-3 h-8 w-8 text-gray-600" />
              <p className="text-gray-300">No achievements earned yet.</p>
              <p className="mt-1 text-sm text-gray-500">Your earned achievements will appear here automatically.</p>
            </div>
          )}
          </CardContent>
        </Card>
      </div>

      <Card className="profile-quick-stats min-w-0 border-orange-900/20 bg-black/40">
        <CardHeader>
          <CardTitle className="font-mono text-orange-400">QUICK STATS</CardTitle>
        </CardHeader>
        <CardContent className="profile-stat-grid min-w-0">
          <QuickStat icon={<Swords />} label="Matches" value={matches} />
          <QuickStat icon={<Trophy />} label="Wins" value={wins} />
          <QuickStat icon={<Target />} label="Win rate" value={`${winRate}%`} />
          <QuickStat icon={<Crosshair />} label="Kills" value={kills} />
          <QuickStat icon={<Flame />} label="K/D" value={kda} />
          <QuickStat icon={<Award />} label="Achievements" value={ownedBadgeIds.size} />
        </CardContent>
      </Card>

      <div className="profile-social-grid min-w-0 items-start">
        <Card className="min-w-0 border-orange-900/20 bg-black/40">
          <CardHeader>
            <CardTitle className="font-mono text-orange-400">SOCIAL LINKS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {socialLinks.length ? socialLinks.map(([network, value]) => {
              const isExternalUrl = /^https?:\/\//i.test(value);
              const content = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-xs uppercase tracking-wide text-gray-500">{network}</span>
                    <span className="block truncate text-sm text-orange-200">{value}</span>
                  </span>
                  {isExternalUrl && <ExternalLink className="h-4 w-4 shrink-0 text-orange-400" />}
                </>
              );
              return isExternalUrl ? (
                <a key={network} href={value} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-3 rounded-lg border border-orange-900/20 bg-black/30 p-3 transition-colors hover:border-orange-700/50">
                  {content}
                </a>
              ) : (
                <div key={network} className="flex min-w-0 items-center gap-3 rounded-lg border border-orange-900/20 bg-black/30 p-3">
                  {content}
                </div>
              );
            }) : (
              <p className="rounded-lg border border-dashed border-orange-900/30 p-6 text-center text-sm text-gray-500">
                No social links added yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

    </main>
  );
}

function StatusPill({
  active,
  activeLabel,
  inactiveLabel,
  icon,
}: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
  icon: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs ${
        active
          ? "border-green-800/50 bg-green-950/30 text-green-300"
          : "border-gray-700 bg-gray-900/40 text-gray-400"
      }`}
    >
      {icon}
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

function QuickStat({
  icon,
  label,
  value,
}: {
  icon: ReactElement;
  label: string;
  value: number | string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-orange-900/20 bg-black/30 p-3">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded bg-orange-950/40 text-orange-400 [&>svg]:h-4 [&>svg]:w-4">
        {icon}
      </div>
      <p className="font-mono text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 truncate text-xl font-semibold text-gray-100">{value}</p>
    </div>
  );
}
