import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../components/Text';
import { Button } from '../components/Button';
import { Tape } from '../components/Tape';
import { Perforation } from '../components/Perforation';
import { DevnetBanner } from '../components/DevnetBanner';
import { useTheme } from '../design/theme';
import { useWallet, WalletError } from '../lib/wallet';

/**
 * Welcome and connect. Says what the app does, names the AI disclosure up
 * front (NFR Privacy: the first-run screen must state that receipt images are
 * sent to an AI provider), and connects a wallet.
 */
export function ConnectScreen() {
  const { c, space } = useTheme();
  const { connect, connecting } = useWallet();
  const [error, setError] = useState<string | null>(null);

  const onConnect = async () => {
    setError(null);
    try {
      await connect();
    } catch (e) {
      setError(e instanceof WalletError ? e.message : 'Something went wrong. Try again.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }} edges={['top']}>
      <DevnetBanner />
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: space.gutter, paddingBottom: space.xl }}>
        <View style={{ flex: 1, justifyContent: 'center', gap: space.lg }}>
          <View>
            <Text variant="micro" tone="secondary">
              snapclaim
            </Text>
            <Text variant="displayL" style={{ marginTop: space.md }}>
              Photograph a receipt.{'\n'}Hand over a month{'’'}s expenses{'\n'}nobody can quietly edit.
            </Text>
          </View>

          <Tape torn>
            <Text variant="micro" tone="secondary">
              how it works
            </Text>
            <View style={{ gap: space.md, marginTop: space.md }}>
              {[
                ['01', 'Scan a receipt. The fields are read for you, and you correct anything wrong.'],
                ['02', 'Seal the month. A fingerprint of the report is written to Solana.'],
                ['03', 'Your reviewer checks that fingerprint against what you sent them.'],
              ].map(([n, copy]) => (
                <View key={n} style={{ flexDirection: 'row', gap: space.md }}>
                  <Text variant="micro" tone="stamp" style={{ width: 20 }}>
                    {n}
                  </Text>
                  <Text variant="body" style={{ flex: 1 }}>
                    {copy}
                  </Text>
                </View>
              ))}
            </View>
            <Perforation style={{ marginVertical: space.base }} />
            {/* NFR Privacy + the "sealing is not proof of authenticity" risk,
                stated before the user connects rather than buried in an FAQ. */}
            <Text variant="label" tone="secondary">
              Receipt images are sent to an AI provider to be read. Sealing proves a report has not
              changed since you sealed it — it does not prove the receipts are genuine.
            </Text>
          </Tape>
        </View>

        <View style={{ gap: space.md }}>
          {error ? (
            <View
              style={{
                borderLeftWidth: 3,
                borderLeftColor: c.stamp,
                paddingLeft: space.md,
                paddingVertical: space.sm,
                backgroundColor: c.stampSoft,
              }}
            >
              <Text variant="label" tone="stamp">
                {error}
              </Text>
            </View>
          ) : null}
          <Button label="connect wallet" onPress={onConnect} busy={connecting} />
          <Text variant="micro" tone="tertiary" style={{ textAlign: 'center' }}>
            devnet · no real funds · snapclaim never sees your private key
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
