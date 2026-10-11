import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../components/Text';
import { Tape } from '../components/Tape';
import { Button } from '../components/Button';
import { Perforation } from '../components/Perforation';
import { Stamp } from '../components/Stamp';
import { DevnetBanner } from '../components/DevnetBanner';
import { useTheme } from '../design/theme';
import { currencyCode, displayAmount, formatAmount, monthName, tapeDate } from '../lib/money';
import { Db, expensesForMonth, latestReport, monthTotals } from '../lib/store';

export function HomeScreen({
  db,
  month,
  onScan,
  onOpenReport,
  onOpenVerify,
  onOpenExpense,
  onOpenSettings,
}: {
  db: Db;
  month: string;
  onScan: () => void;
  onOpenReport: () => void;
  onOpenVerify: () => void;
  onOpenExpense?: (id: string) => void;
  onOpenSettings?: () => void;
}) {
  const { c, space } = useTheme();
  const expenses = expensesForMonth(db, month);
  const totals = monthTotals(db, month);
  const currencies = Object.keys(totals);
  const primary = currencies[0] ?? 'NGN';
  const report = latestReport(db, month);
  const sealed = report?.status === 'sealed';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }} edges={['top']}>
      <DevnetBanner />
      <ScrollView contentContainerStyle={{ padding: space.gutter, paddingBottom: space.xxl, gap: space.lg }}>
        {/* Hero: the running month total, which is the stickiness bet in the
            brief — it has to be the first thing seen on every open. */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Text variant="micro" tone="secondary">
            claiming for
          </Text>
          <Pressable
            onPress={onOpenSettings}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            hitSlop={12}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <Text variant="micro" tone="tertiary">
              settings
            </Text>
          </Pressable>
        </View>
        <View style={{ marginTop: -space.lg }}>
          <Text variant="displayM" style={{ marginTop: space.xs }}>
            {monthName(month)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginTop: space.md }}>
            <Text variant="micro" tone="secondary">
              {currencyCode(primary)}
            </Text>
            <Text variant="displayXL">{formatAmount(totals[primary] ?? 0)}</Text>
          </View>
          {currencies.slice(1).map((cur) => (
            <Text key={cur} variant="data" tone="secondary" style={{ marginTop: space.xs }}>
              {displayAmount(totals[cur], cur)}
            </Text>
          ))}
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
            <Text variant="micro" tone="tertiary">
              {expenses.length} receipt{expenses.length === 1 ? '' : 's'}
            </Text>
            <Text variant="micro" tone="tertiary">
              ·
            </Text>
            <Text variant="micro" tone={sealed ? 'ok' : 'tertiary'}>
              {sealed ? 'sealed' : 'not yet sealed'}
            </Text>
          </View>
        </View>

        <Button label="scan a receipt" onPress={onScan} />

        {expenses.length === 0 ? (
          <Tape>
            <Text variant="body" tone="secondary">
              No receipts yet this month. Photograph one and it will appear here with the fields
              already filled in.
            </Text>
          </Tape>
        ) : (
          <Tape torn inset={false}>
            <View style={{ padding: space.base, paddingBottom: space.sm }}>
              <Text variant="micro" tone="secondary">
                this month
              </Text>
            </View>
            <Perforation />
            {expenses.map((e, i) => (
              <View key={e.id}>
                {i > 0 ? <Perforation /> : null}
                <Pressable
                  onPress={() => onOpenExpense?.(e.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${e.vendor}, ${formatAmount(e.total)}. Open to edit or delete.`}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.md,
                    paddingHorizontal: space.base,
                    paddingVertical: space.md,
                    minHeight: 48,
                    backgroundColor: pressed ? c.well : 'transparent',
                  })}
                >
                  <Text variant="micro" tone="tertiary" style={{ width: 54 }}>
                    {tapeDate(e.date)}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text variant="body" numberOfLines={1}>
                      {e.vendor}
                    </Text>
                    {e.lowConfidence && e.lowConfidence.length > 0 ? (
                      <Text variant="micro" tone="warn">
                        {e.lowConfidence.length} field{e.lowConfidence.length > 1 ? 's' : ''} to check
                      </Text>
                    ) : null}
                  </View>
                  <Text variant="data">{formatAmount(e.total)}</Text>
                </Pressable>
              </View>
            ))}
            <Perforation strong />
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: space.base,
              }}
            >
              <Text variant="micro" tone="secondary">
                total
              </Text>
              <Text variant="dataL">{displayAmount(totals[primary] ?? 0, primary)}</Text>
            </View>
          </Tape>
        )}

        <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
          <Stamp kind={sealed ? 'sealed' : 'draft'} />
          <Text variant="label" tone="secondary" style={{ flex: 1 }}>
            {sealed
              ? 'This month is sealed. Your reviewer can check it has not changed.'
              : 'Seal the month to give your reviewer something they can check.'}
          </Text>
        </View>

        <Button
          label={sealed ? 'open report' : 'review and seal'}
          variant="outline"
          onPress={onOpenReport}
          disabled={expenses.length === 0}
        />
        <Button label="verify a report" variant="quiet" onPress={onOpenVerify} />
      </ScrollView>
    </SafeAreaView>
  );
}
