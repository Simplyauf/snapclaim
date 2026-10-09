import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../design/theme';
import { TornEdge } from './Perforation';

/**
 * A tape card. Flat, hairline-bordered, 2px corners — the surface everything
 * in the app sits on. `torn` punches a receipt edge on the bottom and is
 * reserved for things that represent a real receipt or a sealed report.
 */
export function Tape({
  children,
  torn = false,
  inset = true,
  style,
}: {
  children: React.ReactNode;
  torn?: boolean;
  inset?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c, space, radius, hairline } = useTheme();
  return (
    <View style={style}>
      <View
        style={{
          backgroundColor: c.tape,
          borderWidth: hairline,
          borderColor: c.rule,
          borderRadius: radius.card,
          padding: inset ? space.base : 0,
          // No shadow anywhere: paper on paper is separated by edge, not lift.
        }}
      >
        {children}
      </View>
      {torn ? <TornEdge /> : null}
    </View>
  );
}
