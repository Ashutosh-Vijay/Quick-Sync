import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
}

export function BackgroundCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    let width = 0;
    let height = 0;
    let isBoring = document.body.classList.contains('boring-mode');
    let isDark = document.documentElement.classList.contains('dark');

    const PARTICLE_COUNT = window.innerWidth < 768 ? 40 : 80;
    const CONNECTION_DISTANCE = 150;
    const MOVE_SPEED = 0.5;

    const colors = {
      dark: {
        particle: 'rgba(6, 182, 212, 0.5)', // Cyan
        line: 'rgba(6, 182, 212, 0.15)',
      },
      light: {
        // UPDATED: Indigo/Violet for better visibility on light backgrounds
        particle: 'rgba(79, 70, 229, 0.6)',
        line: 'rgba(79, 70, 229, 0.15)',
      },
    };

    const init = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;

      particles = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * MOVE_SPEED,
          vy: (Math.random() - 0.5) * MOVE_SPEED,
          size: Math.random() * 2 + 1,
        });
      }
    };

    const draw = () => {
      if (isBoring) {
        ctx.clearRect(0, 0, width, height);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      const theme = isDark ? colors.dark : colors.light;
      ctx.fillStyle = theme.particle;
      ctx.strokeStyle = theme.line;

      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECTION_DISTANCE) {
            ctx.lineWidth = 1 - dist / CONNECTION_DISTANCE;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    const themeObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          isDark = document.documentElement.classList.contains('dark');
        }
      });
    });
    themeObserver.observe(document.documentElement, { attributes: true });

    const boringObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const wasBoring = isBoring;
          isBoring = document.body.classList.contains('boring-mode');
          if (wasBoring && !isBoring) {
            draw();
          }
        }
      });
    });
    boringObserver.observe(document.body, { attributes: true });

    const handleResize = () => init();
    window.addEventListener('resize', handleResize);

    init();
    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      themeObserver.disconnect();
      boringObserver.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[-1] w-full h-full pointer-events-none bg-transparent transition-colors duration-500"
    />
  );
}
