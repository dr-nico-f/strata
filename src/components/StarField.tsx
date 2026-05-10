import type { Map as MaplibreMap } from "maplibre-gl";
import { useEffect, useRef } from "react";
import { useStore } from "../store";
import { subscribeMapInstance } from "../utils/mapInstance";

/**
 * Fixed-position starfield canvas that sits behind the MapLibre canvas in
 * globe projection. The globe renders transparent outside the planet's
 * silhouette, so painting deep-space here gives you stars + nebulae behind
 * the Earth instead of the dark UI background colour.
 *
 * Implementation notes:
 * - Pure canvas, drawn on rAF while globe is active, then teared down.
 * - Stars are scattered with a deterministic Mulberry32 PRNG so the layout
 *   is stable across re-renders, theme swaps, and HMR.
 * - The canvas is intentionally larger than the viewport (120% × 120%) so
 *   parallax translation never reveals an empty edge.
 * - A subset of stars twinkle slowly. Skipped under prefers-reduced-motion.
 * - Subtle parallax: the canvas drifts opposite to camera longitude/latitude
 *   so the stars feel "out there" instead of pinned to the screen.
 * - One meteor every ~25-35s draws a tapered streak across the sky.
 * - Returns null when projection !== "globe", so flat mode pays nothing.
 */
export function StarField() {
  const projection = useStore((s) => s.projection);
  const theme = useStore((s) => s.theme);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (projection !== "globe") return;
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const ctxEl = canvasEl.getContext("2d");
    if (!ctxEl) return;
    // Capture as non-null locals so TS keeps the narrowing inside the
    // resize/paint closures and the rAF loop below.
    const canvas: HTMLCanvasElement = canvasEl;
    const ctx: CanvasRenderingContext2D = ctxEl;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // Canvas is rendered larger than the viewport so parallax translation
    // can pan the stars without exposing empty edges. ±10% of viewport
    // each side gives plenty of room for the ±90px parallax range.
    const OVERSIZE = 1.2;

    type Star = {
      x: number;
      y: number;
      r: number;
      a: number;
      tint: string;
      twinkle: boolean;
      twinklePhase: number;
      twinkleSpeed: number;
    };
    type Meteor = {
      startTime: number;
      duration: number;
      x0: number;
      y0: number;
      dx: number;
      dy: number;
      length: number;
      tint: string;
    };
    let stars: Star[] = [];
    let nebulae: Array<{
      x: number;
      y: number;
      r: number;
      color: string;
    }> = [];
    let meteors: Meteor[] = [];
    let dpr = 1;
    // Logical (CSS) dimensions of the oversized canvas.
    let cssW = 0;
    let cssH = 0;

    // Live parallax offsets driven by the map camera. The canvas's CSS
    // transform reads these — we don't repaint the bitmap on every camera
    // frame; we just translate the element.
    let parallaxX = 0;
    let parallaxY = 0;
    // Anchor camera state so parallax is relative to wherever the user
    // entered globe mode. Avoids a sudden jump on first paint.
    let lngAnchor: number | null = null;
    let latAnchor: number | null = null;

    /** Mulberry32 PRNG for stable scatter. */
    const rng = (() => {
      let t = 0x9e3779b9;
      return () => {
        t += 0x6d2b79f5;
        let r = t;
        r = Math.imul(r ^ (r >>> 15), r | 1);
        r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
      };
    })();

    function build(): void {
      stars = [];
      nebulae = [];
      // Star count scales with viewport area but is capped — a 4K display
      // shouldn't fire 4× the GPU work of a laptop.
      const area = cssW * cssH;
      const count = Math.min(900, Math.max(280, Math.round(area / 2200)));
      for (let i = 0; i < count; i++) {
        const tintRoll = rng();
        // ~80% white, 12% warm yellow, 8% cool blue — mimics realistic
        // stellar colour distribution at low cost.
        const tint =
          tintRoll < 0.8
            ? "rgba(255, 255, 255, "
            : tintRoll < 0.92
              ? "rgba(255, 230, 180, "
              : "rgba(170, 200, 255, ";
        const twinkle = rng() < 0.07;
        stars.push({
          x: rng() * cssW,
          y: rng() * cssH,
          r: 0.4 + Math.pow(rng(), 3) * 1.9,
          a: 0.35 + rng() * 0.6,
          tint,
          twinkle,
          twinklePhase: rng() * Math.PI * 2,
          twinkleSpeed: 0.0006 + rng() * 0.0011,
        });
      }
      // A handful of soft nebula blobs in cool tones for depth.
      const nebulaPalette = [
        "rgba(86, 60, 160, 0.16)",
        "rgba(40, 90, 170, 0.13)",
        "rgba(180, 60, 140, 0.10)",
        "rgba(60, 110, 180, 0.10)",
      ];
      const nebulaCount = 4;
      for (let i = 0; i < nebulaCount; i++) {
        nebulae.push({
          x: rng() * cssW,
          y: rng() * cssH,
          r: Math.min(cssW, cssH) * (0.35 + rng() * 0.25),
          color: nebulaPalette[i % nebulaPalette.length],
        });
      }
    }

    function spawnMeteor(now: number): void {
      // Random direction biased toward diagonal travel; longer streaks
      // (200-360px) at slightly varied tints.
      const angle = (rng() * 0.7 + 0.15) * Math.PI; // 0.15π..0.85π
      const length = 200 + rng() * 160;
      // Start somewhere in the upper half + 30% off either edge so the
      // streak begins or ends just outside the visible area.
      const x0 = (rng() * 1.4 - 0.2) * cssW;
      const y0 = rng() * cssH * 0.55;
      const dx = Math.cos(angle) * length * (rng() < 0.5 ? -1 : 1);
      const dy = Math.sin(angle) * length;
      const tints = ["rgba(255, 240, 200,", "rgba(190, 220, 255,", "rgba(255, 220, 180,"];
      meteors.push({
        startTime: now,
        duration: 700 + rng() * 350,
        x0,
        y0,
        dx,
        dy,
        length,
        tint: tints[Math.floor(rng() * tints.length)],
      });
    }

    /**
     * Schedule the next meteor 25-35s out. Re-arms itself recursively while
     * the effect is active. On `prefers-reduced-motion` we skip meteors
     * entirely (still scenic, but motionless).
     */
    let meteorTimer: number | null = null;
    function scheduleNextMeteor(): void {
      if (reduceMotion) return;
      const delay = 25_000 + Math.random() * 10_000;
      meteorTimer = window.setTimeout(() => {
        spawnMeteor(performance.now());
        scheduleNextMeteor();
      }, delay);
    }

    function paint(time: number): void {
      ctx.clearRect(0, 0, cssW * dpr, cssH * dpr);

      // Faint vertical gradient — slightly lighter at the top, deeper at
      // the bottom — so the starfield doesn't read as a flat black wash.
      const bg = ctx.createLinearGradient(0, 0, 0, cssH * dpr);
      // Light theme gets a much paler space (so the globe still looks
      // anchored against a bright UI), but keeps the same star scatter.
      if (theme === "light") {
        bg.addColorStop(0, "#cdd6e4");
        bg.addColorStop(1, "#aab4c6");
      } else if (theme === "sepia") {
        bg.addColorStop(0, "#1a120a");
        bg.addColorStop(1, "#0c0805");
      } else {
        bg.addColorStop(0, "#0a1020");
        bg.addColorStop(1, "#03060d");
      }
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cssW * dpr, cssH * dpr);

      // Nebulae: large soft radial blobs. Skipped on light theme because
      // they read as smudges on a pale background.
      if (theme !== "light") {
        for (const n of nebulae) {
          const grad = ctx.createRadialGradient(
            n.x * dpr,
            n.y * dpr,
            0,
            n.x * dpr,
            n.y * dpr,
            n.r * dpr,
          );
          grad.addColorStop(0, n.color);
          grad.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, cssW * dpr, cssH * dpr);
        }
      }

      // Stars
      for (const s of stars) {
        let alpha = s.a;
        if (s.twinkle && !reduceMotion) {
          alpha *= 0.55 + 0.45 * Math.sin(s.twinklePhase + time * s.twinkleSpeed);
        }
        // Light theme: invert star colour so they read against the pale sky.
        const color =
          theme === "light"
            ? `rgba(40, 60, 100, ${alpha.toFixed(3)})`
            : `${s.tint}${alpha.toFixed(3)})`;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(s.x * dpr, s.y * dpr, s.r * dpr, 0, Math.PI * 2);
        ctx.fill();
      }

      // Meteors: tapered streak with a bright head. Drop expired ones.
      if (meteors.length > 0) {
        meteors = meteors.filter((m) => time - m.startTime <= m.duration);
        for (const m of meteors) {
          const t = (time - m.startTime) / m.duration; // 0..1
          // Head travels along the direction; the streak trails behind it.
          const headX = (m.x0 + m.dx * t) * dpr;
          const headY = (m.y0 + m.dy * t) * dpr;
          const tailX = (m.x0 + m.dx * Math.max(0, t - 0.25)) * dpr;
          const tailY = (m.y0 + m.dy * Math.max(0, t - 0.25)) * dpr;
          // Fade-in / fade-out envelope so the streak doesn't pop.
          const env =
            Math.sin(Math.min(1, t / 0.3) * Math.PI * 0.5) *
            Math.sin(Math.min(1, (1 - t) / 0.4) * Math.PI * 0.5);
          if (env <= 0) continue;
          const grad = ctx.createLinearGradient(tailX, tailY, headX, headY);
          grad.addColorStop(0, `${m.tint} 0)`);
          grad.addColorStop(1, `${m.tint} ${(0.85 * env).toFixed(3)})`);
          ctx.strokeStyle = grad;
          ctx.lineCap = "round";
          ctx.lineWidth = Math.max(1, 1.6 * dpr);
          ctx.beginPath();
          ctx.moveTo(tailX, tailY);
          ctx.lineTo(headX, headY);
          ctx.stroke();
          // Bright head dot
          ctx.fillStyle = `${m.tint} ${env.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(headX, headY, Math.max(1.4, 1.8 * dpr), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    function applyParallax(): void {
      // Translate the (oversized) canvas via CSS so the bitmap doesn't
      // re-paint on every camera frame. Negative on lng so the stars drift
      // *opposite* the planet, selling depth.
      const overflowX = (cssW - window.innerWidth) / 2;
      const overflowY = (cssH - window.innerHeight) / 2;
      // Center the oversized canvas, then offset by parallax (clamped
      // within the available overflow margin).
      const tx = -overflowX + Math.max(-overflowX, Math.min(overflowX, parallaxX));
      const ty = -overflowY + Math.max(-overflowY, Math.min(overflowY, parallaxY));
      canvas.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`;
    }

    function resize(): void {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cssW = window.innerWidth * OVERSIZE;
      cssH = window.innerHeight * OVERSIZE;
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      build();
      applyParallax();
      paint(performance.now());
    }

    resize();
    window.addEventListener("resize", resize);

    // Hook up parallax to the active MapLibre instance. We only listen for
    // camera moves while a globe-mode map is mounted.
    let activeMap: MaplibreMap | null = null;
    const updateFromCamera = () => {
      if (!activeMap) return;
      const c = activeMap.getCenter();
      if (lngAnchor === null || latAnchor === null) {
        lngAnchor = c.lng;
        latAnchor = c.lat;
        return;
      }
      // Wrap lng diff to -180..180 so a 359 → 1 spin doesn't whip the
      // stars across the screen.
      let dLng = c.lng - lngAnchor;
      if (dLng > 180) dLng -= 360;
      if (dLng < -180) dLng += 360;
      const dLat = c.lat - latAnchor;
      // Tunable strengths. The parallax range is bounded by the canvas
      // overflow margin, so these are upper bounds.
      parallaxX = -dLng * 0.6; // ~ ±100px end-to-end at full spin
      parallaxY = -dLat * 0.45;
      applyParallax();
    };
    const detach = (m: MaplibreMap | null) => {
      if (!m) return;
      m.off("move", updateFromCamera);
      m.off("zoom", updateFromCamera);
    };
    const unsubMap = subscribeMapInstance((m) => {
      detach(activeMap);
      activeMap = m;
      lngAnchor = null;
      latAnchor = null;
      if (!m) return;
      m.on("move", updateFromCamera);
      m.on("zoom", updateFromCamera);
      updateFromCamera();
    });

    // Schedule meteors. Fire one a few seconds in so users get an early
    // payoff, then settle into the 25-35s cadence.
    let firstMeteorTimer: number | null = null;
    if (!reduceMotion) {
      firstMeteorTimer = window.setTimeout(
        () => {
          spawnMeteor(performance.now());
          scheduleNextMeteor();
        },
        4_000 + Math.random() * 4_000,
      );
    }

    // Always-on rAF loop in globe mode: drives twinkles + meteor animation.
    // Cheap — a few hundred fillRect/arc calls per frame.
    const tick = (t: number) => {
      paint(t);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (meteorTimer !== null) {
        clearTimeout(meteorTimer);
        meteorTimer = null;
      }
      if (firstMeteorTimer !== null) {
        clearTimeout(firstMeteorTimer);
      }
      detach(activeMap);
      unsubMap();
    };
  }, [projection, theme]);

  if (projection !== "globe") return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        // The canvas itself is sized to 120% × 120% via JS; the inline
        // top/left stays at 0 and our applyParallax() translate3d centers
        // and offsets it within the viewport.
        top: 0,
        left: 0,
        pointerEvents: "none",
        zIndex: 0,
        willChange: "transform",
      }}
    />
  );
}
