import React from 'react';
import { View } from 'react-native';
import { Text } from './Text';
import { useTheme } from '../design/theme';

type Kind = 'sealed' | 'match' | 'nomatch' | 'draft';

/**
 * A rubber stamp: double-ruled box, wide tracking, rotated a few degrees so
 * it reads as pressed onto the page rather than laid out by a grid.
 *
 * Deliberately restrained in wording — "SEALED" never says "VERIFIED
 * AUTHENTIC". Sealing proves the report is unchanged, nothing more, and the
 * UI must not overclaim it (project.md, Risks).
 */
export function Stamp({ kind, label }: { kind: Kind; label?: string }) {
  const { c, space } = useTheme();
  const spec = {
    sealed: { text: 'sealed', color: c.stamp, tilt: '-4deg' },
    match: { text: 'match', color: c.ok, tilt: '-3deg' },
    nomatch: { text: 'no match', color: c.stamp, tilt: '2deg' },
    draft: { text: 'draft', color: c.textTertiary, tilt: '-2deg' },
  }[kind];

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={label ?? spec.text}
      style={{
        alignSelf: 'flex-start',
        transform: [{ rotate: spec.tilt }],
        borderWidth: 2,
        borderColor: spec.color,
        paddingHorizontal: space.sm,
        paddingVertical: space.xs,
      }}
    >
      <View
        style={{
          borderWidth: 1,
          borderColor: spec.color,
          paddingHorizontal: space.sm,
          paddingVertical: space.xs,
        }}
      >
        <Text variant="stamp" style={{ color: spec.color }}>
          {label ?? spec.text}
        </Text>
      </View>
    </View>
  );
}
