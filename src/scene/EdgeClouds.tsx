import { useMemo } from 'react';
import * as THREE from 'three';
import { world } from '../geo/world';
import { PAL } from '../palette';

// Cloud banks at the bridge ends and along the map's southern edge so the
// world reads as "the city continues beyond the clouds" instead of just
// stopping. Positions are lat/lon anchors projected like everything else.

interface Bank {
  lat: number;
  lon: number;
  /** spread of the bank along its long axis (units) and its yaw */
  length: number;
  yaw: number;
  y: number;
  puffs: number;
  scale: number;
}

const BANKS: Bank[] = [
  // Golden Gate Bridge north end
  { lat: 37.8345, lon: -122.4795, length: 26, yaw: 1.45, y: 3.2, puffs: 9, scale: 3.4 },
  // Bay Bridge east end
  { lat: 37.816, lon: -122.3425, length: 24, yaw: 0.5, y: 3.0, puffs: 8, scale: 3.2 },
  // southern city limit — a long soft bank suggesting the peninsula goes on
  { lat: 37.7045, lon: -122.475, length: 50, yaw: Math.PI / 2, y: 2.2, puffs: 11, scale: 3.6 },
  { lat: 37.7045, lon: -122.415, length: 50, yaw: Math.PI / 2, y: 2.2, puffs: 11, scale: 3.8 },
  { lat: 37.706, lon: -122.36, length: 40, yaw: Math.PI / 2, y: 2.2, puffs: 9, scale: 3.4 },
];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function EdgeClouds() {
  const banks = useMemo(() => {
    const rand = mulberry32(94117);
    return BANKS.map((b, i) => {
      const [x, z] = world.toXZ(b.lat, b.lon);
      const puffs = Array.from({ length: b.puffs }, (_, k) => ({
        key: k,
        pos: [
          (k / (b.puffs - 1) - 0.5) * b.length + (rand() - 0.5) * 3,
          b.y + (rand() - 0.5) * 1.6 + (k % 2) * 1.2,
          (rand() - 0.5) * 5,
        ] as [number, number, number],
        s: b.scale * (0.65 + rand() * 0.7),
        squash: 0.55 + rand() * 0.2,
      }));
      return { key: i, x, z, yaw: b.yaw, puffs };
    });
  }, []);

  return (
    <group>
      {banks.map((b) => (
        <group key={b.key} position={[b.x, 0, b.z]} rotation-y={b.yaw}>
          {b.puffs.map((p) => (
            <mesh key={p.key} position={p.pos} scale={[p.s, p.s * p.squash, p.s]}>
              <sphereGeometry args={[1, 8, 6]} />
              <meshStandardMaterial color={PAL.cloud} flatShading />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
