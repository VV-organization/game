import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

afterEach(() => vi.unstubAllGlobals());

describe('API error boundaries', () => {
  it('preserves an authoritative payment error code and HTTP status for recovery', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: 'PAYMENT_NOT_FOUND',
            message: 'Пополнение не найдено',
          }),
          { status: 404, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
    await expect(api('/topups/missing')).rejects.toMatchObject({
      message: 'Пополнение не найдено',
      status: 404,
      code: 'PAYMENT_NOT_FOUND',
    });
  });

  it('rejects an HTML proxy response even with HTTP 200 instead of treating it as data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>Unavailable</html>', { status: 200 })),
    );
    await expect(api('/session')).rejects.toMatchObject({ status: 200 });
  });

  it('keeps a temporary gateway error distinct from a missing payment', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Bad Gateway', { status: 502 })));
    await expect(api('/topups/pending')).rejects.toMatchObject({ status: 502 });
  });
});
