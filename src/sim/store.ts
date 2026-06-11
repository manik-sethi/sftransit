import { create } from 'zustand';
import { SystemId, SYSTEMS } from '../geo/systems';

export interface FlyTo {
  pos: [number, number, number];
  target: [number, number, number];
}

interface AppState {
  visible: Record<SystemId, boolean>;
  toggle: (id: SystemId) => void;
  followedId: string | null;
  setFollowed: (id: string | null) => void;
  flyTo: FlyTo | null;
  setFlyTo: (f: FlyTo | null) => void;
  night: boolean;
  toggleNight: () => void;
  mode: 'live' | 'demo';
  setMode: (mode: 'live' | 'demo') => void;
  /** comma/space-separated line refs to spotlight, e.g. "48, 24" */
  lineQuery: string;
  setLineQuery: (q: string) => void;
}

/** parse "48, 24" -> ['48','24'] (uppercased) */
export function queryTokens(q: string): string[] {
  return q
    .split(/[\s,]+/)
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);
}

/** does a line ref match the active query? empty query matches everything */
export function matchesQuery(tokens: string[], lineRef: string | null | undefined): boolean {
  if (!tokens.length) return true;
  if (!lineRef) return false;
  const ref = lineRef.toUpperCase();
  return tokens.some((t) => ref === t || ref === `${t}R`);
}

export const useApp = create<AppState>((set) => ({
  visible: Object.fromEntries(SYSTEMS.map((s) => [s.id, true])) as Record<SystemId, boolean>,
  toggle: (id) =>
    set((s) => ({ visible: { ...s.visible, [id]: !s.visible[id] } })),
  followedId: null,
  // following a vehicle and flying to a preset are mutually exclusive
  setFollowed: (id) => set({ followedId: id, ...(id ? { flyTo: null } : {}) }),
  flyTo: null,
  setFlyTo: (f) => set({ flyTo: f, ...(f ? { followedId: null } : {}) }),
  night: false,
  toggleNight: () => set((s) => ({ night: !s.night })),
  // 'live' = real 511.org feed via our proxy; 'demo' = the dummy simulator
  mode: 'live' as 'live' | 'demo',
  setMode: (mode: 'live' | 'demo') => set({ mode, followedId: null }),
  lineQuery: '',
  setLineQuery: (lineQuery) => set({ lineQuery }),
}));
