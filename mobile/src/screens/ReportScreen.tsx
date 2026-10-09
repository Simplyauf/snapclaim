import React, { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../components/Text';
import { Tape } from '../components/Tape';
import { Button } from '../components/Button';
import { Perforation } from '../components/Perforation';
import { Stamp } from '../components/Stamp';
import { Fingerprint } from '../components/Fingerprint';
import { DevnetBanner } from '../components/DevnetBanner';
import { useTheme } from '../design/theme';
import { useWallet, WalletError } from '../lib/wallet';
import { displayAmount, formatAmount, monthName, tapeDate } from '../lib/money';
import { fingerprintReport } from '../lib/fingerprint';
import {
  buildSealTransaction,
  explorerTxUrl,
  findExistingSeal,
  getConnection,
  CLUSTER,
} from '../lib/solana';
import {
  Db,
  Report,
  buildCanonicalReport,
  ensureDraft,
  expensesForMonth,
  markSealed,
  monthTotals,
} from '../lib/store';
import { shortAddress } from '../lib/address';

type Props = {
  db: Db;
  month: string;
  onDbChange: (db: Db) => void;
  onBack: () => void;
};

/**
 * Reports and sealing: FR-14, FR-15, FR-18, FR-19, FR-20.
 *
 * The sealing step is the one irreversible action in the app, so it is the
 * only place the vermilion stamp button appears, and the only place a
 * confirmation of what is about to be written is shown in full.
 */
export function ReportScreen({ db, month, onDbChange, onBack }: Props) {
  const { c, space } = useTheme();
  const { account, signAndSend } = useWallet();
  const [report, setReport] = useState<Report | null>(null);
  const [sealing, setSealing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const owner = account?.address ?? '';
  const expenses = expensesForMonth(db, month);
  const totals = monthTotals(db, month);
  const primary = Object.keys(totals)[0] ?? 'NGN';

  // Recompute the draft whenever the month's contents change. ensureDraft
  // keeps a sealed version immutable and cuts a new draft when needed (FR-21).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!owner) return;
      const canonicalReport = buildCanonicalReport(db, month, owner);
      const { canonical, fingerprint } = await fingerprintReport(canonicalReport);
      if (cancelled) return;
      const next = ensureDraft(db, month, owner, fingerprint, canonical, CLUSTER, () =>
        `rep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      );
      setReport(next.report);
      if (next.db !== db) onDbChange(next.db);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, month, owner, onDbChange]);

  const onSeal = useCallback(async () => {
    if (!report || !account) return;
    setError(null);
    setSealing(true);
    try {
      const connection = getConnection();

      // If a previous attempt already landed on chain — app killed, network
      // dropped, confirmation timed out — adopt that seal instead of paying
      // for an identical one.
      const already = await findExistingSeal(
        connection,
        account.publicKey,
        report.fingerprint,
        month,
      );
      if (already) {
        onDbChange(
          markSealed(
            db,
            report.id,
            already.signature,
            new Date((already.blockTime ?? Date.now() / 1000) * 1000).toISOString(),
          ),
        );
        return;
      }

      const { transaction } = await buildSealTransaction(
        connection,
        account.publicKey,
        report.fingerprint,
        month,
      );
      const signature = await signAndSend(transaction);
      onDbChange(markSealed(db, report.id, signature, new Date().toISOString()));
    } catch (e) {
      // FR-20: a declined signature or a network failure leaves the report a
      // draft. Nothing is marked sealed unless a signature came back.
      setError(e instanceof WalletError ? e.message : `Sealing failed: ${String(e)}`);
    } finally {
      setSealing(false);
    }
  }, [report, account, month, db, onDbChange, signAndSend]);

  const sealed = report?.status === 'sealed';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }} edges={['top']}>
      <DevnetBanner />
      <ScrollView contentContainerStyle={{ padding: space.gutter, paddingBottom: space.xxl, gap: space.lg }}>
        <View>
          <Button label="back" variant="quiet" onPress={onBack} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
          <Text variant="micro" tone="secondary">
            report
          </Text>
          <Text variant="displayM" style={{ marginTop: space.xs }}>
            {monthName(month)}
          </Text>
          {report ? (
            <Text variant="micro" tone="tertiary" style={{ marginTop: space.sm }}>
              version {report.version} · {expenses.length} receipt
              {expenses.length === 1 ? '' : 's'} · {CLUSTER}
            </Text>
          ) : null}
        </View>

        <Tape torn inset={false}>
          {expenses.map((e, i) => (
            <View key={e.id}>
              {i > 0 ? <Perforation /> : null}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                  paddingHorizontal: space.base,
                  paddingVertical: space.md,
                }}
              >
                <Text variant="micro" tone="tertiary" style={{ width: 54 }}>
                  {tapeDate(e.date)}
                </Text>
                <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>
                  {e.vendor}
                </Text>
                <Text variant="data">{formatAmount(e.total)}</Text>
              </View>
            </View>
          ))}
          {expenses.length === 0 ? (
            <View style={{ padding: space.base }}>
              <Text variant="body" tone="secondary">
                No receipts for this month yet.
              </Text>
            </View>
          ) : null}
          <Perforation strong />
          {Object.keys(totals).map((cur) => (
            <View
              key={cur}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: space.base,
                paddingVertical: space.md,
              }}
            >
              <Text variant="micro" tone="secondary">
                {Object.keys(totals).length > 1 ? `total ${cur.toLowerCase()}` : 'total'}
              </Text>
              <Text variant="dataL">{displayAmount(totals[cur], cur)}</Text>
            </View>
          ))}
        </Tape>

        {report ? <Fingerprint hex={report.fingerprint} /> : null}

        {sealed && report?.signature ? (
          <Tape>
            <View style={{ gap: space.md }}>
              <Stamp kind="sealed" />
              <Text variant="label" tone="secondary">
                Sealed on {CLUSTER} by {shortAddress(report.owner)}. This version is read only.
              </Text>
              <Perforation />
              <Text variant="micro" tone="secondary">
                transaction
              </Text>
              <Text variant="data" selectable>
                {report.signature}
              </Text>
              <Button
                label="view on explorer"
                variant="outline"
                onPress={() => Linking.openURL(explorerTxUrl(report.signature!))}
              />
            </View>
          </Tape>
        ) : (
          <View style={{ gap: space.md }}>
            {error ? (
              <View
                style={{
                  borderLeftWidth: 3,
                  borderLeftColor: c.stamp,
                  backgroundColor: c.stampSoft,
                  paddingLeft: space.md,
                  paddingVertical: space.sm,
                }}
              >
                <Text variant="label" tone="stamp">
                  {error}
                </Text>
                <Text variant="micro" tone="secondary" style={{ marginTop: space.xs }}>
                  still a draft — nothing was written
                </Text>
              </View>
            ) : null}
            <Text variant="label" tone="secondary">
              Sealing writes this fingerprint to {CLUSTER} and locks the version. It proves the
              report has not changed since — not that the receipts are genuine.
            </Text>
            <Button
              label="seal this month"
              variant="stamp"
              busy={sealing}
              disabled={!report || expenses.length === 0}
              onPress={onSeal}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
