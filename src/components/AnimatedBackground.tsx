import { useEffect, useRef } from "react";

type Particle = { x: number; y: number; vx: number; vy: number; radius: number; alpha: number; spark: boolean; phase: number };
type Tracer = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; width: number };

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0;
    let height = 0;
    let frame = 0;
    let lastTime = 0;
    let nextTracerAt = 900 + Math.random() * 900;
    let particles: Particle[] = [];
    const tracers: Tracer[] = [];

    const readPalette = () => {
      const styles = getComputedStyle(document.documentElement);
      return {
        particle: styles.getPropertyValue("--theme-particle-rgb").trim() || "251, 146, 60",
        spark: styles.getPropertyValue("--theme-spark-rgb").trim() || "255, 210, 120",
        tracer: styles.getPropertyValue("--theme-tracer-rgb").trim() || "255, 190, 80",
      };
    };
    let palette = readPalette();
    const themeObserver = new MutationObserver(() => { palette = readPalette(); });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = reducedMotion.matches ? 7 : Math.min(25, Math.max(width < 640 ? 12 : 16, Math.round((width * height) / 85000)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width, y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.34, vy: -(0.12 + Math.random() * 0.32),
        radius: 0.65 + Math.random() * 1.35, alpha: 0.15 + Math.random() * 0.24,
        spark: Math.random() < 0.24, phase: Math.random() * Math.PI * 2,
      }));
    };

    const draw = (time: number) => {
      frame = window.requestAnimationFrame(draw);
      if (document.hidden || time - lastTime < 32) return;
      lastTime = time;
      context.clearRect(0, 0, width, height);
      for (const particle of particles) {
        if (!reducedMotion.matches) {
          particle.x += particle.vx;
          particle.y += particle.vy;
          particle.phase += 0.06;
          if (particle.y < -4) { particle.y = height + 4; particle.x = Math.random() * width; }
          if (particle.x < -4) particle.x = width + 4;
          if (particle.x > width + 4) particle.x = -4;
        }
        context.beginPath();
        const pulse = particle.spark ? 0.7 + Math.sin(particle.phase) * 0.3 : 1;
        context.fillStyle = `rgba(${particle.spark ? palette.spark : palette.particle}, ${particle.alpha * pulse})`;
        if (particle.spark) context.shadowColor = `rgba(${palette.spark}, 0.45)`;
        context.shadowBlur = particle.spark ? 4 : 0;
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fill();
      }

      if (!reducedMotion.matches && time >= nextTracerAt && tracers.length < 2) {
        const speed = 34 + Math.random() * 24;
        const travel = width * (0.42 + Math.random() * 0.38);
        tracers.push({ x: -100 + Math.random() * width * 0.2, y: height * (0.12 + Math.random() * 0.7), vx: speed, vy: speed * (-0.04 + Math.random() * 0.14), life: 0, maxLife: Math.ceil(travel / speed), width: 1 + Math.random() * 0.55 });
        nextTracerAt = time + 1000 + Math.random() * 2000;
      }

      context.shadowBlur = 0;
      for (let index = tracers.length - 1; index >= 0; index -= 1) {
        const tracer = tracers[index];
        tracer.x += tracer.vx;
        tracer.y += tracer.vy;
        tracer.life += 1;
        const opacity = Math.sin(Math.min(1, tracer.life / 4) * Math.PI / 2) * Math.max(0, 1 - tracer.life / tracer.maxLife) * 0.42;
        const length = 80 + Math.min(80, tracer.vx * 1.5);
        const gradient = context.createLinearGradient(tracer.x - length, tracer.y - tracer.vy * 2, tracer.x, tracer.y);
        gradient.addColorStop(0, `rgba(${palette.tracer}, 0)`);
        gradient.addColorStop(1, `rgba(${palette.tracer}, ${opacity})`);
        context.strokeStyle = gradient;
        context.lineWidth = tracer.width;
        context.beginPath();
        context.moveTo(tracer.x - length, tracer.y - tracer.vy * 2);
        context.lineTo(tracer.x, tracer.y);
        context.stroke();
        if (tracer.life >= tracer.maxLife) tracers.splice(index, 1);
      }
    };

    const handleVisibility = () => { if (!document.hidden) lastTime = performance.now(); };
    resize();
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);
    frame = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(frame);
      themeObserver.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return (
    <div aria-hidden="true" className="atmospheric-background fixed inset-0 z-0 pointer-events-none overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="atmospheric-grid absolute inset-0" />
    </div>
  );
}
