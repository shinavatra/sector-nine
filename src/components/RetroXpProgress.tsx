import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { calculateXpProgress, getXpSegmentFill, XP_SEGMENT_COUNT } from "../utils/xpProgress";

type RetroXpProgressProps = { level?: number | null; totalXp?: number | null; compact?: boolean; className?: string };
type SegmentStyle = CSSProperties & { "--xp-segment-fill": string };

export function RetroXpProgress({ level, totalXp, compact = false, className = "" }: RetroXpProgressProps) {
  const progress = calculateXpProgress(level, totalXp);
  const previous = useRef(progress ? { level: progress.level, totalXp: progress.totalXp } : null);
  const [animation, setAnimation] = useState<{ kind: "earned" | "level-up"; fromProgress: number } | null>(null);

  useEffect(() => {
    if (!progress) { previous.current = null; return; }
    const prior = previous.current;
    previous.current = { level: progress.level, totalXp: progress.totalXp };
    if (!prior || progress.totalXp <= prior.totalXp) return;
    const priorProgress = calculateXpProgress(prior.level, prior.totalXp)?.progress ?? 0;
    setAnimation({ kind: progress.level > prior.level ? "level-up" : "earned", fromProgress: progress.level > prior.level ? 0 : priorProgress });
    const timer = window.setTimeout(() => setAnimation(null), progress.level > prior.level ? 900 : 560);
    return () => window.clearTimeout(timer);
  }, [progress?.level, progress?.totalXp]);

  if (!progress) return <div className={`retro-xp retro-xp-unconfigured ${compact ? "retro-xp-compact" : ""} ${className}`}>XP PROGRESSION UNCONFIGURED</div>;

  return (
    <div className={`retro-xp ${compact ? "retro-xp-compact" : ""} ${animation ? `retro-xp-${animation.kind}` : ""} ${className}`}>
      <div className="retro-xp-heading"><span>LEVEL {progress.level}</span><span>{progress.currentXp.toLocaleString()} / {progress.requiredXp.toLocaleString()} XP</span></div>
      <div className="retro-xp-segments" role="progressbar" aria-label={`Level ${progress.level} experience progress`} aria-valuemin={0} aria-valuemax={progress.requiredXp} aria-valuenow={progress.currentXp} aria-valuetext={`${progress.currentXp} of ${progress.requiredXp} XP; ${progress.remainingXp} XP remaining`}>
        {Array.from({ length: XP_SEGMENT_COUNT }, (_, index) => {
          const fill = getXpSegmentFill(progress.progress, index);
          const newlyEarned = animation?.kind === "earned" && fill > getXpSegmentFill(animation.fromProgress, index);
          return <span key={index} className={`retro-xp-segment ${fill >= 1 ? "is-filled" : fill > 0 ? "is-partial" : ""} ${newlyEarned ? "is-new" : ""}`} style={{ "--xp-segment-fill": `${fill * 100}%` } as SegmentStyle} aria-hidden="true" />;
        })}
      </div>
      <p className="retro-xp-remaining">{progress.remainingXp.toLocaleString()} XP REMAINING TO NEXT LEVEL</p>
    </div>
  );
}
