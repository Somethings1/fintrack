import { useRef, useState } from 'react';
import { Text } from 'react-native';
import * as Crypto from 'expo-crypto';
import { type LedgerConfig, type LedgerRow, type Values, amountMicros, normalizeAmount, localDate, dateAtNoon } from '@fintrack/client';
import type { Draft } from './vault';
import { Button, ErrorText, Field, Notice, Picker, Sheet, styles } from './ui';

export function transactionValues(input: { amount: string; type: string; source: string; destination: string; category: string; note: string; day: string }, config: LedgerConfig): Values {
  const amount = normalizeAmount(input.amount, config);
  if (amountMicros(amount) <= 0n) throw new Error('Amount must be greater than zero.');
  if (!['expense', 'income', 'transfer'].includes(input.type)) throw new Error('Choose the transaction type.');
  if ((input.type !== 'income' && !input.source) || (input.type !== 'expense' && !input.destination) || (input.type !== 'transfer' && !input.category)) throw new Error('Choose the account and category.');
  if (input.type === 'transfer' && input.source === input.destination) throw new Error('Choose two different accounts.');
  return { amount, currency: config.currency, type: input.type, sourceAccount: input.type === 'income' ? '' : input.source,
    destinationAccount: input.type === 'expense' ? '' : input.destination, category: input.type === 'transfer' ? '' : input.category,
    note: input.note, dateTime: dateAtNoon(input.day) };
}
export default function Entry({ config, accounts, categories, save, close }: { config: LedgerConfig; accounts: LedgerRow[]; categories: LedgerRow[]; save: (draft: Draft, submit: boolean) => Promise<void>; close: () => void }) {
  const [type, setType] = useState('expense'); const [amount, setAmount] = useState(''); const [note, setNote] = useState('');
  const [source, setSource] = useState(accounts[0]?._id ?? ''); const [destination, setDestination] = useState(''); const [category, setCategory] = useState('');
  const [day, setDay] = useState(localDate()); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const lock = useRef(false);
  const submit = async (online: boolean) => {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try {
      const values = transactionValues({ amount, type, source, destination, category, note, day }, config);
      await save({ id: Crypto.randomUUID(), values, state: 'local', createdAt: new Date().toISOString() }, online); close();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save the draft.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const choices = accounts.map(v => ({ id: v._id, name: v.name || v._id }));
  return <Sheet title="Record a transaction" close={close} busy={busy}>
    <Text style={styles.heading}>What happened?</Text>
    <Picker label="Type" value={type} options={[{ id: 'expense', name: 'Expense' }, { id: 'income', name: 'Income' }, { id: 'transfer', name: 'Transfer to an account or saving' }]} onChange={v => { setType(v); setCategory(''); }} />
    <Field label={`Amount (${config.currency})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" maxLength={24} placeholder="0" autoFocus />
    {type !== 'income' && <Picker label="From account" value={source} options={choices} onChange={setSource} />}
    {type !== 'expense' && <Picker label="To account" value={destination} options={choices} onChange={setDestination} />}
    {type !== 'transfer' && <Picker label="Category" value={category} options={categories.filter(v => v.type === type).map(v => ({ id: v._id, name: v.name || v._id }))} onChange={setCategory} />}
    <Field label="Date (YYYY-MM-DD, device time)" value={day} onChangeText={setDay} maxLength={10} />
    <Field label="Note (optional)" value={note} onChangeText={setNote} maxLength={120} />
    <Notice>Review before saving. This records a ledger entry; it does not move money at your bank. Dates are recorded at noon in your device timezone.</Notice>
    <ErrorText error={error} />
    <Button title={busy ? 'Saving…' : 'Confirm and save online'} disabled={busy} onPress={() => void submit(true)} />
    <Button title="Save draft on this device" secondary disabled={busy} onPress={() => void submit(false)} />
  </Sheet>;
}
