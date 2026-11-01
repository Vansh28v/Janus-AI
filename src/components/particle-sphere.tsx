
"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";

/* =========================================
   OBSIDIAN / CHAMPAGNE GOLD PARTICLE SHADERS
========================================= */

const vertexShader = `
uniform float uTime;
uniform vec2 uMouse;

attribute float aSize;
attribute float aTone;

varying float vTone;
varying float vAlpha;

void main() {
  vec3 p = position;

  float mouseDistance = distance(p.xy, uMouse);

  float ripple =
    sin(mouseDistance * 17.0 - uTime * 4.0)
    * exp(-mouseDistance * 1.4)
    * 0.105;

  float ambientWave =
    sin(p.x * 4.0 + p.y * 3.5 + uTime * 0.8)
    * 0.014;

  float vibration =
    sin(p.z * 7.0 - uTime * 1.5)
    * 0.008;

  p += normalize(position) *
    (ripple + ambientWave + vibration);

  float angle = uTime * 0.035;
  float c = cos(angle);
  float s = sin(angle);

  p.xz = mat2(c, -s, s, c) * p.xz;

  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);

  gl_Position = projectionMatrix * mvPosition;

  gl_PointSize = aSize * (440.0 / -mvPosition.z);

  vTone = aTone;

  vAlpha = mix(
    0.78,
    1.0,
    smoothstep(-1.4, 1.4, position.z)
  );
}
`;

const fragmentShader = `
varying float vTone;
varying float vAlpha;

void main() {
  vec2 center = gl_PointCoord - vec2(0.5);
  float d = length(center);

  if (d > 0.5) discard;

  float glow = 1.0 - smoothstep(0.05, 0.5, d);

  vec3 darkBronze = vec3(0.20, 0.12, 0.055);
  vec3 antiqueGold = vec3(0.48, 0.32, 0.12);
  vec3 metallicGold = vec3(0.76, 0.56, 0.25);
  vec3 champagneGold = vec3(1.0, 0.83, 0.53);

  vec3 color = mix(darkBronze, antiqueGold, vTone);
  color = mix(color, metallicGold, smoothstep(0.25, 0.85, vTone));
  color = mix(color, champagneGold, glow * 0.42);

  gl_FragColor = vec4(color, glow * vAlpha * 0.98);
}
`;

/* =========================================
   GOLD NETWORK NODE SHADERS
========================================= */

const nodeVertexShader = `
uniform float uTime;

attribute float aSize;

varying float vAlpha;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

  gl_Position = projectionMatrix * mvPosition;

  gl_PointSize = aSize * (300.0 / -mvPosition.z);

  vAlpha = 0.82 + 0.18 *
    sin(uTime * 1.4 + position.x * 5.0);
}
`;

const nodeFragmentShader = `
uniform vec3 uColor;

varying float vAlpha;

void main() {
  vec2 center = gl_PointCoord - vec2(0.5);
  float d = length(center);

  if (d > 0.5) discard;

  float glow = 1.0 - smoothstep(0.12, 0.5, d);

  gl_FragColor = vec4(
    uColor,
    glow * vAlpha * 0.98
  );
}
`;

function createDotMaterial(color: string) {
  return new THREE.ShaderMaterial({
    vertexShader: nodeVertexShader,
    fragmentShader: nodeFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/* =========================================
   SPHERICAL POWER NETWORK
========================================= */

function createNetwork() {
  const count = 120;
  const radius = 1.55;

  const positions: THREE.Vector3[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = goldenAngle * i;

    positions.push(
      new THREE.Vector3(
        Math.cos(theta) * r * radius,
        y * radius,
        Math.sin(theta) * r * radius
      )
    );
  }

  const edges: number[] = [];
  const edgeSet = new Set<string>();

  positions.forEach((point, i) => {
    const nearest = positions
      .map((other, j) => ({
        index: j,
        distance: point.distanceTo(other),
      }))
      .filter((item) => item.index !== i)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 2);

    nearest.forEach(({ index }) => {
      const key = [
        Math.min(i, index),
        Math.max(i, index),
      ].join("-");

      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push(i, index);
      }
    });
  });

  const linePositions: number[] = [];

  edges.forEach((index) => {
    const p = positions[index];
    linePositions.push(p.x, p.y, p.z);
  });

  const lineGeometry = new THREE.BufferGeometry();

  lineGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(linePositions, 3)
  );

  const nodeGeometry = new THREE.BufferGeometry();

  const nodePositions = new Float32Array(count * 3);
  const nodeSizes = new Float32Array(count);

  positions.forEach((p, i) => {
    nodePositions[i * 3] = p.x;
    nodePositions[i * 3 + 1] = p.y;
    nodePositions[i * 3 + 2] = p.z;

    const isHub = i % 15 === 0;

    nodeSizes[i] = isHub ? 0.19 : 0.105;
  });

  nodeGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(nodePositions, 3)
  );

  nodeGeometry.setAttribute(
    "aSize",
    new THREE.BufferAttribute(nodeSizes, 1)
  );

  const pulseEdges: [number, number][] = [];

  for (let i = 0; i < edges.length; i += 2) {
    if (i % 12 === 0) {
      pulseEdges.push([edges[i], edges[i + 1]]);
    }
  }

  return {
    positions,
    pulseEdges,
    nodeGeometry,
    lineGeometry,
  };
}

/* =========================================
   ANIMATED GOLD POWER NETWORK
========================================= */

function PowerNetwork() {
  const groupRef = useRef<THREE.Group>(null);

  const network = useMemo(() => createNetwork(), []);

  const nodeMaterial = useMemo(
    () => createDotMaterial("#C99A48"),
    []
  );

  const pulseMaterial = useMemo(
    () => createDotMaterial("#FFE1A0"),
    []
  );

  const pulseGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();

    const positions = new Float32Array(
      network.pulseEdges.length * 3
    );

    const sizes = new Float32Array(
      network.pulseEdges.length
    );

    sizes.fill(0.22);

    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );

    geometry.setAttribute(
      "aSize",
      new THREE.BufferAttribute(sizes, 1)
    );

    geometry.setDrawRange(0, network.pulseEdges.length);

    return geometry;
  }, [network]);

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;

    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.025;

      groupRef.current.rotation.x =
        Math.sin(time * 0.18) * 0.025;
    }

    nodeMaterial.uniforms.uTime.value = time;
    pulseMaterial.uniforms.uTime.value = time;

    const attribute = pulseGeometry.getAttribute(
      "position"
    ) as THREE.BufferAttribute;

    network.pulseEdges.forEach(([start, end], i) => {
      const a = network.positions[start];
      const b = network.positions[end];

      const progress = (
        time * 0.24 + i * 0.137
      ) % 1;

      attribute.setXYZ(
        i,
        THREE.MathUtils.lerp(a.x, b.x, progress),
        THREE.MathUtils.lerp(a.y, b.y, progress),
        THREE.MathUtils.lerp(a.z, b.z, progress)
      );
    });

    attribute.needsUpdate = true;
  });

  return (
    <group ref={groupRef}>
      {/* Fine golden network connections */}
      <lineSegments
        geometry={network.lineGeometry}
        frustumCulled={false}
      >
        <lineBasicMaterial
          color="#A47A36"
          transparent
          opacity={0.48}
          depthWrite={false}
        />
      </lineSegments>

      {/* Network nodes */}
      <points
        geometry={network.nodeGeometry}
        frustumCulled={false}
      >
        <primitive
          object={nodeMaterial}
          attach="material"
        />
      </points>

      {/* Moving energy pulses */}
      <points
        geometry={pulseGeometry}
        frustumCulled={false}
      >
        <primitive
          object={pulseMaterial}
          attach="material"
        />
      </points>
    </group>
  );
}

/* =========================================
   MAIN GOLD PARTICLE CLOUD
========================================= */

function ParticleCloud() {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const { pointer, viewport } = useThree();

  const geometry = useMemo(() => {
    const count = 16000;
    const radius = 1.55;

    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const tones = new Float32Array(count);

    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = goldenAngle * i;

      const variation =
        1 + (Math.random() - 0.5) * 0.018;

      const x = Math.cos(theta) * r * variation;
      const z = Math.sin(theta) * r * variation;

      positions[i * 3] = x * radius;
      positions[i * 3 + 1] = y * radius;
      positions[i * 3 + 2] = z * radius;

      sizes[i] = 0.033 + Math.random() * 0.024;
      tones[i] = Math.random();
    }

    const geo = new THREE.BufferGeometry();

    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );

    geo.setAttribute(
      "aSize",
      new THREE.BufferAttribute(sizes, 1)
    );

    geo.setAttribute(
      "aTone",
      new THREE.BufferAttribute(tones, 1)
    );

    return geo;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uMouse: {
            value: new THREE.Vector2(5, 5),
          },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
      }),
    []
  );

  useFrame((state, delta) => {
    if (!materialRef.current) return;

    const uniforms = materialRef.current.uniforms;

    uniforms.uTime.value += Math.min(delta, 0.05);

    const target = new THREE.Vector2(
      pointer.x * viewport.width * 0.5,
      pointer.y * viewport.height * 0.5
    );

    uniforms.uMouse.value.lerp(target, 0.06);

    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.025;
    }
  });

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      frustumCulled={false}
    >
      <primitive
        ref={materialRef}
        object={material}
        attach="material"
      />
    </points>
  );
}

/* =========================================
   SCENE
========================================= */

function Scene() {
  return (
    <>
      <ParticleCloud />
      <PowerNetwork />
    </>
  );
}

/* =========================================
   EXPORTED COMPONENT
========================================= */

export default function ParticleSphere() {
  return (
    <div className="particle-sphere">
      <Canvas
        camera={{
          position: [0, 0, 4.85],
          fov: 42,
        }}
        dpr={[1, 1.5]}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
        }}
        style={{
          background: "transparent",
          width: "100%",
          height: "100%",
        }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}

