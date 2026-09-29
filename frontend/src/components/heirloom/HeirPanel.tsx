"use client";
import { useState } from 'react';
import { Cl } from '@stacks/transactions';
import { useHeirloom_Claim } from '@/generated/hooks';
import { formatStx, isValidPrincipal } from '@/lib/heirloom';
import { TxStatus, useOnTxSuccess } from './TxStatus';
import { useVault } from './useVault';
import { VaultStatus } from './VaultStatus';
import { input, label, muted, primaryButton } from './ui';

export function HeirPanel({ address, initialOwner }: { address: string | null; initialOwner: string }) {
  const [ownerInput, setOwnerInput] = useState(initialOwner);
  const owner = isValidPrincipal(ownerInput) ? ownerInput.trim() : null;
  const { vault, refresh, error } = useVault(owner);
  const claim = useHeirloom_Claim();
  const [claimed, setClaimed] = useState<bigint | null>(null);
  useOnTxSuccess(claim, () => {
    if (vault) setClaimed(vault.balance);
    void refresh();
  });

  const isHeir = Boolean(vault && address && vault.heir === address);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[22px] font-instrument font-medium">Claim an inheritance</h2>
        <p className={`text-[13px] ${muted} mt-1`}>
          Enter the address of the person who named you as their heir, or open the link they sent you.
        </p>
      </div>
      <div>
        <label htmlFor="owner" className={label}>Owner&apos;s Stacks address</label>
        <input id="owner" value={ownerInput} onChange={e => setOwnerInput(e.target.value)} placeholder="ST…" className={input} autoComplete="off" />
        {ownerInput.trim() && !owner && <p className="text-[11px] font-mono text-[#F87171] mt-1">Not a valid Stacks address</p>}
      </div>

      {claimed !== null && (
        <p className="text-[#4ADE80] font-instrument text-[18px]">
          You received {formatStx(claimed)} STX. The vault is now closed.
        </p>
      )}

      {owner && vault === undefined && (
        <p className={`font-mono text-[13px] ${muted}`}>{error ? `Could not load vault: ${error.message}` : 'Looking up vault…'}</p>
      )}
      {owner && vault === null && claimed === null && (
        <p className={`font-mono text-[13px] ${muted}`}>This address has no vault.</p>
      )}

      {vault && (
        <>
          <VaultStatus vault={vault} viewer="heir" />
          {!address ? (
            <p className={`font-mono text-[13px] ${muted}`}>Connect the heir&apos;s wallet to claim.</p>
          ) : !isHeir ? (
            <p className="font-mono text-[13px] text-[#F87171]">The connected wallet is not the named heir of this vault.</p>
          ) : (
            <div>
              <button
                onClick={() => void claim.call([Cl.principal(owner!)]).catch(() => {})}
                disabled={!vault.claimable || claim.loading}
                className={`${primaryButton} w-full text-[18px] py-4`}
              >
                {vault.claimable ? `Claim ${formatStx(vault.balance)} STX` : 'Not claimable yet'}
              </button>
              <TxStatus tx={claim} success="Claimed." />
            </div>
          )}
        </>
      )}
    </div>
  );
}
