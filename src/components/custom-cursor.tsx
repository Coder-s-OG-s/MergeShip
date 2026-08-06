'use client';

import { useEffect, useRef } from 'react';

// Elements that should trigger the "hovering something interactive" cursor state.
const HOVER_SELECTOR =
  'a, button, input, textarea, select, [role="button"], [data-cursor-hover], label';

export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const ring = useRef({ x: 0, y: 0 });
  const rafId = useRef<number>();

  useEffect(() => {
    // Devices with no precise pointer (touch/tablets) get the normal browser cursor —
    // a custom cursor doesn't make sense when there's no mouse to move it.
    const isTouchDevice =
      typeof window !== 'undefined' &&
      (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
    if (isTouchDevice) return;

    document.body.classList.add('custom-cursor-active');

    const onMouseMove = (e: MouseEvent) => {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
        dotRef.current.style.opacity = '1';
      }
      if (ringRef.current) {
        ringRef.current.style.opacity = '1';
      }
    };

    const onMouseDown = () => ringRef.current?.classList.add('cursor-clicking');
    const onMouseUp = () => ringRef.current?.classList.remove('cursor-clicking');

    const onMouseOver = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(HOVER_SELECTOR)) {
        ringRef.current?.classList.add('cursor-hovering');
      }
    };
    const onMouseOut = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(HOVER_SELECTOR)) {
        ringRef.current?.classList.remove('cursor-hovering');
      }
    };

    // The dot follows the mouse exactly (set directly in onMouseMove above).
    // The ring trails behind with a bit of lag, animated on its own loop for smoothness.
    const animateRing = () => {
      ring.current.x += (mouse.current.x - ring.current.x) * 0.2;
      ring.current.y += (mouse.current.y - ring.current.y) * 0.2;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ring.current.x}px, ${ring.current.y}px, 0) translate(-50%, -50%)`;
      }
      rafId.current = requestAnimationFrame(animateRing);
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mouseover', onMouseOver);
    document.addEventListener('mouseout', onMouseOut);
    rafId.current = requestAnimationFrame(animateRing);

    return () => {
      document.body.classList.remove('custom-cursor-active');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('mouseover', onMouseOver);
      document.removeEventListener('mouseout', onMouseOut);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    <>
      <div
        ref={dotRef}
        aria-hidden="true"
        className="custom-cursor-dot"
        style={{ transform: 'translate3d(-100px, -100px, 0)', opacity: 0 }}
      />
      <div
        ref={ringRef}
        aria-hidden="true"
        className="custom-cursor-ring"
        style={{ transform: 'translate3d(-100px, -100px, 0)', opacity: 0 }}
      />
    </>
  );
}