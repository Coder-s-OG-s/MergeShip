/**
 * @vitest-environment jsdom
 */
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CopyButton } from './copy-button';

describe('CopyButton', () => {
  const mockWriteText = vi.fn();

  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });
    mockWriteText.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders successfully', () => {
    render(<CopyButton textToCopy="test-text" />);
    const button = screen.getByRole('button', { name: /copy handle to clipboard/i });
    expect(button).toBeInTheDocument();

    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  it('copies text and shows success state temporarily', async () => {
    render(<CopyButton textToCopy="test-text" />);

    const button = screen.getByRole('button', { name: /copy handle to clipboard/i });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(mockWriteText).toHaveBeenCalledWith('test-text');

    const svg = button.querySelector('svg');
    expect(svg).toHaveClass('text-emerald-500');

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    const revertedSvg = button.querySelector('svg');
    expect(revertedSvg).not.toHaveClass('text-emerald-500');
  });
});
