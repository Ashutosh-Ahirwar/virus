'use client';

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Float, Icosahedron, Sphere, Sparkles } from '@react-three/drei';
import { keccak256, encodePacked } from 'viem';

// --- LORE ARRAYS (STRICT MATCH) ---
const ALIGNMENTS = ['Symbiotic', 'Parasitic'] as const;
// Logic placeholders to ensure seed consumption matches Solidity exactly
const MUTATIONS_SYM = ['Neural-Linker', 'Muscle-Weaver', 'Cell-Regenerator', 'Gene-Purifier'] as const;
const MUTATIONS_PAR = ['Void-Rot', 'Blood-Boil', 'Neural-Decay', 'Cell-Rupture'] as const;

type Alignment = (typeof ALIGNMENTS)[number];

interface Virus3DProps {
  tokenId: number;
}

// --- MICROSCOPE PALETTE ---
// Adjusted to look like the blue/cyan electron microscope image provided
function getPalette(hue: number, alignment: Alignment) {
  const isPara = alignment === 'Parasitic';
  
  // Base is always that "science blue" from the image, shifted slightly by NFT trait
  return {
    // The core color (darker inside)
    core: isPara ? '#001a33' : '#002233', 
    // The granular surface (cyan/blue/teal)
    surface: `hsl(${180 + (hue % 40)}, 80%, 50%)`,
    // The tips/highlights
    highlight: isPara ? '#ff0055' : '#00ffcc',
    // The atmosphere
    glow: `hsl(${190 + (hue % 20)}, 90%, 60%)`,
  };
}

export function Virus3D({ tokenId }: Virus3DProps) {
  const rootRef = useRef<THREE.Group>(null);

  // === 1. TRAIT GENERATION (Strict Match) ===
  const seedHex = keccak256(
    encodePacked(
      ['uint256', 'uint256', 'string'],
      [BigInt(tokenId), BigInt(tokenId), 'VIRUS_EVO_V1']
    )
  );
  const seed = BigInt(seedHex);
  const hue = Number(seed % 360n);
  
  const spikeCount = 6 + Number(seed % 7n); 
  const alignIdx = Number((seed >> 8n) % 2n);
  const alignment: Alignment = ALIGNMENTS[alignIdx];
  const palette = useMemo(() => getPalette(hue, alignment), [hue, alignment]);

  // === 2. ANIMATION ===
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (!rootRef.current) return;

    // Slow organic rotation
    rootRef.current.rotation.y = t * 0.1;
    rootRef.current.rotation.z = Math.sin(t * 0.2) * 0.05;

    // Breathing
    const pulse = 1 + Math.sin(t * 1.5) * 0.02;
    rootRef.current.scale.setScalar(1.5 * pulse);
  });

  return (
    <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
      <group ref={rootRef}>
        <GranularBody palette={palette} />
        <SpikeArray count={spikeCount} alignment={alignment} palette={palette} seed={Number(seed % 100000n)} />
        <Atmosphere palette={palette} />
      </group>
    </Float>
  );
}

// --- SUB-COMPONENTS FOR "MICROSCOPE" LOOK ---

// 1. The Body: Renders as POINTS to match the grainy texture image
function GranularBody({ palette }: { palette: any }) {
  return (
    <group>
      {/* Inner dark occlusion sphere to block light */}
      <Sphere args={[0.95, 32, 32]}>
         <meshBasicMaterial color="#000" />
      </Sphere>

      {/* Layer 1: Dense Points (The Texture) */}
      <points>
        {/* Icosahedron gives a nice triangulated distribution */}
        <icosahedronGeometry args={[1, 16]} /> 
        <pointsMaterial 
          color={palette.surface} 
          size={0.015} // Tiny dots
          sizeAttenuation={true} 
          transparent 
          opacity={0.8}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Layer 2: Faint Halo Shell */}
      <Sphere args={[1.05, 64, 64]}>
        <meshBasicMaterial 
          color={palette.glow} 
          transparent 
          opacity={0.1} 
          wireframe
        />
      </Sphere>
    </group>
  );
}

// 2. The Spikes: "Club" shaped like the image, also grainy
function SpikeArray({ count, seed, palette }: { count: number, seed: number, palette: any, alignment: Alignment }) {
  const spikes = useMemo(() => {
    const temp = [];
    const phi = Math.PI * (3 - Math.sqrt(5)); 
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const theta = phi * i;
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;
      const pos = new THREE.Vector3(x, y, z).normalize();
      const rot = new THREE.Euler().setFromQuaternion(
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos)
      );
      temp.push({ pos, rot });
    }
    return temp;
  }, [count]);

  return (
    <group>
      {spikes.map((s, i) => (
        <group key={i} position={s.pos} rotation={s.rot}>
           <GranularSpike palette={palette} />
        </group>
      ))}
    </group>
  );
}

function GranularSpike({ palette }: { palette: any }) {
  return (
    <group position={[0, 0.95, 0]}> 
       {/* The Stalk */}
       <points position={[0, 0.15, 0]}>
         <cylinderGeometry args={[0.08, 0.12, 0.3, 8, 4]} />
         <pointsMaterial color={palette.surface} size={0.015} transparent opacity={0.6} />
       </points>

       {/* The "Mushroom" Head (Club shape) */}
       <group position={[0, 0.35, 0]}>
          <points>
            <sphereGeometry args={[0.18, 12, 12]} />
            <pointsMaterial color={palette.highlight} size={0.02} transparent opacity={0.8} blending={THREE.AdditiveBlending} />
          </points>
          {/* Inner solid part to make it look dense */}
          <Sphere args={[0.15, 8, 8]}>
             <meshBasicMaterial color={palette.surface} opacity={0.5} transparent />
          </Sphere>
       </group>
    </group>
  )
}

function Atmosphere({ palette }: { palette: any }) {
  return (
    <group>
       {/* Floating particulates from the image */}
       <Sparkles count={80} scale={2.5} size={2} speed={0.2} opacity={0.4} color={palette.glow} />
    </group>
  )
}