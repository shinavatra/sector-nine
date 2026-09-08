import { useEffect, useState } from "react";

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  color: string;
  type: 'muzzle' | 'spark' | 'shell' | 'smoke' | 'bullet' | 'impact';
}

interface BulletTrail {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  opacity: number;
  duration: number;
}

export function AnimatedBackground() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [bulletTrails, setBulletTrails] = useState<BulletTrail[]>([]);

  useEffect(() => {
    const createParticle = (): Particle => {
      const type = Math.random() < 0.25 ? 'muzzle' : 
                   Math.random() < 0.4 ? 'spark' : 
                   Math.random() < 0.6 ? 'shell' : 
                   Math.random() < 0.8 ? 'smoke' : 
                   Math.random() < 0.9 ? 'bullet' : 'impact';
      
      let color = '#ff8800';
      if (type === 'muzzle') color = '#ffdd00';
      if (type === 'spark') color = '#ffff66';
      if (type === 'shell') color = '#888888';
      if (type === 'smoke') color = '#444444';
      if (type === 'bullet') color = '#ffaa00';
      if (type === 'impact') color = '#ff4444';

      return {
        id: Math.random(),
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        size: type === 'bullet' ? Math.random() * 2 + 1 : Math.random() * 3 + 1,
        opacity: Math.random() * 0.8 + 0.2,
        color,
        type
      };
    };

    const createBulletTrail = (): BulletTrail => {
      return {
        id: Math.random(),
        startX: Math.random() * window.innerWidth,
        startY: Math.random() * window.innerHeight,
        endX: Math.random() * window.innerWidth,
        endY: Math.random() * window.innerHeight,
        opacity: 0.8,
        duration: 0.3
      };
    };

    const animate = () => {
      setParticles(prev => {
        let newParticles = prev.map(particle => ({
          ...particle,
          x: particle.x + particle.vx,
          y: particle.y + particle.vy,
          opacity: particle.opacity - (particle.type === 'bullet' ? 0.02 : 0.005),
          size: particle.type === 'smoke' ? particle.size + 0.03 : particle.size
        })).filter(particle => 
          particle.opacity > 0 && 
          particle.x >= -20 && 
          particle.x <= window.innerWidth + 20 &&
          particle.y >= -20 && 
          particle.y <= window.innerHeight + 20
        );

        // Add new particles occasionally
        if (Math.random() < 0.4 && newParticles.length < 60) {
          newParticles.push(createParticle());
        }

        return newParticles;
      });

      setBulletTrails(prev => {
        let newTrails = prev.map(trail => ({
          ...trail,
          opacity: trail.opacity - 0.05,
          duration: trail.duration - 0.05
        })).filter(trail => trail.opacity > 0 && trail.duration > 0);

        // Add new bullet trails occasionally
        if (Math.random() < 0.1 && newTrails.length < 5) {
          newTrails.push(createBulletTrail());
        }

        return newTrails;
      });
    };

    // Create initial particles
    const initialParticles = Array.from({ length: 30 }, createParticle);
    setParticles(initialParticles);

    const interval = setInterval(animate, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {/* Combat Zone Grid Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255, 136, 0, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 136, 0, 0.04) 1px, transparent 1px),
            radial-gradient(circle at 50% 50%, rgba(255, 136, 0, 0.025) 0%, transparent 70%)
          `,
          backgroundSize: '50px 50px, 50px 50px, 200px 200px'
        }}
      />
      
      {/* Crosshair Targeting Systems */}
      <div className="absolute top-10 left-10 w-12 h-12 opacity-10">
        <div className="absolute top-1/2 left-0 w-full h-px bg-orange-400"></div>
        <div className="absolute top-0 left-1/2 w-px h-full bg-orange-400"></div>
        <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-orange-400 rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute top-1/2 left-1/2 w-8 h-8 border border-orange-400 rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
      </div>
      
      <div className="absolute bottom-20 right-20 w-12 h-12 opacity-10">
        <div className="absolute top-1/2 left-0 w-full h-px bg-green-400"></div>
        <div className="absolute top-0 left-1/2 w-px h-full bg-green-400"></div>
        <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-green-400 rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute top-1/2 left-1/2 w-6 h-6 border border-green-400 transform -translate-x-1/2 -translate-y-1/2"></div>
      </div>

      {/* Radar Sweep with Enhanced Design */}
      <div className="absolute top-4 right-4 w-24 h-24 opacity-15">
        <div className="relative w-full h-full border-2 border-orange-400/40 rounded-full">
          <div 
            className="absolute top-1/2 left-1/2 w-px h-10 bg-gradient-to-t from-orange-400 to-transparent origin-bottom animate-spin"
            style={{ 
              transformOrigin: 'bottom center',
              transform: 'translate(-50%, -100%)',
              animationDuration: '3s'
            }}
          ></div>
          <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-orange-400 rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute top-1/2 left-1/2 w-16 h-16 border border-orange-400/20 rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute top-1/2 left-1/2 w-8 h-8 border border-orange-400/30 rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
        </div>
      </div>

      {/* Bullet Trails */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {bulletTrails.map(trail => (
          <line
            key={trail.id}
            x1={trail.startX}
            y1={trail.startY}
            x2={trail.endX}
            y2={trail.endY}
            stroke={`rgba(255, 221, 0, ${trail.opacity})`}
            strokeWidth="2"
            strokeLinecap="round"
          />
        ))}
      </svg>

      {/* Combat Particles */}
      {particles.map(particle => (
        <div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            left: particle.x,
            top: particle.y,
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
            opacity: particle.opacity,
            boxShadow: particle.type === 'muzzle' || particle.type === 'impact' 
              ? `0 0 ${particle.size * 4}px ${particle.color}` 
              : `0 0 ${particle.size * 2}px ${particle.color}`,
            animation: particle.type === 'muzzle' ? 'pulse 0.3s ease-in-out' : 
                      particle.type === 'impact' ? 'muzzleFlash 0.5s ease-out' : undefined
          }}
        />
      ))}

      {/* Combat HUD Elements */}
      <div className="absolute bottom-4 left-4 font-mono text-xs text-green-400 opacity-50">
        <div className="flex items-center space-x-2 mb-1">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <div>COMBAT SYSTEMS: ACTIVE</div>
        </div>
        <div>SECURITY LEVEL: MAXIMUM</div>
        <div>SECTOR NINE: OPERATIONAL</div>
        <div>THREAT ASSESSMENT: HOSTILE</div>
      </div>

      {/* Tactical Status Display */}
      <div className="absolute top-4 left-4 font-mono text-xs opacity-40">
        <div className="text-orange-400 mb-1">╔═══ TACTICAL DISPLAY ═══╗</div>
        <div className="text-green-400">║ SURVEILLANCE: ONLINE   ║</div>
        <div className="text-blue-400">║ PROTOCOLS: ENGAGED     ║</div>
        <div className="text-purple-400">║ QUANTUM SYS: STABLE    ║</div>
        <div className="text-orange-400">╚═══ AUTHORIZED ONLY ═══╝</div>
      </div>

      {/* Ammo Counter Effect */}
      <div className="absolute bottom-4 right-4 font-mono text-xs text-orange-400 opacity-40">
        <div className="border border-orange-400/30 p-2 rounded bg-black/30">
          <div className="flex justify-between">
            <span>AMMO:</span>
            <span className="text-green-400">∞</span>
          </div>
          <div className="flex justify-between">
            <span>ARMOR:</span>
            <span className="text-blue-400">█████</span>
          </div>
          <div className="flex justify-between">
            <span>HEALTH:</span>
            <span className="text-red-400">████░</span>
          </div>
        </div>
      </div>

      {/* Environmental Scanning Lines */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 3px,
            rgba(0, 255, 0, 0.04) 3px,
            rgba(0, 255, 0, 0.04) 4px
          )`,
          animation: 'scan 6s linear infinite'
        }}
      />

      {/* Motion Detector Grid */}
      <div 
        className="absolute inset-0 opacity-[0.012]"
        style={{
          background: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 100px,
            rgba(255, 136, 0, 0.035) 100px,
            rgba(255, 136, 0, 0.035) 101px
          )`
        }}
      />
    </div>
  );
}
