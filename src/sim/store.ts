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
}));
