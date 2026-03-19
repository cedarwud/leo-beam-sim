import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';

interface LinkData {
  satId: string;
  position: THREE.Vector3;
  role: 'serving' | 'target' | 'candidate';
}

interface SatelliteLinksProps {
  links: LinkData[];
  uePosition: THREE.Vector3;
}

const ROLE_STYLES = {
  serving:   { color: '#00ff88', lineWidth: 3.2, opacity: 0.9, dashed: false },
  target:    { color: '#0088ff', lineWidth: 2.8, opacity: 0.7, dashed: true },
  candidate: { color: '#5c6475', lineWidth: 1.5, opacity: 0.35, dashed: true },
} as const;

export function SatelliteLinks({ links, uePosition }: SatelliteLinksProps) {
  const linkElements = useMemo(() => {
    return links.map(link => {
      const style = ROLE_STYLES[link.role];
      return {
        key: `link-${link.satId}-${link.role}`,
        points: [
          [uePosition.x, uePosition.y, uePosition.z] as [number, number, number],
          [link.position.x, link.position.y, link.position.z] as [number, number, number],
        ],
        ...style,
      };
    });
  }, [links, uePosition]);

  return (
    <>
      {linkElements.map(el => (
        <Line
          key={el.key}
          points={el.points}
          color={el.color}
          lineWidth={el.lineWidth}
          transparent
          opacity={el.opacity}
          dashed={el.dashed}
          dashSize={el.dashed ? 10 : undefined}
          gapSize={el.dashed ? 5 : undefined}
        />
      ))}
    </>
  );
}
