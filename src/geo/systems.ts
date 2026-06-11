import { PAL } from '../palette';
import type { SystemId } from './world';

export type { SystemId };

export interface SystemMeta {
  id: SystemId;
  label: string;
  emoji: string;
  color: string;
  /** display speed when moving (the sim runs ~12x real time) */
  mph: number;
}

export const SYSTEMS: SystemMeta[] = [
  { id: 'bus', label: 'Muni buses', emoji: '🚌', color: PAL.bus, mph: 18 },
  { id: 'metro', label: 'Muni Metro', emoji: '🚈', color: PAL.metro, mph: 25 },
  { id: 'streetcar', label: 'F streetcar', emoji: '🚋', color: PAL.streetcar, mph: 15 },
  { id: 'bart', label: 'BART', emoji: '🚇', color: PAL.bart, mph: 50 },
  { id: 'cable', label: 'Cable cars', emoji: '🚠', color: PAL.cable, mph: 9 },
  { id: 'ferry', label: 'Ferries', emoji: '⛴️', color: PAL.ferry, mph: 20 },
];
