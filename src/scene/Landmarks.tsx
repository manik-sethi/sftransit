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
      {/* Oracle Park: brick bowl, green diamond, light towers, scoreboard */}
      <At lat={37.7786} lon={-122.3893} yaw={0.8}>
        <mesh castShadow position-y={0.5}>
          <cylinderGeometry args={[2.1, 2.5, 1, 16, 1, true]} />
          <meshStandardMaterial color="#b3705a" flatShading side={2} />
        </mesh>
        <mesh position-y={1.02} rotation-x={-Math.PI / 2}>
          <torusGeometry args={[2.12, 0.1, 6, 16]} />
          <meshStandardMaterial color="#e8dcc0" flatShading />
        </mesh>
        <mesh position-y={0.08} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[2.0, 16]} />
          <meshStandardMaterial color="#8fae72" />
        </mesh>
        <mesh position={[0, 0.09, -0.4]} rotation-x={-Math.PI / 2} rotation-z={Math.PI / 4}>
          <planeGeometry args={[1.1, 1.1]} />
          <meshStandardMaterial color="#d9c49a" />
        </mesh>
        {[[-1.7, -1.4], [1.7, -1.4], [-1.9, 1.2], [1.9, 1.2]].map(([lx, lz], i) => (
          <group key={i} position={[lx, 0, lz]}>
            <mesh castShadow position-y={1.1}>
              <cylinderGeometry args={[0.05, 0.07, 2.2, 5]} />
              <meshStandardMaterial color="#6b5841" />
            </mesh>
            <mesh position-y={2.25}>
              <boxGeometry args={[0.45, 0.18, 0.08]} />
              <meshStandardMaterial color="#fbf6ec" emissive="#fff2c8" emissiveIntensity={0.5} />
            </mesh>
          </group>
        ))}
        <mesh castShadow position={[0, 1.25, 2.1]}>
          <boxGeometry args={[1.4, 0.5, 0.15]} />
          <meshStandardMaterial color="#5a4a3a" flatShading />
        </mesh>
      </At>
      {/* Palace of Fine Arts: terracotta rotunda + colonnade + lagoon */}
      <At lat={37.8021} lon={-122.4486}>
        <mesh position={[1.6, 0.03, 0.4]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[1.5, 12]} />
          <meshStandardMaterial color="#9ec7c2" />
        </mesh>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <mesh key={i} castShadow position={[Math.cos(a) * 0.85, 0.55, Math.sin(a) * 0.85]}>
              <cylinderGeometry args={[0.09, 0.11, 1.1, 6]} />
              <meshStandardMaterial color="#e8d9bd" flatShading />
            </mesh>
          );
        })}
        <mesh castShadow position-y={1.25}>
          <sphereGeometry args={[1.05, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#c9886a" flatShading />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} castShadow position={[-1.6 * s, 0.4, -1.1 * s * 0.4]} rotation-y={0.4 * s}>
            <boxGeometry args={[1.3, 0.8, 0.3]} />
            <meshStandardMaterial color="#e8d9bd" flatShading />
          </mesh>
        ))}
      </At>
      {/* de Young: copper slab + twisting tower */}
      <At lat={37.7714} lon={-122.4688} yaw={0.25}>
        <mesh castShadow position-y={0.3}>
          <boxGeometry args={[2.6, 0.6, 1]} />
          <meshStandardMaterial color="#a8765c" flatShading roughness={0.6} />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} castShadow position={[1.6, 0.3 + i * 0.55, 0]} rotation-y={i * 0.22}>
            <boxGeometry args={[0.55, 0.55, 0.55]} />
            <meshStandardMaterial color="#a8765c" flatShading roughness={0.6} />
          </mesh>
        ))}
      </At>
      {/* Fillmore St marina bars: tiny storefronts with awnings */}
      <At lat={37.8} lon={-122.436} yaw={Math.PI / 2}>
        {['#d97b6c', '#6fa8a0', '#d9a13c', '#a58ac2', '#7faa5e', '#c98a4b'].map((color, i) => (
          <group key={i} position={[i * 0.42 - 1.05, 0, 0]}>
            <mesh castShadow position-y={0.22}>
              <boxGeometry args={[0.36, 0.44, 0.4]} />
              <meshStandardMaterial color="#f2e6d0" flatShading />
            </mesh>
            <mesh position={[0, 0.34, 0.26]} rotation-x={0.5}>
              <boxGeometry args={[0.34, 0.02, 0.18]} />
              <meshStandardMaterial color={color} flatShading />
            </mesh>
          </group>
        ))}
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
