import { Terrain, Water } from './Terrain';
import { Buildings } from './Buildings';
import { Trees, Clouds } from './Greenery';
import { Landmarks } from './Landmarks';
import { Bridges } from './Bridges';
import { RoadsLayer } from './RoadsLayer';
import { RoutesLayer } from './RoutesLayer';
import { Vehicles } from './Vehicles';
import { LiveVehicles } from './LiveVehicles';
import { useApp } from '../sim/store';

export function CityScene() {
  const mode = useApp((s) => s.mode);
  return (
    <group>
      <Terrain />
      <Water />
      <RoadsLayer />
      <Buildings />
      <Trees />
      <Clouds />
      <Landmarks />
      <Bridges />
      <RoutesLayer />
      {mode === 'live' ? <LiveVehicles /> : <Vehicles />}
    </group>
  );
}
