"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { Cl } from '@stacks/transactions';
import { useHeirloom_GetVault } from '@/generated/hooks';
import { isValidPrincipal, parseVault, type Vault } from '@/lib/heirloom';

const REFRESH_MS = 30_000;

/**
 * Loads `owner`'s vault and keeps it fresh so the countdown advances on its own.
 * `vault` is undefined while unknown, null when the owner has no vault.
 */
export function useVault(owner: string | null) {
  const { call, error } = useHeirloom_GetVault();
  const [vault, setVault] = useState<Vault | null | undefined>(undefined);
  const current = useRef(owner);
  current.current = owner;

  const refresh = useCallback(async () => {
    if (!isValidPrincipal(owner)) return;
    try {
      const data = await call([Cl.principal(owner.trim())]);
      // Ignore responses for an owner the user has since navigated away from.
      if (current.current === owner) setVault(parseVault(data));
    } catch {
      // The hook exposes `error`; keep showing the last known state.
    }
  }, [owner, call]);

  useEffect(() => {
    setVault(undefined);
    if (!isValidPrincipal(owner)) return;
    void refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [owner, refresh]);

  return { vault, refresh, error };
}
