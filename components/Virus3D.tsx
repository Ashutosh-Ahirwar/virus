// components/Virus3D.tsx
'use client';

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MeshDistortMaterial, Sphere, Cylinder, Torus, Box, RoundedBox, Instance, Instances, Float, Sparkles } from '@react-three/drei';
import { keccak256, encodePacked } from 'viem';

// --- Helpers to match Solidity HSL Logic in Three.js ---
function getColors(hue: number) {
  const h = hue / 360; // Three.js uses 0-1 range for Hue
  // Using HSL to ensure colors match the 2D SVG vibe
  return {
    main: new THREE.Color().setHSL(h, 0.7, 0.5),
    dark: new THREE.Color().setHSL(h, 0.6, 0.15), // Slightly darker for 3D depth
    glow: new THREE.Color().setHSL((h + 0.5) % 1.0, 0.8, 0.6),
    accent: new THREE.Color().setHSL((h + 0.083) % 1.0, 1.0, 0.6),
  };
}

interface Virus3DProps {
  tokenId: number;
}

export function Virus3D({ tokenId }: Virus3DProps) {
  const groupRef = useRef<THREE.Group>(null);

  // 1. REPLICATE SOLIDITY SEED GENERATION EXACTLY
  const seedHex = keccak256(encodePacked(
    ['uint256', 'uint256', 'string'],
    [BigInt(tokenId), BigInt(tokenId), "VIRUS_EVO_V1"]
  ));
  const seed = BigInt(seedHex);

  // 2. DERIVE PARAMETERS FROM SEED (Using BigInt constructor instead of literals)
  const hue = Number(seed % BigInt(360));
  const colors = useMemo(() => getColors(hue), [hue]);
  
  // 6 + (seed % 7)
  const spikeCount = 6 + Number(seed % BigInt(7));
  // (seed >> 12) % 3
  const spikeStyle = Number((seed >> BigInt(12)) % BigInt(3));
  // (seed >> 4) % 3
  const nucleusType = Number((seed >> BigInt(4)) % BigInt(3));
  // (seed % 10) > 3
  const hasAura = (seed % BigInt(10)) > BigInt(3);

  // Slow rotation animation
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.15;
      groupRef.current.rotation.z += delta * 0.05;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5} floatingRange={[-0.1, 0.1]}>
      <group ref={groupRef} scale={1.6}>
        
        {/* --- AURA LAYER --- */}
        {hasAura && (
          <Sphere args={[1.5, 32, 32]}>
            <meshBasicMaterial 
                color={colors.glow} 
                transparent 
                opacity={0.07} 
                side={THREE.BackSide} 
                blending={THREE.AdditiveBlending} 
                depthWrite={false}
            />
          </Sphere>
        )}

        {/* --- MAIN BODY (Capsid) --- */}
        {/* Using a distorted sphere for organic viral look */}
        <Sphere args={[0.85, 64, 64]}>
          <MeshDistortMaterial
            color={colors.main}
            emissive={colors.dark}
            emissiveIntensity={0.8}
            roughness={0.1}
            metalness={0.6}
            distort={0.35} // The "wobble" effect
            speed={1.5}
          />
        </Sphere>
        
        {/* Internal Bio-luminescence */}
        <pointLight position={[0,0,0]} intensity={1.5} color={colors.glow} distance={4} decay={2} />
        <Sphere args={[0.7, 32, 32]}>
            <meshStandardMaterial color={colors.glow} emissive={colors.glow} emissiveIntensity={0.5} transparent opacity={0.3} blending={THREE.AdditiveBlending} />
        </Sphere>

        {/* --- SPIKES --- */}
        <Spikes count={spikeCount} style={spikeStyle} colors={colors} />

        {/* --- NUCLEUS --- */}
        <Nucleus type={nucleusType} color={colors.accent} />

        {/* Tiny floating particles around the virus */}
        <Sparkles count={30} scale={2.5} size={0.4} speed={0.2} color={colors.accent} opacity={0.5} />
      </group>
    </Float>
  );
}

// --- Sub-component: Spikes (using Instancing for performance) ---
function Spikes({ count, style, colors }: { count: number, style: number, colors: any }) {
  const spikeData = useMemo(() => {
    const data = [];
    const radius = 0.82; // Position on surface
    const phi = (1 + Math.sqrt(5)) / 2; // Golden ratio for even spherical distribution

    for (let i = 0; i < count; i++) {
      const theta = 2 * Math.PI * i / phi;
      const phiAng = Math.acos(1 - 2 * (i + 0.5) / count);

      const x = radius * Math.sin(phiAng) * Math.cos(theta);
      const y = radius * Math.sin(phiAng) * Math.sin(theta);
      const z = radius * Math.cos(phiAng);
      
      const position = new THREE.Vector3(x, y, z);
      // Calculate rotation so spike points outwards from center
      const rotation = new THREE.Euler();
      const up = new THREE.Vector3(0, 1, 0); // Assuming spike geometry is built along Y axis
      rotation.setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(up, position.clone().normalize()));

      data.push({ position, rotation });
    }
    return data;
  }, [count]);

  // Define geometry based on style index
  let SpikeGeometry: React.FC<any>;
  if (style === 0) { // Style 0: Protein Stalk
    SpikeGeometry = () => (
      <group>
        {/* Stalk */}
        <Cylinder args={[0.05, 0.03, 0.5]} position={[0, 0.25, 0]}>
          <meshStandardMaterial color={colors.dark} roughness={0.6} metalness={0.2} />
        </Cylinder>
        {/* Bulb tip */}
        <Sphere args={[0.09, 16, 16]} position={[0, 0.5, 0]}>
          <meshStandardMaterial color={colors.accent} emissive={colors.accent} emissiveIntensity={0.5} roughness={0.1} metalness={0.5} />
        </Sphere>
      </group>
    );
  } else if (style === 1) { // Style 1: Needle Injector
    SpikeGeometry = () => (
      <group>
        {/* Base joint */}
        <Sphere args={[0.07]} position={[0, 0.05, 0]}>
          <meshStandardMaterial color={colors.dark} metalness={0.7} roughness={0.2} />
        </Sphere>
        {/* Sharp needle */}
        <Cylinder args={[0.005, 0.06, 0.6, 8]} position={[0, 0.35, 0]}>
            <meshStandardMaterial color={colors.accent} roughness={0.1} metalness={1} emissive={colors.accent} emissiveIntensity={0.2} />
        </Cylinder>
      </group>
    );
  } else { // Style 2: Antenna Receptor
    SpikeGeometry = () => (
      <group>
        {/* Thin shaft */}
        <Cylinder args={[0.02, 0.02, 0.5]} position={[0, 0.25, 0]}>
          <meshStandardMaterial color={colors.accent} emissive={colors.accent} emissiveIntensity={0.3} />
        </Cylinder>
        {/* Torus receiver dish */}
        <Torus args={[0.1, 0.02, 16, 32]} position={[0, 0.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <meshStandardMaterial color={colors.accent} emissive={colors.accent} emissiveIntensity={0.8} />
        </Torus>
      </group>
    );
  }

  return (
    <Instances range={count}>
      <SpikeGeometry />
      {spikeData.map((props, i) => (
        <Instance key={i} position={props.position} rotation={props.rotation} />
      ))}
    </Instances>
  );
}

// --- Sub-component: Nucleus Core ---
function Nucleus({ type, color }: { type: number, color: THREE.Color }) {
  // Create the material prop object to pass down
  const materialProps = {
    color: color,
    emissive: color,
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.8,
    roughness: 0.3,
    metalness: 0.2,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  };

  if (type === 0) { // Sphere Core
    return <Sphere args={[0.28, 32, 32]}><meshStandardMaterial {...materialProps} /></Sphere>;
  } else if (type === 1) { // Box Core
    // FIX: Use RoundedBox geometry. The radius is defined on the geometry, not the material.
    return (
      <RoundedBox args={[0.38, 0.38, 0.38]} radius={0.1} smoothness={4}>
        <meshStandardMaterial {...materialProps} />
      </RoundedBox>
    );
  } else { // Ring/Torus Core
    return <Torus args={[0.22, 0.06, 16, 64]}><meshStandardMaterial {...materialProps} /></Torus>;
  }
}