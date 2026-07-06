import { describe, it, expect } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

describe('/api/quiz/submit', () => {
  const correctAnswers = [0, 2, 1, 3, 2, 0, 1];

  it('should compute score correctly for perfect answers (100%)', async () => {
    const request = new NextRequest('http://localhost/api/quiz/submit', {
      method: 'POST',
      body: JSON.stringify({ answers: correctAnswers }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.score).toBe(1);
    expect(data.level).toBe(2);
  });

  it('should place at level 2 for 80% or higher score', async () => {
    const almostPerfect = [0, 2, 1, 3, 2, 1, 1];
    const request = new NextRequest('http://localhost/api/quiz/submit', {
      method: 'POST',
      body: JSON.stringify({ answers: almostPerfect }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.score).toBeGreaterThanOrEqual(0.8);
    expect(data.level).toBe(2);
  });

  it('should place at level 1 for 60-79% score', async () => {
    const partialAnswers = [0, 2, 1, 1, 2, 1, 1];
    const request = new NextRequest('http://localhost/api/quiz/submit', {
      method: 'POST',
      body: JSON.stringify({ answers: partialAnswers }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.score).toBeGreaterThanOrEqual(0.6);
    expect(data.score).toBeLessThan(0.8);
    expect(data.level).toBe(1);
  });

  it('should place at level 0 for less than 60% score', async () => {
    const poorAnswers = [1, 1, 1, 1, 1, 1, 1];
    const request = new NextRequest('http://localhost/api/quiz/submit', {
      method: 'POST',
      body: JSON.stringify({ answers: poorAnswers }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.score).toBeLessThan(0.6);
    expect(data.level).toBe(0);
  });

  it('should reject invalid answer count', async () => {
    const tooFewAnswers = [0, 2, 1];
    const request = new NextRequest('http://localhost/api/quiz/submit', {
      method: 'POST',
      body: JSON.stringify({ answers: tooFewAnswers }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.success).toBe(false);
  });

  it('should reject invalid request body', async () => {
    const request = new NextRequest('http://localhost/api/quiz/submit', {
      method: 'POST',
      body: JSON.stringify({ invalid: 'data' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.success).toBe(false);
  });

  it('should prevent score tampering by ignoring client-sent score', async () => {
    const allWrongAnswers = [3, 0, 0, 0, 0, 1, 3];
    const tamperedRequest = {
      answers: allWrongAnswers,
      score: 100,
    };

    const request = new NextRequest('http://localhost/api/quiz/submit', {
      method: 'POST',
      body: JSON.stringify(tamperedRequest),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.score).toBe(0);
    expect(data.level).toBe(0);
  });
});
