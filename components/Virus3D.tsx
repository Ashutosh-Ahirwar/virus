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

// --- UPDATED PALETTE: Dual Colors (Spikes vs Body) ---
function getPalette(hue: number, alignment: Alignment) {
  // SVG shows high contrast (e.g. Green Spikes vs Purple Body).
  // We use the hue for the Spikes/Ring (Primary)
  // We use the Complementary hue for the Body (Secondary)
  
  const primaryHue = hue;
  const secondaryHue = (hue + 180) % 360; // Complementary color

  return {
    // Spikes, Ring, Core Dot (Bright Neon)
    primary: `hsl(${primaryHue}, 90%, 60%)`,
    primaryGlow: `hsl(${primaryHue}, 100%, 80%)`,
    
    // Main Body (Darker, contrasting)
    body: `hsl(${secondaryHue}, 60%, 40%)`, 
    bodyHighlight: `hsl(${secondaryHue}, 80%, 60%)`,
    
    opacity: alignment === 'Parasitic' ? 0.9 : 0.7,
  };
}

export function Virus3D({ tokenId }: Virus3DProps) {
  const rootRef = useRef<THREE.Group>(null);

  // === 1. METADATA GENERATION ===
  // Note: If colors still don't match exactly, the seed string 'VIRUS_EVO_V1' 
  // might differ from your smart contract's seed string.
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

    // Gentle floating pulse
    const scaleVar = 1.8 * (1 + Math.sin(t * 1.5) * 0.02);
    rootRef.current.scale.setScalar(scaleVar); 
  });

  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.4}>
      <group ref={rootRef}>
        <ParticleBody palette={palette} />
        {/* Added Ring Component to match SVG */}
        <ParticleRing palette={palette} /> 
        <ParticleSpikes count={spikeCount} palette={palette} seed={Number(seed % 100000n)} />
        <Atmosphere palette={palette} />
      </group>
    </Float>
  );
}

// --- SUB-COMPONENTS ---

function ParticleBody({ palette }: { palette: any }) {
  const particles = useMemo(() => {
    const count = 4000; 
    const pos = new Float32Array(count * 3);
    const cols = new Float32Array(count * 3);
    const colorBody = new THREE.Color(palette.body);
    const colorHigh = new THREE.Color(palette.bodyHighlight);
    const colorCore = new THREE.Color(palette.primary); // Center dot color

    for (let i = 0; i < count; i++) {
      // 1. Geometry: Sphere with denser core
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      // Radius variation: Some deep inside (core), most on surface
      const isCore = Math.random() > 0.85; 
      const r = isCore ? Math.random() * 0.4 : (0.9 + Math.random() * 0.1);
      
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      // 2. Color: Gradient from Core (Primary) to Surface (Secondary)
      if (isCore) {
        // Bright center dot like in SVG
        cols[i*3] = colorCore.r;
        cols[i*3+1] = colorCore.g;
        cols[i*3+2] = colorCore.b;
      } else {
        // Surface gradient
        cols[i*3] = colorBody.r;
        cols[i*3+1] = colorBody.g;
        cols[i*3+2] = colorBody.b;
      }
    }
    return { pos, cols };
  }, [palette]);

  return (
    <group>
      {/* Black Occlusion Sphere */}
      <mesh>
        <sphereGeometry args={[0.85, 32, 32]} />
        <meshBasicMaterial color="#050505" />
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
          size={0.035}
          transparent
          opacity={palette.opacity}
          sizeAttenuation={true}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  );
}

function ParticleRing({ palette }: { palette: any }) {
  // The thin outer ring seen in the SVG
  const particles = useMemo(() => {
    const count = 300;
    const pos = new Float32Array(count * 3);
    for(let i=0; i<count; i++) {
        const theta = Math.random() * Math.PI * 2;
        // Ring radius slightly larger than body
        const r = 1.1 + (Math.random() * 0.05); 
        
        pos[i*3] = r * Math.cos(theta);
        pos[i*3+1] = r * Math.sin(theta);
        pos[i*3+2] = (Math.random() - 0.5) * 0.1; // Flat ring
    }
    return pos;
  }, []);

  return (
    <points rotation={[0, 0, Math.PI/8]}>
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
            size={0.02} 
            transparent 
            opacity={0.4} 
            blending={THREE.AdditiveBlending} 
        />
    </points>
  )
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
    const pCount = 150;
    const pos = new Float32Array(pCount * 3);
    
    for(let i=0; i<pCount; i++) {
      const rVal = Math.random();
      const isHead = rVal > 0.6; // Top 40% is head
      
      let x, y, z;
      if (isHead) {
        // Head: Defined Sphere/Bulb
        const r = 0.12 * Math.cbrt(Math.random()); 
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        x = r * Math.sin(phi) * Math.cos(theta);
        y = (r * Math.sin(phi) * Math.sin(theta)) + 0.5; // Offset to tip
        z = r * Math.cos(phi);
      } else {
        // Stalk: Very thin cylinder line
        const r = 0.02 * Math.sqrt(Math.random()); // Tighter radius for "line" look
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
          color={palette.primaryGlow} // Use the bright glow color
          size={0.03} 
          transparent 
          opacity={0.9} 
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
      count={40} 
      scale={3.2} 
      size={4} 
      speed={0.3} 
      opacity={0.3} 
      color={palette.primary} 
    />
  );
}