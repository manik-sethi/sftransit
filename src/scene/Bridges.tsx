import { useMemo } from 'react';
import * as THREE from 'three';
import { world } from '../geo/world';
import { PAL } from '../palette';

// Stylized suspension bridges at their true spans. Deck height matches the
// lifted bridge roads in RoadsLayer (2.6) so the real 101 / I-80 ribbons run
// along the decks.

const DECK_Y = 2.6;

interface BridgeProps {
  from: [number, number]; // lat, lon
  to: [number, number];
  color: string;
  towerHeight?: number;
  width?: number;
}

function SuspensionBridge({ from, to, color, towerHeight = 9, width = 1.6 }: BridgeProps) {
  const { mid, length, angle, cables } = useMemo(() => {
    const [ax, az] = world.toXZ(from[0], from[1]);
    const [bx, bz] = world.toXZ(to[0], to[1]);
    const a = new THREE.Vector3(ax, DECK_Y, az);
    const b = new THREE.Vector3(bx, DECK_Y, bz);
    const length = a.distanceTo(b);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const angle = Math.atan2(bx - ax, bz - az);
    const top = towerHeight - 0.4;
    const side = width / 2 + 0.1;
    const mk = (s: number) => {
      const pts = [
        new THREE.Vector3(s, 0.4, -length / 2),
        new THREE.Vector3(s, top, -length * 0.25),
        new THREE.Vector3(s, 1.4, 0),
        new THREE.Vector3(s, top, length * 0.25),
        new THREE.Vector3(s, 0.4, length / 2),
      ];
      const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.8);
      return new THREE.TubeGeometry(curve, 60, 0.07, 5, false);
    };
    return { mid, length, angle, cables: [mk(-side), mk(side)] };
  }, [from, to, towerHeight, width]);

  return (
    <group position={mid} rotation-y={angle}>
      <mesh castShadow receiveShadow position-y={-0.2}>
        <boxGeometry args={[width + 0.4, 0.35, length]} />
        <meshStandardMaterial color={color} flatShading roughness={0.85} />
      </mesh>
      {[-length * 0.25, length * 0.25].map((tz, i) => (
        <group key={i} position={[0, 0, tz]}>
          {[-(width / 2 + 0.1), width / 2 + 0.1].map((tx, j) => (
            <mesh key={j} castShadow position={[tx, towerHeight / 2 - DECK_Y / 2, 0]}>
              <boxGeometry args={[0.4, towerHeight + DECK_Y, 0.4]} />
              <meshStandardMaterial color={color} flatShading roughness={0.85} />
            </mesh>
          ))}
          <mesh position={[0, towerHeight - 1, 0]}>
            <boxGeometry args={[width + 0.6, 0.3, 0.35]} />
            <meshStandardMaterial color={color} flatShading />
          </mesh>
          <mesh position={[0, towerHeight * 0.5, 0]}>
            <boxGeometry args={[width + 0.6, 0.3, 0.35]} />
            <meshStandardMaterial color={color} flatShading />
          </mesh>
        </group>
      ))}
      {cables.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

export function Bridges() {
  return (
    <group>
      {/* Golden Gate: Fort Point to the Marin anchorage */}
      <SuspensionBridge from={[37.8065, -122.476]} to={[37.832, -122.479]} color={PAL.bridgeOrange} towerHeight={9} />
      {/* Bay Bridge west span: SF anchorage to Yerba Buena */}
      <SuspensionBridge from={[37.7875, -122.3885]} to={[37.8105, -122.3625]} color={PAL.bridgeGray} towerHeight={7} />
      {/* Bay Bridge east span: low causeway toward Oakland */}
      <SuspensionBridge from={[37.8135, -122.3575]} to={[37.8205, -122.3225]} color={PAL.bridgeGray} towerHeight={5} />
    </group>
  );
}
