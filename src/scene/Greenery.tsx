import { useMemo } from 'react';
import * as THREE from 'three';
import { world } from '../geo/world';
import { PAL } from '../palette';

export function Trees() {
  const { trunks, crowns } = useMemo(() => {
    const positions: { x: number; y: number; z: number; s: number }[] = [];
    let tries = 0;
    while (positions.length < 2200 && tries < 30000) {
      tries++;
      const p = world.randomGreenPoint();
      if (!p) continue;
      const [x, z] = p;
      const hm = world.heightMeters(x, z);
      if (hm < 1) continue;
      positions.push({ x, y: world.sceneH(x, z), z, s: 0.35 + Math.random() * 0.5 });
    }

    const dummy = new THREE.Object3D();
    const trunkGeo = new THREE.CylinderGeometry(0.1, 0.16, 0.7, 5);
    trunkGeo.translate(0, 0.35, 0);
    const crownGeo = new THREE.IcosahedronGeometry(0.75, 0);
    const trunks = new THREE.InstancedMesh(
      trunkGeo,
      new THREE.MeshStandardMaterial({ color: PAL.treeTrunk, roughness: 1 }),
      positions.length,
    );
    const crowns = new THREE.InstancedMesh(
      crownGeo,
      new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }),
      positions.length,
    );
    const crownColors = PAL.treeCrown.map((c) => new THREE.Color(c));
    positions.forEach((p, i) => {
      dummy.position.set(p.x, p.y - 0.05, p.z);
      dummy.scale.setScalar(p.s);
      dummy.rotation.y = Math.random() * Math.PI;
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      dummy.position.y += 0.95 * p.s;
      dummy.updateMatrix();
      crowns.setMatrixAt(i, dummy.matrix);
      crowns.setColorAt(i, crownColors[i % crownColors.length]);
    });
    trunks.castShadow = true;
    crowns.castShadow = true;
    return { trunks, crowns };
  }, []);

  return (
    <group>
      <primitive object={trunks} />
      <primitive object={crowns} />
    </group>
  );
}

export function Clouds() {
  const clouds = useMemo(() => {
    const m = world.meta;
    return Array.from({ length: 10 }, (_, i) => ({
      key: i,
      x: m.xmin + Math.random() * (m.xmax - m.xmin),
      y: 42 + Math.random() * 20,
      z: m.zmin + Math.random() * (m.zmax - m.zmin),
      s: 2 + Math.random() * 2.2,
    }));
  }, []);
  return (
    <group>
      {clouds.map((c) => (
        <group key={c.key} position={[c.x, c.y, c.z]} scale={c.s}>
          <mesh>
            <sphereGeometry args={[1, 7, 5]} />
            <meshStandardMaterial color={PAL.cloud} flatShading />
          </mesh>
          <mesh position={[1.1, -0.15, 0.2]} scale={0.7}>
            <sphereGeometry args={[1, 7, 5]} />
            <meshStandardMaterial color={PAL.cloud} flatShading />
          </mesh>
          <mesh position={[-1, -0.2, -0.1]} scale={0.6}>
            <sphereGeometry args={[1, 7, 5]} />
            <meshStandardMaterial color={PAL.cloud} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
}
