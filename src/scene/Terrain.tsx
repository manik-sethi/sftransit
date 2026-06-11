import { useMemo } from 'react';
import * as THREE from 'three';
import { world } from '../geo/world';
import { useApp } from '../sim/store';
import { PAL, NIGHT } from '../palette';

const cLow = new THREE.Color(PAL.landLow);
const cHigh = new THREE.Color(PAL.landHigh);
const cSand = new THREE.Color(PAL.sand);
const cPark = new THREE.Color(PAL.park);
const cParkDark = new THREE.Color(PAL.parkDark);
const cSea = new THREE.Color(PAL.waterDeep);

export function Terrain() {
  const geometry = useMemo(() => {
    const m = world.meta;
    const w = m.xmax - m.xmin;
    const d = m.zmax - m.zmin;
    const geo = new THREE.PlaneGeometry(w, d, 340, 300);
    geo.rotateX(-Math.PI / 2);
    geo.translate((m.xmin + m.xmax) / 2, 0, (m.zmin + m.zmax) / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const hm = world.heightMeters(x, z);
      pos.setY(i, world.sceneH(x, z));
      if (hm < 0.5) {
        c.copy(cSea);
      } else if (world.isGreen(x, z)) {
        c.lerpColors(cPark, cParkDark, Math.random() * 0.6);
      } else {
        // beach band: low and right next to water
        const nearWater =
          hm < 5 &&
          (world.isWater(x + 2.5, z) || world.isWater(x - 2.5, z) || world.isWater(x, z + 2.5) || world.isWater(x, z - 2.5));
        if (nearWater) {
          c.copy(cSand);
        } else {
          c.lerpColors(cLow, cHigh, Math.min(1, hm / 220));
          c.offsetHSL(0, 0, (Math.random() - 0.5) * 0.02);
        }
      }
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors flatShading roughness={1} />
    </mesh>
  );
}

export function Water() {
  const night = useApp((s) => s.night);
  const m = world.meta;
  return (
    <mesh rotation-x={-Math.PI / 2} position={[(m.xmin + m.xmax) / 2, 0, (m.zmin + m.zmax) / 2]}>
      <planeGeometry args={[(m.xmax - m.xmin) * 1.6, (m.zmax - m.zmin) * 1.6]} />
      <meshStandardMaterial color={night ? NIGHT.water : PAL.water} transparent opacity={0.9} roughness={0.5} />
    </mesh>
  );
}
