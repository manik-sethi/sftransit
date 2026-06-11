import { world } from '../geo/world';
import type { FlyTo } from '../sim/store';

export interface ViewPreset {
  id: string;
  emoji: string;
  label: string;
  fly: FlyTo;
}

interface Spec {
  id: string;
  emoji: string;
  label: string;
  lat: number;
  lon: number;
  /** camera distance from the target */
  dist: number;
  /** compass-ish heading the camera sits at, radians (0 = camera south of target) */
  heading: number;
  /** how high the camera sits relative to dist (higher = more top-down) */
  pitch?: number;
}

const SPECS: Spec[] = [
  { id: 'city', emoji: '🌁', label: 'Full city', lat: 37.768, lon: -122.435, dist: 280, heading: 0.5, pitch: 0.75 },
  { id: 'downtown', emoji: '🏙️', label: 'Downtown', lat: 37.7925, lon: -122.401, dist: 34, heading: 0.9, pitch: 0.7 },
  { id: 'gg', emoji: '🌉', label: 'Golden Gate', lat: 37.8195, lon: -122.4785, dist: 38, heading: 1.9, pitch: 0.45 },
  { id: 'wharf', emoji: '🎡', label: 'Wharf & Bay', lat: 37.809, lon: -122.414, dist: 30, heading: -0.2, pitch: 0.55 },
  { id: 'mission', emoji: '🌮', label: 'Mission', lat: 37.76, lon: -122.419, dist: 30, heading: 0.6, pitch: 0.7 },
  { id: 'peaks', emoji: '📡', label: 'Twin Peaks', lat: 37.7544, lon: -122.4477, dist: 34, heading: -2.5, pitch: 0.5 },
];

export function getViewPresets(): ViewPreset[] {
  return SPECS.map((s) => {
    const [x, z] = world.toXZ(s.lat, s.lon);
    const y = Math.max(world.sceneH(x, z), 0);
    const pitch = s.pitch ?? 0.6;
    const pos: [number, number, number] = [
      x + Math.sin(s.heading) * s.dist,
      y + s.dist * pitch,
      z + Math.cos(s.heading) * s.dist,
    ];
    return { id: s.id, emoji: s.emoji, label: s.label, fly: { pos, target: [x, y, z] } };
  });
}
