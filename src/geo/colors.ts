import { PAL } from '../palette';
import type { SystemId } from './world';

// Per-line colors: official-ish hues for Muni Metro, signature colors for
// the other systems, and a deterministic pastel hue hashed from the line
// ref for the bus network — every line gets its own color.

const METRO_COLORS: Record<string, string> = {
  J: '#d09a3e',
  K: '#5fa3a3',
  L: '#a58ac2',
  M: '#7faa5e',
  N: '#6f8fc9',
  T: '#c96a6a',
  S: '#b0a796',
};

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** lineRef examples: '38', '14R', 'N', 'F', '60'. Falls back to system color. */
export function routeColor(system: SystemId, lineRef: string | null | undefined): string {
  switch (system) {
    case 'bart':
      return PAL.bart;
    case 'ferry':
      return PAL.ferry;
    case 'cable':
      return PAL.cable;
    case 'streetcar':
      return PAL.streetcar;
    case 'metro':
      return (lineRef && METRO_COLORS[lineRef.charAt(0).toUpperCase()]) || PAL.metro;
    case 'bus': {
      if (!lineRef) return PAL.bus;
      const h = (hashCode(lineRef) * 137.508) % 360;
      return `hsl(${Math.round(h)}, 42%, 56%)`;
    }
  }
}

/** Line ref for a baked route id: 'bus38' -> '38', 'metroN' -> 'N', etc. */
export function lineRefOfRoute(id: string, system: SystemId): string | null {
  if (id.startsWith('bus')) return id.slice(3);
  if (id.startsWith('metro')) return id.slice(5);
  if (id === 'fline') return 'F';
  return null;
}
