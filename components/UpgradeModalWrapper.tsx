'use client';

import { useEffect, useState, useMemo } from 'react';
import { UpgradeModal } from './UpgradeModal';

interface UpgradeModalWrapperProps {
  shouldShow: boolean;
  hiddenMatchCount: number;
  email: string;
}

export function UpgradeModalWrapper({ shouldShow, hiddenMatchCount, email }: UpgradeModalWrapperProps) {
  const [open, setOpen] = useState(false);
  const [hasDismissed, setHasDismissed] = useState(false);
  const storageKey = useMemo(
    () => (email ? `premium-upsell-dismissed-${email}` : 'premium-upsell-dismissed'),
    [email]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissed = window.localStorage.getItem(storageKey) === 'true';
    setHasDismissed(dismissed);
  }, [storageKey]);

  const persistDismissal = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, 'true');
    setHasDismissed(true);
  };

  useEffect(() => {
    if (shouldShow && hiddenMatchCount > 0 && !hasDismissed) {
      // Small delay to ensure page is loaded
      const timer = setTimeout(() => {
        setOpen(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [shouldShow, hiddenMatchCount, hasDismissed]);

  if (!shouldShow || hiddenMatchCount === 0 || hasDismissed) {
    return null;
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      persistDismissal();
    }
  };

  return (
    <UpgradeModal
      open={open}
      onOpenChange={handleOpenChange}
      hiddenMatchCount={hiddenMatchCount}
      email={email}
      onDismiss={persistDismissal}
    />
  );
}

