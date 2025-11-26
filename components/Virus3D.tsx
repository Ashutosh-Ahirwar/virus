'use client';

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  Float,
  Sphere,
  Cylinder,
  Icosahedron,
  Ring,
  Sparkles,
  MeshDistortMaterial,
} from '@react-three/drei';
import { keccak256, encodePacked } from 'viem';

// --- LORE ARRAYS (MUST MATCH SOLIDITY) ---
const ALIGNMENTS = ['Symbiotic', 'Parasitic'] as const;
const MUTATIONS_SYM = ['Neural-Linker', 'Muscle-Weaver', 'Cell-Regenerator', 'Gene-Purifier'] as const;
const MUTATIONS_PAR = ['Void-Rot', 'Blood-Boil', 'Neural-Decay', 'Cell-Rupture'] as const;

type Alignment = (typeof ALIGNMENTS)[number];
type Mutation = (typeof MUTATIONS_SYM)[number] | (typeof MUTATIONS_PAR)[number];

interface Virus3DProps {
  tokenId: number;
}

// --- COLOR PALETTE GENERATOR ---
function getPalette(hue: number, alignment: Alignment) {
  if (alignment === 'Symbiotic') {
    return {
      body: `hsl(${hue}, 60%, 45%)`, 
      veins: `hsl(${hue}, 90%, 65%)`, 
      core: `hsl(${(hue + 180) % 360}, 100%, 85%)`, 
      spikes: `hsl(${hue}, 50%, 30%)`, 
      tips: `hsl(${(hue + 40) % 360}, 90%, 60%)`, 
      aura: `hsl(${hue}, 80%, 50%)`,
    };
  } else {
    return {
      body: `hsl(${hue}, 50%, 20%)`, 
      veins: `hsl(${(hue + 300) % 360}, 100%, 50%)`, 
      core: `hsl(${hue}, 100%, 50%)`, 
      spikes: `hsl(${hue}, 20%, 10%)`, 
      tips: `hsl(${(hue + 180) % 360}, 100%, 50%)`, 
      aura: `hsl(${(hue + 320) % 360}, 90%, 40%)`,
    };
  }
}

export function Virus3D({ tokenId }: Virus3DProps) {
  const rootRef = useRef<THREE.Group>(null);

  // === 1. TRAIT GENERATION (Reverted to EXACT original logic) ===
  const seedHex = keccak256(
    encodePacked(
      ['uint256', 'uint256', 'string'],
      [BigInt(tokenId), BigInt(tokenId), 'VIRUS_EVO_V1']
    )
  );
  const seed = BigInt(seedHex);
  const hue = Number(seed % 360n);
  
  // STRICT METADATA MATCHING
  // Original logic: 6 + (seed % 7)
  const spikeCount = 6 + Number(seed % 7n); 
  const alignIdx = Number((seed >> 8n) % 2n);
  const mutIdx = Number((seed >> 12n) % 4n);

  const alignment: Alignment = ALIGNMENTS[alignIdx];
  // Unused in render but part of lore derivation
  // const mutation: Mutation = alignment === 'Symbiotic' ? MUTATIONS_SYM[mutIdx] : MUTATIONS_PAR[mutIdx];

  const palette = useMemo(() => getPalette(hue, alignment), [hue, alignment]);

  // === 2. ANIMATION LOOP ===
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (!rootRef.current) return;

    rootRef.current.rotation.y = t * 0.15;
    rootRef.current.rotation.z = Math.sin(t * 0.2) * 0.1;

    // Pulse effect
    const beatFreq = alignment === 'Parasitic' ? 2.5 : 1.2;
    const beatAmp = 0.05;
    const pulse = 1 + Math.sin(t * beatFreq) * beatAmp;
    
    // REDUCED SCALE: Changed from 2.0 to 1.5 to help with "zoomed in" feel
    rootRef.current.scale.setScalar(1.5 * pulse);
  });

  return (
    <Float
      speed={2} 
      rotationIntensity={0.5} 
      floatIntensity={0.5} 
      floatingRange={[-0.1, 0.1]}
    >
      <group ref={rootRef}>
        <ViralMembrane alignment={alignment} palette={palette} />
        <CyberCore alignment={alignment} palette={palette} />
        <SpikeArray count={spikeCount} alignment={alignment} palette={palette} seed={Number(seed % 100000n)} />
        <DataField alignment={alignment} palette={palette} />
        <Sparkles count={50} scale={4} size={3} speed={0.4} opacity={0.4} color={palette.aura} />
      </group>
    </Float>
  );
}

// --- SUB-COMPONENTS ---

function ViralMembrane({ alignment, palette }: { alignment: Alignment, palette: any }) {
  const isPara = alignment === 'Parasitic';
  const distort = isPara ? 0.6 : 0.4;
  const speed = isPara ? 3.0 : 1.5;

  return (
    <group>
      {/* Matte Organic Shell */}
      <Sphere args={[1, 64, 64]}>
        <MeshDistortMaterial
          color={palette.body}
          emissive={palette.veins}
          emissiveIntensity={0.2}
          roughness={0.7} 
          metalness={0.1} 
          distort={distort}
          speed={speed}
          bumpScale={0.05}
        />
      </Sphere>

      {/* Wireframe Overlay */}
      <Sphere args={[1.02, 32, 32]}>
        <MeshDistortMaterial
          color={palette.veins}
          wireframe
          transparent
          opacity={0.15}
          distort={distort}
          speed={speed}
          roughness={0}
          metalness={1}
        />
      </Sphere>
    </group>
  );
}

function SpikeArray({ count, alignment, palette, seed }: { count: number, alignment: Alignment, palette: any, seed: number }) {
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
      
      const lenVar = ((seed + i * 13) % 100) / 100; 
      const length = 1 + lenVar * 0.4; 

      temp.push({ pos, rot, length });
    }
    return temp;
  }, [count, seed]);

  return (
    <group>
      {spikes.map((s, i) => (
        <group key={i} position={s.pos} rotation={s.rot}>
          <SpikeModel length={s.length} alignment={alignment} palette={palette} />
        </group>
      ))}
    </group>
  );
}

function SpikeModel({ length, alignment, palette }: { length: number, alignment: Alignment, palette: any }) {
  const isPara = alignment === 'Parasitic';

  return (
    <group>
      {/* Stalk */}
      <Cylinder args={[0.03, 0.06, 0.3, 8]} position={[0, 0.15, 0]}>
        <meshStandardMaterial color={palette.spikes} roughness={0.9} />
      </Cylinder>
      
      {/* Tip */}
      <group position={[0, 0.3 + (length * 0.2), 0]}>
        {isPara ? (
          <Cylinder args={[0, 0.05, length * 0.5, 6]}>
             <meshStandardMaterial color={palette.tips} emissive={palette.tips} emissiveIntensity={2} toneMapped={false} />
          </Cylinder>
        ) : (
          <Icosahedron args={[0.15, 0]}>
             <meshStandardMaterial color={palette.tips} emissive={palette.tips} emissiveIntensity={1} roughness={0.3} metalness={0.5} />
          </Icosahedron>
        )}
      </group>
    </group>
  );
}

function CyberCore({ alignment, palette }: { alignment: Alignment, palette: any }) {
  return (
    <group>
      <pointLight color={palette.core} intensity={2} distance={3} decay={2} />
      <Icosahedron args={[0.4, 0]}>
        <meshStandardMaterial 
          color={palette.core} 
          emissive={palette.core}
          emissiveIntensity={2}
          wireframe={true} 
          toneMapped={false}
        />
      </Icosahedron>
      <Sphere args={[0.3, 16, 16]}>
        <meshBasicMaterial color="#000000" />
      </Sphere>
    </group>
  );
}

function DataField({ alignment, palette }: { alignment: Alignment, palette: any }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if(ref.current) {
      ref.current.rotation.z = state.clock.getElapsedTime() * 0.1;
    }
  });

  return (
    <group ref={ref}>
       <Ring args={[1.4, 1.42, 64]} rotation={[Math.PI / 2, 0, 0]}>
         <meshBasicMaterial color={palette.aura} transparent opacity={0.3} side={THREE.DoubleSide} />
       </Ring>
    </group>
  )
}