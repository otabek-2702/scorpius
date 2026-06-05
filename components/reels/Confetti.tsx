"use client";

import { useEffect, useRef } from "react";

/**
 * Inline canvas confetti — no CDN, no deps. A one-shot burst of paper rectangles
 * launched upward from the center-bottom of the panel, integrated under real
 * gravity + air drag in a requestAnimationFrame loop. Each piece spins; the
 * whole burst fades and the canvas tears itself down when the last piece dies.
 *
 * The component renders nothing when `fire` is false or reduced-motion is on.
 * Pointer events pass through (it's an overlay).
 */

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** rotation (rad) + angular velocity */
  rot: number;
  spin: number;
  /** half-width / half-height of the paper rect */
  w: number;
  h: number;
  color: string;
  life: number; // 0..1, drains to 0
}

const GRAVITY = 1400; // px/s²
const DRAG = 0.86; // velocity retained per second-ish (applied as pow(dt))

export function Confetti({
  fire,
  colors,
  reduced,
}: {
  /** Toggling this to true (re)launches a burst. */
  fire: boolean;
  /** Accent palette for the pieces. */
  colors: string[];
  /** When true, render nothing (honors prefers-reduced-motion). */
  reduced: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const piecesRef = useRef<Piece[]>([]);

  useEffect(() => {
    if (!fire || reduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const parent = canvas.parentElement;
    if (!parent) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = parent.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    // Launch a fan of pieces from a point ~62% down the panel.
    const cx = W / 2;
    const cy = H * 0.62;
    const N = 90;
    const pieces: Piece[] = [];
    for (let i = 0; i < N; i++) {
      // Upward fan: angle around -90° (straight up) with spread.
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI * 0.95);
      const speed = 320 + Math.random() * 520;
      pieces.push({
        x: cx + (Math.random() - 0.5) * 40,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 16,
        w: 3 + Math.random() * 4,
        h: 6 + Math.random() * 7,
        color: colors[i % colors.length],
        life: 1,
      });
    }
    piecesRef.current = pieces;

    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.04, (now - last) / 1000);
      last = now;
      const dragFactor = Math.pow(DRAG, dt);

      ctx.clearRect(0, 0, W, H);
      let alive = 0;
      for (const p of pieces) {
        if (p.life <= 0) continue;
        // Integrate (semi-implicit Euler).
        p.vy += GRAVITY * dt;
        p.vx *= dragFactor;
        p.vy *= dragFactor;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.spin * dt;
        // Start fading once the piece is past its peak / drifting down.
        p.life -= dt * 0.42;
        if (p.y > H + 30) p.life = 0;
        if (p.life <= 0) continue;
        alive++;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
        ctx.fillStyle = p.color;
        // Wobble width to fake a fluttering paper edge.
        const wob = Math.cos(p.rot * 2) * 0.5 + 0.5;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w * (0.4 + 0.6 * wob), p.h);
        ctx.restore();
      }

      if (alive > 0) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        ctx.clearRect(0, 0, W, H);
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [fire, reduced, colors]);

  if (reduced) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-30"
    />
  );
}
