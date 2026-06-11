import { ReactNode } from 'react';
import { world } from '../geo/world';
import { PAL } from '../palette';

// Landmarks at their true coordinates, heights ~ real meters with the same
// vertical exaggeration as the terrain (so towers read correctly vs hills).

function At({ lat, lon, children, yaw = 0 }: { lat: number; lon: number; children: ReactNode; yaw?: number }) {
  const [x, z] = world.toXZ(lat, lon);
  return (
    <group position={[x, world.sceneH(x, z) - 0.05, z]} rotation-y={yaw}>
      {children}
    </group>
  );
}

const E = 2 / 50; // meters -> scene units (matches terrain exaggeration)

export function Landmarks() {
  return (
    <group>
      {/* Transamerica Pyramid, 260m */}
      <At lat={37.7952} lon={-122.4027}>
        <mesh castShadow position-y={(260 * E) / 2}>
          <coneGeometry args={[0.9, 260 * E, 4]} />
          <meshStandardMaterial color="#f4ecda" flatShading roughness={0.8} />
        </mesh>
      </At>
      {/* Salesforce Tower, 326m */}
      <At lat={37.7897} lon={-122.3967}>
        <mesh castShadow position-y={(326 * E) / 2}>
          <cylinderGeometry args={[0.62, 0.85, 326 * E, 12]} />
          <meshStandardMaterial color="#e9ddc6" flatShading roughness={0.7} />
        </mesh>
        <mesh position-y={326 * E}>
          <sphereGeometry args={[0.62, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#e9ddc6" flatShading />
        </mesh>
      </At>
      {/* Coit Tower */}
      <At lat={37.8024} lon={-122.4058}>
        <mesh castShadow position-y={1.3}>
          <cylinderGeometry args={[0.3, 0.42, 2.6, 10]} />
          <meshStandardMaterial color="#efe3cc" flatShading />
        </mesh>
        <mesh position-y={2.75}>
          <cylinderGeometry args={[0.37, 0.37, 0.3, 10]} />
          <meshStandardMaterial color="#e2d3b6" flatShading />
        </mesh>
      </At>
      {/* Ferry Building */}
      <At lat={37.7955} lon={-122.3937} yaw={0.6}>
        <mesh castShadow position-y={0.5}>
          <boxGeometry args={[3.4, 1, 1]} />
          <meshStandardMaterial color="#f0e2c8" flatShading />
        </mesh>
        <mesh castShadow position-y={1.7}>
          <boxGeometry args={[0.7, 2.4, 0.7]} />
          <meshStandardMaterial color="#ecdcc0" flatShading />
        </mesh>
        <mesh position-y={3.15}>
          <coneGeometry args={[0.5, 0.7, 4]} />
          <meshStandardMaterial color={PAL.roofAccent} flatShading />
        </mesh>
      </At>
      {/* Sutro Tower, ~298m mast on the ridge */}
      <At lat={37.7552} lon={-122.4528}>
        {[-0.55, 0, 0.55].map((off, i) => (
          <mesh key={i} castShadow position={[off, 6, 0]} rotation-z={-off * 0.05}>
            <cylinderGeometry args={[0.07, 0.18, 12, 6]} />
            <meshStandardMaterial color="#d9684f" flatShading />
          </mesh>
        ))}
        <mesh position-y={8}>
          <boxGeometry args={[1.6, 0.16, 0.16]} />
          <meshStandardMaterial color="#f0e6d4" />
        </mesh>
        <mesh position-y={11}>
          <boxGeometry args={[1.3, 0.16, 0.16]} />
          <meshStandardMaterial color="#f0e6d4" />
        </mesh>
      </At>
      {/* Painted Ladies, Steiner St */}
      <At lat={37.7762} lon={-122.433} yaw={Math.PI / 2}>
        {['#e8c8c8', '#cfd8c2', '#d9c9e2', '#f0ddb8', '#c8d6dd'].map((color, i) => (
          <group key={i} position={[i * 0.45 - 0.9, 0, 0]}>
            <mesh castShadow position-y={0.3}>
              <boxGeometry args={[0.38, 0.6, 0.45]} />
              <meshStandardMaterial color={color} flatShading />
            </mesh>
            <mesh castShadow position-y={0.72} rotation-y={Math.PI / 4}>
              <coneGeometry args={[0.3, 0.28, 4]} />
              <meshStandardMaterial color={PAL.roofAccent} flatShading />
            </mesh>
          </group>
        ))}
      </At>
      {/* Oracle Park */}
      <At lat={37.7786} lon={-122.3893} yaw={0.8}>
        <mesh castShadow position-y={0.45}>
          <cylinderGeometry args={[2.2, 2.4, 0.9, 14, 1, true]} />
          <meshStandardMaterial color="#e0c9ab" flatShading side={2} />
        </mesh>
        <mesh position-y={0.06} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[2.1, 14]} />
          <meshStandardMaterial color={PAL.park} />
        </mesh>
      </At>
      {/* Alcatraz cellhouse */}
      <At lat={37.8267} lon={-122.423}>
        <mesh castShadow position-y={0.5}>
          <boxGeometry args={[1.6, 0.8, 0.9]} />
          <meshStandardMaterial color="#e6dcc4" flatShading />
        </mesh>
        <mesh castShadow position={[0.4, 1.2, 0]}>
          <cylinderGeometry args={[0.12, 0.15, 0.9, 6]} />
          <meshStandardMaterial color="#ded2b6" flatShading />
        </mesh>
      </At>
    </group>
  );
}
