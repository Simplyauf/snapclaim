import React from 'react';
import { View } from 'react-native';
import { Text } from './Text';
import { useTheme } from '../design/theme';
import { groupHex } from '../lib/fingerprint';

/**
 * 64 hex characters are unreadable as a run, and a reviewer has to compare
 * them by eye. Grouping in fours over two lines in mono is what makes that
 * possible — this is the one place the app shows the full hash.
 */
export function Fingerprint({ hex, label = 'fingerprint' }: { hex: string; label?: string }) {
  const { c, space } = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="micro" tone="secondary">
        {label}
      </Text>
      <View
        style={{
          backgroundColor: c.well,
          borderLeftWidth: 3,
          borderLeftColor: c.ruleStrong,
          paddingVertical: space.md,
          paddingHorizontal: space.md,
          gap: space.xs,
        }}
      >
        {groupHex(hex).map((line, i) => (
          <Text key={i} variant="data" selectable style={{ letterSpacing: 0.5 }}>
            {line}
          </Text>
        ))}
      </View>
      <Text variant="micro" tone="tertiary">
        sha-256 of the report
      </Text>
    </View>
  );
}
