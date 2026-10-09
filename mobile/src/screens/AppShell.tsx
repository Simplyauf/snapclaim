import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../design/theme';
import { useWallet } from '../lib/wallet';
import { authenticate } from '../lib/api';
import { Db, Expense, emptyDb, loadDb, saveDb, upsertExpense } from '../lib/store';
import { HomeScreen } from './HomeScreen';
import { CaptureScreen } from './CaptureScreen';
import { ReviewScreen } from './ReviewScreen';
import { ReportScreen } from './ReportScreen';
import { VerifyScreen } from './VerifyScreen';

type Route =
  | { name: 'home' }
  | { name: 'capture' }
  | { name: 'review'; imageUri: string }
  | { name: 'report' }
  | { name: 'verify' };

const currentMonth = () => new Date().toISOString().slice(0, 7);

/**
 * Screen flow and the single source of truth for the stored ledger.
 *
 * A hand-rolled route union rather than a navigator: the app has one linear
 * flow (home → capture → review → home) plus the report, and a navigation
 * library would add a native dependency and a rebuild for no benefit here.
 */
export function AppShell() {
  const { c } = useTheme();
  const { account, proof } = useWallet();
  const [db, setDb] = useState<Db>(emptyDb());
  const [loaded, setLoaded] = useState(false);
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const [token, setToken] = useState<string | undefined>();
  const month = currentMonth();

  useEffect(() => {
    (async () => {
      setDb(await loadDb(AsyncStorage));
      setLoaded(true);
    })();
  }, []);

  // Trade the wallet's sign-in signature for a backend session. A failure
  // here is not fatal: the review screen falls back to manual entry (FR-10).
  useEffect(() => {
    if (!proof) return;
    let cancelled = false;
    (async () => {
      try {
        const t = await authenticate(proof);
        if (!cancelled && t) setToken(t);
      } catch {
        // Left undefined; parsing will fail and the user types the fields.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [proof]);

  // Persist on every change. The ledger is small (text only; images stay on
  // the filesystem), so writing the whole blob is cheaper than tracking diffs.
  const update = useCallback(
    (next: Db) => {
      setDb(next);
      void saveDb(AsyncStorage, next);
    },
    [],
  );

  const onSaveExpense = useCallback(
    (expense: Expense) => {
      update(upsertExpense(db, expense));
      setRoute({ name: 'home' });
    },
    [db, update],
  );

  if (!loaded) return <View style={{ flex: 1, backgroundColor: c.ground }} />;

  switch (route.name) {
    case 'capture':
      return (
        <CaptureScreen
          onCaptured={(imageUri) => setRoute({ name: 'review', imageUri })}
          onCancel={() => setRoute({ name: 'home' })}
        />
      );
    case 'review':
      return (
        <ReviewScreen
          imageUri={route.imageUri}
          token={token}
          onSave={onSaveExpense}
          onCancel={() => setRoute({ name: 'home' })}
        />
      );
    case 'verify':
      return <VerifyScreen db={db} onBack={() => setRoute({ name: 'home' })} />;
    case 'report':
      return <ReportScreen db={db} month={month} onDbChange={update} onBack={() => setRoute({ name: 'home' })} />;
    default:
      return (
        <HomeScreen
          db={db}
          month={month}
          onScan={() => setRoute({ name: 'capture' })}
          onOpenReport={() => setRoute({ name: 'report' })}
          onOpenVerify={() => setRoute({ name: 'verify' })}
        />
      );
  }
}
