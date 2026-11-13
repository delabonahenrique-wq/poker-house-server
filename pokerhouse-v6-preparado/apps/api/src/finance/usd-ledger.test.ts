import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REAL_MONEY_FEATURES, assertRealMoneyDisabled, parseUsdMinor,
  formatUsdMinor, validateBalancedUsdDraft
} from './usd-ledger.js';

test('all real-money capabilities are disabled by default', () => {
  assert.deepEqual(REAL_MONEY_FEATURES, {
    realMoney:false, deposits:false, cashGames:false,
    tournamentPrizes:false, withdrawals:false, peerTransfers:false
  });
  assert.throws(() => assertRealMoneyDisabled('deposits'), /REAL_MONEY_DISABLED/);
  assert.throws(() => assertRealMoneyDisabled('withdrawals'), /REAL_MONEY_DISABLED/);
});

test('parses and formats USD using exact cents', () => {
  assert.equal(parseUsdMinor('12'), 1200n);
  assert.equal(parseUsdMinor('12.3'), 1230n);
  assert.equal(parseUsdMinor('12.34'), 1234n);
  assert.equal(formatUsdMinor(1234n), '$12.34');
  assert.throws(() => parseUsdMinor('1.234'), /INVALID_USD_AMOUNT/);
  assert.throws(() => parseUsdMinor('-1'), /INVALID_USD_AMOUNT/);
  assert.throws(() => parseUsdMinor('0'), /POSITIVE/);
});

test('accepts balanced USD double-entry drafts', () => {
  const draft = validateBalancedUsdDraft([
    { accountId:'provider-clearing', direction:'DEBIT', amountMinor:2500n, currency:'USD' },
    { accountId:'customer-available', direction:'CREDIT', amountMinor:2500n, currency:'USD' }
  ]);
  assert.equal(draft.totalMinor, 2500n);
  assert.equal(draft.currency, 'USD');
});

test('rejects unbalanced, non-USD, and non-positive ledger entries', () => {
  assert.throws(() => validateBalancedUsdDraft([
    { accountId:'a', direction:'DEBIT', amountMinor:100n, currency:'USD' },
    { accountId:'b', direction:'CREDIT', amountMinor:99n, currency:'USD' }
  ]), /NOT_BALANCED/);
  assert.throws(() => validateBalancedUsdDraft([
    { accountId:'a', direction:'DEBIT', amountMinor:100n, currency:'BRL' as 'USD' },
    { accountId:'b', direction:'CREDIT', amountMinor:100n, currency:'USD' }
  ]), /USD_ONLY/);
  assert.throws(() => validateBalancedUsdDraft([
    { accountId:'a', direction:'DEBIT', amountMinor:0n, currency:'USD' },
    { accountId:'b', direction:'CREDIT', amountMinor:0n, currency:'USD' }
  ]), /INVALID_LEDGER_AMOUNT/);
});
