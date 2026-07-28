/**
 * @vitest-environment jsdom
 */
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { Skeleton, SkeletonText, SkeletonCard, SkeletonTableRow, SkeletonStat } from './skeleton';

describe('skeleton primitives', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the base block with the pulse animation', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass('animate-pulse');
  });

  it('merges custom classes onto the base block', () => {
    const { container } = render(<Skeleton className="h-8 w-8" />);
    expect(container.firstChild).toHaveClass('h-8', 'w-8', 'animate-pulse');
  });

  it('renders text, stat, and card primitives without crashing', () => {
    expect(() =>
      render(
        <>
          <SkeletonText />
          <SkeletonStat />
          <SkeletonCard />
        </>,
      ),
    ).not.toThrow();
  });

  it('renders card children when provided instead of the default lines', () => {
    const { getByText } = render(
      <SkeletonCard>
        <span>custom content</span>
      </SkeletonCard>,
    );
    expect(getByText('custom content')).toBeInTheDocument();
  });

  it('renders the requested number of table row cells', () => {
    const { container } = render(<SkeletonTableRow columns={3} />);
    const row = container.firstChild as HTMLElement;
    expect(row.children).toHaveLength(3);
  });
});
