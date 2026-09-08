import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import Entry from '../src/Entry';
jest.mock('expo-crypto', () => ({ randomUUID: () => 'stable-draft-id' }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native'); return { SafeAreaView: View, SafeAreaProvider: View };
});
const config = { currency: 'USD', precision: 2, moneyVersion: 1 };
const account = { _id: '111111111111111111111111', currency: 'USD', lastUpdate: '2026-09-08T00:00:00Z', name: 'Cash', balance: '100' };
const category = { _id: '222222222222222222222222', currency: 'USD', lastUpdate: account.lastUpdate, name: 'Food', type: 'expense' };
describe('quick capture', () => {
  it('saves an exact offline draft without an AI call', async () => {
    const save = jest.fn(async () => undefined); const close = jest.fn();
    const screen = render(<Entry config={config} accounts={[account]} categories={[category]} save={save} close={close} />);
    fireEvent.changeText(screen.getByLabelText('Amount (USD)'), '0.30');
    fireEvent.press(screen.getByRole('button', { name: 'Category: Choose' }));
    fireEvent.press(screen.getByRole('button', { name: 'Food' }));
    fireEvent.press(screen.getByRole('button', { name: 'Save draft on this device' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ state: 'local', values: expect.objectContaining({ amount: '0.3', sourceAccount: account._id, category: category._id }) }), false);
    expect(close).toHaveBeenCalledTimes(1);
  });
  it('does not send an invalid amount', async () => {
    const save = jest.fn(async () => undefined);
    const screen = render(<Entry config={config} accounts={[account]} categories={[category]} save={save} close={() => undefined} />);
    fireEvent.changeText(screen.getByLabelText('Amount (USD)'), '0.001');
    fireEvent.press(screen.getByRole('button', { name: 'Confirm and save online' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy()); expect(save).not.toHaveBeenCalled();
  });
});
