'use client';

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Float } from '@react-three/drei';
import { keccak256, encodePacked } from 'viem';

const ALIGNMENTS = ['Symbiotic', 'Parasitic'] as const;

type Alignment = (typeof ALIGNMENTS)[number];

interface Virus3DProps {
  tokenId: number;
}

// === 1. DISPLACEMENT LOGIC (Kept the rugged look) ===
function getRuggedDisplacement(theta: number, phi: number) {
  const lobe = Math.sin(theta * 5) * Math.cos(phi * 5); 
  const micro = Math.cos(theta * 20 + phi * 10); 
  return (lobe * 0.15) + (micro * 0.03); 
}

function getPalette(hue: number, alignment: Alignment) {
  const primaryHue = hue; 
  const secondaryHue = (hue + 180) % 360; 

  return {
    primary: `hsl(${primaryHue}, 100%, 50%)`, 
    primaryGlow: `hsl(${primaryHue}, 100%, 60%)`,
    secondary: `hsl(${secondaryHue}, 90%, 65%)`, 
    opacity: alignment === 'Parasitic' ? 1.0 : 0.9,
  };
}

export function Virus3D({ tokenId }: Virus3DProps) {
  const rootRef = useRef<THREE.Group>(null);

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

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (!rootRef.current) return;

    rootRef.current.rotation.y = t * 0.12;
    rootRef.current.rotation.z = Math.sin(t * 0.2) * 0.05;

    const scaleVar = 1.8 * (1 + Math.sin(t * 1.5) * 0.02);
    rootRef.current.scale.setScalar(scaleVar); 
  });

  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.4}>
      <group ref={rootRef}>
        <ParticleCore palette={palette} />
        <ParticleShell palette={palette} />
        <ParticleSpikes count={spikeCount} palette={palette} seed={Number(seed % 100000n)} />
        <Atmosphere palette={palette} />
      </group>
    </Float>
  );
}

// --- SUB-COMPONENTS ---

function ParticleCore({ palette }: { palette: any }) {
  const particles = useMemo(() => {
    const count = 3000; 
    const pos = new Float32Array(count * 3);
    
    for(let i=0; i<count; i++) {
        // Uniform sphere distribution for a solid look
        const r = Math.pow(Math.random(), 0.33) * 0.28; // Radius up to 0.28
        
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        pos[i*3] = r * Math.sin(phi) * Math.cos(theta);
        pos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
        pos[i*3+2] = r * Math.cos(phi);
    }
    return pos;
  }, []);

  return (
    <group>
        {/* SOLID GLOWING SPHERE (Fixes the black hole) */}
        <mesh>
            <sphereGeometry args={[0.18, 32, 32]} />
            <meshBasicMaterial 
                color={palette.primary} 
                toneMapped={false}
                transparent
                opacity={1.0}
            />
        </mesh>

        {/* Cloud of particles surrounding it */}
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
                color={palette.primaryGlow} 
                size={0.035} 
                transparent 
                opacity={0.8} 
                blending={THREE.AdditiveBlending}
                toneMapped={false}
                depthWrite={false}
            />
        </points>
    </group>
  );
}

function ParticleShell({ palette }: { palette: any }) {
  const particles = useMemo(() => {
    const count = 12000; 
    const pos = new Float32Array(count * 3);
    const cols = new Float32Array(count * 3);
    const colorSecondary = new THREE.Color(palette.secondary); 

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      const displacement = getRuggedDisplacement(theta, phi);
      const surfaceRadius = 1.0 + displacement;

      // Fill from 0.25 (Core edge) to Surface
      // Overlaps the core mesh slightly so there is no gap
      const r = 0.25 + Math.pow(Math.random(), 2) * (surfaceRadius - 0.25); 
      
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      cols[i*3] = colorSecondary.r;
      cols[i*3+1] = colorSecondary.g;
      cols[i*3+2] = colorSecondary.b;
    }
    return { pos, cols };
  }, [palette]);

  return (
    <group>
      {/* DELETED: The black blocker mesh is gone */}
      
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
          size={0.03}
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
    const phiMagic = Math.PI * (3 - Math.sqrt(5)); 
    
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - y * y);
      
      const theta = phiMagic * i;
      const phi = Math.acos(y);

      const displacement = getRuggedDisplacement(theta, phi);
      const surfaceRadius = 1.0 + displacement; 
      
      const x = surfaceRadius * Math.cos(theta) * radiusAtY;
      const z = surfaceRadius * Math.sin(theta) * radiusAtY;
      const yPos = y * surfaceRadius;

      const pos = new THREE.Vector3(x, yPos, z);
      const rot = new THREE.Euler().setFromQuaternion(
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos.clone().normalize())
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
    const pCount = 250;
    const pos = new Float32Array(pCount * 3);
    
    for(let i=0; i<pCount; i++) {
      const isHead = Math.random() > 0.6;
      let x, y, z;
      if (isHead) {
        // Head
        const r = 0.1 * Math.cbrt(Math.random()); 
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        x = r * Math.sin(phi) * Math.cos(theta);
        y = (r * Math.sin(phi) * Math.sin(theta)) + 0.6; 
        z = r * Math.cos(phi);
      } else {
        // Stalk
        const r = 0.012 * Math.sqrt(Math.random()); 
        const theta = Math.random() * Math.PI * 2;
        const h = Math.random() * 0.6; 
        
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
          color={palette.primaryGlow} 
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
      const r = 3 + Math.random() * 4;
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