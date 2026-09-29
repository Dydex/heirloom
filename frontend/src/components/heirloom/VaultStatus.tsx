import { describeBlocks, explorerAddressUrl, formatStx, shortAddress, type Vault } from '@/lib/heirloom';
import { inset, muted } from './ui';

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={inset}>
      <p className={`text-[11px] font-mono ${muted} mb-1`}>{label}</p>
      <div className="text-[15px] font-instrument text-[#F4F3EF] break-all">{children}</div>
    </div>
  );
}

/** Countdown + vault facts. `viewer` changes the wording, not the data. */
export function VaultStatus({ vault, viewer }: { vault: Vault; viewer: 'owner' | 'heir' }) {
  const elapsed = Math.max(0, vault.currentHeight - vault.lastCheckIn);
  const blocksLeft = Math.max(0, vault.unlockHeight - vault.currentHeight);
  const pct = Math.min(100, (elapsed / vault.period) * 100);

  const headline = vault.claimable
    ? viewer === 'owner'
      ? 'Your heir can claim this vault now. Check in to stop it.'
      : 'The owner has gone silent. This vault can be claimed.'
    : viewer === 'owner'
      ? `${blocksLeft.toLocaleString()} Bitcoin block${blocksLeft === 1 ? '' : 's'} until your heir can claim`
      : `Unlocks in ${blocksLeft.toLocaleString()} Bitcoin block${blocksLeft === 1 ? '' : 's'} unless the owner checks in`;

  return (
    <div>
      <div className="mb-6">
        <p
          className={`text-[20px] md:text-[24px] font-instrument font-medium leading-tight ${
            vault.claimable ? 'text-[#F7931A]' : 'text-[#F4F3EF]'
          }`}
        >
          {headline}
        </p>
        {!vault.claimable && (
          <p className={`text-[12px] font-mono ${muted} mt-1`}>{describeBlocks(blocksLeft)} at the current block rate</p>
        )}
        <div
          className="h-2 bg-[#131416] rounded-full mt-4 overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          aria-label="Time elapsed since last check-in"
        >
          <div
            className={`h-full rounded-full transition-all ${vault.claimable ? 'bg-[#F7931A]' : 'bg-[#4ADE80]'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className={`text-[11px] font-mono ${muted} mt-2`}>
          {elapsed.toLocaleString()} of {vault.period.toLocaleString()} blocks since last check-in
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat label="Locked">{formatStx(vault.balance)} STX</Stat>
        <Stat label="Heir">
          <a href={explorerAddressUrl(vault.heir)} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {shortAddress(vault.heir)}
          </a>
        </Stat>
        <Stat label="Check-in period">
          {vault.period.toLocaleString()} blocks
          <span className={`block text-[11px] font-mono ${muted}`}>{describeBlocks(vault.period)}</span>
        </Stat>
        <Stat label="Last check-in">Block {vault.lastCheckIn.toLocaleString()}</Stat>
        <Stat label="Unlocks at">Block {vault.unlockHeight.toLocaleString()}</Stat>
        <Stat label="Current Bitcoin block">{vault.currentHeight.toLocaleString()}</Stat>
      </div>
    </div>
  );
}
