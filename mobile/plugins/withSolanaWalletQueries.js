const { withAndroidManifest } = require('expo/config-plugins');

const WALLET_SCHEME = 'solana-wallet';

/**
 * Android 11+ package visibility: without a <queries> entry for the
 * `solana-wallet` scheme the app cannot see, and therefore cannot launch, any
 * installed wallet. Mobile Wallet Adapter then reports "no wallet found" on a
 * phone that has one installed.
 *
 * The intent is merged INTO the existing <queries> block. Pushing a second
 * one is silently dropped — a manifest may only carry a single <queries>
 * element, and Expo already emits one for https.
 *
 * Lives as a config plugin because `expo prebuild --clean` regenerates
 * android/ and would discard a hand edit.
 */
module.exports = function withSolanaWalletQueries(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    if (!Array.isArray(manifest.queries) || manifest.queries.length === 0) {
      manifest.queries = [{ intent: [] }];
    }
    const queries = manifest.queries[0];
    queries.intent = queries.intent ?? [];

    const already = queries.intent.some((i) =>
      (i.data ?? []).some((d) => d.$?.['android:scheme'] === WALLET_SCHEME),
    );
    if (already) return cfg;

    queries.intent.push({
      action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
      category: [{ $: { 'android:name': 'android.intent.category.BROWSABLE' } }],
      data: [{ $: { 'android:scheme': WALLET_SCHEME } }],
    });
    return cfg;
  });
};
