import { Terrain, Water } from './Terrain';
import { Buildings } from './Buildings';
import { Trees, Clouds } from './Greenery';
import { Landmarks } from './Landmarks';
import { Bridges } from './Bridges';
import { RoadsLayer } from './RoadsLayer';
import { RoutesLayer } from './RoutesLayer';
import { Vehicles } from './Vehicles';

export function CityScene() {
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
      <Vehicles />
    </group>
  );
}
