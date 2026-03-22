import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
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

    const PARTICLE_COUNT = window.innerWidth < 768 ? 45 : 85;
    const CONNECTION_DISTANCE = 150;
    const MOVE_SPEED = 0.4;

    const colors = {
      dark: {
        particleFill: 'rgba(139, 92, 246, 0.5)',
        lineStroke: 'rgba(139, 92, 246, 0.12)',
        glowColor: '139, 92, 246',
      },
      light: {
        particleFill: 'rgba(109, 40, 217, 0.4)',
        lineStroke: 'rgba(109, 40, 217, 0.1)',
        glowColor: '109, 40, 217',
      },
    };

    const init = () => {
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);

      particles = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * MOVE_SPEED * 2,
          vy: (Math.random() - 0.5) * MOVE_SPEED * 2,
          size: Math.random() * 2 + 0.8,
          opacity: Math.random() * 0.4 + 0.3,
        });
      }
    };

    const draw = () => {
      if (isBoring) {
        ctx.clearRect(0, 0, width, height);
        animationFrameId = requestAnimationFrame(draw);
        return;
      }

      ctx.clearRect(0, 0, width, height);
      const theme = isDark ? colors.dark : colors.light;

      // Update & draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Autonomous movement — always alive
        p.x += p.vx;
        p.y += p.vy;

        // Bounce off edges
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        // Draw glow
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 6);
        grad.addColorStop(0, `rgba(${theme.glowColor}, ${p.opacity * 0.4})`);
        grad.addColorStop(1, `rgba(${theme.glowColor}, 0)`);
        ctx.beginPath();
        ctx.fillStyle = grad;
        ctx.arc(p.x, p.y, p.size * 6, 0, Math.PI * 2);
        ctx.fill();

        // Draw solid core
        ctx.beginPath();
        ctx.fillStyle = theme.particleFill;
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Draw connections
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECTION_DISTANCE) {
            const alpha = 1 - dist / CONNECTION_DISTANCE;
            ctx.strokeStyle = `rgba(${theme.glowColor}, ${alpha * 0.12})`;
            ctx.lineWidth = alpha * 1.2;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    // Watch for theme changes
    const themeObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          isDark = document.documentElement.classList.contains('dark');
        }
      });
    });
    themeObserver.observe(document.documentElement, { attributes: true });

    // Watch for boring-mode toggle
    const boringObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          isBoring = document.body.classList.contains('boring-mode');
        }
      });
    });
    boringObserver.observe(document.body, { attributes: true });

    const handleResize = () => {
      // Reset scale before re-init
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      init();
    };
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
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 -z-10 pointer-events-none transition-opacity duration-700 [.boring-mode_&]:opacity-0"
        style={{ willChange: 'transform' }}
      />
      {/* Continuous Animated Aurora Background (Always Visible) */}
      <div className="fixed inset-0 -z-[11] pointer-events-none overflow-hidden">
        <div className="aurora-bg" />
        {/* Soft overlay to blend aurora with theme background */}
        <div className="absolute inset-0 bg-background/70 dark:bg-background/80" />
      </div>
    </>
  );
}
