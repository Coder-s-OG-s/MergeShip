/**
 * @vitest-environment jsdom
 */
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Loading from './loading';

describe('settings/profile loading', () => {
  it('renders skeleton placeholders', () => {
    const { container } = render(<Loading />);
    expect(container.querySelectorAll('[aria-hidden]').length).toBeGreaterThan(0);
  });
});
