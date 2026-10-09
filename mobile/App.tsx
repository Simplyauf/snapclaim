import './src/lib/polyfills';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { ThemeProvider } from './src/design/theme';
import { fontAssets } from './src/design/type';
import { light, dark } from './src/design/tokens';
import { WalletProvider, useWallet } from './src/lib/wallet';
import { AppShell } from './src/screens/AppShell';
import { ConnectScreen } from './src/screens/ConnectScreen';
import { Preview } from './src/screens/Preview';

/** Design-system preview, for checking type and primitives without a device. */
const PREVIEW = process.env.EXPO_PUBLIC_PREVIEW === '1';

function Root() {
  const { account, restoring } = useWallet();
  if (PREVIEW) return <Preview />;
  const { c } = { c: useColorScheme() === 'dark' ? dark : light };
  if (restoring) return <View style={{ flex: 1, backgroundColor: c.ground }} />;
  return account ? <AppShell /> : <ConnectScreen />;
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const isDark = useColorScheme() === 'dark';
  const c = isDark ? dark : light;

  // Hold the paper ground while faces load so the app never flashes white and
  // never renders a frame in the system sans.
  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: c.ground }} />;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <WalletProvider>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <Root />
        </WalletProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
