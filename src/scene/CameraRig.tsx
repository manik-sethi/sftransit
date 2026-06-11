import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { positionOf } from '../sim/transit';
import { useApp } from '../sim/store';

type ControlsLike = {
  target: THREE.Vector3;
  object: THREE.Camera;
  addEventListener?: (type: string, fn: () => void) => void;
  removeEventListener?: (type: string, fn: () => void) => void;
};

export function CameraRig() {
  const followedId = useApp((s) => s.followedId);
  const flyTo = useApp((s) => s.flyTo);
  const setFlyTo = useApp((s) => s.setFlyTo);
  const controls = useThree((s) => s.controls) as unknown as ControlsLike | null;
  const vehiclePos = useRef(new THREE.Vector3());
  const offset = useRef(new THREE.Vector3());
  const destPos = useRef(new THREE.Vector3());
  const destTarget = useRef(new THREE.Vector3());

  // grabbing the controls cancels an in-flight preset fly-to
  useEffect(() => {
    if (!controls?.addEventListener) return;
    const cancel = () => {
      if (useApp.getState().flyTo) setFlyTo(null);
    };
    controls.addEventListener('start', cancel);
    return () => controls.removeEventListener?.('start', cancel);
  }, [controls, setFlyTo]);

  useFrame(() => {
    if (!controls) return;
    const cam = controls.object as THREE.PerspectiveCamera;

    if (followedId) {
      if (!positionOf(followedId, vehiclePos.current)) return;
      offset.current.copy(cam.position).sub(controls.target);
      // ease in to a comfy chase distance while keeping the user's orbit angle
      const len = THREE.MathUtils.lerp(offset.current.length(), 26, 0.04);
      offset.current.setLength(Math.max(len, 8));
      controls.target.lerp(vehiclePos.current, 0.12);
      cam.position.copy(controls.target).add(offset.current);
      return;
    }

    if (flyTo) {
      destPos.current.set(...flyTo.pos);
      destTarget.current.set(...flyTo.target);
      cam.position.lerp(destPos.current, 0.07);
      controls.target.lerp(destTarget.current, 0.07);
      if (cam.position.distanceTo(destPos.current) < 0.5 && controls.target.distanceTo(destTarget.current) < 0.5) {
        setFlyTo(null);
      }
    }
  });

  return null;
}
