'use client';

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  Float,
  Sphere,
  Cylinder,
  Icosahedron,
  Torus,
  Ring,
  Sparkles,
  MeshDistortMaterial,
  MeshWobbleMaterial,
  Trail,
} from '@react-three/drei';
import { keccak256, encodePacked } from 'viem';

// --- LORE ARRAYS (Preserved exactly from original) ---
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
  // Symbiotic: Clean, neon, harmonious (Cyber-Medic vibe)
  if (alignment === 'Symbiotic') {
    return {
      body: `hsl(${hue}, 60%, 45%)`, // Matte organic base
      veins: `hsl(${hue}, 90%, 65%)`, // Glowing internal veins
      core: `hsl(${(hue + 180) % 360}, 100%, 85%)`, // Bright white-hot core
      spikes: `hsl(${hue}, 50%, 30%)`, // Darker protein spikes
      tips: `hsl(${(hue + 40) % 360}, 90%, 60%)`, // Glowing receptor tips
      aura: `hsl(${hue}, 80%, 50%)`,
    };
  } 
  // Parasitic: Toxic, dark, high contrast (Malware vibe)
  else {
    return {
      body: `hsl(${hue}, 50%, 20%)`, // Dark, bruised organic base
      veins: `hsl(${(hue + 300) % 360}, 100%, 50%)`, // Corrupted veins (magenta/red shift)
      core: `hsl(${hue}, 100%, 50%)`, // Deep pulsating core
      spikes: `hsl(${hue}, 20%, 10%)`, // Black/burned spikes
      tips: `hsl(${(hue + 180) % 360}, 100%, 50%)`, // Toxic warning color tips
      aura: `hsl(${(hue + 320) % 360}, 90%, 40%)`,
    };
  }
}

export function Virus3D({ tokenId }: Virus3DProps) {
  const rootRef = useRef<THREE.Group>(null);

  // === 1. TRAIT GENERATION (Deterministic based on TokenID) ===
  const seedHex = keccak256(
    encodePacked(
      ['uint256', 'uint256', 'string'],
      [BigInt(tokenId), BigInt(tokenId), 'VIRUS_EVO_V1']
    )
  );
  const seed = BigInt(seedHex);
  const hue = Number(seed % 360n);
  
  // Logic matches original solidity/metadata rules
  const spikeCount = 8 + Number(seed % 12n); // Slightly denser spikes for better look
  const alignIdx = Number((seed >> 8n) % 2n);
  const mutIdx = Number((seed >> 12n) % 4n);

  const alignment: Alignment = ALIGNMENTS[alignIdx];
  const mutation: Mutation = alignment === 'Symbiotic' ? MUTATIONS_SYM[mutIdx] : MUTATIONS_PAR[mutIdx];

  const palette = useMemo(() => getPalette(hue, alignment), [hue, alignment]);

  // === 2. ANIMATION LOOP ===
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (!rootRef.current) return;

    // Organic bobbing and rotation
    rootRef.current.rotation.y = t * 0.15;
    rootRef.current.rotation.z = Math.sin(t * 0.2) * 0.1;

    // "Heartbeat" scale effect
    // Parasitic beats faster and more erratically
    const beatFreq = alignment === 'Parasitic' ? 2.5 : 1.2;
    const beatAmp = alignment === 'Parasitic' ? 0.08 : 0.05;
    const pulse = 1 + Math.sin(t * beatFreq) * beatAmp;
    
    rootRef.current.scale.setScalar(2.0 * pulse);
  });

  return (
    <Float
      speed={2} 
      rotationIntensity={0.5} 
      floatIntensity={0.5} 
      floatingRange={[-0.2, 0.2]}
    >
      <group ref={rootRef}>
        
        {/* The Main Viral Capsid */}
        <ViralMembrane alignment={alignment} palette={palette} />

        {/* The "Cyber" Core inside */}
        <CyberCore alignment={alignment} palette={palette} />

        {/* Surface Proteins / Spikes */}
        <SpikeArray 
          count={spikeCount} 
          alignment={alignment} 
          palette={palette} 
          seed={Number(seed % 100000n)} 
        />

        {/* External Tech Rings / Aura */}
        <DataField alignment={alignment} palette={palette} />

        {/* Atmosphere */}
        <Sparkles 
          count={50} 
          scale={5} 
          size={2} 
          speed={0.4} 
          opacity={0.5} 
          color={palette.aura} 
        />
      </group>
    </Float>
  );
}

// --------------------------------------------------------
// 1. VIRAL MEMBRANE (The Body)
// --------------------------------------------------------
// Changed: Low metalness, High Roughness for "Flesh" look.
// Added: Wireframe overlay for "Cyber" look.
function ViralMembrane({ alignment, palette }: { alignment: Alignment, palette: any }) {
  const isPara = alignment === 'Parasitic';
  
  // Parasitic distorts faster and sharper
  const distort = isPara ? 0.6 : 0.4;
  const speed = isPara ? 3.0 : 1.5;

  return (
    <group>
      {/* Layer 1: The Biological Shell (Matte, Fleshy) */}
      <Sphere args={[1, 64, 64]}>
        <MeshDistortMaterial
          color={palette.body}
          emissive={palette.veins}
          emissiveIntensity={0.2}
          roughness={0.7} // <--- Makes it look organic/matte, not shiny
          metalness={0.1} // <--- Low metalness for biological tissue
          distort={distort}
          speed={speed}
          bumpScale={0.05}
        />
      </Sphere>

      {/* Layer 2: The Digital Grid (Wireframe overlay) */}
      <Sphere args={[1.02, 32, 32]}>
        <MeshDistortMaterial
          color={palette.veins}
          wireframe
          transparent
          opacity={0.15}
          distort={distort}
          speed={speed}
          roughness={0}
          metalness={1} // The grid is pure tech
        />
      </Sphere>

      {/* Layer 3: Inner Glow (Fake SSS) */}
      <Sphere args={[0.85, 32, 32]}>
        <meshBasicMaterial color={palette.body} transparent opacity={0.5} />
      </Sphere>
    </group>
  );
}

// --------------------------------------------------------
// 2. SPIKE ARRAY (The Receptors)
// --------------------------------------------------------
// Changed: Use Icosahedrons for tips (looks more viral/molecular).
// Changed: Tapered cylinders for stalks.
function SpikeArray({ count, alignment, palette, seed }: { count: number, alignment: Alignment, palette: any, seed: number }) {
  const spikes = useMemo(() => {
    const temp = [];
    // Fibonacci Sphere distribution for even spike placement
    const phi = Math.PI * (3 - Math.sqrt(5)); 
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const theta = phi * i;
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;
      
      const pos = new THREE.Vector3(x, y, z).normalize().multiplyScalar(1); // On surface
      const rot = new THREE.Euler().setFromQuaternion(
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos)
      );
      
      // Random length variation based on seed
      const lenVar = ((seed + i * 13) % 100) / 100; 
      const length = 1 + lenVar * 0.4; // 1.0 to 1.4

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
      {/* The Stalk - connects to body */}
      <Cylinder 
        args={[0.02, 0.08, 0.4, 8]} 
        position={[0, 0.2, 0]}
      >
        <meshStandardMaterial color={palette.spikes} roughness={0.8} />
      </Cylinder>

      {/* The Connector */}
      <Sphere args={[0.06, 8, 8]} position={[0, 0.4, 0]}>
        <meshStandardMaterial color={palette.veins} emissive={palette.veins} emissiveIntensity={0.5} />
      </Sphere>

      {/* The Tip - Visual identity of the strain */}
      {isPara ? (
        // Parasitic: Sharp, Needle-like, Dangerous
        <group position={[0, 0.4 + (length * 0.3), 0]}>
          <Cylinder args={[0, 0.04, length * 0.6, 6]} >
            <meshStandardMaterial 
              color={palette.tips} 
              emissive={palette.tips} 
              emissiveIntensity={2} 
              toneMapped={false}
            />
          </Cylinder>
        </group>
      ) : (
        // Symbiotic: Geometric, Molecular, Complex
        <group position={[0, 0.45, 0]}>
          <Icosahedron args={[0.12, 0]}>
            <meshStandardMaterial 
              color={palette.tips} 
              emissive={palette.tips} 
              emissiveIntensity={1} 
              roughness={0.3}
              metalness={0.8}
            />
          </Icosahedron>
          {/* Floating bits around the tip */}
          <group rotation={[0.5, 0.5, 0]}>
            <Torus args={[0.2, 0.01, 8, 24]}>
              <meshBasicMaterial color={palette.veins} transparent opacity={0.6} />
            </Torus>
          </group>
        </group>
      )}
    </group>
  );
}

// --------------------------------------------------------
// 3. CYBER CORE (The Nucleus)
// --------------------------------------------------------
function CyberCore({ alignment, palette }: { alignment: Alignment, palette: any }) {
  const coreRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (coreRef.current) {
      coreRef.current.rotation.x += 0.01;
      coreRef.current.rotation.y += 0.02;
    }
  });

  return (
    <group>
      {/* Bright center light */}
      <pointLight color={palette.core} intensity={2} distance={3} decay={2} />
      
      {/* The physical core geometry */}
      <Icosahedron ref={coreRef} args={[0.4, 0]}>
        <meshStandardMaterial 
          color={palette.core} 
          emissive={palette.core}
          emissiveIntensity={2}
          wireframe={true} // Looks like data/code
          toneMapped={false}
        />
      </Icosahedron>

      {/* Inner dark matter */}
      <Sphere args={[0.3, 16, 16]}>
        <meshBasicMaterial color="#000000" />
      </Sphere>
    </group>
  );
}

// --------------------------------------------------------
// 4. DATA FIELD (The Rings)
// --------------------------------------------------------
function DataField({ alignment, palette }: { alignment: Alignment, palette: any }) {
  const ref = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if(ref.current) {
      ref.current.rotation.z = t * 0.1;
      ref.current.rotation.x = Math.sin(t * 0.2) * 0.2;
    }
  });

  return (
    <group ref={ref}>
       {/* Scanner Ring 1 */}
       <Ring args={[1.4, 1.42, 64]} rotation={[Math.PI / 2, 0, 0]}>
         <meshBasicMaterial color={palette.aura} transparent opacity={0.3} side={THREE.DoubleSide} />
       </Ring>
       
       {/* Scanner Ring 2 (Offset) */}
       <Ring args={[1.6, 1.61, 64]} rotation={[Math.PI / 1.8, 0, 0]}>
         <meshBasicMaterial color={palette.veins} transparent opacity={0.15} side={THREE.DoubleSide} />
       </Ring>

       {/* Floating Data Particles */}
       {alignment === 'Symbiotic' && (
         <Torus args={[1.8, 0.01, 16, 100]} rotation={[Math.PI / 3, 0, 0]}>
           <meshBasicMaterial color={palette.core} transparent opacity={0.1} />
         </Torus>
       )}
    </group>
  )
}