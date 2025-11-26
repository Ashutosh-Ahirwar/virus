'use client';

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  MeshDistortMaterial,
  Sphere,
  Cylinder,
  Torus,
  RoundedBox,
  Float,
  Sparkles,
} from '@react-three/drei';
import { keccak256, encodePacked } from 'viem';

// Match Solidity-style HSL but as CSS strings
function getColors(hue: number) {
  return {
    body: `hsl(${hue}, 70%, 30%)`,                  // darker capsule
    bodyHighlight: `hsl(${hue}, 70%, 45%)`,
    dark: `hsl(${hue}, 70%, 14%)`,
    glow: `hsl(${(hue + 190) % 360}, 85%, 60%)`,    // outer aura
    accent: `hsl(${(hue + 40) % 360}, 95%, 65%)`,   // tips + core
  };
}

interface Virus3DProps {
  tokenId: number;
}

export function Virus3D({ tokenId }: Virus3DProps) {
  const rootRef = useRef<THREE.Group>(null);

  // Same seed as contract: keccak256(fid, tokenId, "VIRUS_EVO_V1")
  const seedHex = keccak256(
    encodePacked(
      ['uint256', 'uint256', 'string'],
      [BigInt(tokenId), BigInt(tokenId), 'VIRUS_EVO_V1']
    )
  );
  const seed = BigInt(seedHex);

  const hue = Number(seed % BigInt(360));
  const colors = useMemo(() => getColors(hue), [hue]);

  const traitSpikeCount = 6 + Number(seed % BigInt(7)); // 6–12 (matches on-chain)
  const visualSpikeCount = traitSpikeCount * 2;         // more visually dense
  const spikeStyle = Number((seed >> BigInt(12)) % BigInt(3));
  const nucleusType = Number((seed >> BigInt(4)) % BigInt(3));
  const hasAura = (seed % BigInt(10)) > BigInt(3);

  useFrame((state) => {
    if (!rootRef.current) return;
    const t = state.clock.getElapsedTime();

    // Slow spin
    rootRef.current.rotation.y = t * 0.3;
    rootRef.current.rotation.x = Math.sin(t * 0.4) * 0.15;

    // Breathing / pulsating scale
    const pulse = 1 + Math.sin(t * 1.6) * 0.09;
    rootRef.current.scale.setScalar(2.4 * pulse); // bigger in the card
  });

  return (
    <Float
      speed={1.4}
      rotationIntensity={0.4}
      floatIntensity={0.6}
      floatingRange={[-0.1, 0.1]}
    >
      <group ref={rootRef}>
        {/* --- AURA / FORCE FIELD --- */}
        {hasAura && (
          <Sphere args={[1.7, 40, 40]}>
            <meshBasicMaterial
              color={colors.glow}
              transparent
              opacity={0.12}
              side={THREE.BackSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </Sphere>
        )}

        {/* --- MAIN CAPSULE --- */}
        {/* Outer distorted membrane */}
        <Sphere args={[1.0, 64, 64]} scale={[1.1, 1.25, 1.05]}>
          <MeshDistortMaterial
            color={colors.body}
            emissive={colors.dark}
            emissiveIntensity={0.9}
            distort={0.55}
            speed={1.9}
            roughness={0.25}
            metalness={0.7}
            envMapIntensity={1.5}
          />
        </Sphere>

        {/* Inner softer tissue layer */}
        <Sphere args={[0.78, 48, 48]} scale={[1.0, 1.15, 1.0]}>
          <meshStandardMaterial
            color={colors.bodyHighlight}
            emissive={colors.bodyHighlight}
            emissiveIntensity={0.35}
            roughness={0.7}
            metalness={0.1}
            transparent
            opacity={0.25}
          />
        </Sphere>

        {/* Internal glow */}
        <Sphere args={[0.65, 40, 40]}>
          <meshStandardMaterial
            color={colors.glow}
            emissive={colors.glow}
            emissiveIntensity={0.7}
            transparent
            opacity={0.22}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </Sphere>

        <pointLight
          position={[0, 0, 0]}
          intensity={2.5}
          color={colors.glow}
          distance={5}
          decay={2}
        />

        {/* --- SPIKES --- */}
        <Spikes
          count={visualSpikeCount}
          style={spikeStyle}
          colors={colors}
          seed={Number(seed % BigInt(1_000_000))}
        />

        {/* --- NUCLEUS / CORE --- */}
        <Nucleus type={nucleusType} color={colors.accent} />

        {/* --- DNA HELIX + ORBITING PARTICLES --- */}
        <Helix color={colors.accent} />
        <OrbitingSpores color={colors.accent} />

        <Sparkles
          count={50}
          size={0.4}
          speed={0.4}
          opacity={0.45}
          scale={4}
          color={colors.glow}
        />
      </group>
    </Float>
  );
}

/* ---------------- SPIKES ---------------- */

type ColorSet = ReturnType<typeof getColors>;

function Spikes({
  count,
  style,
  colors,
  seed,
}: {
  count: number;
  style: number;
  colors: ColorSet;
  seed: number;
}) {
  const spikesRef = useRef<THREE.Group[]>([]);

  const spikeData = useMemo(() => {
    const data: { pos: THREE.Vector3; rot: THREE.Euler; len: number }[] = [];
    const radius = 1.05;
    const phi = (1 + Math.sqrt(5)) / 2;

    for (let i = 0; i < count; i++) {
      const theta = (2 * Math.PI * i) / phi;
      const phiAng = Math.acos(1 - (2 * (i + 0.5)) / count);

      const x = radius * Math.sin(phiAng) * Math.cos(theta);
      const y = radius * Math.sin(phiAng) * Math.sin(theta);
      const z = radius * Math.cos(phiAng);

      const pos = new THREE.Vector3(x, y, z);

      const rot = new THREE.Euler();
      rot.setFromQuaternion(
        new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          pos.clone().normalize()
        )
      );

      const rand = ((Math.sin(seed + i * 17.13) + 1) / 2) * 0.7 + 0.9; // 0.9–1.6
      data.push({ pos: pos.multiplyScalar(1.05), rot, len: rand });
    }
    return data;
  }, [count, seed]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    spikesRef.current.forEach((g, i) => {
      if (!g) return;
      const wobble = Math.sin(t * 3 + i * 0.8) * 0.15;
      g.rotation.z += wobble * 0.015;
      g.rotation.y += wobble * 0.015;
    });
  });

  const SpikeGeom: React.FC<{ len: number }> = ({ len }) => {
    if (style === 0) {
      // Thick club spike
      return (
        <group>
          <Cylinder args={[0.07, 0.06, 0.7 * len, 10]} position={[0, 0.35 * len, 0]}>
            <meshStandardMaterial
              color={colors.dark}
              roughness={0.6}
              metalness={0.35}
            />
          </Cylinder>
          <Sphere args={[0.14 * len, 18, 18]} position={[0, 0.75 * len, 0]}>
            <meshStandardMaterial
              color={colors.accent}
              emissive={colors.accent}
              emissiveIntensity={0.9}
              roughness={0.15}
              metalness={0.7}
            />
          </Sphere>
        </group>
      );
    } else if (style === 1) {
      // Needle injector
      return (
        <group>
          <Sphere args={[0.08, 16, 16]} position={[0, 0.06, 0]}>
            <meshStandardMaterial
              color={colors.dark}
              metalness={0.8}
              roughness={0.2}
            />
          </Sphere>
          <Cylinder args={[0.015, 0.085, 0.9 * len, 10]} position={[0, 0.48 * len, 0]}>
            <meshStandardMaterial
              color={colors.accent}
              emissive={colors.accent}
              emissiveIntensity={0.5}
              metalness={1}
              roughness={0.2}
            />
          </Cylinder>
        </group>
      );
    } else {
      // Antenna receptor
      return (
        <group>
          <Cylinder args={[0.025, 0.025, 0.7 * len, 12]} position={[0, 0.35 * len, 0]}>
            <meshStandardMaterial
              color={colors.accent}
              emissive={colors.accent}
              emissiveIntensity={0.4}
            />
          </Cylinder>
          <Torus
            args={[0.14 * len, 0.03, 16, 32]}
            position={[0, 0.75 * len, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <meshStandardMaterial
              color={colors.accent}
              emissive={colors.accent}
              emissiveIntensity={1}
              metalness={0.6}
            />
          </Torus>
        </group>
      );
    }
  };

  return (
    <group>
      {spikeData.map((s, i) => (
        <group
          key={i}
          ref={(el) => {
            if (el) spikesRef.current[i] = el;
          }}
          position={s.pos}
          rotation={s.rot}
        >
          <SpikeGeom len={s.len} />
        </group>
      ))}
    </group>
  );
}

/* ---------------- CORE & DNA ---------------- */

function Nucleus({ type, color }: { type: number; color: string }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (!ref.current) return;
    ref.current.rotation.y = t * 0.7;
    ref.current.rotation.x = Math.sin(t * 0.9) * 0.4;
  });

  const matProps = {
    color,
    emissive: color,
    emissiveIntensity: 1.2,
    transparent: true,
    opacity: 0.95,
    roughness: 0.2,
    metalness: 0.6,
    blending: THREE.AdditiveBlending,
  };

  if (type === 0) {
    return (
      <Sphere ref={ref} args={[0.3, 32, 32]}>
        <meshStandardMaterial {...matProps} />
      </Sphere>
    );
  } else if (type === 1) {
    return (
      <RoundedBox ref={ref} args={[0.42, 0.42, 0.42]} radius={0.16} smoothness={6}>
        <meshStandardMaterial {...matProps} />
      </RoundedBox>
    );
  } else {
    return (
      <Torus ref={ref} args={[0.27, 0.08, 18, 64]}>
        <meshStandardMaterial {...matProps} />
      </Torus>
    );
  }
}

function Helix({ color }: { color: string }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (!groupRef.current) return;
    groupRef.current.rotation.y = -t * 0.8;
  });

  const beads: React.ReactElement[] = [];
  const turns = 2.3;
  const segments = 34;

  for (let i = 0; i < segments; i++) {
    const t = (i / (segments - 1)) * turns * Math.PI * 2;
    const y = (i / (segments - 1) - 0.5) * 0.55;
    const r = 0.18;
    const x = Math.cos(t) * r;
    const z = Math.sin(t) * r;

    beads.push(
      <Sphere key={i} args={[0.03, 12, 12]} position={[x, y, z]}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.8}
          roughness={0.3}
          metalness={0.5}
        />
      </Sphere>
    );
  }

  return <group ref={groupRef}>{beads}</group>;
}

function OrbitingSpores({ color }: { color: string }) {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (!ref.current) return;
    ref.current.rotation.y = t * 0.5;
    ref.current.rotation.x = Math.sin(t * 0.3) * 0.4;
  });

  return (
    <group ref={ref}>
      {[0, 1, 2, 3].map((i) => {
        const angle = (i / 4) * Math.PI * 2;
        const r = 1.35;
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        const y = (i % 2 === 0 ? 0.25 : -0.25);

        return (
          <Sphere key={i} args={[0.09, 16, 16]} position={[x, y, z]}>
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.6}
              roughness={0.4}
              metalness={0.4}
              transparent
              opacity={0.85}
            />
          </Sphere>
        );
      })}
    </group>
  );
}
