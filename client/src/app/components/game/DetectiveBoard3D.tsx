import React, { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Center, Environment, OrbitControls, useGLTF } from "@react-three/drei";

function BoardModel() {
  const gltf = useGLTF("/models/detective_board/scene.gltf") as any;
  const scene = gltf.scene as THREE.Object3D;

  const group = useRef<THREE.Group>(null);
  const mouse = useRef({ x: 0, y: 0 });

  // Track pointer globally (no clicking needed)
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;  // -1..1
      const ny = (e.clientY / window.innerHeight) * 2 - 1; // -1..1
      mouse.current.x = nx;
      mouse.current.y = ny;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame(() => {
    if (!group.current) return;

    // Sensitivity (bigger = more movement)
    const maxYaw = 0.45;   // left-right
    const maxPitch = 0.22; // up-down

    // Target rotation from mouse position
    const targetY = mouse.current.x * maxYaw;
    const targetX = -mouse.current.y * maxPitch;

    // Smooth follow (higher lerp = snappier)
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, targetY, 0.10);
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, targetX, 0.10);
  });

  return (
    <Center>
      <group ref={group} scale={1}>
        <primitive object={scene} />
      </group>
    </Center>
  );
}

export function DetectiveBoard3D() {
  return (
    <div className="relative w-full overflow-hidden rounded-xl h-[520px] md:h-[640px]">
      <Canvas camera={{ position: [0, 0.6, 2.6], fov: 45 }} dpr={[1, 2]}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[3, 4, 2]} intensity={1.2} />

        <Suspense fallback={null}>
          <Environment preset="city" />
          <BoardModel />
        </Suspense>

        {/* Keep OrbitControls only for zoom if you want. Rotation disabled so it doesn't fight pointer-tilt */}
        <OrbitControls enableRotate={false} enablePan={false} enableZoom={false} />
      </Canvas>
    </div>
  );
}

useGLTF.preload("/models/detective_board/scene.gltf");