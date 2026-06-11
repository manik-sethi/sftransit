import { useMemo } from 'react';
import * as THREE from 'three';
import { world } from '../geo/world';
import { PAL } from '../palette';

// Procedural buildings on real city blocks: placed only on land, off parks,
// hugging the real street grid and rotated to face their nearest street.
// Heights ~ real-world scale (downtown towers, low row houses elsewhere).

const LANDMARK_CLEARANCE: [number, number, number][] = [
  [37.7952, -122.4027, 2.2], // Transamerica
  [37.7897, -122.3967, 2.2], // Salesforce
  [37.8024, -122.4058, 1.5], // Coit
  [37.7955, -122.3937, 2.5], // Ferry Building
  [37.7552, -122.4528, 3], // Sutro
  [37.7762, -122.433, 2.5], // Painted Ladies
  [37.7786, -122.3893, 4], // Oracle Park
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

function generate() {
  const rand = mulberry32(415);
  const m = world.meta;
  const matrices: THREE.Matrix4[] = [];
  const colors: THREE.Color[] = [];
  const dummy = new THREE.Object3D();
  const palette = PAL.building.map((hex) => new THREE.Color(hex));
  const clearance = LANDMARK_CLEARANCE.map(([lat, lon, r]) => [...world.toXZ(lat, lon), r]);
  const [dtX, dtZ] = world.toXZ(37.791, -122.401); // FiDi
  const [somaX, somaZ] = world.toXZ(37.778, -122.405);

  const exagg = m.exagg / m.scale; // meters -> scene units

  for (let gx = m.xmin + 2; gx < m.xmax - 2; gx += 1.4) {
    for (let gz = m.zmin + 2; gz < m.zmax - 2; gz += 1.4) {
      const x = gx + (rand() - 0.5) * 0.9;
      const z = gz + (rand() - 0.5) * 0.9;
      const hm = world.heightMeters(x, z);
      if (hm < 1.5) continue; // water / beach
      if (world.isGreen(x, z)) continue;
      const h0 = world.sceneH(x, z);
      // skip steep slopes
      if (Math.abs(world.sceneH(x + 1.2, z) - h0) > 0.5 || Math.abs(world.sceneH(x, z + 1.2) - h0) > 0.5) continue;
      if (clearance.some(([lx, lz, r]) => Math.hypot(lx - x, lz - z) < r)) continue;

      const downtown = Math.exp(-((x - dtX) ** 2 + (z - dtZ) ** 2) / (2 * 8 * 8));
      const soma = Math.exp(-((x - somaX) ** 2 + (z - somaZ) ** 2) / (2 * 11 * 11));
      if (rand() > 0.62 + downtown * 0.38) continue;

      // height in real meters, then exaggerated like the terrain
      const meters =
        10 + rand() * 14 + downtown * (40 + rand() * 200) + soma * (15 + rand() * 50);
      const height = Math.max(0.35, meters * exagg);

      // must hug a street but keep the whole footprint (plus a margin for
      // the vehicles) off it: shrink the building to fit its lot rather
      // than rejecting it, so dense blocks stay dense
      const road = world.nearestRoad(x, z);
      if (!road || road.dist < 0.62 || road.dist > 2.6) continue;
      const maxFoot = Math.min(1.15, ((road.dist - 0.48) / 0.75) * 0.95);
      if (maxFoot < 0.4) continue;
      const w = Math.min(0.55 + rand() * 0.6, maxFoot);
      const d = Math.min(0.55 + rand() * 0.6, maxFoot);

      dummy.position.set(x, h0 - 0.08, z);
      dummy.rotation.set(0, Math.atan2(road.dx, road.dz), 0);
      dummy.scale.set(w, height, d);
      dummy.updateMatrix();
      matrices.push(dummy.matrix.clone());

      const base = palette[Math.floor(rand() * palette.length)].clone();
      base.offsetHSL(0, 0, (rand() - 0.5) * 0.04);
      colors.push(base);
    }
  }
  return { matrices, colors };
}

export function Buildings() {
  const mesh = useMemo(() => {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const inst = generate();
    const im = new THREE.InstancedMesh(
      geo,
      new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }),
      inst.matrices.length,
    );
    inst.matrices.forEach((mat, i) => im.setMatrixAt(i, mat));
    inst.colors.forEach((c, i) => im.setColorAt(i, c));
    im.castShadow = true;
    im.receiveShadow = true;
    return im;
  }, []);

  return <primitive object={mesh} />;
}
