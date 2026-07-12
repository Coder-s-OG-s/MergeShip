'use client';

import { useState, useEffect } from 'react';

export function useSeasonCountdown() {
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchCohortEndDate() {
      try {
        setIsLoading(true);
        const response = await fetch('/api/cohort/end-date');
        if (response.ok) {
          const data = await response.json();
          if (data.endsAt) {
            setEndDate(new Date(data.endsAt));
          }
        }
      } catch (error) {
        console.error('Failed to fetch cohort end date:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCohortEndDate();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const getCountdownText = () => {
    if (!endDate) return 'No season';

    const diff = endDate.getTime() - now.getTime();

    if (diff <= 0) return 'Season ended';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    return `${days}d ${hours}h`;
  };

  return {
    countdownText: getCountdownText(),
    isLoading,
    endDate,
  };
}
