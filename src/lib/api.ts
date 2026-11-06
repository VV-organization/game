export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  color: string;
  variant: number;
  stats?: { speed: number; acceleration: number; handling: number };
  bundle?: string[];
}
export interface User {
  id: string;
  login: string;
  balance: number;
  owned: string[];
  equipped: Record<string, string>;
}
export interface History {
  topups: {
    id: string;
    date: string;
    method: string;
    rub: number;
    fapix: number;
    status: string;
  }[];
  purchases: { id: string; date: string; name: string; fapix: number; status: string }[];
}
export type PaymentMode = 'sandbox' | 'arco' | 'disabled';
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    method: body ? 'POST' : 'GET',
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => {
    throw Object.assign(new Error('Сервер вернул некорректный ответ. Повтори проверку.'), {
      status: response.status,
    });
  });
  if (!response.ok)
    throw Object.assign(
      new Error(
        data?.message ||
          data?.error?.message ||
          (typeof data?.error === 'string' ? data.error : 'Не удалось выполнить запрос'),
      ),
      { status: response.status, code: typeof data?.error === 'string' ? data.error : undefined },
    );
  return data;
}
export const money = (n: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n);
export const quickAmounts = [311, 584, 1039, 2077, 2903, 5205];
