import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { advance, poseCar, vehicles, VehicleSim } from '../sim/transit';
import { SystemId, SYSTEMS } from '../geo/systems';
import { useApp } from '../sim/store';
import { PAL } from '../palette';

// Vehicles are deliberately oversized for the real-scale map (like markers
// on a transit map) — VEHICLE_SCALE controls how toy-like they read.
const VEHICLE_SCALE = 0.85;

const CAR_SPACING: Record<SystemId, number> = {
  bus: 0,
  metro: 2.2,
  streetcar: 0,
  bart: 2.3,
  cable: 0,
  ferry: 0,
};

const sysMeta = Object.fromEntries(SYSTEMS.map((s) => [s.id, s]));

function Wheels({ length, width }: { length: number; width: number }) {
  const offsets: [number, number][] = [
    [-width / 2, length * 0.3],
    [width / 2, length * 0.3],
    [-width / 2, -length * 0.3],
    [width / 2, -length * 0.3],
  ];
  return (
    <group>
      {offsets.map(([x, z], i) => (
        <mesh key={i} position={[x, -0.38, z]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.18, 0.18, 0.12, 10]} />
          <meshStandardMaterial color="#5a4a3a" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function WindowBand({ length, width, y = 0.18 }: { length: number; width: number; y?: number }) {
  const night = useApp((s) => s.night);
  return (
    <mesh position-y={y}>
      <boxGeometry args={[width + 0.02, 0.28, length * 0.8]} />
      {night ? (
        <meshStandardMaterial color="#ffd98a" emissive="#ffc864" emissiveIntensity={0.8} roughness={0.4} />
      ) : (
        <meshStandardMaterial color="#8aa3a8" roughness={0.4} />
      )}
    </mesh>
  );
}

function CarMesh({ system, lead }: { system: SystemId; lead: boolean }) {
  switch (system) {
    case 'bus':
      return (
        <group position-y={0.55}>
          <RoundedBox args={[1, 0.95, 2.5]} radius={0.18} smoothness={3} castShadow>
            <meshStandardMaterial color="#f3e7cf" roughness={0.7} />
          </RoundedBox>
          <WindowBand length={2.5} width={1} />
          <mesh position={[0, -0.18, 0]}>
            <boxGeometry args={[1.04, 0.16, 2.3]} />
            <meshStandardMaterial color={PAL.bus} roughness={0.7} />
          </mesh>
          <Wheels length={2.5} width={0.85} />
        </group>
      );
    case 'streetcar':
      return (
        <group position-y={0.6}>
          <RoundedBox args={[1, 1.05, 3]} radius={0.2} smoothness={3} castShadow>
            <meshStandardMaterial color={PAL.streetcar} roughness={0.7} />
          </RoundedBox>
          <WindowBand length={3} width={1} y={0.22} />
          <mesh position={[0, -0.3, 0]}>
            <boxGeometry args={[1.04, 0.22, 2.8]} />
            <meshStandardMaterial color="#f3e7cf" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.85, 0]} rotation-x={0.5}>
            <cylinderGeometry args={[0.03, 0.03, 0.9, 5]} />
            <meshStandardMaterial color="#6b5841" />
          </mesh>
          <Wheels length={3} width={0.85} />
        </group>
      );
    case 'metro':
      return (
        <group position-y={0.58}>
          <RoundedBox args={[0.95, 1, 3.3]} radius={0.18} smoothness={3} castShadow>
            <meshStandardMaterial color="#ece4d2" roughness={0.6} />
          </RoundedBox>
          <WindowBand length={3.3} width={0.95} y={0.2} />
          <mesh position={[0, -0.22, 0]}>
            <boxGeometry args={[0.99, 0.18, 3.1]} />
            <meshStandardMaterial color={PAL.metro} roughness={0.7} />
          </mesh>
          {lead && (
            <mesh position={[0, 0.05, 1.68]}>
              <boxGeometry args={[0.7, 0.4, 0.08]} />
              <meshStandardMaterial color="#8aa3a8" roughness={0.4} />
            </mesh>
          )}
          <Wheels length={3.3} width={0.8} />
        </group>
      );
    case 'bart':
      return (
        <group position-y={0.5}>
          <RoundedBox args={[1, 0.95, 3.5]} radius={0.24} smoothness={3}>
            <meshStandardMaterial color="#e8e6df" roughness={0.5} transparent opacity={0.95} />
          </RoundedBox>
          <WindowBand length={3.5} width={1} y={0.16} />
          <mesh position={[0, -0.2, 0]}>
            <boxGeometry args={[1.04, 0.14, 3.3]} />
            <meshStandardMaterial color={PAL.bart} roughness={0.7} />
          </mesh>
        </group>
      );
    case 'cable':
      return (
        <group position-y={0.5}>
          <RoundedBox args={[0.95, 0.85, 1.9]} radius={0.14} smoothness={3} castShadow>
            <meshStandardMaterial color={PAL.cable} roughness={0.8} />
          </RoundedBox>
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[1.1, 0.12, 2.05]} />
            <meshStandardMaterial color="#f3e7cf" roughness={0.8} />
          </mesh>
          <WindowBand length={1.9} width={0.95} y={0.12} />
          <Wheels length={1.9} width={0.8} />
        </group>
      );
    case 'ferry':
      return (
        <group position-y={0.45}>
          <mesh castShadow>
            <boxGeometry args={[1.7, 0.7, 4.2]} />
            <meshStandardMaterial color={PAL.ferry} roughness={0.8} flatShading />
          </mesh>
          <mesh position={[0, 0.16, 2.3]} rotation-x={Math.PI / 2}>
            <coneGeometry args={[0.85, 1.4, 4]} />
            <meshStandardMaterial color={PAL.ferry} roughness={0.8} flatShading />
          </mesh>
          <FerryCabin />
          <mesh position={[0, 1.25, -0.9]}>
            <cylinderGeometry args={[0.14, 0.18, 0.6, 8]} />
            <meshStandardMaterial color="#d9a13c" roughness={0.8} />
          </mesh>
        </group>
      );
  }
}

function FerryCabin() {
  const night = useApp((s) => s.night);
  return (
    <RoundedBox args={[1.3, 0.7, 2.6]} radius={0.14} smoothness={3} position={[0, 0.65, -0.2]} castShadow>
      {night ? (
        <meshStandardMaterial color="#ffe2a0" emissive="#ffc864" emissiveIntensity={0.6} roughness={0.7} />
      ) : (
        <meshStandardMaterial color="#f7efdf" roughness={0.7} />
      )}
    </RoundedBox>
  );
}

function FollowMarker({ color }: { color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = 2.4 + Math.sin(clock.elapsedTime * 4) * 0.25;
    ref.current.rotation.y += 0.04;
  });
  return (
    <mesh ref={ref} position-y={2.4} rotation-x={Math.PI}>
      <coneGeometry args={[0.45, 0.8, 4]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} />
    </mesh>
  );
}

function VehicleObject({
  v,
  refs,
  followed,
}: {
  v: VehicleSim;
  refs: React.MutableRefObject<Map<string, THREE.Group>>;
  followed: boolean;
}) {
  const setFollowed = useApp((s) => s.setFollowed);
  const cars = v.route.def.cars ?? 1;
  return (
    <>
      {Array.from({ length: cars }, (_, c) => (
        <group
          key={c}
          scale={VEHICLE_SCALE}
          ref={(g) => {
            if (g) refs.current.set(`${v.id}/${c}`, g);
            else refs.current.delete(`${v.id}/${c}`);
          }}
          onClick={(e) => {
            e.stopPropagation();
            setFollowed(v.id);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'auto';
          }}
        >
          <CarMesh system={v.route.def.system} lead={c === 0} />
          {c === 0 && followed && <FollowMarker color={sysMeta[v.route.def.system].color} />}
        </group>
      ))}
    </>
  );
}

export function Vehicles() {
  const visible = useApp((s) => s.visible);
  const followedId = useApp((s) => s.followedId);
  const refs = useRef(new Map<string, THREE.Group>());

  useFrame((_, dt) => {
    advance(Math.min(dt, 0.1));
    for (const v of vehicles) {
      const cars = v.route.def.cars ?? 1;
      const spacing = CAR_SPACING[v.route.def.system];
      for (let c = 0; c < cars; c++) {
        const g = refs.current.get(`${v.id}/${c}`);
        if (g) poseCar(v, c, spacing, g.position, g.quaternion);
      }
    }
  });

  return (
    <group>
      {vehicles
        .filter((v) => visible[v.route.def.system])
        .map((v) => (
          <VehicleObject key={v.id} v={v} refs={refs} followed={followedId === v.id} />
        ))}
    </group>
  );
}
