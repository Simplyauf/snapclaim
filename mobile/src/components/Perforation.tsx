import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useTheme } from '../design/theme';

const HIDE = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/**
 * A perforated rule — the app's only horizontal divider. Drawn as a row of
 * short dashes rather than a 1px line so separation reads as a tear line on
 * paper. `strong` is for the subtotal/total break inside a report.
 *
 * The dashes are ABSOLUTELY POSITIONED. A plain flex row of fixed-width
 * children sets the parent's intrinsic width, which dragged the whole card
 * past the viewport and clipped the amount column; overflow:hidden clips the
 * paint but does not stop children from driving layout width.
 */
export function Perforation({ strong = false, style }: { strong?: boolean; style?: ViewStyle }) {
  const { c } = useTheme();
  const h = strong ? 3 : 1;
  return (
    <View style={[{ width: '100%', height: h, overflow: 'hidden' }, style]} {...HIDE}>
      <View style={{ position: 'absolute', left: 0, top: 0, flexDirection: 'row' }}>
        {Array.from({ length: 200 }).map((_, i) => (
          <View
            key={i}
            style={{
              width: 3,
              marginRight: 3,
              height: h,
              backgroundColor: strong ? c.ruleStrong : c.rule,
            }}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * The torn tape edge: half-circles punched in the ground colour, sitting
 * flush against the bottom of a tape card. Same absolute-positioning rule as
 * above — the notches must not widen the card.
 */
export function TornEdge({ side = 'bottom' }: { side?: 'top' | 'bottom' }) {
  const { c } = useTheme();
  const notch = 12;
  return (
    <View style={{ width: '100%', height: notch / 2, overflow: 'hidden' }} {...HIDE}>
      <View style={{ position: 'absolute', left: 0, top: 0, flexDirection: 'row' }}>
        {Array.from({ length: 60 }).map((_, i) => (
          <View
            key={i}
            style={{
              width: notch,
              height: notch,
              borderRadius: notch / 2,
              backgroundColor: c.ground,
              marginTop: side === 'bottom' ? -notch / 2 : 0,
            }}
          />
        ))}
      </View>
    </View>
  );
}
