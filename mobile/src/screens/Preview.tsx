import React from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from '../components/Text';
import { Tape } from '../components/Tape';
import { Button } from '../components/Button';
import { Stamp } from '../components/Stamp';
import { Perforation } from '../components/Perforation';
import { Fingerprint } from '../components/Fingerprint';
import { DevnetBanner } from '../components/DevnetBanner';
import { useTheme } from '../design/theme';
import { currencyCode, displayAmount, formatAmount, tapeDate } from '../lib/money';

/**
 * Design preview, reached with EXPO_PUBLIC_PREVIEW=1. Renders the type scale
 * and every primitive on one page so the system can be checked in both
 * schemes without a device or a wallet. Not reachable in a normal build.
 */
export function Preview() {
  const { c, space } = useTheme();
  const FP = '68aa0da8045b7478d8f15ce39d042661dcb7bd71e3bc438675f9164ad409d876';

  return (
    <View style={{ flex: 1, backgroundColor: c.ground }}>
      <DevnetBanner />
      <ScrollView contentContainerStyle={{ padding: space.gutter, gap: space.xl, paddingBottom: space.xxl }}>
        <View style={{ gap: space.sm }}>
          <Text variant="micro" tone="secondary">type scale</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
            <Text variant="micro" tone="secondary">{currencyCode('ngn')}</Text>
            <Text variant="displayXL">{formatAmount(2194000)}</Text>
          </View>
          <Text variant="displayL">Seal the month</Text>
          <Text variant="displayM">October 2026</Text>
          <Text variant="title">Check what the AI read</Text>
          <Text variant="body">
            Receipt images are sent to an AI provider to be read. You can correct any field before
            saving.
          </Text>
          <Text variant="label" tone="secondary">Shoprite Ikeja · 06 Oct 2026</Text>
          <Text variant="data">{formatAmount(1290000)}</Text>
          <Text variant="dataL">{displayAmount(2194000, 'NGN')}</Text>
          <Text variant="micro" tone="tertiary">devnet · no real funds</Text>
        </View>

        <View style={{ gap: space.md }}>
          <Text variant="micro" tone="secondary">stamps</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.lg, alignItems: 'center' }}>
            <Stamp kind="draft" />
            <Stamp kind="sealed" />
            <Stamp kind="match" />
            <Stamp kind="nomatch" />
          </View>
        </View>

        <View style={{ gap: space.md }}>
          <Text variant="micro" tone="secondary">buttons</Text>
          <Button label="scan a receipt" />
          <Button label="seal this month" variant="stamp" />
          <Button label="view on explorer" variant="outline" />
          <Button label="busy" busy />
          <Button label="disabled" disabled />
        </View>

        <Tape torn inset={false}>
          <View style={{ padding: space.base, paddingBottom: space.sm }}>
            <Text variant="micro" tone="secondary">tape card</Text>
          </View>
          <Perforation />
          {[
            ['2026-10-06', 'Shoprite Ikeja', 1290000],
            ['2026-10-05', 'Uber', 345000],
          ].map(([date, vendor, amt], i) => (
            <View key={vendor as string}>
              {i > 0 ? <Perforation /> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.base, paddingVertical: space.md }}>
                <Text variant="micro" tone="tertiary" style={{ width: 54 }}>{tapeDate(date as string)}</Text>
                <Text variant="body" style={{ flex: 1 }}>{vendor as string}</Text>
                <Text variant="data">{formatAmount(amt as number)}</Text>
              </View>
            </View>
          ))}
          <Perforation strong />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: space.base }}>
            <Text variant="micro" tone="secondary">total</Text>
            <Text variant="dataL">{displayAmount(1635000, 'NGN')}</Text>
          </View>
        </Tape>

        <Fingerprint hex={FP} />
      </ScrollView>
    </View>
  );
}
