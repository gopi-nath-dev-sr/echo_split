import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Polygon, Rect, Path, Line } from 'react-native-svg';
import type { SymbolShape } from '@/lib/game-engine';
import Colors from '@/constants/colors';

interface SymbolViewProps {
  shape: SymbolShape;
  size?: number;
  color?: string;
  opacity?: number;
}

export function SymbolIcon({ shape, size = 40, color = Colors.text, opacity = 1 }: SymbolViewProps) {
  const half = size / 2;
  const pad = size * 0.1;

  return (
    <View style={[styles.container, { width: size, height: size, opacity }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {shape === 'circle' && (
          <Circle cx={half} cy={half} r={half - pad} fill={color} />
        )}
        {shape === 'triangle' && (
          <Polygon
            points={`${half},${pad} ${size - pad},${size - pad} ${pad},${size - pad}`}
            fill={color}
          />
        )}
        {shape === 'square' && (
          <Rect x={pad} y={pad} width={size - pad * 2} height={size - pad * 2} fill={color} rx={3} />
        )}
        {shape === 'diamond' && (
          <Polygon
            points={`${half},${pad} ${size - pad},${half} ${half},${size - pad} ${pad},${half}`}
            fill={color}
          />
        )}
        {shape === 'star' && (
          <Polygon
            points={starPoints(half, half, half - pad, (half - pad) * 0.4, 5)}
            fill={color}
          />
        )}
        {shape === 'pentagon' && (
          <Polygon
            points={regularPolygon(half, half, half - pad, 5)}
            fill={color}
          />
        )}
        {shape === 'hexagon' && (
          <Polygon
            points={regularPolygon(half, half, half - pad, 6)}
            fill={color}
          />
        )}
        {shape === 'cross' && (
          <>
            <Rect x={half - size * 0.1} y={pad} width={size * 0.2} height={size - pad * 2} fill={color} rx={2} />
            <Rect x={pad} y={half - size * 0.1} width={size - pad * 2} height={size * 0.2} fill={color} rx={2} />
          </>
        )}
        {shape === 'arrow' && (
          <Path
            d={`M ${half} ${pad} L ${size - pad} ${half} L ${half + size * 0.12} ${half} L ${half + size * 0.12} ${size - pad} L ${half - size * 0.12} ${size - pad} L ${half - size * 0.12} ${half} L ${pad} ${half} Z`}
            fill={color}
          />
        )}
        {shape === 'spiral' && (
          <>
            <Circle cx={half} cy={half} r={half - pad} fill="none" stroke={color} strokeWidth={3} />
            <Circle cx={half} cy={half} r={(half - pad) * 0.6} fill="none" stroke={color} strokeWidth={3} />
            <Circle cx={half} cy={half} r={(half - pad) * 0.25} fill={color} />
          </>
        )}
      </Svg>
    </View>
  );
}

function starPoints(cx: number, cy: number, outerR: number, innerR: number, points: number): string {
  const result: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    result.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return result.join(' ');
}

function regularPolygon(cx: number, cy: number, r: number, sides: number): string {
  const result: string[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
    result.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return result.join(' ');
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
