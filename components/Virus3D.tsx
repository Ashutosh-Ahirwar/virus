'use client';

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Float, Sparkles } from '@react-three/drei';
import { keccak256, encodePacked } from 'viem';

const ALIGNMENTS = ['Symbiotic', 'Parasitic'] as const;

type Alignment = (typeof ALIGNMENTS)[number];

interface Virus3DProps {
  tokenId: number;
}

// --- COLOR PALETTE (Strictly derived from Seed Hue) ---
function getPalette(hue: number, alignment: Alignment) {
  return {
    // The main body color (EXACT hue from seed)
    primary: `hsl(${hue}, 85%, 50%)`,
    // A lighter glow for the tips/aura
    highlight: `hsl(${hue}, 100%, 75%)`,
    // Inner core color (complementary or darker version)
    core: `hsl(${(hue + 180) % 360}, 50%, 40%)`,
    // Particle opacity varies by alignment (Parasitic is denser/darker)
    opacity: alignment === 'Parasitic' ? 0.9 : 0.6,
  };
}

export function Virus3D({ tokenId }: Virus3DProps) {
  const rootRef = useRef<THREE.Group>(null);

  // === 1. METADATA GENERATION ===
  const seedHex = keccak256(
    encodePacked(
      ['uint256', 'uint256', 'string'],
      [BigInt(tokenId), BigInt(tokenId), 'VIRUS_EVO_V1']
    )
  );
  const seed = BigInt(seedHex);
  const hue = Number(seed % 360n);
  
  // STRICT METADATA: 6 + (seed % 7) spikes
  const spikeCount = 6 + Number(seed % 7n); 
  const alignIdx = Number((seed >> 8n) % 2n);
  const alignment = ALIGNMENTS[alignIdx];
  
  const palette = useMemo(() => getPalette(hue, alignment), [hue, alignment]);

  // === 2. ANIMATION ===
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (!rootRef.current) return;

    // Slow, heavy rotation
    rootRef.current.rotation.y = t * 0.12;
    rootRef.current.rotation.z = Math.sin(t * 0.15) * 0.08;

    // "Breathing" pulse
    const pulseSpeed = alignment === 'Parasitic' ? 2.0 : 1.2;
    const scaleVar = 1 + Math.sin(t * pulseSpeed) * 0.03;
    rootRef.current.scale.setScalar(scaleVar); 
  });

  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.4}>
      <group ref={rootRef}>
        <ParticleBody palette={palette} />
        <ParticleSpikes count={spikeCount} palette={palette} seed={Number(seed % 100000n)} />
        <Atmosphere palette={palette} />
      </group>
    </Float>
  );
}

// --- SUB-COMPONENTS (PARTICLE SYSTEMS) ---

function ParticleBody({ palette }: { palette: any }) {
  // Generate random points on/in a sphere for that "fuzzy" look
  const particles = useMemo(() => {
    const count = 3500; // High density for texture
    const pos = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      // Uniform distribution on sphere surface
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      // Add slight noise to radius for "fuzz" (0.95 to 1.05)
      const r = 0.95 + Math.random() * 0.1; 
      
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
    }
    return pos;
  }, []);

  return (
    <group>
      {/* Black occlusion sphere to hide back-facing particles (gives depth) */}
      <mesh>
        <sphereGeometry args={[0.9, 32, 32]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* The Particle Cloud */}
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particles.length / 3}
            array={particles}
            itemSize={3}
            args={[particles, 3]} // REQUIRED for TypeScript
          />
        </bufferGeometry>
        <pointsMaterial
          color={palette.primary}
          size={0.035} // Small dots
          transparent
          opacity={palette.opacity}
          sizeAttenuation={true}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
      
      {/* Faint outer glow shell */}
      <mesh>
        <sphereGeometry args={[1.0, 32, 32]} />
        <meshBasicMaterial color={palette.primary} transparent opacity={0.1} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function ParticleSpikes({ count, palette }: { count: number, palette: any, seed: number }) {
  // Position spikes using Fibonacci sphere algorithm
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
          <SingleSpikeCloud palette={palette} />
        </group>
      ))}
    </group>
  );
}

function SingleSpikeCloud({ palette }: { palette: any }) {
  // Create a volumetric cloud for the spike (cylinder + club head)
  const particles = useMemo(() => {
    const pCount = 200;
    const pos = new Float32Array(pCount * 3);
    
    for(let i=0; i<pCount; i++) {
      // 70% of points in the stalk, 30% in the head
      const isHead = Math.random() > 0.7;
      
      let x, y, z;
      if (isHead) {
        // Head: Sphere at top
        const r = 0.2 * Math.cbrt(Math.random()); // uniform sphere
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        x = r * Math.sin(phi) * Math.cos(theta);
        // CHANGED: Lowered the head position slightly to match new stalk height
        y = (r * Math.sin(phi) * Math.sin(theta)) + 0.45; 
        z = r * Math.cos(phi);
      } else {
        // Stalk: Cylinder
        const r = 0.06 * Math.sqrt(Math.random());
        const theta = Math.random() * Math.PI * 2;
        const h = Math.random() * 0.5; // height 0 to 0.5
        x = r * Math.cos(theta);
        y = h;
        z = r * Math.sin(theta);
      }
      pos[i*3] = x;
      pos[i*3+1] = y;
      pos[i*3+2] = z;
    }
    return pos;
  }, []);

  // CHANGED: Removed "position={[0, 0.9, 0]}" so it sits ON the surface
  return (
    <group> 
      <points>
        <bufferGeometry>
           <bufferAttribute 
              attach="attributes-position" 
              count={particles.length/3} 
              array={particles} 
              itemSize={3}
              args={[particles, 3]} 
            />
        </bufferGeometry>
        <pointsMaterial 
          color={palette.highlight} 
          size={0.03} 
          transparent 
          opacity={0.8} 
          sizeAttenuation 
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

function Atmosphere({ palette }: { palette: any }) {
  return (
    <Sparkles 
      count={60} 
      scale={3.5} 
      size={3} 
      speed={0.2} 
      opacity={0.4} 
      color={palette.highlight} 
    />
  );
}