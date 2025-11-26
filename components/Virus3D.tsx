'use client';

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  Float,
  Sphere,
  Cylinder,
  Torus,
  RoundedBox,
  Sparkles,
  MeshDistortMaterial,
} from '@react-three/drei';
import { keccak256, encodePacked } from 'viem';

// --- Same lore arrays as Solidity ---
const ALIGNMENTS = ['Symbiotic', 'Parasitic'] as const;
const MUTATIONS_SYM = ['Neural-Linker', 'Muscle-Weaver', 'Cell-Regenerator', 'Gene-Purifier'] as const;
const MUTATIONS_PAR = ['Void-Rot', 'Blood-Boil', 'Neural-Decay', 'Cell-Rupture'] as const;

type Alignment = (typeof ALIGNMENTS)[number];
type Mutation =
  | (typeof MUTATIONS_SYM)[number]
  | (typeof MUTATIONS_PAR)[number];

interface Virus3DProps {
  tokenId: number;
}

// Palette: derived from the SAME hue as SVG, but tweaked per alignment for cyberpunk vibe.
function getPalette(hue: number, alignment: Alignment) {
  // Base HSL exactly like Solidity renderer
  const cMain = `hsl(${hue}, 70%, 50%)`;
  const cDark = `hsl(${hue}, 60%, 25%)`;
  const cGlow = `hsl(${(hue + 180) % 360}, 80%, 70%)`;
  const cAccent = `hsl(${(hue + 30) % 360}, 90%, 60%)`;

  // Alignment-specific flavor
  if (alignment === 'Symbiotic') {
    return {
      body: cMain,
      bodyInner: `hsl(${hue}, 70%, 35%)`,
      dark: cDark,
      glow: cGlow,
      accent: cAccent,
      grid: `hsl(${(hue + 200) % 360}, 90%, 65%)`,
    };
  } else {
    // Parasitic: more toxic & hostile
    return {
      body: `hsl(${hue}, 80%, 30%)`,
      bodyInner: `hsl(${hue}, 80%, 22%)`,
      dark: `hsl(${hue}, 85%, 12%)`,
      glow: `hsl(${(hue + 200) % 360}, 90%, 65%)`,
      accent: `hsl(${(hue + 330) % 360}, 95%, 65%)`,
      grid: `hsl(${(hue + 30) % 360}, 90%, 70%)`,
    };
  }
}

export function Virus3D({ tokenId }: Virus3DProps) {
  const rootRef = useRef<THREE.Group>(null);

  // === 1. Reproduce seed & traits exactly like Solidity ===
  const seedHex = keccak256(
    encodePacked(
      ['uint256', 'uint256', 'string'],
      [BigInt(tokenId), BigInt(tokenId), 'VIRUS_EVO_V1']
    )
  );
  const seed = BigInt(seedHex);

  const hue = Number(seed % 360n);

  const spikeCount = 6 + Number(seed % 7n); // must match metadata
  const alignIdx = Number((seed >> 8n) % 2n);
  const mutIdx = Number((seed >> 12n) % 4n);

  const alignment: Alignment = ALIGNMENTS[alignIdx];
  const mutation: Mutation =
    alignment === 'Symbiotic'
      ? MUTATIONS_SYM[mutIdx]
      : MUTATIONS_PAR[mutIdx];

  const palette = useMemo(
    () => getPalette(hue, alignment),
    [hue, alignment]
  );

  // === 2. Global motion (breathing, slow spin) ===
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (!rootRef.current) return;

    // slow world spin
    rootRef.current.rotation.y = t * 0.25;
    rootRef.current.rotation.x = Math.sin(t * 0.35) * 0.15;

    // breathing / pulsing
    const pulse = 1 + Math.sin(t * 1.6) * 0.08;
    rootRef.current.scale.setScalar(2.1 * pulse);
  });

  return (
    <Float
      speed={1.4}
      rotationIntensity={0.35}
      floatIntensity={0.55}
      floatingRange={[-0.1, 0.1]}
    >
      <group ref={rootRef}>
        <VirusBody
          alignment={alignment}
          mutation={mutation}
          palette={palette}
        />
        <Spikes
          count={spikeCount}
          alignment={alignment}
          palette={palette}
          seed={Number(seed % 1_000_000n)}
        />
        <Core
          alignment={alignment}
          mutation={mutation}
          palette={palette}
        />
        <Sparkles
          count={40}
          size={0.35}
          speed={0.35}
          opacity={0.45}
          scale={4}
          color={palette.glow}
        />
      </group>
    </Float>
  );
}

/* ---------------- BODY / CAPSULE ---------------- */

function VirusBody({
  alignment,
  mutation,
  palette,
}: {
  alignment: Alignment;
  mutation: Mutation;
  palette: ReturnType<typeof getPalette>;
}) {
  // Slightly different distortion based on mutation
  const distort =
    mutation === 'Neural-Linker' || mutation === 'Neural-Decay'
      ? 0.6
      : 0.4;

  const speed =
    mutation === 'Blood-Boil' || mutation === 'Cell-Rupture'
      ? 2.4
      : 1.7;

  return (
    <>
      {/* Aura / force field */}
      <Sphere args={[1.5, 40, 40]}>
        <meshBasicMaterial
          color={palette.glow}
          transparent
          opacity={0.12}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </Sphere>

      {/* Outer distorted shell */}
      <Sphere args={[1.0, 64, 64]} scale={[1.15, 1.25, 1.1]}>
        <MeshDistortMaterial
          color={palette.body}
          emissive={palette.dark}
          emissiveIntensity={alignment === 'Parasitic' ? 1.0 : 0.6}
          distort={distort}
          speed={speed}
          roughness={0.2}
          metalness={0.8}
        />
      </Sphere>

      {/* Inner tissue layer */}
      <Sphere args={[0.8, 48, 48]} scale={[1.05, 1.18, 1.05]}>
        <meshStandardMaterial
          color={palette.bodyInner}
          emissive={palette.bodyInner}
          emissiveIntensity={0.4}
          roughness={0.7}
          metalness={0.1}
          transparent
          opacity={0.3}
        />
      </Sphere>

      {/* Cyberpunk ring / grid feel */}
      <Torus args={[1.2, 0.02, 16, 96]} rotation={[Math.PI / 3, 0, 0]}>
        <meshBasicMaterial
          color={palette.grid}
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
        />
      </Torus>
      <Torus args={[1.05, 0.015, 16, 96]} rotation={[Math.PI / 2.2, 0, 0]}>
        <meshBasicMaterial
          color={palette.grid}
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
        />
      </Torus>

      {/* Internal glow */}
      <Sphere args={[0.65, 40, 40]}>
        <meshStandardMaterial
          color={palette.glow}
          emissive={palette.glow}
          emissiveIntensity={0.8}
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </Sphere>

      <pointLight
        position={[0, 0, 0]}
        intensity={alignment === 'Parasitic' ? 2.8 : 2.0}
        color={palette.glow}
        distance={5}
        decay={2}
      />
    </>
  );
}

/* ---------------- SPIKES ---------------- */

function Spikes({
  count,
  alignment,
  palette,
  seed,
}: {
  count: number;
  alignment: Alignment;
  palette: ReturnType<typeof getPalette>;
  seed: number;
}) {
  const spikesRef = useRef<THREE.Group[]>([]);

  const spikeData = useMemo(() => {
    const arr: { pos: THREE.Vector3; rot: THREE.Euler; len: number }[] = [];
    const radius = 1.1;
    const phi = (1 + Math.sqrt(5)) / 2;

    for (let i = 0; i < count; i++) {
      const theta = (2 * Math.PI * i) / phi;
      const phiAng = Math.acos(1 - (2 * (i + 0.5)) / count);

      const x = radius * Math.sin(phiAng) * Math.cos(theta);
      const y = radius * Math.sin(phiAng) * Math.sin(theta);
      const z = radius * Math.cos(phiAng);

      const base = new THREE.Vector3(x, y, z);

      const rot = new THREE.Euler();
      rot.setFromQuaternion(
        new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          base.clone().normalize()
        )
      );

      const rand = ((Math.sin(seed + i * 17.3) + 1) / 2) * 0.7 + 0.9; // 0.9–1.6
      arr.push({ pos: base.multiplyScalar(1.03), rot, len: rand });
    }

    return arr;
  }, [count, seed]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    spikesRef.current.forEach((g, i) => {
      if (!g) return;
      const wobble = Math.sin(t * 3 + i * 0.9) * 0.12;
      g.rotation.z += wobble * 0.015;
      g.rotation.y += wobble * 0.01;
    });
  });

  const SpikeShape: React.FC<{ len: number }> = ({ len }) => {
    const isSym = alignment === 'Symbiotic';

    if (isSym) {
      // softer protein clubs
      return (
        <group>
          <Cylinder args={[0.06, 0.05, 0.65 * len, 10]} position={[0, 0.33 * len, 0]}>
            <meshStandardMaterial
              color={palette.dark}
              roughness={0.6}
              metalness={0.35}
            />
          </Cylinder>
          <Sphere args={[0.13 * len, 18, 18]} position={[0, 0.72 * len, 0]}>
            <meshStandardMaterial
              color={palette.accent}
              emissive={palette.accent}
              emissiveIntensity={0.7}
              roughness={0.2}
              metalness={0.6}
            />
          </Sphere>
        </group>
      );
    } else {
      // parasitic: needle / antenna hybrid
      return (
        <group>
          <Sphere args={[0.07, 16, 16]} position={[0, 0.04, 0]}>
            <meshStandardMaterial
              color={palette.dark}
              metalness={0.8}
              roughness={0.25}
            />
          </Sphere>
          <Cylinder args={[0.015, 0.08, 0.85 * len, 10]} position={[0, 0.45 * len, 0]}>
            <meshStandardMaterial
              color={palette.accent}
              emissive={palette.accent}
              emissiveIntensity={0.6}
              metalness={1}
              roughness={0.2}
            />
          </Cylinder>
          <Torus
            args={[0.14 * len, 0.025, 16, 32]}
            position={[0, 0.85 * len, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <meshStandardMaterial
              color={palette.accent}
              emissive={palette.accent}
              emissiveIntensity={1.0}
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
          <SpikeShape len={s.len} />
        </group>
      ))}
    </group>
  );
}

/* ---------------- CORE / NUCLEUS ---------------- */

function Core({
  alignment,
  mutation,
  palette,
}: {
  alignment: Alignment;
  mutation: Mutation;
  palette: ReturnType<typeof getPalette>;
}) {
  const coreRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (!coreRef.current) return;

    coreRef.current.rotation.y = t * 0.8;
    coreRef.current.rotation.x = Math.sin(t * 0.9) * 0.4;
  });

  const isSym = alignment === 'Symbiotic';

  return (
    <group ref={coreRef}>
      {/* main core shape varies by alignment */}
      {isSym ? (
        <Sphere args={[0.32, 32, 32]}>
          <meshStandardMaterial
            color={palette.accent}
            emissive={palette.accent}
            emissiveIntensity={1.1}
            transparent
            opacity={0.9}
            roughness={0.2}
            metalness={0.6}
            blending={THREE.AdditiveBlending}
          />
        </Sphere>
      ) : (
        <RoundedBox args={[0.42, 0.42, 0.42]} radius={0.16} smoothness={5}>
          <meshStandardMaterial
            color={palette.accent}
            emissive={palette.accent}
            emissiveIntensity={1.2}
            transparent
            opacity={0.95}
            roughness={0.2}
            metalness={0.7}
            blending={THREE.AdditiveBlending}
          />
        </RoundedBox>
      )}

      {/* inner DNA / tech spiral – more complex for Neural* mutations */}
      <Helix
        color={palette.accent}
        dense={
          mutation === 'Neural-Linker' ||
          mutation === 'Neural-Decay'
        }
      />

      {/* outer cyber rings */}
      <FieldRings color={palette.glow} aggressive={alignment === 'Parasitic'} />
    </group>
  );
}

/* ---------------- HELIX / FIELD RINGS ---------------- */

function Helix({ color, dense }: { color: string; dense: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (!groupRef.current) return;
    groupRef.current.rotation.y = -t * 0.9;
  });

  const beads: React.ReactElement[] = [];
  const turns = dense ? 3.0 : 2.0;
  const segments = dense ? 40 : 28;

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

function FieldRings({ color, aggressive }: { color: string; aggressive: boolean }) {
  const r1 = useRef<THREE.Mesh>(null);
  const r2 = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (r1.current) {
      r1.current.rotation.y = t * (aggressive ? 0.6 : 0.4);
      r1.current.rotation.x = Math.sin(t * 0.3) * 0.4;
    }
    if (r2.current) {
      r2.current.rotation.y = -t * (aggressive ? 0.5 : 0.35);
      r2.current.rotation.z = Math.cos(t * 0.27) * 0.4;
    }
  });

  return (
    <group>
      <Torus ref={r1} args={[0.55, 0.02, 16, 64]}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
        />
      </Torus>
      <Torus ref={r2} args={[0.75, 0.015, 16, 64]}>
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
