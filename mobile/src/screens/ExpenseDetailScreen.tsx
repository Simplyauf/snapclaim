import React, { useState } from 'react';
import { Alert, Image, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../components/Text';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Tape } from '../components/Tape';
import { Perforation } from '../components/Perforation';
import { useTheme } from '../design/theme';
import { formatAmount, tapeDate } from '../lib/money';
import { parseAmountToMinor, todayIso } from '../lib/parse';
import { Expense } from '../lib/store';

/**
 * One expense: the receipt photograph, every field editable, and delete
 * (FR-12, FR-13).
 *
 * The image is shown full width above the fields because the only reason to
 * open this screen is to compare what was printed against what was recorded.
 */
export function ExpenseDetailScreen({
  expense,
  monthIsSealed,
  onSave,
  onDelete,
  onBack,
}: {
  expense: Expense;
  monthIsSealed: boolean;
  onSave: (next: Expense) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}) {
  const { c, space } = useTheme();
  const [vendor, setVendor] = useState(expense.vendor);
  const [date, setDate] = useState(expense.date);
  const [subtotal, setSubtotal] = useState(expense.subtotal == null ? '' : formatAmount(expense.subtotal));
  const [tax, setTax] = useState(expense.tax == null ? '' : formatAmount(expense.tax));
  const [total, setTotal] = useState(formatAmount(expense.total));
  const [currency, setCurrency] = useState(expense.currency);
  const [error, setError] = useState<string | null>(null);

  const flagged = expense.lowConfidence ?? [];

  const save = () => {
    const totalMinor = parseAmountToMinor(total);
    if (totalMinor == null || totalMinor <= 0) {
      setError('The total has to be an amount greater than zero.');
      return;
    }
    onSave({
      ...expense,
      vendor: vendor.trim() || 'Unknown vendor',
      date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayIso(),
      subtotal: parseAmountToMinor(subtotal),
      tax: parseAmountToMinor(tax),
      total: totalMinor,
      currency: currency.trim().toUpperCase() || 'NGN',
      // The user has looked at every field now, so nothing is still a guess.
      lowConfidence: [],
      updatedAt: new Date().toISOString(),
    });
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete this expense?',
      monthIsSealed
        ? 'This month is already sealed. The sealed report stays exactly as it was — this starts a new draft version. The receipt image is deleted from your phone.'
        : 'The receipt image is deleted from your phone too. This cannot be undone.',
      [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(expense.id) },
      ],
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: space.gutter, paddingBottom: space.xxl, gap: space.lg }}>
        <View>
          <Button label="back" variant="quiet" onPress={onBack} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
          <Text variant="micro" tone="secondary">
            {tapeDate(expense.date)} · {expense.parseStatus === 'manual' ? 'typed by hand' : 'read from the photo'}
          </Text>
          <Text variant="displayM" style={{ marginTop: space.xs }}>
            {expense.vendor}
          </Text>
        </View>

        {expense.imageUri ? (
          <Tape torn inset={false}>
            <Image
              source={{ uri: expense.imageUri }}
              style={{ width: '100%', height: 260, backgroundColor: c.well }}
              resizeMode="contain"
              accessibilityLabel="The receipt you photographed"
            />
          </Tape>
        ) : (
          <Tape>
            <Text variant="body" tone="secondary">
              This expense has no receipt image.
            </Text>
          </Tape>
        )}

        {flagged.length > 0 ? (
          <Text variant="label" tone="warn">
            {flagged.length} field{flagged.length > 1 ? 's were' : ' was'} uncertain when this was read: {flagged.join(', ')}.
          </Text>
        ) : null}

        <View style={{ gap: space.base }}>
          <Field label="vendor" value={vendor} onChangeText={setVendor} flagged={flagged.includes('vendor')} />
          <Field label="date" value={date} onChangeText={setDate} flagged={flagged.includes('date')} placeholder="YYYY-MM-DD" />
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <View style={{ flex: 1 }}>
              <Field label="subtotal" value={subtotal} onChangeText={setSubtotal} flagged={flagged.includes('subtotal')} numeric placeholder="—" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="tax" value={tax} onChangeText={setTax} flagged={flagged.includes('tax')} numeric placeholder="—" />
            </View>
          </View>
          <Perforation />
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <View style={{ flex: 2 }}>
              <Field label="total" value={total} onChangeText={setTotal} flagged={flagged.includes('total')} numeric />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="currency" value={currency} onChangeText={setCurrency} flagged={flagged.includes('currency')} />
            </View>
          </View>
        </View>

        {error ? (
          <Text variant="label" tone="stamp">
            {error}
          </Text>
        ) : null}

        {monthIsSealed ? (
          <Text variant="label" tone="secondary">
            This month is sealed. Changing an expense starts a new draft version — the sealed
            report stays exactly as it was, so anything you already sent still verifies.
          </Text>
        ) : null}

        <Button label="save changes" onPress={save} />
        <Button label="delete this expense" variant="outline" onPress={confirmDelete} />
      </ScrollView>
    </SafeAreaView>
  );
}
