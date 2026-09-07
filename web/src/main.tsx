import { AppBoundary } from './components/AppBoundary';
import 'antd/dist/reset.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadLedgerConfig } from './config/ledger';

const root = createRoot(document.getElementById('root')!);
async function start() {
  root.render(<p role="status">Loading ledger configuration...</p>);
  try {
    await loadLedgerConfig();
    const { default: App } = await import('./App.tsx');
    root.render(<StrictMode><AppBoundary><App /></AppBoundary></StrictMode>);
  } catch {
    // Do not display balances with a guessed currency, or expose internal errors.
    root.render(<main role="alert"><h1>FinTrack is temporarily unavailable</h1>
      <p>The ledger configuration could not be loaded. Your saved data has not been changed.</p>
      <button onClick={() => { void start(); }}>Retry</button></main>);
  }
}
void start();
