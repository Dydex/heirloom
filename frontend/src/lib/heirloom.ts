import { scaffoldConfig } from '@/scaffold.config';

export type Vault = {
  heir: string;
  balance: bigint;
  period: number;
  lastCheckIn: number;
  unlockHeight: number;
  currentHeight: number;
  claimable: boolean;
};

type CvJson = { type?: string; value?: unknown };

function field(tuple: Record<string, CvJson>, key: string): unknown {
  return tuple[key]?.value;
}

/**
 * The generated read-only hook returns cvToValue output, which drops the
 * (ok …)/(err …) wrapper: a vault arrives as a cvToJSON tuple and
 * ERR_NO_VAULT arrives as a bare `{ type: "uint", value: "100" }`.
 * Anything that isn't a tuple with a heir means "no vault".
 */
export function parseVault(data: unknown): Vault | null {
  if (!data || typeof data !== 'object') return null;
  const tuple = (data as CvJson).value as Record<string, CvJson> | undefined;
  if (!tuple || typeof tuple !== 'object' || !('heir' in tuple)) return null;
  return {
    heir: String(field(tuple, 'heir')),
    balance: BigInt(String(field(tuple, 'balance'))),
    period: Number(field(tuple, 'period')),
    lastCheckIn: Number(field(tuple, 'last-check-in')),
    unlockHeight: Number(field(tuple, 'unlock-height')),
    currentHeight: Number(field(tuple, 'current-height')),
    claimable: field(tuple, 'claimable') === true,
  };
}

export function isValidPrincipal(addr: string | null | undefined): addr is string {
  return typeof addr === 'string' && /^(ST|SP|SN|SM)[0-9A-HJ-NP-Z]{38,41}$/.test(addr.trim());
}

const MICRO = 1_000_000n;

export function formatStx(micro: bigint): string {
  const whole = micro / MICRO;
  const fraction = (micro % MICRO).toString().padStart(6, '0').replace(/0+$/, '');
  return `${whole.toLocaleString()}${fraction ? `.${fraction}` : ''}`;
}

/** Parse a user-typed STX amount into micro-STX without float rounding. */
export function toMicroStx(input: string): bigint | null {
  const match = input.trim().match(/^(\d+)(?:\.(\d{1,6}))?$/);
  if (!match) return null;
  const micro = BigInt(match[1]) * MICRO + BigInt((match[2] ?? '').padEnd(6, '0'));
  return micro > 0n ? micro : null;
}

// Bitcoin mainnet averages 10 minutes a block; Stacks testnet's burn chain runs faster.
export const MINUTES_PER_BLOCK = scaffoldConfig.isMainnet ? 10 : 4;

export function describeBlocks(blocks: number): string {
  const minutes = blocks * MINUTES_PER_BLOCK;
  if (minutes < 90) return `~${minutes} min`;
  const hours = minutes / 60;
  if (hours < 48) return `~${Math.round(hours)} hours`;
  const days = hours / 24;
  if (days < 60) return `~${Math.round(days)} days`;
  if (days < 730) return `~${Math.round(days / 30)} months`;
  return `~${(days / 365).toFixed(1)} years`;
}

// Presets are defined in real time and converted to blocks for the active network.
const blocksFor = (minutes: number) => Math.max(1, Math.round(minutes / MINUTES_PER_BLOCK));

export const PERIOD_PRESETS = [
  { label: 'Demo', blocks: 3 },
  { label: '1 month', blocks: blocksFor(30 * 24 * 60) },
  { label: '6 months', blocks: blocksFor(182 * 24 * 60) },
  { label: '1 year', blocks: blocksFor(365 * 24 * 60) },
];

export const MAX_PERIOD = 262_800;

const ERRORS: Record<string, string> = {
  u100: 'No vault exists for this owner.',
  u101: 'You already have a vault.',
  u102: 'Only the named heir can claim this vault.',
  u103: 'The owner is still checking in. The vault is not claimable yet.',
  u104: 'Invalid amount.',
  u105: 'Invalid check-in period.',
  u106: 'You cannot name yourself as your own heir.',
};

/** Turn a tx result like "(err u103)" into a readable message. */
export function explainTxError(repr: string | null): string {
  if (!repr) return 'Transaction failed.';
  const code = repr.match(/u\d+/)?.[0];
  return (code && ERRORS[code]) || repr;
}

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function explorerAddressUrl(addr: string): string {
  return `https://explorer.hiro.so/address/${addr}${scaffoldConfig.explorerChainQuery}`;
}
