/**
 * @vitest-environment jsdom
 */
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { RouteError } from './route-error';
import { captureException } from '@/lib/posthog/helpers';

vi.mock('@/lib/posthog/helpers', () => ({
  captureException: vi.fn(),
}));

const mockCaptureException = vi.mocked(captureException);

describe('RouteError', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    mockCaptureException.mockReset();
  });

  it('renders the themed fallback and reports the error on mount', () => {
    const error = Object.assign(new Error('boom'), { digest: 'abc123' });
    render(<RouteError error={error} reset={vi.fn()} />);

    expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
    expect(mockCaptureException).toHaveBeenCalledWith(error, { digest: 'abc123' });
  });

  it('surfaces the message and digest in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const error = Object.assign(new Error('detailed failure'), { digest: 'deadbeef' });
    render(<RouteError error={error} reset={vi.fn()} />);

    expect(screen.getByText('detailed failure')).toBeInTheDocument();
    expect(screen.getByText(/deadbeef/)).toBeInTheDocument();
  });

  it('hides the raw message outside development', () => {
    vi.stubEnv('NODE_ENV', 'production');
    render(<RouteError error={new Error('secret internals')} reset={vi.fn()} />);

    expect(screen.queryByText('secret internals')).not.toBeInTheDocument();
  });

  it('calls reset when Retry is clicked', () => {
    const reset = vi.fn();
    render(<RouteError error={new Error('boom')} reset={reset} />);

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
