import { useMemo } from 'react';

export interface StarfieldProps {
  starCount?: number;
  style?: React.CSSProperties;
}

interface Star {
  left: number;
  top: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
}

function createStars(count: number): Star[] {
  return Array.from({ length: count }, () => ({
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: Math.random() * 2 + 1,
    opacity: Math.random() * 0.7 + 0.3,
    duration: Math.random() * 3 + 2,   // 2~5s 閃爍週期
    delay: Math.random() * 5,           // 0~5s 隨機延遲
  }));
}

export const Starfield: React.FC<StarfieldProps> = ({
  starCount = 180,
  style = {},
}) => {
  const stars = useMemo(() => createStars(starCount), [starCount]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        ...style,
      }}
    >
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: var(--star-opacity); }
          50% { opacity: 0.15; }
        }
      `}</style>
      {stars.map((star, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${star.left}%`,
            top: `${star.top}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            borderRadius: '50%',
            background: 'white',
            filter: 'blur(0.5px)',
            '--star-opacity': star.opacity,
            animation: `twinkle ${star.duration}s ease-in-out ${star.delay}s infinite`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
};

