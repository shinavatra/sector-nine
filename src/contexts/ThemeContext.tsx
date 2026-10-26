import { createContext, ReactNode, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useUser } from "./UserContext";

export type ThemeId = "default" | "hl1" | "cs16" | "l4d2" | "cod4";
export type ThemeMode = "manual" | "follow_game";

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  gameId: string | null;
  description: string;
  gameLabel: string;
  protocol: string;
  status: string;
}

export const themeDefinitions: ThemeDefinition[] = [
  { id: "default", name: "Sector Nine", gameId: null, description: "The original Sector Nine tactical interface.", gameLabel: "Half-Life 1", protocol: "QUANTUM GAMING PROTOCOLS", status: "SYSTEM STATUS: OPERATIONAL" },
  { id: "hl1", name: "Half-Life 1", gameId: "hl1", description: "Sector Nine with restrained industrial orange and dark hazard-green accents.", gameLabel: "Half-Life 1", protocol: "HALF-LIFE PROTOCOL", status: "SYSTEM STATUS: OPERATIONAL" },
  { id: "cs16", name: "Counter-Strike 1.6", gameId: "cs16", description: "Sector Nine with restrained tactical tan and dark olive accents.", gameLabel: "Counter-Strike 1.6", protocol: "COUNTER-STRIKE PROTOCOL", status: "TACTICAL NETWORK: READY" },
  { id: "l4d2", name: "Left 4 Dead 2", gameId: "l4d2", description: "Sector Nine with desaturated survival accents and rare emergency red.", gameLabel: "Left 4 Dead 2", protocol: "SURVIVAL PROTOCOL", status: "SYSTEM STATUS: DEGRADED" },
  { id: "cod4", name: "Call of Duty 4 Promod", gameId: "cod4", description: "Sector Nine with restrained military green, steel, and amber accents.", gameLabel: "Call of Duty 4 Promod", protocol: "MODERN WARFARE PROTOCOL", status: "OPERATIONS NETWORK: ONLINE" },
];

if (new Set(themeDefinitions.map(theme => theme.id)).size !== themeDefinitions.length) {
  throw new Error("Theme definitions must use unique IDs");
}

interface ThemeCache {
  mode: ThemeMode;
  preferred: ThemeId;
}

interface ThemeContextValue {
  themeMode: ThemeMode;
  preferredTheme: ThemeId;
  effectiveTheme: ThemeId;
  selectedGameId: string;
  availableThemes: ThemeId[];
  definition: ThemeDefinition;
  saveThemePreferences: (mode: ThemeMode, preferred: ThemeId) => Promise<void>;
}

const CACHE_KEY = "sector-nine-theme-cache";
const validThemes = new Set<ThemeId>(themeDefinitions.map(theme => theme.id));
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const readCache = (): ThemeCache => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    return {
      mode: parsed.mode === "follow_game" ? "follow_game" : "manual",
      preferred: validThemes.has(parsed.preferred) ? parsed.preferred : "default",
    };
  } catch {
    return { mode: "manual", preferred: "default" };
  }
};

const themeForGame = (gameId: string): ThemeId =>
  themeDefinitions.find(theme => theme.gameId === gameId)?.id || "default";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, isLoading, updateProfile } = useUser();
  const cached = useMemo(readCache, []);
  const [themeMode, setThemeMode] = useState<ThemeMode>(cached.mode);
  const [preferredTheme, setPreferredTheme] = useState<ThemeId>(cached.preferred);
  const hydratedUserId = useRef<string | null>(null);
  const saveRevision = useRef(0);
  const persistenceQueue = useRef<Promise<void>>(Promise.resolve());
  const activeUserId = useRef<string | null>(user?.id || null);
  activeUserId.current = user?.id || null;
  const [selectedGameId, setSelectedGameId] = useState(() => localStorage.getItem("selected_game_id") || "hl1");
  const availableThemes = useMemo<ThemeId[]>(
    () => user?.availableThemes?.filter(theme => validThemes.has(theme)) ||
      (isLoading && cached.preferred !== "default" ? ["default", cached.preferred] : ["default"]),
    [cached.preferred, isLoading, user?.availableThemes],
  );

  useEffect(() => {
    const syncSelectedGame = () => setSelectedGameId(localStorage.getItem("selected_game_id") || "hl1");
    window.addEventListener("storage", syncSelectedGame);
    window.addEventListener("sector-nine:selected-game", syncSelectedGame);
    return () => {
      window.removeEventListener("storage", syncSelectedGame);
      window.removeEventListener("sector-nine:selected-game", syncSelectedGame);
    };
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      const latestCache=readCache();
      hydratedUserId.current = null;
      setThemeMode(latestCache.mode);
      setPreferredTheme(latestCache.preferred);
      return;
    }
    if (hydratedUserId.current === user.id) return;
    hydratedUserId.current = user.id;
    setThemeMode(user.themeMode);
    setPreferredTheme(user.preferredTheme);
  }, [cached.mode, cached.preferred, isLoading, user?.id, user?.preferredTheme, user?.themeMode]);

  const effectiveTheme = useMemo<ThemeId>(() => {
    const requested = themeMode === "follow_game" ? themeForGame(selectedGameId) : preferredTheme;
    return availableThemes.includes(requested) ? requested : "default";
  }, [availableThemes, preferredTheme, selectedGameId, themeMode]);

  useLayoutEffect(() => {
    const root=document.documentElement;
    for(const attribute of [...root.attributes])if(attribute.name.startsWith('data-theme'))root.removeAttribute(attribute.name);
    for(const className of [...root.classList])if(/^theme(?:-|$)/.test(className))root.classList.remove(className);
    for(const property of [...root.style])if(property.startsWith('--theme-'))root.style.removeProperty(property);
    root.setAttribute('data-theme',effectiveTheme);
    localStorage.setItem(CACHE_KEY, JSON.stringify({ mode: themeMode, preferred: preferredTheme }));
  }, [effectiveTheme, preferredTheme, themeMode]);

  const saveThemePreferences = useCallback(async (mode: ThemeMode, preferred: ThemeId) => {
    if (!validThemes.has(preferred)) throw new Error("Invalid theme ID");
    const targetUserId = user?.id || null;
    const revision=++saveRevision.current;
    const previous={mode:themeMode,preferred:preferredTheme};
    setThemeMode(mode);setPreferredTheme(preferred);
    localStorage.setItem(CACHE_KEY,JSON.stringify({mode,preferred}));
    const persistence = persistenceQueue.current
      .catch(() => undefined)
      .then(() => {
        if (!targetUserId || activeUserId.current !== targetUserId) throw new Error("Theme save cancelled after account change");
        return updateProfile({ themeMode: mode, preferredTheme: preferred });
      });
    persistenceQueue.current = persistence;
    try{await persistence}
    catch(error){if(saveRevision.current===revision){setThemeMode(previous.mode);setPreferredTheme(previous.preferred)}throw error}
  }, [preferredTheme, themeMode, updateProfile, user?.id]);

  const value = useMemo<ThemeContextValue>(() => ({
    themeMode,
    preferredTheme,
    effectiveTheme,
    selectedGameId,
    availableThemes,
    definition: themeDefinitions.find(theme => theme.id === effectiveTheme) || themeDefinitions[0],
    saveThemePreferences,
  }), [availableThemes, effectiveTheme, preferredTheme, saveThemePreferences, selectedGameId, themeMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
