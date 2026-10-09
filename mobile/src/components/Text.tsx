import React from 'react';
import { Text as RNText, TextProps as RNTextProps } from 'react-native';
import { type as typeScale, TypeToken } from '../design/type';
import { useTheme } from '../design/theme';

type Tone = 'default' | 'secondary' | 'tertiary' | 'stamp' | 'ok' | 'warn' | 'onInk';

export type TextProps = RNTextProps & {
  variant?: TypeToken;
  tone?: Tone;
};

/**
 * The only text primitive. Screens pick a type token and a tone; they never
 * set fontFamily or a raw colour, which is what keeps the three voices from
 * drifting back into one default sans.
 */
export function Text({ variant = 'body', tone = 'default', style, ...rest }: TextProps) {
  const { c } = useTheme();
  const colors: Record<Tone, string> = {
    default: c.text,
    secondary: c.textSecondary,
    tertiary: c.textTertiary,
    stamp: c.stamp,
    ok: c.ok,
    warn: c.warn,
    onInk: c.onInk,
  };
  return <RNText style={[typeScale[variant], { color: colors[tone] }, style]} {...rest} />;
}
