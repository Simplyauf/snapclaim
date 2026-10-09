import React from 'react';
import { TextInput, View } from 'react-native';
import { Text } from './Text';
import { useTheme } from '../design/theme';
import { family, type as typeScale } from '../design/type';

/**
 * One editable parsed field (FR-8). A field the model was unsure about is
 * marked with an amber rule and a note rather than an error colour — it is a
 * prompt to look, not a mistake the user made (FR-9).
 */
export function Field({
  label,
  value,
  onChangeText,
  flagged = false,
  numeric = false,
  placeholder,
  autoFocus,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  flagged?: boolean;
  numeric?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const { c, space, minTarget } = useTheme();

  return (
    <View style={{ gap: space.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Text variant="micro" tone={flagged ? 'warn' : 'secondary'}>
          {label}
        </Text>
        {flagged ? (
          <Text variant="micro" tone="warn">
            · check this
          </Text>
        ) : null}
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textTertiary}
        autoFocus={autoFocus}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        accessibilityLabel={label}
        style={[
          // Amounts are mono so a column of them lines up; everything else is
          // UI text.
          numeric ? typeScale.dataL : { ...typeScale.body, fontFamily: family.uiMedium },
          {
            color: c.text,
            minHeight: minTarget,
            backgroundColor: c.tape,
            borderWidth: 1,
            borderColor: flagged ? c.warn : c.rule,
            borderLeftWidth: flagged ? 3 : 1,
            paddingHorizontal: space.md,
            paddingVertical: space.sm,
          },
        ]}
      />
    </View>
  );
}
