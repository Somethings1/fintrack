import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import type { FinTrackClient } from '@fintrack/client';
import Chat from '../src/Chat';
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native'); return { SafeAreaView: View, SafeAreaProvider: View };
});
const config = { currency: 'USD', precision: 2, moneyVersion: 1 };
const proposal = { id: 'test-card', entity: 'account', operation: 'create', currency: 'USD', values: { name: 'Wallet', balance: '0' }, references: {}, warnings: [] };
const share = 'Share questions and relevant financial data with Google Gemini';
describe('mobile guarded chat', () => {
  it('requires consent, confirms only on click, and blocks a second click', async () => {
    let complete: (v: string) => void = () => undefined;
    const ask = jest.fn(async () => ({ answer: 'Review, not saved.', toolsUsed: ['propose_account'], proposal }));
    const confirm = jest.fn(() => new Promise<string>(resolve => { complete = resolve; }));
    const onWriting = jest.fn();
    const screen = render(<Chat api={{ ask, confirm } as unknown as FinTrackClient} config={config} refresh={async () => undefined} active onWriting={onWriting} />);
    fireEvent.changeText(screen.getByLabelText('Message to assistant'), 'Create Wallet');
    expect(screen.getByRole('button', { name: 'Ask assistant' }).props.accessibilityState.disabled).toBe(true);
    fireEvent(screen.getByLabelText(share), 'valueChange', true);
    fireEvent(screen.getByLabelText('Allow change proposals'), 'valueChange', true);
    fireEvent.press(screen.getByRole('button', { name: 'Ask assistant' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm change' })).toBeTruthy());
    expect(confirm).not.toHaveBeenCalled();
    const button = screen.getByRole('button', { name: 'Confirm change' });
    fireEvent.press(button); fireEvent.press(button);
    expect(confirm).toHaveBeenCalledTimes(1); expect(onWriting).toHaveBeenCalledWith(true);
    complete('111111111111111111111111');
    await waitFor(() => expect(screen.getByText(/Saved in FinTrack/)).toBeTruthy());
    expect(onWriting).toHaveBeenLastCalledWith(false);
  });
  it('permission changes remove actionable cards and old conversation context', async () => {
    const ask = jest.fn(async () => ({ answer: 'Review.', toolsUsed: [], proposal }));
    const screen = render(<Chat api={{ ask } as unknown as FinTrackClient} config={config} refresh={async () => undefined} active onWriting={() => undefined} />);
    fireEvent(screen.getByLabelText(share), 'valueChange', true);
    fireEvent(screen.getByLabelText('Allow change proposals'), 'valueChange', true);
    fireEvent.changeText(screen.getByLabelText('Message to assistant'), 'Create Wallet');
    fireEvent.press(screen.getByRole('button', { name: 'Ask assistant' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm change' })).toBeTruthy());
    fireEvent(screen.getByLabelText('Include stored transaction notes'), 'valueChange', true);
    expect(screen.queryByRole('button', { name: 'Confirm change' })).toBeNull();
  });
});
