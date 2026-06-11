import { useMemo } from 'react';
import * as THREE from 'three';
import { world } from '../geo/world';
import { useApp } from '../sim/store';
import { NIGHT } from '../palette';

// The full real street network, rendered as flat ribbons draped on the
// terrain and merged into one mesh per road class (3 draw calls total).

const ROAD_LIFT = 0.16;
const BRIDGE_Y = 2.6;

// Roads use unlit materials, so at night they read as a glowing amber
// street grid against the dark city.
const CLASSES = [
  { key: 'major' as const, width: 0.55, color: '#d8c298', night: NIGHT.roadMajor, overWater: BRIDGE_Y },
  { key: 'mid' as const, width: 0.42, color: '#e2d2ad', night: NIGHT.roadMid, overWater: BRIDGE_Y },
  { key: 'minor' as const, width: 0.26, color: '#e9dcbc', night: NIGHT.roadMinor, overWater: 0.4 },
];

// neighborhood max keeps ribbons on top of the flat-shaded terrain
// triangles, which can peak above the bilinear height between samples
function groundMax(x: number, z: number): number {
  return Math.max(
    world.sceneH(x, z),
    world.sceneH(x + 0.7, z),
    world.sceneH(x - 0.7, z),
    world.sceneH(x, z + 0.7),
    world.sceneH(x, z - 0.7),
  );
}

function buildRibbons(lines: [number, number][][], width: number, overWaterY: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const hw = width / 2;
  for (const line of lines) {
    if (line.length < 2) continue;
    // heights: drape on land, lift across water (bridges / piers)
    const ys = line.map(([x, z]) => (world.isWater(x, z) ? NaN : groundMax(x, z) + ROAD_LIFT));
    for (let i = 0; i < ys.length; i++) {
      if (Number.isNaN(ys[i])) {
        let a = NaN;
        let b = NaN;
        for (let j = i - 1; j >= 0; j--) if (!Number.isNaN(ys[j])) { a = ys[j]; break; }
        for (let j = i + 1; j < ys.length; j++) if (!Number.isNaN(ys[j])) { b = ys[j]; break; }
        const base = Number.isNaN(a) ? (Number.isNaN(b) ? overWaterY : b) : Number.isNaN(b) ? a : (a + b) / 2;
        ys[i] = Math.max(base, overWaterY);
      }
    }
    // one gentle smoothing pass; never below the terrain-max drape
    for (let j = 1; j < ys.length - 1; j++) {
      ys[j] = Math.max((ys[j - 1] + ys[j] * 2 + ys[j + 1]) / 4, ys[j] - 0.04);
    }
    const base = positions.length / 3;
    for (let i = 0; i < line.length; i++) {
      const [x, z] = line[i];
      const [px, pz] = line[Math.max(0, i - 1)];
      const [nx, nz] = line[Math.min(line.length - 1, i + 1)];
      let dx = nx - px;
      let dz = nz - pz;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
      // perpendicular in the ground plane
      positions.push(x - dz * hw, ys[i], z + dx * hw, x + dz * hw, ys[i], z - dx * hw);
    }
    for (let i = 0; i < line.length - 1; i++) {
      const a = base + i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.setIndex(indices);
  return geo;
}

export function RoadsLayer() {
  const night = useApp((s) => s.night);
  const meshes = useMemo(
    () =>
      CLASSES.map((c) => ({
        ...c,
        geometry: buildRibbons(world.roads[c.key], c.width, c.overWater),
      })),
    [],
  );
  return (
    <group>
      {meshes.map((m) => (
        <mesh key={m.key} geometry={m.geometry}>
          <meshBasicMaterial color={night ? m.night : m.color} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}
