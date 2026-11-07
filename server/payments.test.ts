import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPaymentGateway } from './payments';
import { generateKeyPairSync, sign } from 'node:crypto';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const env = {
  PAYMENT_MODE: 'arco',
  PUBLIC_URL: 'https://racing.example',
  ARCO_PAY_API_KEY: 'test-api-key',
  ARCO_PAY_BEARER_TOKEN: 'test-bearer',
  ARCO_PAY_SHOP_ID: '999',
  ARCO_PAY_PUBLIC_KEY: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
};
const order = (status = 'CREATED', extra = {}) => ({
  Response: { Success: true },
  Order: {
    OrderId: 'provider-order-1',
    MerchantOrderId: '11111111-1111-4111-8111-111111111111',
    ShopId: 999,
    Amount: 31100,
    Currency: 'RUB',
    Status: status,
    PaymentType: 'CARD',
    ...extra,
  },
});
const json = (data: unknown) =>
  new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
afterEach(() => vi.unstubAllGlobals());
describe('provider boundary', () => {
  it('is disabled without complete Arco configuration, including the removed sandbox mode', async () => {
    expect(createPaymentGateway({}).mode).toBe('disabled');
    expect(createPaymentGateway({ PAYMENT_MODE: 'arco' }).mode).toBe('disabled');
    expect(createPaymentGateway({ PAYMENT_MODE: 'sandbox' }).mode).toBe('disabled');
    await expect(
      createPaymentGateway({}).create({ id: 'a', login: 'alice', rub: 311, method: 'card' }),
    ).rejects.toThrow();
  });
  it('creates hosted CARD with kopeks and stable merchant/request identity', async () => {
    const fetcher = vi.fn().mockResolvedValue(json(order()));
    vi.stubGlobal('fetch', fetcher);
    const result = await createPaymentGateway(env).create({
      id: '11111111-1111-4111-8111-111111111111',
      login: 'alice',
      rub: 311,
      method: 'card',
    });
    expect(result.checkoutUrl).toBe('https://payment.paidlayer.com/provider-order-1');
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe('https://api.clickit.team/api/v1/payments/create');
    expect(JSON.parse(options.body)).toMatchObject({
      Amount: 31100,
      Currency: 'RUB',
      PaymentTypes: ['CARD'],
      IsForm: true,
      MerchantOrderId: '11111111-1111-4111-8111-111111111111',
    });
    expect(options.headers['x-req-id']).toBe('11111111-1111-4111-8111-111111111111');
  });
  it('creates SBP QR and persists the provider ID before asking for the QR', async () => {
    const save = vi.fn();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json(order('CREATED', { PaymentType: 'IPS' })))
      .mockImplementationOnce(() => {
        expect(save).toHaveBeenCalledWith('provider-order-1');
        return Promise.resolve(
          json({
            ...order('QRCDATA_CREATED', { PaymentType: 'IPS' }),
            Qrc: { Payload: 'https://qr.nspk.ru/test-qr' },
          }),
        );
      });
    vi.stubGlobal('fetch', fetcher);
    const result = await createPaymentGateway(env).create({
      id: '11111111-1111-4111-8111-111111111111',
      login: 'alice',
      rub: 311,
      method: 'sbp',
      onOrderCreated: save,
    });
    expect(result.checkoutUrl).toBe('https://qr.nspk.ru/test-qr');
    expect(fetcher.mock.calls[1][0]).toContain('/payments/ips/qrcData');
  });
  it.each(['CREATED', 'AUTHORIZED', 'QRCDATA_CREATED', 'REFUND_IN_PROGRESS'])(
    'does not interpret %s as settlement',
    async (status) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(order(status))));
      expect((await createPaymentGateway(env).status('provider-order-1')).status).toBe('pending');
    },
  );
  it.each([
    ['CHARGED', 'CARD'],
    ['IPS_ACCEPTED', 'IPS'],
  ])('accepts only authoritative %s settlement', async (status, method) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(order(status, { PaymentType: method }))));
    expect(await createPaymentGateway(env).status('provider-order-1')).toMatchObject({
      status: 'success',
      rub: 311,
      merchantOrderId: '11111111-1111-4111-8111-111111111111',
    });
  });
  it('infers the settled channel when the provider omits optional PaymentType', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json(order('IPS_ACCEPTED', { PaymentType: undefined }))),
    );
    expect((await createPaymentGateway(env).status('provider-order-1')).method).toBe('sbp');
  });
  it.each([
    { ShopId: 777 },
    { Currency: 'USD' },
    { OrderId: 'foreign-order' },
    { Amount: 1.5 },
    { PaymentType: 'IPS', Status: 'CHARGED' },
  ])('rejects mismatched or invalid provider fields %o', async (extra) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(order('CHARGED', extra))));
    await expect(createPaymentGateway(env).status('provider-order-1')).rejects.toThrow();
  });
  it('verifies the signature over original callback bytes and rejects tampering', () => {
    const gateway = createPaymentGateway(env);
    const raw = Buffer.from(JSON.stringify(order('CHARGED')));
    const signature = sign('RSA-SHA1', raw, privateKey).toString('base64');
    expect(gateway.verifyCallback?.(raw, signature)).toEqual({
      providerId: 'provider-order-1',
      merchantOrderId: '11111111-1111-4111-8111-111111111111',
    });
    expect(gateway.verifyCallback?.(Buffer.from('{}'), signature)).toBeNull();
  });
});
