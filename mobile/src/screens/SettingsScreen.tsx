import React, { useState } from 'react';
import { Alert, Linking, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../components/Text';
import { Button } from '../components/Button';
import { Tape } from '../components/Tape';
import { Perforation } from '../components/Perforation';
import { DevnetBanner } from '../components/DevnetBanner';
import { useTheme } from '../design/theme';
import { useWallet } from '../lib/wallet';
import { CLUSTER } from '../lib/solana';
import { Db } from '../lib/store';

/**
 * Account and data.
 *
 * The connect screen promises that receipt images are sent to an AI provider
 * and that they can be deleted. This screen is where that promise is kept —
 * without it the app states something it does not let the user do.
 */
export function SettingsScreen({
  db,
  onDeleteEverything,
  onBack,
}: {
  db: Db;
  onDeleteEverything: () => Promise<void>;
  onBack: () => void;
}) {
  const { c, space } = useTheme();
  const { account, disconnect } = useWallet();
  const [busy, setBusy] = useState(false);

  const sealedCount = db.reports.filter((r) => r.status === 'sealed').length;

  const confirmWipe = () => {
    Alert.alert(
      'Delete everything on this phone?',
      `This removes ${db.expenses.length} expense${db.expenses.length === 1 ? '' : 's'} and every receipt image stored on this device.\n\n` +
        (sealedCount > 0
          ? `${sealedCount} sealed report${sealedCount === 1 ? '' : 's'} already written to ${CLUSTER} cannot be removed — a blockchain does not forget. Anyone holding a report you sent can still verify it.\n\n`
          : '') +
        'This cannot be undone.',
      [
        { text: 'Keep my data', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await onDeleteEverything();
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }} edges={['top']}>
      <DevnetBanner />
      <ScrollView contentContainerStyle={{ padding: space.gutter, paddingBottom: space.xxl, gap: space.lg }}>
        <View>
          <Button label="back" variant="quiet" onPress={onBack} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
          <Text variant="micro" tone="secondary">
            settings
          </Text>
          <Text variant="displayM" style={{ marginTop: space.xs }}>
            Your account
          </Text>
        </View>

        <Tape>
          <Text variant="micro" tone="secondary">
            wallet
          </Text>
          <Text variant="data" selectable style={{ marginTop: space.sm }}>
            {account?.address ?? 'not connected'}
          </Text>
          <Perforation style={{ marginVertical: space.base }} />
          <Text variant="micro" tone="secondary">
            stored on this phone
          </Text>
          <Text variant="body" style={{ marginTop: space.xs }}>
            {db.expenses.length} expense{db.expenses.length === 1 ? '' : 's'} · {db.reports.length} report
            {db.reports.length === 1 ? '' : 's'} ({sealedCount} sealed)
          </Text>
        </Tape>

        <Tape>
          <Text variant="micro" tone="secondary">
            what this app does with your data
          </Text>
          <View style={{ gap: space.md, marginTop: space.md }}>
            <Text variant="body">
              Receipt photographs are sent to an AI provider to be read. Nothing else leaves your
              phone except the fingerprint you choose to seal.
            </Text>
            <Text variant="body">
              Expenses and images are stored on this device, against your wallet address. SnapClaim
              never sees your private key — signing happens inside your wallet app.
            </Text>
            <Text variant="body">
              Sealing writes one hash to {CLUSTER}. It proves a report has not changed since you
              sealed it. It does not prove the receipts are genuine.
            </Text>
          </View>
        </Tape>

        <Button
          label="view this wallet on explorer"
          variant="outline"
          disabled={!account}
          onPress={() =>
            account &&
            Linking.openURL(`https://explorer.solana.com/address/${account.address}?cluster=${CLUSTER}`)
          }
        />

        <Button
          label="disconnect wallet"
          variant="outline"
          busy={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await disconnect();
            } finally {
              setBusy(false);
            }
          }}
        />

        <View style={{ gap: space.sm }}>
          <Button label="delete all my data" variant="stamp" busy={busy} onPress={confirmWipe} />
          <Text variant="micro" tone="tertiary">
            removes every expense and receipt image from this phone
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
