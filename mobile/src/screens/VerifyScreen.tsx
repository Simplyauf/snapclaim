import React, { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../components/Text';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Tape } from '../components/Tape';
import { Stamp } from '../components/Stamp';
import { Perforation } from '../components/Perforation';
import { Fingerprint } from '../components/Fingerprint';
import { DevnetBanner } from '../components/DevnetBanner';
import { useTheme } from '../design/theme';
import { CLUSTER, VerifyResult, getConnection, verifySeal } from '../lib/solana';
import { Db, Report, sealedReports } from '../lib/store';
import { monthName } from '../lib/money';
import { shortAddress } from '../lib/address';

/**
 * Verify (FR-22): pick a sealed report, or paste a fingerprint and a
 * transaction signature, and get Match or No match.
 *
 * The result is stated plainly and narrowly. A match means the report is
 * byte-identical to what was sealed — the screen says so explicitly rather
 * than letting "Match" imply the receipts were checked.
 */
export function VerifyScreen({ db, onBack }: { db: Db; onBack: () => void }) {
  const { c, space } = useTheme();
  const [fingerprint, setFingerprint] = useState('');
  const [signature, setSignature] = useState('');
  const [month, setMonth] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);

  // Every sealed version across every month, newest first.
  const sealed = [...new Set(db.reports.map((r) => r.month))]
    .flatMap((m) => sealedReports(db, m))
    .sort((a, b) => (b.sealedAt ?? '').localeCompare(a.sealedAt ?? ''));

  const fill = (r: Report) => {
    setFingerprint(r.fingerprint);
    setSignature(r.signature ?? '');
    setMonth(r.month);
    setResult(null);
  };

  const run = useCallback(async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await verifySeal(
        getConnection(),
        signature.trim(),
        fingerprint.trim().toLowerCase(),
        /^\d{4}-\d{2}$/.test(month.trim()) ? month.trim() : undefined,
      );
      setResult(res);
    } finally {
      setBusy(false);
    }
  }, [signature, fingerprint, month]);

  const ready = /^[0-9a-fA-F]{64}$/.test(fingerprint.trim()) && signature.trim().length > 40;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }} edges={['top']}>
      <DevnetBanner />
      <ScrollView contentContainerStyle={{ padding: space.gutter, paddingBottom: space.xxl, gap: space.lg }}>
        <View>
          <Button label="back" variant="quiet" onPress={onBack} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
          <Text variant="micro" tone="secondary">
            verify
          </Text>
          <Text variant="displayM" style={{ marginTop: space.xs }}>
            Has this report changed?
          </Text>
        </View>

        {sealed.length > 0 ? (
          <Tape torn inset={false}>
            <View style={{ padding: space.base, paddingBottom: space.sm }}>
              <Text variant="micro" tone="secondary">
                your sealed reports
              </Text>
            </View>
            <Perforation />
            {sealed.map((r, i) => (
              <View key={r.id}>
                {i > 0 ? <Perforation /> : null}
                <View style={{ padding: space.base, gap: space.sm }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text variant="bodyStrong">{monthName(r.month)}</Text>
                    <Text variant="micro" tone="tertiary">
                      version {r.version}
                    </Text>
                  </View>
                  <Button label="check this one" variant="outline" onPress={() => fill(r)} />
                </View>
              </View>
            ))}
          </Tape>
        ) : null}

        <View style={{ gap: space.base }}>
          <Text variant="micro" tone="secondary">
            or paste what you were sent
          </Text>
          <Field label="fingerprint" value={fingerprint} onChangeText={setFingerprint} placeholder="64 hex characters" />
          <Field label="transaction signature" value={signature} onChangeText={setSignature} placeholder="the devnet transaction" />
          <Field label="month (optional)" value={month} onChangeText={setMonth} placeholder="YYYY-MM" />
          <Button label="check it" onPress={run} busy={busy} disabled={!ready} />
        </View>

        {result ? (
          <Tape>
            <View style={{ gap: space.md }}>
              <Stamp kind={result.status === 'match' ? 'match' : 'nomatch'} />
              {result.status === 'match' ? (
                <>
                  <Text variant="body">
                    This report is exactly what was sealed, at that transaction.
                  </Text>
                  <Text variant="label" tone="secondary">
                    Sealed by {shortAddress(result.signer)} on {CLUSTER}
                    {result.blockTime
                      ? `, ${new Date(result.blockTime * 1000).toLocaleString('en-GB')}`
                      : ''}
                    .
                  </Text>
                  <Perforation />
                  {/* The honest limit, stated where someone acts on the result. */}
                  <Text variant="micro" tone="secondary">
                    this does not prove the receipts are genuine, or that nothing was left out
                  </Text>
                </>
              ) : (
                <>
                  <Text variant="body">
                    {result.status === 'nomatch' ? result.reason : result.reason}
                  </Text>
                  {result.status === 'nomatch' && result.onChain ? (
                    <View style={{ gap: space.md }}>
                      <Fingerprint hex={result.onChain} label="what was sealed" />
                      <Fingerprint hex={result.expected} label="what you have" />
                    </View>
                  ) : null}
                </>
              )}
            </View>
          </Tape>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
