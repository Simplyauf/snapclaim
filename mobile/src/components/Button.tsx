import React from 'react';
import { Pressable, View, ActivityIndicator, StyleProp, ViewStyle } from 'react-native';
import { Text } from './Text';
import { useTheme } from '../design/theme';

type Variant = 'ink' | 'outline' | 'stamp' | 'quiet';

/**
 * Square-shouldered buttons (2px). `stamp` is vermilion and exists only for
 * the Seal action, so the one irreversible step in the app looks like nothing
 * else in it.
 */
export function Button({
  label,
  onPress,
  variant = 'ink',
  busy = false,
  disabled = false,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  busy?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c, space, radius, hairline, minTarget } = useTheme();
  const off = disabled || busy;

  const skin: Record<Variant, { bg: string; border: string; fg: string }> = {
    ink: { bg: c.inkFill, border: c.inkFill, fg: c.onInk },
    outline: { bg: 'transparent', border: c.ruleStrong, fg: c.text },
    stamp: { bg: c.stamp, border: c.stamp, fg: '#FBF8F1' },
    quiet: { bg: 'transparent', border: 'transparent', fg: c.textSecondary },
  };
  const s = skin[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy }}
      style={({ pressed }) => [
        {
          minHeight: minTarget,
          backgroundColor: s.bg,
          borderWidth: hairline,
          borderColor: s.border,
          borderRadius: radius.card,
          paddingHorizontal: space.base,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.45 : busy ? 0.85 : pressed ? 0.78 : 1,
        },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={s.fg} />
      ) : (
        <View>
          <Text variant="micro" style={{ color: s.fg, letterSpacing: 1.4 }}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
