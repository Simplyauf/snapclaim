import React, { useEffect, useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../components/Text';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Tape } from '../components/Tape';
import { Perforation } from '../components/Perforation';
import { useTheme } from '../design/theme';
import { ParseError, parseReceipt, usingStubParser } from '../lib/api';
import { NormalizedReceipt, normalizeReceipt, parseAmountToMinor, todayIso } from '../lib/parse';
import { formatAmount } from '../lib/money';
import { Expense } from '../lib/store';

/**
 * Review what the model read (FR-8), with unsure fields marked (FR-9) and a
 * working manual path when parsing fails entirely (FR-10).
 *
 * The receipt image sits above the fields rather than behind them: the whole
 * job here is comparing what was printed against what was read.
 */
type Stage =
  | { kind: 'parsing' }
  | { kind: 'ready'; data: NormalizedReceipt }
  | { kind: 'failed'; message: string; detail?: string };

const newId = () => `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export function ReviewScreen({
  imageUri,
  token,
  onSave,
  onCancel,
}: {
  imageUri: string;
  token?: string;
  onSave: (expense: Expense) => void;
  onCancel: () => void;
}) {
  const { c, space } = useTheme();
  const [stage, setStage] = useState<Stage>({ kind: 'parsing' });

  // Editable copies, held as strings so a half-typed amount is never lost.
  const [vendor, setVendor] = useState('');
  const [date, setDate] = useState('');
  const [subtotal, setSubtotal] = useState('');
  const [tax, setTax] = useState('');
  const [total, setTotal] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [flagged, setFlagged] = useState<string[]>([]);
  const [parseStatus, setParseStatus] = useState<Expense['parseStatus']>('parsed');

  const applyFields = (r: NormalizedReceipt) => {
    setVendor(r.vendor);
    setDate(r.date);
    setSubtotal(r.subtotal == null ? '' : formatAmount(r.subtotal));
    setTax(r.tax == null ? '' : formatAmount(r.tax));
    setTotal(formatAmount(r.total));
    setCurrency(r.currency);
    setFlagged(r.lowConfidence);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { receipt } = await parseReceipt(imageUri, { token });
        if (cancelled) return;
        const normalized = normalizeReceipt(receipt);
        setParseStatus('parsed');
        applyFields(normalized);
        setStage({ kind: 'ready', data: normalized });
      } catch (e) {
        if (cancelled) return;
        // FR-10: a failed parse must not lose the receipt. Fall straight into
        // a blank, editable form rather than a dead end.
        setParseStatus('failed');
        setDate(todayIso());
        setCurrency('NGN');
        setStage({
          kind: 'failed',
          message: e instanceof ParseError ? e.message : 'The receipt could not be read.',
          detail: e instanceof ParseError ? e.detail : String(e),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [imageUri, token]);

  const save = () => {
    const totalMinor = parseAmountToMinor(total);
    if (totalMinor == null || totalMinor <= 0) {
      setFlagged((f) => (f.includes('total') ? f : [...f, 'total']));
      return;
    }
    const now = new Date().toISOString();
    onSave({
      id: newId(),
      vendor: vendor.trim() || 'Unknown vendor',
      date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayIso(),
      subtotal: parseAmountToMinor(subtotal),
      tax: parseAmountToMinor(tax),
      total: totalMinor,
      currency: currency.trim().toUpperCase() || 'NGN',
      imageUri,
      lowConfidence: flagged,
      // A field the user edited by hand is no longer the model's guess.
      parseStatus: stage.kind === 'failed' ? 'manual' : parseStatus,
      createdAt: now,
      updatedAt: now,
    });
  };

  const isFlagged = (f: string) => flagged.includes(f);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: space.gutter, paddingBottom: space.xxl, gap: space.lg }}>
        <View>
          <Text variant="micro" tone="secondary">
            check what was read
          </Text>
          <Text variant="displayM" style={{ marginTop: space.xs }}>
            {stage.kind === 'parsing' ? 'Reading the receipt…' : 'Does this match?'}
          </Text>
        </View>

        <Tape torn inset={false}>
          <Image
            source={{ uri: imageUri }}
            style={{ width: '100%', height: 220, backgroundColor: c.well }}
            resizeMode="contain"
            accessibilityLabel="The receipt you photographed"
          />
        </Tape>

        {stage.kind === 'failed' ? (
          <View
            style={{
              borderLeftWidth: 3,
              borderLeftColor: c.warn,
              backgroundColor: c.warnSoft,
              paddingLeft: space.md,
              paddingVertical: space.sm,
            }}
          >
            <Text variant="label" tone="warn">
              {stage.message}
            </Text>
            <Text variant="micro" tone="secondary" style={{ marginTop: space.xs }}>
              type the fields yourself — the receipt is kept either way
            </Text>
            {stage.detail ? (
              <Text variant="data" tone="tertiary" selectable style={{ marginTop: space.sm, fontSize: 10 }}>
                {stage.detail}
              </Text>
            ) : null}
          </View>
        ) : null}

        {usingStubParser() && stage.kind !== 'failed' ? (
          <Text variant="micro" tone="warn">
            sample data · no backend configured
          </Text>
        ) : null}

        {stage.kind === 'parsing' ? (
          <Text variant="body" tone="secondary">
            This usually takes a few seconds.
          </Text>
        ) : (
          <View style={{ gap: space.base }}>
            <Field label="vendor" value={vendor} onChangeText={setVendor} flagged={isFlagged('vendor')} placeholder="Who you paid" />
            <Field label="date" value={date} onChangeText={setDate} flagged={isFlagged('date')} placeholder="YYYY-MM-DD" />
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <View style={{ flex: 1 }}>
                <Field label="subtotal" value={subtotal} onChangeText={setSubtotal} flagged={isFlagged('subtotal')} numeric placeholder="—" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="tax" value={tax} onChangeText={setTax} flagged={isFlagged('tax')} numeric placeholder="—" />
              </View>
            </View>
            <Perforation />
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <View style={{ flex: 2 }}>
                <Field label="total" value={total} onChangeText={setTotal} flagged={isFlagged('total')} numeric placeholder="0.00" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="currency" value={currency} onChangeText={setCurrency} flagged={isFlagged('currency')} placeholder="NGN" />
              </View>
            </View>

            {flagged.length > 0 ? (
              <Text variant="label" tone="warn">
                {flagged.length} field{flagged.length > 1 ? 's' : ''} to check before saving.
              </Text>
            ) : null}

            <Button label="save expense" onPress={save} />
            <Button label="discard" variant="quiet" onPress={onCancel} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
