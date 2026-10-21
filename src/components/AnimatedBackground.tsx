import { useEffect, useRef } from "react";

type Particle = { x: number; y: number; vx: number; vy: number; radius: number; alpha: number };
type Tracer = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number };

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
    let nextTracerAt = 0;
    let particles: Particle[] = [];
    const tracers: Tracer[] = [];

    const readAccent = () => getComputedStyle(document.documentElement).getPropertyValue("--theme-primary-rgb").trim() || "251, 146, 60";
    let rgb = readAccent();
    const themeObserver = new MutationObserver(() => { rgb = readAccent(); });
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
      const count = reducedMotion.matches ? 8 : Math.min(28, Math.max(14, Math.round((width * height) / 70000)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width, y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.12, vy: -(0.035 + Math.random() * 0.1),
        radius: 0.5 + Math.random() * 1.25, alpha: 0.08 + Math.random() * 0.16,
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
          if (particle.y < -4) { particle.y = height + 4; particle.x = Math.random() * width; }
          if (particle.x < -4) particle.x = width + 4;
          if (particle.x > width + 4) particle.x = -4;
        }
        context.beginPath();
        context.fillStyle = `rgba(${rgb}, ${particle.alpha})`;
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fill();
      }

      if (!reducedMotion.matches && time >= nextTracerAt && tracers.length < 2) {
        const speed = 12 + Math.random() * 8;
        tracers.push({ x: -80, y: height * (0.18 + Math.random() * 0.66), vx: speed, vy: speed * (0.08 + Math.random() * 0.08), life: 0, maxLife: Math.ceil((width + 180) / speed) });
        nextTracerAt = time + 2200 + Math.random() * 4200;
      }

      for (let index = tracers.length - 1; index >= 0; index -= 1) {
        const tracer = tracers[index];
        tracer.x += tracer.vx;
        tracer.y += tracer.vy;
        tracer.life += 1;
        const opacity = Math.sin(Math.min(1, tracer.life / 8) * Math.PI / 2) * Math.max(0, 1 - tracer.life / tracer.maxLife) * 0.22;
        const gradient = context.createLinearGradient(tracer.x - 90, tracer.y - 12, tracer.x, tracer.y);
        gradient.addColorStop(0, `rgba(${rgb}, 0)`);
        gradient.addColorStop(1, `rgba(${rgb}, ${opacity})`);
        context.strokeStyle = gradient;
        context.lineWidth = 1.25;
        context.beginPath();
        context.moveTo(tracer.x - 90, tracer.y - 12);
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
