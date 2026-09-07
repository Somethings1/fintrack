export interface LedgerConfig { readonly currency: string; readonly precision: number; readonly moneyVersion: 1 }
const currencies: Readonly<Record<string, number>> = {
  JPY: 0, VND: 0, KRW: 0, USD: 2, EUR: 2, GBP: 2, CAD: 2, AUD: 2,
  CHF: 2, SGD: 2, THB: 2, CNY: 2, KWD: 3, BHD: 3,
};
let ledger: LedgerConfig | undefined;
export function parseLedgerConfig(value: unknown): LedgerConfig {
  if (!value || typeof value !== 'object' || !('currency' in value) || !('precision' in value) || !('moneyVersion' in value) ||
      typeof value.currency !== 'string' || !Object.prototype.hasOwnProperty.call(currencies, value.currency) || currencies[value.currency] !== value.precision || value.moneyVersion !== 1) {
    throw new Error('Unsupported ledger configuration. Update the API and browser together.');
  }
  return Object.freeze({ currency: value.currency, precision: currencies[value.currency], moneyVersion: 1 });
}
export async function loadLedgerConfig(): Promise<LedgerConfig> {
  const response = await fetch('/api/config', { credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('Ledger configuration is unavailable');
  const text = await response.text();
  if (text.length > 4096) throw new Error('Invalid ledger configuration');
  ledger = parseLedgerConfig(JSON.parse(text) as unknown);
  return ledger;
}
export function getLedgerConfig(): LedgerConfig {
  if (!ledger) throw new Error('Ledger configuration has not loaded');
  return ledger;
}
