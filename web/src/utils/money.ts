/** Decimal arithmetic for display totals. No rounding of monetary inputs.
 * Charts/percentages may use floats for geometry, but never for accumulating money.
 * Numbers are retained at the UI boundary only when their decimal spelling is exact.
 */
const SCALE = 1_000_000n;
export function moneyUnits(value: number | string): bigint {
  const text = String(value);
  if (text.length > 64) throw new RangeError('Amount is too large');
  const match = /^(-?)(0|[1-9][0-9]*)(?:\.([0-9]+))?(?:[eE]([+-]?[0-9]{1,2}))?$/.exec(text);
  if (!match) throw new TypeError('Invalid decimal amount');
  const [, sign, whole, fraction = '', exponent = '0'] = match;
  const digits = BigInt(whole + fraction);
  const shift = 6 + Number(exponent) - fraction.length;
  const divisor = 10n ** BigInt(Math.abs(shift));
  if (shift < 0 && digits % divisor !== 0n) throw new RangeError('Amount has excess decimal precision');
  return (sign ? -1n : 1n) * (shift < 0 ? digits / divisor : digits * divisor);
}
export function decimalString(units: bigint): string {
  const value = units < 0n ? -units : units;
  const fraction = (value % SCALE).toString().padStart(6, '0').replace(/0+$/, '');
  return `${units < 0n ? '-' : ''}${value / SCALE}${fraction ? '.' + fraction : ''}`;
}
function exactNumber(units: bigint): number {
  const number = Number(decimalString(units));
  if (!Number.isFinite(number) || moneyUnits(number) !== units) {
    throw new RangeError('Total exceeds exact browser display range');
  }
  return number;
}
export function addMoney(a: number, b: number): number { return exactNumber(moneyUnits(a) + moneyUnits(b)); }
export function subtractMoney(a: number, b: number): number { return exactNumber(moneyUnits(a) - moneyUnits(b)); }
export function sumMoney(values: readonly number[]): number {
  return exactNumber(values.reduce((sum, value) => sum + moneyUnits(value), 0n));
}
export function validateMoney(value: unknown, precision: number, positive = false): boolean {
  if ((typeof value !== 'number' && typeof value !== 'string') || !Number.isInteger(precision) || precision < 0 || precision > 3) return false;
  try {
    const units = moneyUnits(value);
    return units >= (positive ? 1n : 0n) && units <= 1_000_000_000_000n * SCALE && units % (10n ** BigInt(6 - precision)) === 0n;
  } catch { return false; }
}
