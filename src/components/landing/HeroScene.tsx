/* eslint-disable */
// @ts-nocheck — partner's Three.js scene; keep loose during the backend rebuild
'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface HeroSceneProps {
  scrollProgress: number;
}

export default function HeroScene({ scrollProgress }: HeroSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const scrollRef = useRef(scrollProgress);

  useEffect(() => {
    scrollRef.current = scrollProgress;
  }, [scrollProgress]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const parent = canvas.parentElement!;
    const getSize = () => ({ w: parent.clientWidth, h: parent.clientHeight });
    let { w, h } = getSize();

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    camera.position.z = 14;

    const NODE_COUNT = 38;
    const merged = new Set([5, 14, 22]);

    interface NodeData {
      origin: THREE.Vector3;
      phase: number;
      speed: number;
      amplitude: number;
      isMerged: boolean;
    }

    const nodes: Array<THREE.Mesh & { nodeData: NodeData }> = [];

    for (let i = 0; i < NODE_COUNT; i++) {
      const lane = Math.floor(Math.random() * 5) - 2;
      const x = (Math.random() - 0.5) * 14;
      const y = lane * 1.6 + (Math.random() - 0.5) * 1.2;
      const z = (Math.random() - 0.5) * 6;
      const isMerged = merged.has(i);
      const size = isMerged ? 0.12 : 0.06 + Math.random() * 0.05;
      const geom = new THREE.SphereGeometry(size, 16, 16);
      const color = new THREE.Color(isMerged ? '#16a34a' : '#c8c4bb');
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: isMerged ? 1 : 0.55 + Math.random() * 0.3,
      });
      const mesh = new THREE.Mesh(geom, mat) as unknown as THREE.Mesh & { nodeData: NodeData };
      mesh.position.set(x, y, z);
      mesh.nodeData = {
        origin: new THREE.Vector3(x, y, z),
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.5,
        amplitude: 0.05 + Math.random() * 0.08,
        isMerged,
      };
      scene.add(mesh);
      nodes.push(mesh);
    }

    const lineMat = new THREE.LineBasicMaterial({ color: 0xddd9d0, transparent: true, opacity: 0.28 });
    const greenLineMat = new THREE.LineBasicMaterial({ color: 0x16a34a, transparent: true, opacity: 0.45 });

    interface LineData { a: typeof nodes[number]; b: typeof nodes[number]; }
    const lines: Array<THREE.Line & { lineData: LineData }> = [];

    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      const nearest = nodes
        .map((b, j) => ({ j, d: i === j ? Infinity : a.position.distanceTo(b.position) }))
        .sort((p, q) => p.d - q.d)
        .slice(0, 2);
      for (const { j, d } of nearest) {
        if (d > 5) continue;
        const b = nodes[j];
        const isGreen = a.nodeData.isMerged && b.nodeData.isMerged;
        const geo = new THREE.BufferGeometry().setFromPoints([a.position.clone(), b.position.clone()]);
        const line = new THREE.Line(geo, isGreen ? greenLineMat : lineMat) as unknown as THREE.Line & { lineData: LineData };
        line.lineData = { a, b };
        scene.add(line);
        lines.push(line);
      }
    }

    const onMouse = (e: MouseEvent) => {
      const rect = parent.getBoundingClientRect();
      mouseRef.current.targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      mouseRef.current.targetY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMouse);

    const onResize = () => {
      const s = getSize();
      w = s.w; h = s.h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    let rafId: number;
    const center = new THREE.Vector3(0, 0, 0);

    const tick = () => {
      const t = clock.getElapsedTime();
      const m = mouseRef.current;
      m.x += (m.targetX - m.x) * 0.04;
      m.y += (m.targetY - m.y) * 0.04;

      const conv = Math.min(1, Math.max(0, scrollRef.current)) * 0.45;

      for (const node of nodes) {
        const d = node.nodeData;
        const o = d.origin;
        const drift = Math.sin(t * d.speed + d.phase) * d.amplitude;
        const driftY = Math.cos(t * d.speed * 0.7 + d.phase) * d.amplitude;
        node.position.x = o.x * (1 - conv) + center.x * conv + drift - m.x * 0.3;
        node.position.y = o.y * (1 - conv) + center.y * conv + driftY + m.y * 0.3;
        node.position.z = o.z * (1 - conv) + center.z * conv;
      }

      for (const line of lines) {
        const { a, b } = line.lineData;
        const pos = line.geometry.attributes.position as THREE.BufferAttribute;
        const arr = pos.array as Float32Array;
        arr[0] = a.position.x; arr[1] = a.position.y; arr[2] = a.position.z;
        arr[3] = b.position.x; arr[4] = b.position.y; arr[5] = b.position.z;
        pos.needsUpdate = true;
      }

      camera.position.x = -m.x * 0.4;
      camera.position.y = m.y * 0.4;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('resize', onResize);
      for (const n of nodes) {
        n.geometry.dispose();
        (n.material as THREE.Material).dispose();
      }
      for (const l of lines) l.geometry.dispose();
      lineMat.dispose();
      greenLineMat.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="hero-canvas" />;
}
