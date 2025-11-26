'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, Instance, Instances } from '@react-three/drei';
import * as THREE from 'three';

function Strand({ position, rotation, color }: { position: any, rotation: any, color: string }) {
  return (
    <group position={position} rotation={rotation}>
      <Instances range={20}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} />
        {Array.from({ length: 10 }).map((_, i) => {
           const t = (i / 10) * Math.PI * 2; 
           const x = Math.sin(t) * 0.5;
           const z = Math.cos(t) * 0.5;
           const y = (i - 5) * 0.4;
           return (
             <React.Fragment key={i}>
                <Instance position={[x, y, z]} />
                <Instance position={[-x, y, -z]} />
                <mesh position={[0, y, 0]} rotation={[0, t, Math.PI/2]} scale={[0.1, x*2, 0.1]}>
                    <cylinderGeometry args={[0.02, 0.02, 1, 4]} />
                    <meshBasicMaterial color={color} opacity={0.1} transparent />
                </mesh>
             </React.Fragment>
           );
        })}
      </Instances>
    </group>
  );
}

export function DnaBackground() {
  const group = useRef<THREE.Group>(null);

  // OPTIMIZATION: Memoize the particle data so it isn't recreated every frame
  const particlePositions = useMemo(() => {
    const count = 500;
    const array = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
      array[i] = (Math.random() - 0.5) * 40;
    }
    return array;
  }, []);

  useFrame((state) => {
    if (group.current) {
      group.current.rotation.y = state.clock.getElapsedTime() * 0.05;
    }
  });

  return (
    <group ref={group}>
      <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
        <Strand position={[-8, 2, -10]} rotation={[0.5, 0.5, 0]} color="#4ade80" />
        <Strand position={[8, -4, -15]} rotation={[-0.5, -0.2, 0]} color="#60a5fa" />
        <Strand position={[-5, -6, -8]} rotation={[0.2, 0, 0.5]} color="#2dd4bf" />
        <Strand position={[6, 5, -12]} rotation={[-0.2, 0.4, 0]} color="#818cf8" />
        <Strand position={[0, 8, -20]} rotation={[Math.PI/2, 0, 0]} color="#34d399" />
      </Float>
      
      {/* Dust particles */}
      <points>
        <bufferGeometry>
          {/* FIX: Passed arguments via 'args' prop for proper initialization */}
          <bufferAttribute
            attach="attributes-position"
            count={500}
            array={particlePositions}
            itemSize={3}
            args={[particlePositions, 3]} 
          />
        </bufferGeometry>
        <pointsMaterial size={0.05} color="#4ade80" transparent opacity={0.2} sizeAttenuation />
      </points>
    </group>
  );
}