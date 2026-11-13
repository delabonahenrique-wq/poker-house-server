/**
 * Poker House financial domain primitives.
 * USD-only, integer minor units. No funds are moved and no PSP is connected here.
 * Real-money operations remain hard-disabled until legal/provider approval.
 */
export type LedgerDirection = 'DEBIT' | 'CREDIT';
export type LedgerEntryInput = {
  accountId: string;
  direction: LedgerDirection;
  amountMinor: bigint;
  currency: 'USD';
};
export type BalancedLedgerDraft = {
  currency: 'USD';
  entries: LedgerEntryInput[];
  totalMinor: bigint;
};

export const REAL_MONEY_FEATURES = Object.freeze({
  realMoney: false,
  deposits: false,
  cashGames: false,
  tournamentPrizes: false,
  withdrawals: false,
  peerTransfers: false,
} as const);

export function assertRealMoneyDisabled(feature: keyof typeof REAL_MONEY_FEATURES): never {
  if (REAL_MONEY_FEATURES[feature] !== false) {
    throw new Error('REAL_MONEY_REQUIRES_LEGAL_AND_PROVIDER_APPROVAL');
  }
  throw new Error('REAL_MONEY_DISABLED_PENDING_LEGAL_AND_PROVIDER_APPROVAL');
}

/** Parse a decimal USD string without floating-point arithmetic. */
export function parseUsdMinor(value: string): bigint {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.test(value)) {
    throw new Error('INVALID_USD_AMOUNT');
  }
  const [whole, fraction = ''] = value.split('.');
  const minor = BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
  if (minor <= 0n) throw new Error('USD_AMOUNT_MUST_BE_POSITIVE');
  return minor;
}

export function formatUsdMinor(amountMinor: bigint): string {
  if (amountMinor < 0n) throw new Error('INVALID_USD_AMOUNT');
  const whole = amountMinor / 100n;
  const cents = (amountMinor % 100n).toString().padStart(2, '0');
  return '$' + whole.toString() + '.' + cents;
}

/** Validates a double-entry draft; performs no database writes. */
export function validateBalancedUsdDraft(entries: LedgerEntryInput[]): BalancedLedgerDraft {
  if (!Array.isArray(entries) || entries.length < 2) throw new Error('LEDGER_REQUIRES_TWO_ENTRIES');
  let debits = 0n;
  let credits = 0n;
  for (const entry of entries) {
    if (!entry.accountId || entry.currency !== 'USD') throw new Error('USD_ONLY_LEDGER');
    if (typeof entry.amountMinor !== 'bigint' || entry.amountMinor <= 0n) throw new Error('INVALID_LEDGER_AMOUNT');
    if (entry.direction === 'DEBIT') debits += entry.amountMinor;
    else if (entry.direction === 'CREDIT') credits += entry.amountMinor;
    else throw new Error('INVALID_LEDGER_DIRECTION');
  }
  if (debits !== credits) throw new Error('LEDGER_NOT_BALANCED');
  return { currency: 'USD', entries: entries.map(entry => ({ ...entry })), totalMinor: debits };
}
 + whole.toString() + '.' + cents;
}

/** Validates a double-entry draft; performs no database writes. */
export function validateBalancedUsdDraft(entries: LedgerEntryInput[]): BalancedLedgerDraft {
  if (!Array.isArray(entries) || entries.length < 2) throw new Error('LEDGER_REQUIRES_TWO_ENTRIES');
  let debits = 0n;
  let credits = 0n;
  for (const entry of entries) {
    if (!entry.accountId || entry.currency !== 'USD') throw new Error('USD_ONLY_LEDGER');
    if (typeof entry.amountMinor !== 'bigint' || entry.amountMinor <= 0n) throw new Error('INVALID_LEDGER_AMOUNT');
    if (entry.direction === 'DEBIT') debits += entry.amountMinor;
    else if (entry.direction === 'CREDIT') credits += entry.amountMinor;
    else throw new Error('INVALID_LEDGER_DIRECTION');
  }
  if (debits !== credits) throw new Error('LEDGER_NOT_BALANCED');
  return { currency: 'USD', entries: entries.map(entry => ({ ...entry })), totalMinor: debits };
}
