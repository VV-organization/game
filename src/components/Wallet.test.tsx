// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Wallet } from './Wallet';
import { api, type History, type User } from '../lib/api';

vi.mock('../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api')>()),
  api: vi.fn(),
}));

const mockedApi = vi.mocked(api);
const alice: User = { id: 'alice-id', login: 'alice', balance: 0, owned: [], equipped: {} };
const bob: User = { ...alice, id: 'bob-id', login: 'bob' };
const emptyHistory: History = { topups: [], purchases: [] };
const pending = {
  id: 'payment-1',
  status: 'pending',
  paymentMode: 'sandbox' as const,
  login: 'alice',
  rub: 311,
  method: 'card' as const,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function props() {
  return {
    user: alice as User | null,
    mode: 'sandbox' as const,
    initialRub: 311,
    onClose: vi.fn(),
    onUser: vi.fn(),
    onRegister: vi.fn(),
    onComplete: vi.fn(),
  };
}

beforeEach(() => {
  sessionStorage.clear();
  mockedApi.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('wallet recovery and account context', () => {
  it('preserves recipient, amount, SBP and product context while registering a missing account', async () => {
    const interaction = userEvent.setup();
    const callbacks = { ...props(), user: null, initialRub: 2077, productName: 'Apex GT-R' };
    mockedApi.mockResolvedValueOnce({ exists: false });
    const view = render(<Wallet {...callbacks} />);

    await interaction.type(
      screen.getByRole('textbox', { name: 'Логин игрового аккаунта' }),
      'new_pilot',
    );
    await interaction.click(screen.getByRole('button', { name: /СБП Через приложение банка/ }));
    await interaction.click(screen.getByRole('button', { name: /Пополнить на/ }));
    await screen.findByText('Аккаунт не найден.', { exact: false });
    await interaction.click(screen.getByRole('button', { name: 'Создать аккаунт' }));
    expect(callbacks.onRegister).toHaveBeenCalledWith('new_pilot');

    // The parent opens Auth and supplies the new account without remounting Wallet.
    view.rerender(<Wallet {...callbacks} user={{ ...alice, login: 'new_pilot' }} />);
    expect(
      (screen.getByRole('textbox', { name: 'Логин игрового аккаунта' }) as HTMLInputElement).value,
    ).toBe('new_pilot');
    expect(
      (screen.getByRole('spinbutton', { name: 'Сумма пополнения, ₽' }) as HTMLInputElement).value,
    ).toBe('2077');
    expect(screen.getByText('Apex GT-R')).toBeTruthy();

    mockedApi
      .mockResolvedValueOnce({ exists: true })
      .mockResolvedValueOnce({ ...pending, login: 'new_pilot', rub: 2077, method: 'sbp' });
    await interaction.click(screen.getByRole('button', { name: /Пополнить на/ }));
    await screen.findByRole('heading', { name: 'Ожидаем оплату' });
    expect(mockedApi).toHaveBeenLastCalledWith(
      '/topups',
      expect.objectContaining({ login: 'new_pilot', rub: 2077, method: 'sbp' }),
    );
    expect(screen.getByText(/2\s077 ₽ · СБП/)).toBeTruthy();
  });

  it('ignores an older pending poll after a confirmed success, including its stale balance', async () => {
    vi.useFakeTimers();
    const callbacks = props();
    const oldPoll = deferred<unknown>();
    mockedApi.mockImplementation(async (path) => {
      if (path.startsWith('/accounts/')) return { exists: true };
      if (path === '/topups') return pending;
      if (path.endsWith('/sandbox'))
        return { ...pending, status: 'success', user: { ...alice, balance: 622 } };
      return oldPoll.promise;
    });
    render(<Wallet {...callbacks} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Пополнить на/ }));
    });
    expect(screen.getByRole('heading', { name: 'Ожидаем оплату' })).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(mockedApi).toHaveBeenCalledWith('/topups/payment-1', undefined);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Тест: успешная оплата' }));
    });
    expect(screen.getByRole('heading', { name: 'Баланс пополнен' })).toBeTruthy();

    await act(async () => {
      oldPoll.resolve({ ...pending, user: alice });
    });
    expect(screen.queryByRole('heading', { name: 'Ожидаем оплату' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Баланс пополнен' })).toBeTruthy();
    expect(callbacks.onUser).toHaveBeenLastCalledWith(expect.objectContaining({ balance: 622 }));
  });

  it('retries a temporary polling failure and later shows the confirmed result', async () => {
    vi.useFakeTimers();
    const callbacks = props();
    mockedApi
      .mockResolvedValueOnce(pending)
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce({ ...pending, status: 'success', user: { ...alice, balance: 622 } });
    await act(async () => {
      render(<Wallet {...callbacks} initialPaymentId="payment-1" />);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(screen.getByRole('heading', { name: 'Ожидаем оплату' })).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(mockedApi).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('heading', { name: 'Баланс пополнен' })).toBeTruthy();
    expect(callbacks.onUser).toHaveBeenCalledWith(expect.objectContaining({ balance: 622 }));
  });

  it('does not restore a logged-out account from an in-flight status response', async () => {
    vi.useFakeTimers();
    const callbacks = props();
    const inFlight = deferred<unknown>();
    mockedApi.mockResolvedValueOnce(pending).mockReturnValueOnce(inFlight.promise);
    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(<Wallet {...callbacks} initialPaymentId="payment-1" />);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });

    view.rerender(<Wallet {...callbacks} user={null} initialPaymentId="payment-1" />);
    await act(async () => {
      inFlight.resolve({ ...pending, status: 'success', user: { ...alice, balance: 622 } });
    });
    expect(screen.getByRole('heading', { name: 'Баланс пополнен' })).toBeTruthy();
    expect(callbacks.onUser).not.toHaveBeenCalled();
    expect(screen.getByText('Пополнение игрового аккаунта')).toBeTruthy();
  });

  it.each(['success', 'failed'] as const)(
    'clears the request key on %s before closing, so a new identical payment gets a new key',
    async (outcome) => {
      const interaction = userEvent.setup();
      const callbacks = props();
      const keys: string[] = [];
      mockedApi.mockImplementation(async (path, body) => {
        if (path.startsWith('/accounts/')) return { exists: true };
        if (path === '/topups') {
          keys.push((body as { idempotencyKey: string }).idempotencyKey);
          return { ...pending, id: `payment-${keys.length}` };
        }
        if (path.endsWith('/sandbox')) return { ...pending, status: outcome };
        return pending;
      });
      const first = render(<Wallet {...callbacks} />);
      await interaction.click(screen.getByRole('button', { name: /Пополнить на/ }));
      await screen.findByRole('heading', { name: 'Ожидаем оплату' });
      expect(sessionStorage.getItem('fapix-payment-request')).not.toBeNull();
      await interaction.click(
        screen.getByRole('button', {
          name: outcome === 'success' ? 'Тест: успешная оплата' : 'Тест: отказ',
        }),
      );
      await screen.findByRole('heading', {
        name: outcome === 'success' ? 'Баланс пополнен' : 'Платёж не прошёл',
      });
      expect(sessionStorage.getItem('fapix-payment-request')).toBeNull();
      expect(sessionStorage.getItem('fapix-pending-payment')).toBeNull();

      // Closing through the modal's X must not be required to clear a completed request.
      await interaction.click(screen.getByRole('button', { name: 'Закрыть' }));
      first.unmount();
      render(<Wallet {...callbacks} />);
      await interaction.click(screen.getByRole('button', { name: /Пополнить на/ }));
      await screen.findByRole('heading', { name: 'Ожидаем оплату' });
      expect(keys).toHaveLength(2);
      expect(keys[1]).not.toBe(keys[0]);
    },
  );

  it('withholds the form while restoring and then displays server-owned payment details', async () => {
    const restoring = deferred<unknown>();
    mockedApi.mockReturnValue(restoring.promise);
    render(<Wallet {...props()} initialRub={311} initialPaymentId="return-payment" />);
    expect(screen.getByRole('status').textContent).toContain('Восстанавливаем платёж');
    expect(screen.queryByRole('textbox', { name: 'Логин игрового аккаунта' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Пополнить на/ })).toBeNull();

    await act(async () => {
      restoring.resolve({
        ...pending,
        id: 'return-payment',
        paymentMode: 'arco',
        login: 'recipient',
        rub: 584,
        method: 'sbp',
        checkoutUrl: 'https://qr.nspk.ru/example',
      });
    });
    expect(screen.getByText(/584 ₽ · СБП/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Открыть страницу оплаты' })).toBeTruthy();
    expect(mockedApi).toHaveBeenCalledTimes(1);
    expect(mockedApi).toHaveBeenCalledWith('/topups/return-payment');
  });

  it('keeps the intended product across a hosted-payment remount without buying it automatically', async () => {
    const interaction = userEvent.setup();
    const callbacks = props();
    mockedApi
      .mockResolvedValueOnce({ exists: true })
      .mockResolvedValueOnce({ ...pending, paymentMode: 'arco' });
    const first = render(<Wallet {...callbacks} mode="arco" productName="Apex GT-R" />);
    await interaction.click(screen.getByRole('button', { name: /Пополнить на/ }));
    await screen.findByRole('heading', { name: 'Ожидаем оплату' });
    expect(JSON.parse(sessionStorage.getItem('fapix-payment-intent') || 'null')).toEqual({
      paymentId: 'payment-1',
      productName: 'Apex GT-R',
    });

    first.unmount();
    mockedApi.mockResolvedValueOnce({
      ...pending,
      paymentMode: 'arco',
      status: 'success',
      user: { ...alice, balance: 622 },
    });
    render(<Wallet {...callbacks} mode="arco" initialPaymentId="payment-1" />);
    await screen.findByRole('heading', { name: 'Баланс пополнен' });
    expect(screen.getByText(/Теперь можно купить «Apex GT-R»/)).toBeTruthy();
    expect(sessionStorage.getItem('fapix-payment-intent')).toBeNull();
    expect(callbacks.onComplete).not.toHaveBeenCalled();
    expect(mockedApi.mock.calls.some(([path]) => path === '/purchase')).toBe(false);
    await interaction.click(screen.getByRole('button', { name: 'Перейти к покупке' }));
    expect(callbacks.onComplete).toHaveBeenCalledWith('Apex GT-R');
    expect(mockedApi.mock.calls.some(([path]) => path === '/purchase')).toBe(false);
  });

  it('does not reuse a product intent belonging to a different payment', async () => {
    sessionStorage.setItem(
      'fapix-payment-intent',
      JSON.stringify({ paymentId: 'another-payment', productName: 'Чужой комплект' }),
    );
    const callbacks = props();
    const interaction = userEvent.setup();
    mockedApi.mockResolvedValueOnce({ ...pending, id: 'current-payment', status: 'success' });
    render(
      <Wallet
        {...callbacks}
        initialPaymentId="current-payment"
        productName="Новый товар из магазина"
      />,
    );
    await screen.findByRole('heading', { name: 'Баланс пополнен' });
    expect(screen.queryByText(/Чужой комплект/)).toBeNull();
    expect(screen.queryByText(/Новый товар из магазина/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Перейти к покупке' })).toBeNull();
    await interaction.click(screen.getByRole('button', { name: 'Готово' }));
    expect(callbacks.onComplete).not.toHaveBeenCalled();
    expect(callbacks.onClose).toHaveBeenCalledOnce();
  });

  it('removes the previous account history immediately while loading another account', async () => {
    const interaction = userEvent.setup();
    const bobHistory = deferred<History>();
    mockedApi
      .mockResolvedValueOnce({
        topups: [],
        purchases: [
          {
            id: 'alice-purchase',
            date: '2026-11-06T10:00:00Z',
            name: 'Личный комплект Alice',
            fapix: 622,
            status: 'success',
          },
        ],
      })
      .mockReturnValueOnce(bobHistory.promise);
    const callbacks = props();
    const view = render(<Wallet {...callbacks} />);
    await interaction.click(screen.getByRole('button', { name: 'Покупки' }));
    await screen.findByText('Личный комплект Alice');

    view.rerender(<Wallet {...callbacks} user={bob} />);
    expect(screen.queryByText('Личный комплект Alice')).toBeNull();
    expect(screen.getByText('Загружаем историю…')).toBeTruthy();
    await act(async () => {
      bobHistory.resolve(emptyHistory);
    });
    await waitFor(() => expect(screen.getByText(/Пока нет операций/)).toBeTruthy());
    expect(screen.queryByText('Личный комплект Alice')).toBeNull();
  });
});
