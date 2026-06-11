import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { MapControls } from '@react-three/drei';
import { loadWorld } from './geo/world';
import { initTransit } from './sim/transit';
import { CityScene } from './scene/CityScene';
import { CameraRig } from './scene/CameraRig';
import { Hud } from './ui/Hud';
import { useApp } from './sim/store';
import { PAL, NIGHT } from './palette';

export default function App() {
  const setFollowed = useApp((s) => s.setFollowed);
  const night = useApp((s) => s.night);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWorld()
      .then((w) => {
        initTransit(w);
        setReady(true);
      })
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <div className="loading">
        <div>😿 couldn't load the city data</div>
        <div className="loading-sub">{error}</div>
        <div className="loading-sub">run `node scripts/fetch-data.mjs` and refresh</div>
      </div>
    );
  }
  if (!ready) {
    return (
      <div className="loading">
        <div className="loading-bridge">🌁</div>
        <div>loading San Francisco…</div>
      </div>
    );
  }

  const sky = night ? NIGHT.sky : PAL.sky;
  return (
    <div className={night ? 'app night' : 'app'}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [70, 90, 130], fov: 42, near: 0.5, far: 1500 }}
        onPointerMissed={() => setFollowed(null)}
      >
        <color attach="background" args={[sky]} />
        <fog attach="fog" args={[sky, 420, 1200]} />
        <ambientLight
          intensity={night ? NIGHT.ambient.intensity : 0.85}
          color={night ? NIGHT.ambient.color : '#fff3e0'}
        />
        <directionalLight
          position={[120, 180, -90]}
          intensity={night ? NIGHT.moon.intensity : 1.6}
          color={night ? NIGHT.moon.color : '#ffe9c8'}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-240}
          shadow-camera-right={240}
          shadow-camera-top={240}
          shadow-camera-bottom={-240}
          shadow-camera-far={700}
          shadow-bias={-0.0004}
        />
        <hemisphereLight
          args={
            night
              ? [NIGHT.hemi.sky, NIGHT.hemi.ground, NIGHT.hemi.intensity]
              : ['#f6ead3', '#cdbc9a', 0.5]
          }
        />
        <CityScene />
        {/* Map-style navigation: left-drag pans the city, right-drag rotates */}
        <MapControls
          makeDefault
          target={[-20, 0, -20]}
          enableDamping
          dampingFactor={0.08}
          maxPolarAngle={1.45}
          minDistance={4}
          maxDistance={480}
        />
        <CameraRig />
      </Canvas>
      <Hud />
    </div>
  );
}
