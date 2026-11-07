import { createHash, createPublicKey, randomUUID, verify } from 'node:crypto';
import type { PaymentMethod, PaymentMode, PaymentStatus } from '../src/shared/types';
export type { PaymentMethod, PaymentMode } from '../src/shared/types';
export interface PaymentRequest {
  id: string;
  rub: number;
  method: PaymentMethod;
  login: string;
  onOrderCreated?: (providerId: string) => void;
}
export interface ProviderPayment {
  providerId: string;
  checkoutUrl: string;
}
export interface PaymentObservation {
  status: PaymentStatus;
  rub: number;
  merchantOrderId: string;
  method?: PaymentMethod;
}
export interface PaymentGateway {
  mode: PaymentMode;
  configurationId: string;
  create(request: PaymentRequest): Promise<ProviderPayment>;
  status(providerId: string): Promise<PaymentObservation>;
  checkout?(request: PaymentRequest, providerId: string): Promise<string>;
  verifyCallback?(
    raw: Buffer,
    signature: string,
  ): { providerId: string; merchantOrderId: string } | null;
}
export class ProviderError extends Error {
  constructor(public ambiguous = true) {
    super('Платёжный провайдер временно недоступен. Статус будет проверен повторно');
  }
}
type Order = {
  OrderId: string;
  MerchantOrderId: string;
  ShopId: number | string;
  Amount: number;
  Currency: string;
  Status: string;
  PaymentType?: string;
};
const validId = (v: unknown): v is string =>
  typeof v === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(v);
function secureUrl(value: string, originOnly = false) {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.hash ||
    (originOnly && (url.pathname !== '/' || url.search))
  )
    throw new Error('Invalid payment configuration');
  return url;
}
const inactive = (): PaymentGateway => ({
  mode: 'disabled',
  configurationId: 'disabled',
  async create() {
    throw new ProviderError(false);
  },
  async status() {
    throw new ProviderError(false);
  },
});

export function createPaymentGateway(
  env: Record<string, string | undefined> = process.env,
): PaymentGateway {
  if (env.PAYMENT_MODE !== 'arco') return inactive();
  const apiKey = env.ARCO_PAY_API_KEY?.trim(),
    token = env.ARCO_PAY_BEARER_TOKEN?.trim(),
    shop = env.ARCO_PAY_SHOP_ID?.trim(),
    publicKey = env.ARCO_PAY_PUBLIC_KEY?.replace(/\\n/g, '\n').trim();
  if (
    !apiKey ||
    !token ||
    !shop ||
    !publicKey ||
    !env.PUBLIC_URL ||
    !/^[1-9]\d*$/.test(shop) ||
    /\s/.test(apiKey) ||
    /\s/.test(token)
  )
    return inactive();
  let api: string, hosted: URL, origin: URL;
  try {
    api = secureUrl(env.ARCO_PAY_API_URL ?? 'https://api.clickit.team/api/v1').href.replace(
      /\/$/,
      '',
    );
    if (new URL(api).search) throw new Error();
    hosted = secureUrl(env.ARCO_PAY_PAYMENT_ORIGIN ?? 'https://payment.paidlayer.com', true);
    origin = secureUrl(env.PUBLIC_URL, true);
    createPublicKey(publicKey);
  } catch {
    return inactive();
  }
  const configurationId = createHash('sha256').update(`${api}|${shop}`).digest('hex');
  function parse(payload: any, expectedId?: string): Order {
    const o = payload?.Order;
    if (
      payload?.Response?.Success !== true ||
      !o ||
      !validId(o.OrderId) ||
      typeof o.MerchantOrderId !== 'string' ||
      o.MerchantOrderId.length > 50 ||
      String(o.ShopId) !== shop ||
      o.Currency !== 'RUB' ||
      !Number.isSafeInteger(o.Amount) ||
      o.Amount <= 0 ||
      typeof o.Status !== 'string' ||
      (expectedId && o.OrderId !== expectedId) ||
      (o.Status === 'CHARGED' && o.PaymentType !== undefined && o.PaymentType !== 'CARD') ||
      (o.Status === 'IPS_ACCEPTED' && o.PaymentType !== undefined && o.PaymentType !== 'IPS')
    )
      throw new ProviderError();
    return o;
  }
  async function request(
    path: string,
    body: unknown,
    requestId: string = randomUUID(),
  ): Promise<any> {
    let response: Response;
    try {
      response = await fetch(api + path, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
        headers: {
          authorization: `Bearer ${token}`,
          'x-api-key': apiKey!,
          'x-req-id': requestId,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new ProviderError();
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new ProviderError(
        response.status >= 500 || response.status === 408 || response.status === 429,
      );
    }
    const reader = response.body?.getReader();
    if (!reader) throw new ProviderError();
    let size = 0;
    const chunks: Uint8Array[] = [];
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.length;
        if (size > 1048576) {
          await reader.cancel();
          throw new ProviderError();
        }
        chunks.push(chunk.value);
      }
    } finally {
      reader.releaseLock();
    }
    let result: any;
    try {
      result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      throw new ProviderError();
    }
    if (result?.Response?.Success === false) throw new ProviderError(false);
    return result;
  }
  function matches(order: Order, input: PaymentRequest) {
    if (
      order.MerchantOrderId !== input.id ||
      order.Amount !== input.rub * 100 ||
      (order.PaymentType && order.PaymentType !== (input.method === 'card' ? 'CARD' : 'IPS'))
    )
      throw new ProviderError();
  }
  async function checkout(input: PaymentRequest, providerId: string) {
    if (!validId(providerId)) throw new ProviderError(false);
    if (input.method === 'card') return new URL(`/${providerId}`, hosted).href;
    const data = await request('/payments/ips/qrcData', {
      OrderId: providerId,
      QrcType: '02',
      TemplateVersion: '01',
      QrTtl: '15',
      Description: `FApix Racing ${input.id}`,
    });
    matches(parse(data, providerId), input);
    let url: URL;
    try {
      url = secureUrl(data.Qrc?.Payload);
    } catch {
      throw new ProviderError();
    }
    if (url.hostname !== 'qr.nspk.ru' || url.port) throw new ProviderError();
    return url.href;
  }
  return {
    mode: 'arco',
    configurationId,
    checkout,
    async create(input) {
      if (
        !Number.isSafeInteger(input.rub) ||
        input.rub < 1 ||
        input.rub > 100000 ||
        !validId(input.id) ||
        input.id.length > 50
      )
        throw new ProviderError(false);
      const returnUrl = new URL(`/?payment=${encodeURIComponent(input.id)}`, origin).href;
      const data = await request(
        '/payments/create',
        {
          MerchantOrderId: input.id,
          Amount: input.rub * 100,
          Currency: 'RUB',
          Type: 'PayIn',
          PaymentTypes: [input.method === 'card' ? 'CARD' : 'IPS'],
          IsForm: input.method === 'card',
          LifeTime: 900,
          Description: `FApix Racing: ${input.rub * 2} Fapix`,
          CallbackUrl: new URL('/api/payments/arco/callback', origin).href,
          RedirectUrl: { SuccessUrl: returnUrl, FailUrl: returnUrl },
        },
        input.id,
      );
      const order = parse(data);
      matches(order, input);
      input.onOrderCreated?.(order.OrderId);
      return { providerId: order.OrderId, checkoutUrl: await checkout(input, order.OrderId) };
    },
    async status(providerId) {
      if (!validId(providerId)) throw new ProviderError(false);
      const order = parse(await request('/payments/status', { OrderId: providerId }), providerId);
      const success = order.Status === 'CHARGED' || order.Status === 'IPS_ACCEPTED';
      const failed = ['DECLINED', 'CHARGE_DECLINED', 'VOIDED', 'EXPIRED'].includes(order.Status);
      const method =
        order.Status === 'IPS_ACCEPTED' || order.PaymentType === 'IPS'
          ? ('sbp' as const)
          : order.Status === 'CHARGED' || order.PaymentType === 'CARD'
            ? ('card' as const)
            : undefined;
      return {
        status: success ? 'success' : failed ? 'failed' : 'pending',
        rub: order.Amount / 100,
        merchantOrderId: order.MerchantOrderId,
        ...(method ? { method } : {}),
      };
    },
    verifyCallback(raw, signature) {
      if (!signature || signature.length > 4096 || !/^[A-Za-z0-9+/]+={0,2}$/.test(signature))
        return null;
      try {
        const bytes = Buffer.from(signature, 'base64');
        if (bytes.toString('base64') !== signature || !verify('RSA-SHA1', raw, publicKey, bytes))
          return null;
        const order = parse(JSON.parse(raw.toString('utf8')));
        return { providerId: order.OrderId, merchantOrderId: order.MerchantOrderId };
      } catch {
        return null;
      }
    },
  };
}
