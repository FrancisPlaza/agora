"use client";

import { useEffect, useRef } from "react";

/**
 * Landing-page hero background. Canvas 2D animation, Variant A from the
 * Claude Design spec: a drifting constellation of navy dots with two
 * amber accents, connected by faint violet edges, that slowly morphs
 * into 4-5 concentric oval rings (the "assembly" form) on a ~38s cycle
 * before dissolving back into drift.
 *
 * - 30fps cap via timestamp throttling in the rAF loop.
 * - IntersectionObserver pauses when the hero scrolls out of view.
 * - visibilitychange pauses on tab hidden.
 * - prefers-reduced-motion: reduce → single static assembly frame, no rAF.
 *
 * Decorative; aria-hidden, no pointer events. No props for v1.
 */
export function HeroAnimation() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const wrapperMaybe = wrapperRef.current;
    const canvasMaybe = canvasRef.current;
    if (!wrapperMaybe || !canvasMaybe) return;
    const ctxMaybe = canvasMaybe.getContext("2d");
    if (!ctxMaybe) return;
    // Re-bind with non-null types so the narrowing survives into the
    // closures below (TS widens captured locals in callbacks otherwise).
    const wrapper: HTMLDivElement = wrapperMaybe;
    const canvas: HTMLCanvasElement = canvasMaybe;
    const ctx: CanvasRenderingContext2D = ctxMaybe;

    // ── Phase budget (ms). 38s cycle, drift dominates. ──────────────────
    const PHASES = {
      drift: 26000,
      morphIn: 3000,
      assembly: 6000,
      morphOut: 3000,
    } as const;
    const CYCLE =
      PHASES.drift + PHASES.morphIn + PHASES.assembly + PHASES.morphOut;

    // ── Easing ──────────────────────────────────────────────────────────
    const easeInOut = (t: number) =>
      t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    // ── Mutable scene state ─────────────────────────────────────────────
    interface Dot {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      seed: number;
      bx: number; // drift base, used while morphing toward assembly
      by: number;
    }
    interface Target {
      x: number;
      y: number;
      ring: number;
    }

    let dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = 0;
    let h = 0;
    let dots: Dot[] = [];
    let amberIndices: number[] = [];
    let targets: Target[] = [];
    let lastFrame = 0;
    const cycleStart = performance.now();
    let visible = true;
    let docVisible = !document.hidden;
    let rafId: number | null = null;

    const reduceMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduce = reduceMq.matches;

    // ── Builders ────────────────────────────────────────────────────────
    function densityFor(width: number): number {
      // 30 dots at 380px → 60 at 1280px+, clamped.
      const t = Math.max(0, Math.min(1, (width - 380) / (1280 - 380)));
      return Math.round(30 + t * 30);
    }

    function makeDot(cw: number, ch: number): Dot {
      const speed = 4 + Math.random() * 6;
      const angle = Math.random() * Math.PI * 2;
      return {
        x: Math.random() * cw,
        y: Math.random() * ch,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 2.3 + Math.random() * 0.5,
        seed: Math.random() * 1000,
        bx: 0,
        by: 0,
      };
    }

    function buildAssembly(count: number, cw: number, ch: number): Target[] {
      // 4-5 concentric ovals (4 on narrow viewports). Distribute dots
      // proportionally to ring circumference so outer rings get more.
      const cx = cw / 2;
      const cy = ch / 2;
      const rings = cw < 600 ? 4 : 5;
      const aspect = 1.45; // wider than tall
      const baseR = Math.min(cw, ch) * (cw < 600 ? 0.18 : 0.12);
      const stepR = Math.min(cw, ch) * (cw < 600 ? 0.085 : 0.08);
      const circs: number[] = [];
      for (let r = 0; r < rings; r++) circs.push(baseR + r * stepR);
      const totalC = circs.reduce((a, c) => a + c, 0);
      let assigned = 0;
      const perRing = circs.map((c, i) => {
        const n =
          i === rings - 1
            ? count - assigned
            : Math.round((count * c) / totalC);
        assigned += n;
        return n;
      });
      const out: Target[] = [];
      perRing.forEach((n, ri) => {
        const r = circs[ri];
        const offset = (ri % 2) * (Math.PI / Math.max(n, 1));
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + offset;
          out.push({
            x: cx + Math.cos(a) * r * aspect,
            y: cy + Math.sin(a) * r,
            ring: ri,
          });
        }
      });
      return out.slice(0, count);
    }

    function resize() {
      const rect = wrapper.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      w = rect.width;
      h = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const N = densityFor(w);
      if (dots.length !== N) {
        dots = [];
        for (let i = 0; i < N; i++) dots.push(makeDot(w, h));
        // Two stable amber indices.
        amberIndices = [Math.floor(N * 0.22), Math.floor(N * 0.71)];
      } else {
        // Re-clamp positions if the canvas shrank.
        for (const d of dots) {
          d.x = Math.max(8, Math.min(w - 8, d.x));
          d.y = Math.max(8, Math.min(h - 8, d.y));
          d.bx = d.x;
          d.by = d.y;
        }
      }
      targets = buildAssembly(dots.length, w, h);
    }

    // ── Phase clock ─────────────────────────────────────────────────────
    function phase(now: number): { name: keyof typeof PHASES; p: number } {
      const x = (((now - cycleStart) % CYCLE) + CYCLE) % CYCLE;
      let acc = 0;
      for (const name of [
        "drift",
        "morphIn",
        "assembly",
        "morphOut",
      ] as const) {
        const dur = PHASES[name];
        if (x < acc + dur) return { name, p: (x - acc) / dur };
        acc += dur;
      }
      return { name: "drift", p: 0 };
    }

    // ── Per-frame ───────────────────────────────────────────────────────
    function step(now: number) {
      if (!visible || !docVisible) {
        rafId = null;
        return;
      }
      // Cap to ~30fps. The first frame after a pause has lastFrame=0 from
      // either init or the previous bail; the > 33ms gate naturally lets
      // it through.
      if (now - lastFrame < 33) {
        rafId = requestAnimationFrame(step);
        return;
      }
      const dt = Math.min(0.1, (now - lastFrame) / 1000) || 0.033;
      lastFrame = now;

      // Drift physics — applied always, even when amt=1, so the
      // underlying constellation never freezes weirdly.
      for (const d of dots) {
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (d.x < 6) {
          d.x = 6;
          d.vx = Math.abs(d.vx) + (Math.random() - 0.5);
        }
        if (d.x > w - 6) {
          d.x = w - 6;
          d.vx = -Math.abs(d.vx) + (Math.random() - 0.5);
        }
        if (d.y < 6) {
          d.y = 6;
          d.vy = Math.abs(d.vy) + (Math.random() - 0.5);
        }
        if (d.y > h - 6) {
          d.y = h - 6;
          d.vy = -Math.abs(d.vy) + (Math.random() - 0.5);
        }
        // tiny meandering so it never looks billiard-ball
        d.vx += (Math.random() - 0.5) * 1.0 * dt;
        d.vy += (Math.random() - 0.5) * 1.0 * dt;
        const sp = Math.hypot(d.vx, d.vy);
        const max = 12;
        if (sp > max) {
          d.vx *= max / sp;
          d.vy *= max / sp;
        }
        d.bx = d.x;
        d.by = d.y;
      }
      // Amber accents hold position (zero velocity).
      for (const i of amberIndices) {
        const d = dots[i];
        if (d) {
          d.vx = 0;
          d.vy = 0;
        }
      }

      const ph = phase(now);
      let amt = 0;
      if (ph.name === "morphIn") amt = easeInOut(ph.p);
      else if (ph.name === "assembly") amt = 1;
      else if (ph.name === "morphOut") amt = easeInOut(1 - ph.p);
      // drift: amt stays 0

      draw(amt);
      rafId = requestAnimationFrame(step);
    }

    function draw(amt: number) {
      ctx.clearRect(0, 0, w, h);

      // Lerp drift → assembly target by amt.
      const drawPos: Array<{ x: number; y: number }> = dots.map((d, i) => {
        const t = targets[i];
        if (!t) return { x: d.bx, y: d.by };
        return {
          x: d.bx + (t.x - d.bx) * amt,
          y: d.by + (t.y - d.by) * amt,
        };
      });

      // Connection lines: nearest-neighbour, faded by distance.
      const maxDist = Math.max(70, Math.min(140, w * 0.1));
      ctx.lineWidth = 0.5;
      for (let i = 0; i < drawPos.length; i++) {
        for (let j = i + 1; j < drawPos.length; j++) {
          const a = drawPos[i];
          const b = drawPos[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dd = Math.hypot(dx, dy);
          if (dd < maxDist) {
            const fade = 1 - dd / maxDist;
            const alpha = fade * 0.18 * (0.4 + 0.6 * (1 - amt * 0.4));
            ctx.strokeStyle = `rgba(99, 91, 255, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Dots.
      for (let i = 0; i < drawPos.length; i++) {
        const p = drawPos[i];
        const isAmber = amberIndices.includes(i);
        if (isAmber) {
          ctx.fillStyle = "rgba(184, 134, 11, 0.65)";
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3.4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const a = 0.32 + 0.08 * Math.sin(dots[i].seed);
          ctx.fillStyle = `rgba(10, 37, 64, ${a})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, dots[i].r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    function paintStaticAssembly() {
      // For reduced motion: snap every dot to its assembly target, paint
      // one frame, no rAF loop.
      for (let i = 0; i < dots.length; i++) {
        const t = targets[i];
        if (!t) continue;
        dots[i].x = t.x;
        dots[i].y = t.y;
        dots[i].bx = t.x;
        dots[i].by = t.y;
        dots[i].vx = 0;
        dots[i].vy = 0;
      }
      draw(1);
    }

    function maybeStart() {
      if (rafId != null) return;
      if (!visible || !docVisible || reduce) return;
      lastFrame = performance.now();
      rafId = requestAnimationFrame(step);
    }
    function stopLoop() {
      if (rafId != null) cancelAnimationFrame(rafId);
      rafId = null;
    }

    // ── Wire observers ─────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      resize();
      if (reduce) paintStaticAssembly();
    });
    ro.observe(wrapper);

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible = e.isIntersecting;
        if (visible) maybeStart();
        else stopLoop();
      },
      { threshold: 0.05 },
    );
    io.observe(wrapper);

    function onVis() {
      docVisible = !document.hidden;
      if (docVisible) maybeStart();
      else stopLoop();
    }
    document.addEventListener("visibilitychange", onVis);

    function onReduceChange(e: MediaQueryListEvent) {
      reduce = e.matches;
      if (reduce) {
        stopLoop();
        paintStaticAssembly();
      } else {
        maybeStart();
      }
    }
    reduceMq.addEventListener("change", onReduceChange);

    // ── First paint ─────────────────────────────────────────────────────
    resize();
    if (reduce) paintStaticAssembly();
    else maybeStart();

    return () => {
      stopLoop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      reduceMq.removeEventListener("change", onReduceChange);
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      aria-hidden
      className="absolute inset-0 pointer-events-none"
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}
