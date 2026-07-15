/**
 * @vitest-environment jsdom
 */
import { render, screen, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CooldownTimer } from './cooldown-timer';

describe('CooldownTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders correctly with remaining time', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    // 2 minutes and 30 seconds in the future
    const resetAt = now + 2 * 60 * 1000 + 30 * 1000;

    render(<CooldownTimer resetAt={resetAt} />);

    expect(screen.getByText(/LIMIT REACHED — TRY AGAIN IN 02:30/i)).toBeInTheDocument();
  });

  it('updates time as time passes', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const resetAt = now + 60 * 1000; // 1 minute in the future

    render(<CooldownTimer resetAt={resetAt} />);
    expect(screen.getByText(/01:00/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText(/00:59/i)).toBeInTheDocument();
  });

  it('calls onExpire when timer reaches zero', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const resetAt = now + 5000; // 5 seconds
    const onExpireMock = vi.fn();

    render(<CooldownTimer resetAt={resetAt} onExpire={onExpireMock} />);

    expect(onExpireMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onExpireMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/00:00/i)).toBeInTheDocument();
  });
});
