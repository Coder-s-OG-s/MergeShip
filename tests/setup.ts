import { beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Reset module-scoped state between tests so cache mocks don't leak.
beforeEach(() => {
  // intentionally empty; per-test mocks reset themselves
});
