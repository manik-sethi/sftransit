import { useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { routeRuntimes, RouteRuntime } from '../sim/transit';
import { SYSTEMS } from '../geo/systems';
import { useApp } from '../sim/store';
import { PAL } from '../palette';

const sysColor = Object.fromEntries(SYSTEMS.map((s) => [s.id, s.color]));

function SurfaceRoute({ rt }: { rt: RouteRuntime }) {
  const pts = useMemo(() => {
    const n = Math.min(800, rt.points.length * 2);
    return rt.curve.getSpacedPoints(n).map((p) => p.clone().setY(p.y + 0.12));
  }, [rt]);
  // with the full bus network on screen, bus lines stay subtle; rail pops
  const bus = rt.def.system === 'bus';
  return (
    <Line
      points={pts}
      color={sysColor[rt.def.system]}
      lineWidth={bus ? 1.8 : 3.5}
      transparent={bus}
      opacity={bus ? 0.55 : 1}
    />
  );
}

function BartTube({ rt }: { rt: RouteRuntime }) {
  const tube = useMemo(() => new THREE.TubeGeometry(rt.curve, 300, 0.5, 8, false), [rt]);
  return (
    <mesh geometry={tube}>
      <meshStandardMaterial color={PAL.bart} transparent opacity={0.22} depthWrite={false} />
    </mesh>
  );
}

function FerryLine({ rt }: { rt: RouteRuntime }) {
  const pts = useMemo(() => rt.curve.getSpacedPoints(120).map((p) => p.clone().setY(0.2)), [rt]);
  return <Line points={pts} color={PAL.ferry} lineWidth={1.5} dashed dashSize={1.4} gapSize={1.2} transparent opacity={0.65} />;
}

export function RoutesLayer() {
  const visible = useApp((s) => s.visible);
  return (
    <group>
      {routeRuntimes.map((rt) => {
        if (!visible[rt.def.system]) return null;
        if (rt.def.system === 'bart') return <BartTube key={rt.def.id} rt={rt} />;
        if (rt.def.system === 'ferry') return <FerryLine key={rt.def.id} rt={rt} />;
        return <SurfaceRoute key={rt.def.id} rt={rt} />;
      })}
    </group>
  );
}
