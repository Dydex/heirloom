"use client";
import { useState } from 'react';
import { Cl, type ClarityValue } from '@stacks/transactions';
import {
  useHeirloom_CheckIn,
  useHeirloom_CreateVault,
  useHeirloom_Deposit,
  useHeirloom_SetHeir,
  useHeirloom_SetPeriod,
  useHeirloom_Withdraw,
} from '@/generated/hooks';
import {
  describeBlocks,
  formatStx,
  isValidPrincipal,
  MAX_PERIOD,
  PERIOD_PRESETS,
  toMicroStx,
  type Vault,
} from '@/lib/heirloom';
import { TxStatus, useOnTxSuccess, type TxHook } from './TxStatus';
import { useVault } from './useVault';
import { VaultStatus } from './VaultStatus';
import { input, inset, label, muted, primaryButton, secondaryButton } from './ui';

function PeriodPicker({ value, onChange }: { value: number; onChange: (blocks: number) => void }) {
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {PERIOD_PRESETS.map(p => (
          <button
            key={p.label}
            type="button"
            onClick={() => onChange(p.blocks)}
            aria-pressed={value === p.blocks}
            className={`${secondaryButton} ${value === p.blocks ? '!bg-[#F7931A] !text-[#131416]' : ''}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <input
        type="number"
        min={1}
        max={MAX_PERIOD}
        value={value || ''}
        onChange={e => onChange(Number(e.target.value))}
        className={input}
        aria-label="Check-in period in Bitcoin blocks"
      />
      <p className={`text-[11px] font-mono ${muted} mt-1`}>
        {value >= 1 && value <= MAX_PERIOD
          ? `${value.toLocaleString()} Bitcoin blocks, ${describeBlocks(value)}`
          : `Enter 1 to ${MAX_PERIOD.toLocaleString()} blocks`}
      </p>
    </div>
  );
}

function CreateVault({ owner, onCreated }: { owner: string; onCreated: () => void }) {
  const create = useHeirloom_CreateVault();
  const [heir, setHeir] = useState('');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState(PERIOD_PRESETS[0].blocks);
  useOnTxSuccess(create, onCreated);

  const micro = toMicroStx(amount);
  const heirTrimmed = heir.trim();
  const heirError =
    heirTrimmed && !isValidPrincipal(heirTrimmed)
      ? 'Not a valid Stacks address'
      : heirTrimmed === owner
        ? 'Your heir must be someone else'
        : null;
  const ready = isValidPrincipal(heirTrimmed) && !heirError && micro !== null && period >= 1 && period <= MAX_PERIOD;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || micro === null) return;
    void create.call([Cl.principal(heirTrimmed), Cl.uint(period), Cl.uint(micro)]).catch(() => {});
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h2 className="text-[22px] font-instrument font-medium">Create your vault</h2>
        <p className={`text-[13px] ${muted} mt-1`}>
          Lock STX and choose who inherits it. You can add, withdraw or change anything later.
        </p>
      </div>
      <div>
        <label htmlFor="heir" className={label}>Heir&apos;s Stacks address</label>
        <input id="heir" value={heir} onChange={e => setHeir(e.target.value)} placeholder="ST…" className={input} autoComplete="off" />
        {heirError && <p className="text-[11px] font-mono text-[#F87171] mt-1">{heirError}</p>}
      </div>
      <div>
        <label htmlFor="amount" className={label}>Amount to lock (STX)</label>
        <input id="amount" value={amount} onChange={e => setAmount(e.target.value)} placeholder="10" inputMode="decimal" className={input} />
      </div>
      <div>
        <p className={label}>Heir can claim if you don&apos;t check in for</p>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>
      <button type="submit" disabled={!ready || create.loading} className={primaryButton}>
        Lock {micro ? formatStx(micro) : ''} STX
      </button>
      <TxStatus tx={create} success="Vault created." />
    </form>
  );
}

/** A one-field form that submits a single contract call. */
function ActionRow({
  id,
  title,
  placeholder,
  button,
  success,
  hook,
  toArgs,
  onDone,
}: {
  id: string;
  title: string;
  placeholder: string;
  button: string;
  success: string;
  hook: TxHook & { call: (args: ClarityValue[]) => Promise<unknown> };
  toArgs: (value: string) => ClarityValue[] | null;
  onDone: () => void;
}) {
  const [value, setValue] = useState('');
  useOnTxSuccess(hook, () => {
    setValue('');
    onDone();
  });
  const args = toArgs(value);
  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        if (args) void hook.call(args).catch(() => {});
      }}
      className={inset}
    >
      <label htmlFor={id} className={label}>{title}</label>
      <div className="flex gap-2">
        <input id={id} value={value} onChange={e => setValue(e.target.value)} placeholder={placeholder} className={input} autoComplete="off" />
        <button type="submit" disabled={!args || hook.loading} className={secondaryButton}>
          {button}
        </button>
      </div>
      <TxStatus tx={hook} success={success} />
    </form>
  );
}

function ManageVault({ owner, vault, onChange }: { owner: string; vault: Vault; onChange: () => void }) {
  const checkIn = useHeirloom_CheckIn();
  const deposit = useHeirloom_Deposit();
  const withdraw = useHeirloom_Withdraw();
  const setHeir = useHeirloom_SetHeir();
  const setPeriod = useHeirloom_SetPeriod();
  const [copied, setCopied] = useState(false);
  useOnTxSuccess(checkIn, onChange);

  const claimLink = typeof window === 'undefined' ? '' : `${window.location.origin}/?owner=${owner}`;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(claimLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link for your heir:', claimLink);
    }
  };

  const microArgs = (v: string) => {
    const micro = toMicroStx(v);
    return micro ? [Cl.uint(micro)] : null;
  };

  return (
    <div className="space-y-6">
      <VaultStatus vault={vault} viewer="owner" />

      <div>
        <button onClick={() => void checkIn.call([]).catch(() => {})} disabled={checkIn.loading} className={`${primaryButton} w-full text-[18px] py-4`}>
          I&apos;m alive. Check in
        </button>
        <p className={`text-[11px] font-mono ${muted} mt-2 text-center`}>
          Resets the countdown to {vault.period.toLocaleString()} blocks. Every action below also counts as a check-in.
        </p>
        <TxStatus tx={checkIn} success="Checked in. Countdown reset." />
      </div>

      <div className={inset}>
        <p className={label}>Send this link to your heir</p>
        <div className="flex gap-2 items-center">
          <code className="flex-1 text-[12px] font-mono text-[#F4F3EF] truncate">{claimLink}</code>
          <button onClick={copyLink} className={secondaryButton}>{copied ? 'Copied' : 'Copy link'}</button>
        </div>
      </div>

      <details className="group">
        <summary className="cursor-pointer text-[14px] font-instrument text-[#F4F3EF] select-none">Manage vault</summary>
        <div className="grid md:grid-cols-2 gap-3 mt-4">
          <ActionRow id="deposit" title="Add STX" placeholder="5" button="Deposit" success="Deposited." hook={deposit} toArgs={microArgs} onDone={onChange} />
          <ActionRow
            id="withdraw"
            title={`Withdraw STX (max ${formatStx(vault.balance)})`}
            placeholder={formatStx(vault.balance)}
            button="Withdraw"
            success="Withdrawn."
            hook={withdraw}
            toArgs={v => {
              const micro = toMicroStx(v);
              return micro && micro <= vault.balance ? [Cl.uint(micro)] : null;
            }}
            onDone={onChange}
          />
          <ActionRow
            id="set-heir"
            title="Change heir"
            placeholder="ST…"
            button="Update"
            success="Heir updated."
            hook={setHeir}
            toArgs={v => (isValidPrincipal(v) && v.trim() !== owner ? [Cl.principal(v.trim())] : null)}
            onDone={onChange}
          />
          <ActionRow
            id="set-period"
            title="Change check-in period (blocks)"
            placeholder={String(vault.period)}
            button="Update"
            success="Period updated."
            hook={setPeriod}
            toArgs={v => {
              const n = Number(v);
              return Number.isInteger(n) && n >= 1 && n <= MAX_PERIOD ? [Cl.uint(n)] : null;
            }}
            onDone={onChange}
          />
        </div>
      </details>
    </div>
  );
}

export function OwnerPanel({ address }: { address: string }) {
  const { vault, refresh, error } = useVault(address);

  if (vault === undefined) {
    return <p className={`font-mono text-[13px] ${muted}`}>{error ? `Could not load your vault: ${error.message}` : 'Loading your vault…'}</p>;
  }
  if (vault === null) return <CreateVault owner={address} onCreated={refresh} />;
  return <ManageVault owner={address} vault={vault} onChange={refresh} />;
}
