type PlayerNameSource = {
  displayName?: string | null;
  display_name?: string | null;
  localDisplayName?: string | null;
  username?: string | null;
  name?: string | null;
};

export const sanitizeDisplayName = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
};

export const displayPlayerName = (player: PlayerNameSource | null | undefined, fallback = "Player"): string =>
  sanitizeDisplayName(player?.displayName) ||
  sanitizeDisplayName(player?.display_name) ||
  sanitizeDisplayName(player?.name) ||
  sanitizeDisplayName(player?.username) ||
  fallback;

export const playerInitials = (player: PlayerNameSource | null | undefined, fallback = "P"): string =>
  displayPlayerName(player, fallback).slice(0, 2).toUpperCase();
