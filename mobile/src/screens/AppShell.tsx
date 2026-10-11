import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../design/theme';
import { useWallet } from '../lib/wallet';
import { authenticate } from '../lib/api';
import { Db, Expense, deleteExpense, emptyDb, latestReport, loadDb, saveDb, upsertExpense } from '../lib/store';
import { deleteImage } from '../lib/images';
import { HomeScreen } from './HomeScreen';
import { CaptureScreen } from './CaptureScreen';
import { ReviewScreen } from './ReviewScreen';
import { ReportScreen } from './ReportScreen';
import { ExpenseDetailScreen } from './ExpenseDetailScreen';
import { SettingsScreen } from './SettingsScreen';
import { VerifyScreen } from './VerifyScreen';

type Route =
  | { name: 'home' }
  | { name: 'capture' }
  | { name: 'review'; imageUri: string }
  | { name: 'report' }
  | { name: 'verify' }
  | { name: 'expense'; id: string }
  | { name: 'settings' };

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

  /** FR-12: removing an expense removes its image too, not just the row. */
  const onDeleteExpense = useCallback(
    async (id: string) => {
      const target = db.expenses.find((e) => e.id === id);
      update(deleteExpense(db, id));
      setRoute({ name: 'home' });
      await deleteImage(target?.imageUri);
    },
    [db, update],
  );

  /**
   * Wipe everything held on the phone. Images are deleted before the rows, so
   * a failure part-way cannot orphan files whose paths we have just forgotten.
   */
  const onDeleteEverything = useCallback(async () => {
    for (const e of db.expenses) await deleteImage(e.imageUri);
    update(emptyDb());
    setRoute({ name: 'home' });
  }, [db, update]);

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
    case 'expense': {
      const expense = db.expenses.find((e) => e.id === route.id);
      // The expense can vanish under us (deleted on another route); fall back
      // to home rather than rendering a detail screen with nothing in it.
      if (!expense) {
        setRoute({ name: 'home' });
        return <View style={{ flex: 1, backgroundColor: c.ground }} />;
      }
      return (
        <ExpenseDetailScreen
          expense={expense}
          monthIsSealed={latestReport(db, month)?.status === 'sealed'}
          onSave={(next) => {
            update(upsertExpense(db, next));
            setRoute({ name: 'home' });
          }}
          onDelete={onDeleteExpense}
          onBack={() => setRoute({ name: 'home' })}
        />
      );
    }
    case 'settings':
      return <SettingsScreen db={db} onDeleteEverything={onDeleteEverything} onBack={() => setRoute({ name: 'home' })} />;
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
          onOpenExpense={(id) => setRoute({ name: 'expense', id })}
          onOpenSettings={() => setRoute({ name: 'settings' })}
        />
      );
  }
}
