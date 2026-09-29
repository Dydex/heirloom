"use client";
import { useEffect, useState } from 'react';
import { useAtomValue } from 'jotai';
import { addressAtom, isMountedAtom } from '@/store/wallet';
import { HeirPanel } from './HeirPanel';
import { OwnerPanel } from './OwnerPanel';
import { card, muted } from './ui';

type Tab = 'owner' | 'heir';

export default function Heirloom() {
  const address = useAtomValue(addressAtom);
  const isMounted = useAtomValue(isMountedAtom);
  const [tab, setTab] = useState<Tab>('owner');
  const [linkedOwner, setLinkedOwner] = useState('');

  // A claim link (/?owner=ST…) opens straight into the heir view.
  useEffect(() => {
    const owner = new URLSearchParams(window.location.search).get('owner');
    if (owner) {
      setLinkedOwner(owner);
      setTab('heir');
    }
  }, []);

  const tabClass = (t: Tab) =>
    `flex-1 py-3 rounded-[40px] font-instrument text-[15px] transition-colors ${
      tab === t ? 'bg-[#F7931A] text-[#131416] font-semibold' : `${muted} hover:text-[#F4F3EF]`
    }`;

  return (
    <section className={`${card} mb-10`} id="app">
      <div role="tablist" className="flex gap-2 bg-[#131416] p-1.5 rounded-[40px] mb-8">
        <button role="tab" aria-selected={tab === 'owner'} onClick={() => setTab('owner')} className={tabClass('owner')}>
          My vault
        </button>
        <button role="tab" aria-selected={tab === 'heir'} onClick={() => setTab('heir')} className={tabClass('heir')}>
          I&apos;m an heir
        </button>
      </div>

      {!isMounted ? null : tab === 'owner' ? (
        address ? (
          <OwnerPanel address={address} />
        ) : (
          <p className={`font-mono text-[13px] ${muted} text-center py-8`}>
            Connect your wallet to create or manage your vault.
          </p>
        )
      ) : (
        <HeirPanel address={address} initialOwner={linkedOwner} key={linkedOwner} />
      )}
    </section>
  );
}
