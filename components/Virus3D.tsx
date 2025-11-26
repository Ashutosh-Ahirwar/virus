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
import type { JSX } from 'react';

function getColors(hue: number) {
  // We use CSS HSL so Three can parse it directly
  return {
    main: `hsl(${hue}, 70%, 40%)`,     // darker body
    dark: `hsl(${hue}, 70%, 18%)`,     // spike base, shadows
    glow: `hsl(${(hue + 180) % 360}, 80%, 60%)`, // ambient glow
    accent: `hsl(${(hue + 40) % 360}, 90%, 65%)`, // nucleus + tips
  };
}

interface Virus3DProps {
  tokenId: number;
}

export function Virus3D({ tokenId }: Virus3DProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Match Solidity seed logic: keccak256(fid, tokenId, "VIRUS_EVO_V1")
  const seedHex = keccak256(
    encodePacked(
      ['uint256', 'uint256', 'string'],
      [BigInt(tokenId), BigInt(tokenId), 'VIRUS_EVO_V1']
    )
  );
  const seed = BigInt(seedHex);

  const hue = Number(seed % BigInt(360));
  const colors = useMemo(() => getColors(hue), [hue]);

  const spikeCount = 6 + Number(seed % BigInt(7)); // 6–12
  const spikeStyle = Number((seed >> BigInt(12)) % BigInt(3));
  const nucleusType = Number((seed >> BigInt(4)) % BigInt(3));
  const hasAura = (seed % BigInt(10)) > BigInt(3);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();

    // Slow rotation + wobble
    groupRef.current.rotation.y = t * 0.25;
    groupRef.current.rotation.z = Math.sin(t * 0.4) * 0.2;

    // Breathing / pulsing
    const s = 1 + Math.sin(t * 1.4) * 0.06;
    groupRef.current.scale.set(s, s * 1.04, s); // slightly squashed
  });

  return (
    <Float
      speed={1.2}
      rotationIntensity={0.3}
      floatIntensity={0.45}
      floatingRange={[-0.08, 0.08]}
    >
      <group ref={groupRef}>

        {/* Soft aura around the virus */}
        {hasAura && (
          <Sphere args={[1.6, 32, 32]}>
            <meshBasicMaterial
              color={colors.glow}
              transparent
              opacity={0.09}
              side={THREE.BackSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </Sphere>
        )}

        {/* MAIN BODY / CAPSULE */}
        <Sphere args={[0.9, 64, 64]} scale={[1.05, 1.2, 1]}>
          <MeshDistortMaterial
            color={colors.main}
            emissive={colors.dark}
            emissiveIntensity={0.9}
            roughness={0.15}
            metalness={0.7}
            distort={0.45}
            speed={1.8}
            envMapIntensity={1.2}
          />
        </Sphere>

        {/* Inner glow layer just under the skin */}
        <Sphere args={[0.75, 48, 48]}>
          <meshStandardMaterial
            color={colors.glow}
            emissive={colors.glow}
            emissiveIntensity={0.5}
            transparent
            opacity={0.25}
            roughness={0.5}
            metalness={0.1}
            blending={THREE.AdditiveBlending}
          />
        </Sphere>

        {/* Bio-luminescent core light */}
        <pointLight
          position={[0, 0, 0]}
          intensity={2.2}
          color={colors.glow}
          distance={4}
          decay={2}
        />

        {/* SPIKES */}
        <Spikes
          count={spikeCount}
          style={spikeStyle}
          colors={colors}
          seed={Number(seed % BigInt(1_000_000))}
        />

        {/* NUCLEUS */}
        <Nucleus type={nucleusType} color={colors.accent} />

        {/* DNA-like helix inside */}
        <Helix color={colors.accent} />

        {/* Rotating outer rings / field lines */}
        <FieldRings color={colors.glow} />

        {/* Tiny floating particles */}
        <Sparkles
          count={40}
          size={0.35}
          speed={0.35}
          opacity={0.45}
          scale={3}
          color={colors.accent}
        />
      </group>
    </Float>
  );
}

/* ---------------- SPIKES ---------------- */

function Spikes({
  count,
  style,
  colors,
  seed,
}: {
  count: number;
  style: number;
  colors: ReturnType<typeof getColors>;
  seed: number;
}) {
  const spikesRef = useRef<THREE.Group[]>([]);

  const spikeData = useMemo(() => {
    const data: { position: THREE.Vector3; rotation: THREE.Euler; length: number }[] = [];
    const radius = 0.9;
    const phi = (1 + Math.sqrt(5)) / 2;

    for (let i = 0; i < count; i++) {
      const theta = (2 * Math.PI * i) / phi;
      const phiAng = Math.acos(1 - (2 * (i + 0.5)) / count);

      const x = radius * Math.sin(phiAng) * Math.cos(theta);
      const y = radius * Math.sin(phiAng) * Math.sin(theta);
      const z = radius * Math.cos(phiAng);

      const base = new THREE.Vector3(x, y, z);
      const rotation = new THREE.Euler();
      rotation.setFromQuaternion(
        new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          base.clone().normalize()
        )
      );

      // Slight irregularity per spike based on seed
      const rand =
        ((Math.sin(seed + i * 13.37) + 1) / 2) * 0.5 + 0.8; // ~0.8–1.3
      data.push({ position: base.multiplyScalar(1.02), rotation, length: rand });
    }
    return data;
  }, [count, seed]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    spikesRef.current.forEach((g, i) => {
      if (!g) return;
      const jitter = Math.sin(t * 3 + i * 1.7) * 0.12;
      g.rotation.z += jitter * 0.01;
      g.rotation.y += jitter * 0.01;
    });
  });

  const SpikeGeometry: React.FC<{ length: number }> = ({ length }) => {
    if (style === 0) {
      // Protein club
      return (
        <group>
          <Cylinder args={[0.05, 0.04, 0.6 * length, 10]} position={[0, 0.3 * length, 0]}>
            <meshStandardMaterial
              color={colors.dark}
              roughness={0.6}
              metalness={0.35}
            />
          </Cylinder>
          <Sphere args={[0.1 * length, 18, 18]} position={[0, 0.65 * length, 0]}>
            <meshStandardMaterial
              color={colors.accent}
              emissive={colors.accent}
              emissiveIntensity={0.7}
              roughness={0.1}
              metalness={0.6}
            />
          </Sphere>
        </group>
      );
    } else if (style === 1) {
      // Needle
      return (
        <group>
          <Sphere args={[0.07, 12, 12]} position={[0, 0.04, 0]}>
            <meshStandardMaterial
              color={colors.dark}
              metalness={0.8}
              roughness={0.2}
            />
          </Sphere>
          <Cylinder args={[0.01, 0.07, 0.75 * length, 10]} position={[0, 0.4 * length, 0]}>
            <meshStandardMaterial
              color={colors.accent}
              emissive={colors.accent}
              emissiveIntensity={0.4}
              metalness={1}
              roughness={0.15}
            />
          </Cylinder>
        </group>
      );
    } else {
      // Antenna receptor
      return (
        <group>
          <Cylinder args={[0.02, 0.02, 0.55 * length, 12]} position={[0, 0.28 * length, 0]}>
            <meshStandardMaterial
              color={colors.accent}
              emissive={colors.accent}
              emissiveIntensity={0.3}
            />
          </Cylinder>
          <Torus
            args={[0.12 * length, 0.025, 16, 32]}
            position={[0, 0.62 * length, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <meshStandardMaterial
              color={colors.accent}
              emissive={colors.accent}
              emissiveIntensity={0.9}
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
          position={s.position}
          rotation={s.rotation}
        >
          <SpikeGeometry length={s.length} />
        </group>
      ))}
    </group>
  );
}

/* ---------------- NUCLEUS ---------------- */

function Nucleus({ type, color }: { type: number; color: string }) {
  if (type === 0) {
    return (
      <Sphere args={[0.28, 32, 32]}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.1}
          transparent
          opacity={0.85}
          roughness={0.25}
          metalness={0.4}
          blending={THREE.AdditiveBlending}
        />
      </Sphere>
    );
  } else if (type === 1) {
    return (
      <RoundedBox args={[0.38, 0.38, 0.38]} radius={0.12} smoothness={5}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1}
          transparent
          opacity={0.9}
          roughness={0.3}
          metalness={0.5}
          blending={THREE.AdditiveBlending}
        />
      </RoundedBox>
    );
  } else {
    return (
      <Torus args={[0.25, 0.07, 16, 64]}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.2}
          transparent
          opacity={0.95}
          roughness={0.2}
          metalness={0.7}
          blending={THREE.AdditiveBlending}
        />
      </Torus>
    );
  }
}

/* ---------------- HELIX / DNA STRAND ---------------- */

function Helix({ color }: { color: string }) {
  const points: JSX.Element[] = [];
  const turns = 2.5;
  const segments = 40;

  for (let i = 0; i < segments; i++) {
    const t = (i / (segments - 1)) * turns * Math.PI * 2;
    const y = (i / (segments - 1) - 0.5) * 0.5;
    const r = 0.17;
    const x = Math.cos(t) * r;
    const z = Math.sin(t) * r;

    points.push(
      <Sphere key={i} args={[0.03, 12, 12]} position={[x, y, z]}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.7}
          roughness={0.2}
          metalness={0.6}
        />
      </Sphere>
    );
  }

  return <group>{points}</group>;
}

/* ---------------- FIELD RINGS ---------------- */

function FieldRings({ color }: { color: string }) {
  const ringRef1 = useRef<THREE.Mesh>(null);
  const ringRef2 = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (ringRef1.current) {
      ringRef1.current.rotation.y = t * 0.4;
      ringRef1.current.rotation.x = Math.sin(t * 0.3) * 0.4;
    }
    if (ringRef2.current) {
      ringRef2.current.rotation.y = -t * 0.35;
      ringRef2.current.rotation.z = Math.cos(t * 0.27) * 0.4;
    }
  });

  return (
    <group>
      <Torus ref={ringRef1} args={[1.1, 0.015, 16, 64]}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
        />
      </Torus>
      <Torus ref={ringRef2} args={[1.05, 0.02, 16, 64]} rotation={[Math.PI / 2.5, 0, 0]}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.25}
          blending={THREE.AdditiveBlending}
        />
      </Torus>
    </group>
  );
}
