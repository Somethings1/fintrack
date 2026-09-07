import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addMoney, subtractMoney, sumMoney, moneyUnits, decimalString, validateMoney } from '../src/utils/money.ts';
import { parseLedgerConfig } from '../src/config/ledger.ts';
test('decimal totals, subtraction and exponent inputs are exact', () => {
  assert.equal(addMoney(0.1, 0.2), 0.3);
  assert.equal(subtractMoney(1, 0.9), 0.1);
  assert.equal(sumMoney(Array(1000).fill(0.01)), 10);
  assert.equal(decimalString(moneyUnits('-1.234e2')), '-123.4');
  assert.throws(() => addMoney(0.30000000000000004, 0));
  assert.throws(() => moneyUnits('NaN'));
  assert.throws(() => moneyUnits('1e100'));
});
test('precision and limits cannot silently round', () => {
  assert.equal(validateMoney('0.01', 2, true), true);
  assert.equal(validateMoney('0.001', 2, true), false);
  assert.equal(validateMoney('10.1', 0), false);
  assert.equal(validateMoney('0.001', 3, true), true);
  assert.equal(validateMoney('0', 2, true), false);
  assert.equal(validateMoney('1000000000000.01', 2), false);
  assert.equal(validateMoney(null, 2), false);
});
test('ledger version, currency and precision are validated together', () => {
  assert.equal(parseLedgerConfig({currency:'VND',precision:0,moneyVersion:1}).currency, 'VND');
  for (const value of [null, {}, {currency:'USD',precision:0,moneyVersion:1}, {currency:'USD',precision:2,moneyVersion:2}, {currency:'__proto__',moneyVersion:1}]) {
    assert.throws(() => parseLedgerConfig(value));
  }
});
