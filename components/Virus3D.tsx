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

function getPalette(hue: number, alignment: Alignment) {
  const primaryHue = hue; 
  const secondaryHue = (hue + 180) % 360; 

  return {
    // Primary: Spikes and CENTER DOT (e.g. Neon Green)
    primary: `hsl(${primaryHue}, 100%, 50%)`,
    primaryGlow: `hsl(${primaryHue}, 100%, 60%)`,
    
    // Secondary: MAIN BODY Shell (e.g. Purple)
    secondary: `hsl(${secondaryHue}, 70%, 35%)`, 
    
    opacity: alignment === 'Parasitic' ? 1.0 : 0.8,
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
  
  const spikeCount = 6 + Number(seed % 7n); 
  const alignIdx = Number((seed >> 8n) % 2n);
  const alignment = ALIGNMENTS[alignIdx];
  
  const palette = useMemo(() => getPalette(hue, alignment), [hue, alignment]);

  // === 2. ANIMATION ===
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (!rootRef.current) return;

    rootRef.current.rotation.y = t * 0.1;
    rootRef.current.rotation.z = Math.sin(t * 0.15) * 0.05;

    // Subtle breathing
    const scaleVar = 1.8 * (1 + Math.sin(t * 1.5) * 0.02);
    rootRef.current.scale.setScalar(scaleVar); 
  });

  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.4}>
      <group ref={rootRef}>
        <ParticleBody palette={palette} />
        {/* REMOVED RING COMPONENT */}
        <ParticleSpikes count={spikeCount} palette={palette} seed={Number(seed % 100000n)} />
        <Atmosphere palette={palette} />
      </group>
    </Float>
  );
}

// --- SUB-COMPONENTS ---

function ParticleBody({ palette }: { palette: any }) {
  const particles = useMemo(() => {
    // INCREASED COUNT for "Detailed" texture
    const count = 6000; 
    const pos = new Float32Array(count * 3);
    const cols = new Float32Array(count * 3);
    
    const colorPrimary = new THREE.Color(palette.primary);   // Center Dot
    const colorSecondary = new THREE.Color(palette.secondary); // Main Body

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      // LOGIC: Create a dense core and a shell
      // 20% of points in the "Core Dot", 80% in the "Body Shell"
      const isCore = Math.random() > 0.8; 
      
      let r;
      if (isCore) {
         // Tiny distinct dot in center (Radius 0 to 0.25)
         r = Math.random() * 0.25;
      } else {
         // Main Body Shell (Radius 0.25 to 0.95)
         // Biased towards surface for "Solid" look
         r = 0.25 + Math.pow(Math.random(), 0.5) * 0.7; 
      }
      
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      // COLOR MAPPING:
      // If Core -> Primary Color (Green)
      // If Body -> Secondary Color (Purple)
      if (isCore) {
        cols[i*3] = colorPrimary.r;
        cols[i*3+1] = colorPrimary.g;
        cols[i*3+2] = colorPrimary.b;
      } else {
        cols[i*3] = colorSecondary.r;
        cols[i*3+1] = colorSecondary.g;
        cols[i*3+2] = colorSecondary.b;
      }
    }
    return { pos, cols };
  }, [palette]);

  return (
    <group>
      {/* Solid inner core to block background stars (Makes it look solid/detailed) */}
      <mesh>
        <sphereGeometry args={[0.9, 32, 32]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particles.pos.length / 3}
            array={particles.pos}
            itemSize={3}
            args={[particles.pos, 3]} 
          />
          <bufferAttribute
            attach="attributes-color"
            count={particles.cols.length / 3}
            array={particles.cols}
            itemSize={3}
            args={[particles.cols, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          vertexColors
          size={0.03} // Slightly smaller for finer detail
          transparent
          opacity={palette.opacity}
          sizeAttenuation={true}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false} 
        />
      </points>
    </group>
  );
}

function ParticleSpikes({ count, palette }: { count: number, palette: any, seed: number }) {
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
  const particles = useMemo(() => {
    const pCount = 200;
    const pos = new Float32Array(pCount * 3);
    
    for(let i=0; i<pCount; i++) {
      // 40% Head, 60% Stalk
      const isHead = Math.random() > 0.6;
      
      let x, y, z;
      if (isHead) {
        // Head: Distinct Bulb
        const r = 0.1 * Math.cbrt(Math.random()); 
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        x = r * Math.sin(phi) * Math.cos(theta);
        y = (r * Math.sin(phi) * Math.sin(theta)) + 0.5; // Tip Position
        z = r * Math.cos(phi);
      } else {
        // Stalk: Straight Line
        const r = 0.015 * Math.sqrt(Math.random()); 
        const theta = Math.random() * Math.PI * 2;
        const h = Math.random() * 0.5; 
        
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
          color={palette.primaryGlow} // Use Neon Green
          size={0.03} 
          transparent 
          opacity={1.0} 
          sizeAttenuation 
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </group>
  );
}

function Atmosphere({ palette }: { palette: any }) {
  const particles = useMemo(() => {
    const count = 50;
    const pos = new Float32Array(count * 3);
    for(let i=0; i<count; i++) {
      const r = 2.5 + Math.random() * 3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      pos[i*3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i*3+2] = r * Math.cos(phi);
    }
    return pos;
  }, []);

  return (
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
        color={palette.primary} 
        size={0.04} 
        transparent 
        opacity={0.3} 
        sizeAttenuation 
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}