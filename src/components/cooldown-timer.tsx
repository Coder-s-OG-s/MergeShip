'use client';

import { useEffect, useState } from 'react';

type CooldownTimerProps = {
  resetAt: number;
  onExpire?: () => void;
};

export function CooldownTimer({ resetAt, onExpire }: CooldownTimerProps) {
  const [now, setNow] = useState(Date.now());

  const remainingMs = Math.max(0, resetAt - now);

  useEffect(() => {
    if (remainingMs <= 0) return;

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [remainingMs]);

  useEffect(() => {
    if (remainingMs <= 0) {
      onExpire?.();
    }
  }, [remainingMs, onExpire]);

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    <span>
      LIMIT REACHED — TRY AGAIN IN {String(minutes).padStart(2, '0')}:
      {String(seconds).padStart(2, '0')}
    </span>
  );
}
