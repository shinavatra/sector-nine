export const XP_SEGMENT_COUNT = 12;

export type XpProgress = {
  level: number;
  totalXp: number;
  currentXp: number;
  requiredXp: number;
  remainingXp: number;
  progress: number;
};

export function calculateXpProgress(levelValue: unknown, totalXpValue: unknown): XpProgress | null {
  if (levelValue == null || totalXpValue == null) return null;
  const level = Number(levelValue);
  const totalXp = Number(totalXpValue);

  if (!Number.isInteger(level) || level < 0 || !Number.isFinite(totalXp) || totalXp < 0) return null;

  // Mirrors calculate_level(xp) in 001_schema.sql: floor(sqrt(xp / 100)).
  const levelStartXp = level * level * 100;
  const nextLevelXp = (level + 1) * (level + 1) * 100;
  const requiredXp = nextLevelXp - levelStartXp;
  const currentXp = Math.min(requiredXp, Math.max(0, totalXp - levelStartXp));

  return { level, totalXp, currentXp, requiredXp, remainingXp: Math.max(0, requiredXp - currentXp), progress: requiredXp > 0 ? currentXp / requiredXp : 0 };
}

export function getXpSegmentFill(progress: number, segmentIndex: number): number {
  if (!Number.isInteger(segmentIndex) || segmentIndex < 0 || segmentIndex >= XP_SEGMENT_COUNT) return 0;
  const normalizedProgress = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  return Math.min(1, Math.max(0, normalizedProgress * XP_SEGMENT_COUNT - segmentIndex));
}
