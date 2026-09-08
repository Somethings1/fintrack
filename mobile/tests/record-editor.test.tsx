import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { expect, it, jest } from '@jest/globals';
import RecordEditor from '../src/RecordEditor';

jest.mock('expo-crypto', () => ({ randomUUID: () => 'metadata-edit' }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native'); return { SafeAreaView: View, SafeAreaProvider: View };
});
it('savings metadata edits preserve required dates and never send a balance overwrite', async () => {
  const save = jest.fn(async () => undefined);
  const row = { _id: '111111111111111111111111', currency: 'USD', lastUpdate: '2026-09-08T00:00:00Z', name: 'Trip', goal: '100', balance: '20', createdDate: '2026-01-01T13:42:00Z', goalDate: '2027-01-01T18:30:00Z' };
  const screen = render(<RecordEditor entity="saving" row={row} config={{ currency: 'USD', precision: 2, moneyVersion: 1 }} save={save} close={() => undefined} />);
  fireEvent.changeText(screen.getByLabelText('Name'), 'Japan');
  fireEvent.press(screen.getByRole('button', { name: 'Confirm and save' }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ recordVersion: row.lastUpdate, values: { currency: 'USD', name: 'Japan', icon: '', goal: '100', createdDate: row.createdDate, goalDate: row.goalDate } }));
});
