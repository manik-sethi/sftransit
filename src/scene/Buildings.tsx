import { useMemo } from 'react';
import * as THREE from 'three';
import { world } from '../geo/world';
import { PAL } from '../palette';

// Procedural buildings on real city blocks. Row houses render as short
// street-aligned strips (wide along the road, shallow toward it) so blocks
// read like SF terraces; downtown gets towers. Footprints shrink to fit
// their lot so nothing overlaps a street, keeping vehicles visible.

const LANDMARK_CLEARANCE: [number, number, number][] = [
  [37.7952, -122.4027, 2.2], // Transamerica
  [37.7897, -122.3967, 2.2], // Salesforce
  [37.8024, -122.4058, 1.5], // Coit
  [37.7955, -122.3937, 2.5], // Ferry Building
  [37.7552, -122.4528, 3], // Sutro
  [37.7762, -122.433, 2.5], // Painted Ladies
  [37.7786, -122.3893, 4.5], // Oracle Park
  [37.8021, -122.4486, 3.5], // Palace of Fine Arts
  [37.7714, -122.4688, 2.5], // de Young
  [37.8, -122.436, 2], // Fillmore strip
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

interface Inst {
  matrices: THREE.Matrix4[];
  colors: THREE.Color[];
}

function generate(): { bodies: Inst; roofs: Inst } {
  const rand = mulberry32(415);
  const m = world.meta;
  const bodies: Inst = { matrices: [], colors: [] };
  const roofs: Inst = { matrices: [], colors: [] };
  const dummy = new THREE.Object3D();
  const palette = PAL.building.map((hex) => new THREE.Color(hex));
  // soft taupes close to the wall tones, with only occasional terracotta,
  // so the roofscape stays beige-cute instead of brick-red
  const roofPalette = ['#cdb699', '#c4ab8e', '#d2bda1', '#c9a384', '#b48a6a'].map(
    (hex) => new THREE.Color(hex),
  );
  const clearance = LANDMARK_CLEARANCE.map(([lat, lon, r]) => [...world.toXZ(lat, lon), r]);
  const [dtX, dtZ] = world.toXZ(37.791, -122.401); // FiDi
  const [somaX, somaZ] = world.toXZ(37.778, -122.405);
  const exagg = m.exagg / m.scale;

  for (let gx = m.xmin + 2; gx < m.xmax - 2; gx += 1.15) {
    for (let gz = m.zmin + 2; gz < m.zmax - 2; gz += 1.15) {
      const x = gx + (rand() - 0.5) * 0.7;
      const z = gz + (rand() - 0.5) * 0.7;
      const hm = world.heightMeters(x, z);
      if (hm < 1.5) continue;
      if (world.isGreen(x, z)) continue;
      const h0 = world.sceneH(x, z);
      if (Math.abs(world.sceneH(x + 1.2, z) - h0) > 0.5 || Math.abs(world.sceneH(x, z + 1.2) - h0) > 0.5) continue;
      const road = world.nearestRoad(x, z);
      if (!road || road.dist < 0.58 || road.dist > 2.4) continue;
      if (clearance.some(([lx, lz, r]) => Math.hypot(lx - x, lz - z) < r)) continue;

      const downtown = Math.exp(-((x - dtX) ** 2 + (z - dtZ) ** 2) / (2 * 8 * 8));
      const soma = Math.exp(-((x - somaX) ** 2 + (z - somaZ) ** 2) / (2 * 11 * 11));
      if (rand() > 0.8 + downtown * 0.2) continue;

      const meters = 9 + rand() * 12 + downtown * (40 + rand() * 200) + soma * (15 + rand() * 50);
      const height = Math.max(0.32, meters * exagg);
      const tower = height > 1.6;

      // depth (toward the street) limited by the lot; width runs along it
      const dMax = Math.min(0.85, 2 * (road.dist - 0.5));
      if (dMax < 0.35) continue;
      const d = tower ? Math.min(0.55 + rand() * 0.5, dMax) : Math.min(0.5 + rand() * 0.35, dMax);
      const w = tower ? 0.55 + rand() * 0.55 : 0.85 + rand() * 0.6; // row-house strip

      const yaw = Math.atan2(road.dx, road.dz);
      dummy.position.set(x, h0 - 0.08, z);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(w, height, d);
      dummy.updateMatrix();
      bodies.matrices.push(dummy.matrix.clone());
      const base = palette[Math.floor(rand() * palette.length)].clone();
      base.offsetHSL(0, 0, (rand() - 0.5) * 0.05);
      bodies.colors.push(base);

      if (!tower && rand() < 0.6) {
        // flat roof cap, slightly proud of the walls — very SF
        dummy.position.set(x, h0 - 0.08 + height, z);
        dummy.scale.set(w + 0.08, 0.07, d + 0.08);
        dummy.updateMatrix();
        roofs.matrices.push(dummy.matrix.clone());
        roofs.colors.push(roofPalette[Math.floor(rand() * roofPalette.length)]);
      }
    }
  }
  return { bodies, roofs };
}

function makeInstanced(inst: Inst, geometry: THREE.BoxGeometry, shadows: boolean): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(
    geometry,
    new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }),
    inst.matrices.length,
  );
  inst.matrices.forEach((mat, i) => mesh.setMatrixAt(i, mat));
  inst.colors.forEach((c, i) => mesh.setColorAt(i, c));
  mesh.castShadow = shadows;
  mesh.receiveShadow = true;
  return mesh;
}

export function Buildings() {
  const { bodyMesh, roofMesh } = useMemo(() => {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const { bodies, roofs } = generate();
    return {
      bodyMesh: makeInstanced(bodies, geo, true),
      roofMesh: makeInstanced(roofs, geo, false),
    };
  }, []);

  return (
    <group>
      <primitive object={bodyMesh} />
      <primitive object={roofMesh} />
    </group>
  );
}
