import { useRef, useState } from 'react';
import { Text } from 'react-native';
import * as Crypto from 'expo-crypto';
import { type LedgerConfig, type LedgerRow, type Proposal, type Values, normalizeAmount, localDate, dateAtNoon } from '@fintrack/client';
import { Button, ErrorText, Field, Notice, Picker, Sheet, styles } from './ui';

export type EditableEntity = 'account' | 'saving' | 'category';
export default function RecordEditor({ entity, row, config, save, close }: { entity: EditableEntity; row?: LedgerRow; config: LedgerConfig; save: (p: Proposal) => Promise<void>; close: () => void }) {
  const [name, setName] = useState(row?.name ?? ''); const [amount, setAmount] = useState(entity === 'saving' ? row?.goal ?? '0' : entity === 'category' ? row?.budget ?? '0' : '0');
  const [type, setType] = useState(row?.type ?? 'expense');
  const [day, setDay] = useState(row?.goalDate && !row.goalDate.startsWith('0001-') ? localDate(new Date(row.goalDate)) : '');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [attempted, setAttempted] = useState(false); const lock = useRef(false);
  const submit = async () => {
    if (lock.current || attempted) return;
    setError('');
    try {
      if (!name.trim() || name.trim().length > 80) throw new Error('Enter a name with at most 80 characters.');
      const values: Values = { currency: config.currency, name: name.trim(), icon: row?.icon ?? '' };
      if (entity === 'category') { values.type = type; values.budget = normalizeAmount(amount, config); }
      if (entity === 'account' && !row) values.balance = normalizeAmount(amount, config);
      if (entity === 'saving') {
        values.goal = normalizeAmount(amount, config);
        const previousDay = row?.goalDate && !row.goalDate.startsWith('0001-') ? localDate(new Date(row.goalDate)) : '';
        values.goalDate = row?.goalDate && day === previousDay ? row.goalDate : day ? dateAtNoon(day) : '0001-01-01T00:00:00Z';
        // The API requires both dates even on update; preserve creation metadata.
        values.createdDate = row ? row.createdDate ?? '0001-01-01T00:00:00Z' : new Date().toISOString();
        if (!row) values.balance = '0';
      }
      if (amount.trim().startsWith('-')) throw new Error('Use a non-negative amount.');
      lock.current = true; setBusy(true); setAttempted(true);
      await save({ id: Crypto.randomUUID(), entity, operation: row ? 'update' : 'create', recordId: row?._id, recordVersion: row?.lastUpdate, currency: config.currency, values, references: {}, warnings: [] }); close();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save. Inspect records before trying again.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <Sheet title={`${row ? 'Edit' : 'Create'} ${entity}`} close={close} busy={busy}>
    <Field label="Name" value={name} onChangeText={setName} maxLength={80} />
    {entity === 'category' && !row && <Picker label="Category type" value={type} options={[{ id: 'expense', name: 'Expense' }, { id: 'income', name: 'Income' }]} onChange={setType} />}
    {(entity !== 'account' || !row) && <Field label={`${entity === 'saving' ? 'Savings target' : entity === 'category' ? 'Monthly budget (0 removes limit)' : 'Opening balance'} (${config.currency})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" maxLength={24} />}
    {entity === 'saving' && <Field label="Target date (YYYY-MM-DD, optional)" value={day} onChangeText={setDay} maxLength={10} />}
    <Notice>Changes require a connection. Existing balances are ledger-controlled; use a transfer or transaction to change them.</Notice>
    <ErrorText error={error} />
    {attempted && !!error && <Text style={styles.muted}>This submission will not automatically retry. Close, refresh, and inspect records before making another change.</Text>}
    <Button title="Confirm and save" disabled={busy || attempted} onPress={() => void submit()} />
  </Sheet>;
}
