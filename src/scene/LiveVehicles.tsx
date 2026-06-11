import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { liveVehicles, livePositionOf, liveVehicleY, startLive, stopLive, tickLive } from '../sim/live';
import { SYSTEMS, SystemId } from '../geo/systems';
import { routeColor } from '../geo/colors';
import { useApp, queryTokens, matchesQuery } from '../sim/store';

// Hundreds of real vehicles -> one InstancedMesh per transit system.
// Click resolves via the raycast hit's instanceId.

const CAPACITY = 900;

// w, h, l per system (oversized markers, like the sim vehicles)
const SIZE: Record<SystemId, [number, number, number]> = {
  bus: [0.62, 0.55, 1.5],
  metro: [0.6, 0.58, 2.0],
  streetcar: [0.62, 0.6, 1.8],
  bart: [0.62, 0.55, 2.1],
  cable: [0.55, 0.5, 1.1],
  ferry: [1.1, 0.7, 2.6],
};

const dummy = new THREE.Object3D();
const followedPos = new THREE.Vector3();

const tmpColor = new THREE.Color();

function SystemInstances({ system, color }: { system: SystemId; color: string }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const keysRef = useRef<string[]>([]);
  const night = useApp((s) => s.night);
  const setFollowed = useApp((s) => s.setFollowed);
  const lineQuery = useApp((s) => s.lineQuery);
  const tokens = useMemo(() => queryTokens(lineQuery), [lineQuery]);
  const [w, h, l] = SIZE[system];

  const geometry = useMemo(() => {
    const g = new THREE.BoxGeometry(w, h, l);
    g.translate(0, h / 2 + 0.04, 0);
    return g;
  }, [w, h, l]);

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    // instances move every frame — keep a permanent map-sized bounding
    // sphere so raycasting (click-to-follow) never culls against a stale one
    if (!mesh.boundingSphere || mesh.boundingSphere.radius < 500) {
      mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 600);
    }
    const keys: string[] = [];
    let i = 0;
    for (const v of liveVehicles.values()) {
      if (v.system !== system || i >= CAPACITY) continue;
      if (tokens.length && !matchesQuery(tokens, v.line)) continue; // line search
      dummy.position.set(v.x, liveVehicleY(v), v.z);
      dummy.rotation.set(0, v.heading, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, tmpColor.set(routeColor(system, v.line)));
      keys.push(v.key);
      i++;
    }
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    keysRef.current = keys;
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const key = e.instanceId !== undefined ? keysRef.current[e.instanceId] : undefined;
    if (key) setFollowed(`live:${key}`);
  };

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, undefined, CAPACITY]}
      frustumCulled={false}
      onClick={onClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto';
      }}
    >
      {/* per-instance colors multiply the white base; emissive tints at night */}
      <meshStandardMaterial
        color="#ffffff"
        roughness={0.6}
        emissive={color}
        emissiveIntensity={night ? 0.45 : 0}
      />
    </instancedMesh>
  );
}

function LiveFollowMarker() {
  const followedId = useApp((s) => s.followedId);
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const key = followedId?.startsWith('live:') ? followedId.slice(5) : null;
    if (!key || !livePositionOf(key, followedPos)) {
      ref.current.visible = false;
      return;
    }
    ref.current.visible = true;
    ref.current.position.set(
      followedPos.x,
      followedPos.y + 1.6 + Math.sin(clock.elapsedTime * 4) * 0.2,
      followedPos.z,
    );
    ref.current.rotation.y += 0.04;
  });
  return (
    <mesh ref={ref} rotation-x={Math.PI} visible={false}>
      <coneGeometry args={[0.4, 0.7, 4]} />
      <meshStandardMaterial color="#e8604c" emissive="#e8604c" emissiveIntensity={0.4} />
    </mesh>
  );
}

/** Dev-only: lets tests locate live vehicles in screen space. */
function DevProbe() {
  const { camera, size } = useThree();
  useFrame(() => {
    (window as unknown as Record<string, unknown>).__liveOnScreen = () => {
      const out: { key: string; x: number; y: number }[] = [];
      const p = new THREE.Vector3();
      for (const v of liveVehicles.values()) {
        p.set(v.x, liveVehicleY(v), v.z).project(camera);
        if (p.z < 1 && Math.abs(p.x) < 0.85 && Math.abs(p.y) < 0.85) {
          out.push({ key: v.key, x: ((p.x + 1) / 2) * size.width, y: ((1 - p.y) / 2) * size.height });
          if (out.length >= 10) break;
        }
      }
      return out;
    };
  });
  return null;
}

export function LiveVehicles() {
  const visible = useApp((s) => s.visible);

  useEffect(() => {
    startLive();
    return stopLive;
  }, []);

  useFrame((_, dt) => tickLive(Math.min(dt, 0.2)));

  return (
    <group>
      {SYSTEMS.filter((s) => visible[s.id]).map((s) => (
        <SystemInstances key={s.id} system={s.id} color={s.color} />
      ))}
      <LiveFollowMarker />
      {import.meta.env.DEV && <DevProbe />}
    </group>
  );
}
