import { useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { routeRuntimes, RouteRuntime } from '../sim/transit';
import { routeColor, lineRefOfRoute } from '../geo/colors';
import { useApp, queryTokens, matchesQuery } from '../sim/store';
import { PAL } from '../palette';

function SurfaceRoute({ rt, spotlight, dimmed }: { rt: RouteRuntime; spotlight: boolean; dimmed: boolean }) {
  const pts = useMemo(() => {
    const n = Math.min(800, rt.points.length * 2);
    return rt.curve.getSpacedPoints(n).map((p) => p.clone().setY(p.y + 0.06));
  }, [rt]);
  const color = useMemo(
    () => routeColor(rt.def.system, lineRefOfRoute(rt.def.id, rt.def.system)),
    [rt],
  );
  // with the full bus network on screen, bus lines stay subtle; rail pops.
  // a searched line gets the spotlight; everything else fades back.
  const bus = rt.def.system === 'bus';
  const width = spotlight ? 5 : bus ? 1.8 : 3.5;
  const opacity = dimmed ? 0.08 : spotlight ? 1 : bus ? 0.55 : 1;
  return <Line points={pts} color={color} lineWidth={width} transparent={opacity < 1} opacity={opacity} />;
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
  const lineQuery = useApp((s) => s.lineQuery);
  const tokens = useMemo(() => queryTokens(lineQuery), [lineQuery]);
  return (
    <group>
      {routeRuntimes.map((rt) => {
        if (!visible[rt.def.system]) return null;
        if (rt.def.system === 'bart') return <BartTube key={rt.def.id} rt={rt} />;
        if (rt.def.system === 'ferry') return <FerryLine key={rt.def.id} rt={rt} />;
        const match = matchesQuery(tokens, lineRefOfRoute(rt.def.id, rt.def.system));
        return (
          <SurfaceRoute
            key={rt.def.id}
            rt={rt}
            spotlight={tokens.length > 0 && match}
            dimmed={tokens.length > 0 && !match}
          />
        );
      })}
    </group>
  );
}
