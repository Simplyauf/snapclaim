import React from 'react';
import { View } from 'react-native';
import { Text } from './Text';
import { useTheme } from '../design/theme';

/**
 * FR-25. Always visible, never dismissible. Rendered as a hazard strip rather
 * than a tidy chip so it cannot be mistaken for ordinary chrome.
 */
export function DevnetBanner() {
  const { c, space } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        backgroundColor: c.stampSoft,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: c.stamp,
        paddingHorizontal: space.gutter,
        paddingVertical: space.sm,
      }}
    >
      <View style={{ width: 6, height: 6, backgroundColor: c.stamp }} />
      <Text variant="micro" tone="stamp">
        devnet · no real funds
      </Text>
    </View>
  );
}
