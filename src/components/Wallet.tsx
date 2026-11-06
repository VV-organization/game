import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  QrCode,
  Wallet as WalletIcon,
  RefreshCw,
} from 'lucide-react';
import { api, money, quickAmounts, type User, type PaymentMode, type History } from '../lib/api';
import { Modal } from './Modal';
type Payment = {
  id: string;
  status: string;
  checkoutUrl?: string;
  paymentMode: PaymentMode;
  login?: string;
  rub?: number;
  method?: 'card' | 'sbp';
  user?: User;
  requiresReview?: boolean;
  message?: string;
};
interface Props {
  user: User | null;
  mode: PaymentMode;
  initialRub: number;
  productName?: string;
  initialPaymentId?: string;
  onClose: () => void;
  onUser: (u: User) => void;
  onRegister: (login: string, onAuthenticated: (user: User) => void) => void;
  onComplete: (productName?: string) => void;
}
const terminal = (status: string) => ['success', 'succeeded', 'paid', 'failed'].includes(status);
function savedProductName(paymentId?: string): string | undefined {
  if (!paymentId) return undefined;
  try {
    const intent = JSON.parse(sessionStorage.getItem('fapix-payment-intent') || 'null');
    if (
      intent?.paymentId === paymentId &&
      typeof intent.productName === 'string' &&
      intent.productName.trim() &&
      intent.productName.length <= 200
    )
      return intent.productName;
  } catch {
    /* Optional recovery storage. */
  }
  return undefined;
}
function forgetPending() {
  try {
    sessionStorage.removeItem('fapix-pending-payment');
    sessionStorage.removeItem('fapix-payment-request');
    sessionStorage.removeItem('fapix-payment-intent');
  } catch {
    /* Optional recovery storage. */
  }
}
export function savedPaymentId() {
  try {
    return sessionStorage.getItem('fapix-pending-payment') || undefined;
  } catch {
    return undefined;
  }
}
export function Wallet({
  user,
  mode,
  initialRub,
  productName,
  initialPaymentId,
  onClose,
  onUser,
  onRegister,
  onComplete,
}: Props) {
  const [tab, setTab] = useState('topup'),
    [rub, setRub] = useState(String(initialRub)),
    [login, setLogin] = useState(user?.login || ''),
    [method, setMethod] = useState<'card' | 'sbp'>('card');
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [restoring, setRestoring] = useState(!!initialPaymentId),
    [restoreAttempt, setRestoreAttempt] = useState(0),
    [restoreFailure, setRestoreFailure] = useState<{
      unavailable: boolean;
      message: string;
    } | null>(null),
    [pollTick, setPollTick] = useState(0),
    [missing, setMissing] = useState(false);
  const [history, setHistory] = useState<History | null>(null),
    [payment, setPayment] = useState<Payment | null>(null);
  const [resolvedProductName, setResolvedProductName] = useState(() =>
    initialPaymentId ? savedProductName(initialPaymentId) : productName,
  );
  const productContext = useRef(resolvedProductName);
  productContext.current = resolvedProductName;
  const current = useRef({ user, onUser, payment });
  current.current = { user, onUser, payment };
  const generation = useRef(0),
    sequence = useRef(0),
    requestKey = useRef<{ signature: string; key: string } | null>(null);
  const amount = Number(rub),
    valid = Number.isSafeInteger(amount) && amount >= 1 && amount <= 100000;
  function accept(p: Payment) {
    setPayment((old) =>
      old?.id === p.id && terminal(old.status) && p.status === 'pending' ? old : p,
    );
    if (p.user && p.user.id === current.current.user?.id) current.current.onUser(p.user);
    if (terminal(p.status)) {
      forgetPending();
      requestKey.current = null;
    } else {
      try {
        sessionStorage.setItem('fapix-pending-payment', p.id);
        const name = productContext.current;
        if (name && name.length <= 200)
          sessionStorage.setItem(
            'fapix-payment-intent',
            JSON.stringify({ paymentId: p.id, productName: name }),
          );
        else sessionStorage.removeItem('fapix-payment-intent');
      } catch {
        /* Optional recovery. */
      }
    }
  }
  useEffect(() => {
    if (!initialPaymentId) return;
    const epoch = ++generation.current;
    const name = savedProductName(initialPaymentId);
    setResolvedProductName(name);
    productContext.current = name;
    setRestoring(true);
    setRestoreFailure(null);
    setError('');
    try {
      sessionStorage.setItem('fapix-pending-payment', initialPaymentId);
    } catch {
      /* Optional recovery storage. */
    }
    api<Payment>(`/topups/${encodeURIComponent(initialPaymentId)}`)
      .then((p) => {
        if (epoch !== generation.current) return;
        setLogin(p.login || '');
        setRub(String(p.rub || initialRub));
        setMethod(p.method || 'card');
        accept(p);
      })
      .catch((e) => {
        if (epoch === generation.current) {
          // Only a structured local payment error establishes that this payment
          // is unavailable. A gateway/network failure leaves its outcome unknown.
          const failure = e as Error & { status?: number; code?: string };
          setRestoreFailure({
            unavailable:
              (failure.status === 404 && failure.code === 'PAYMENT_NOT_FOUND') ||
              (failure.status === 403 && failure.code === 'PAYMENT_ACCESS_DENIED'),
            message: failure.message,
          });
        }
      })
      .finally(() => {
        if (epoch === generation.current) setRestoring(false);
      });
    return () => {
      generation.current++;
    };
  }, [initialPaymentId, restoreAttempt]);
  useEffect(
    () => () => {
      generation.current++;
      sequence.current++;
    },
    [],
  );
  useEffect(() => {
    setHistory(null);
    if (!user || tab === 'topup') return;
    let active = true;
    api<History>('/history')
      .then((h) => {
        if (active) setHistory(h);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [tab, user?.id]);
  function keyForRequest() {
    const signature = JSON.stringify({ login: login.toLowerCase(), rub: amount, method });
    if (requestKey.current?.signature !== signature) {
      try {
        const old = JSON.parse(sessionStorage.getItem('fapix-payment-request') || 'null');
        requestKey.current = old?.signature === signature ? old : null;
      } catch {
        requestKey.current = null;
      }
      if (!requestKey.current) requestKey.current = { signature, key: crypto.randomUUID() };
      try {
        sessionStorage.setItem('fapix-payment-request', JSON.stringify(requestKey.current));
      } catch {
        /* Optional recovery. */
      }
    }
    return requestKey.current!.key;
  }
  function registerRecipient() {
    const epoch = generation.current;
    onRegister(login, (account) => {
      if (epoch !== generation.current) return;
      setLogin(account.login);
      setMissing(false);
      setError('');
      requestKey.current = null;
    });
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || restoring || restoreFailure || !valid) return;
    const epoch = generation.current;
    setError('');
    setMissing(false);
    setBusy(true);
    try {
      const account = await api<{ exists: boolean }>(`/accounts/${encodeURIComponent(login)}`);
      if (epoch !== generation.current) return;
      if (!account.exists) {
        setMissing(true);
        return;
      }
      const p = await api<Payment>('/topups', {
        login,
        rub: amount,
        method,
        idempotencyKey: keyForRequest(),
      });
      if (epoch === generation.current)
        accept({ ...p, login: p.login || login, rub: p.rub || amount, method: p.method || method });
    } catch (e) {
      if (epoch === generation.current) setError((e as Error).message);
    } finally {
      if (epoch === generation.current) setBusy(false);
    }
  }
  async function check(outcome?: 'success' | 'failed', quiet = false) {
    const p = current.current.payment;
    if (!p) return;
    const epoch = generation.current,
      order = ++sequence.current;
    if (!quiet) {
      setBusy(true);
      setError('');
    }
    try {
      const next = await api<Payment>(
        `/topups/${p.id}${outcome ? '/sandbox' : ''}`,
        outcome ? { outcome } : undefined,
      );
      if (epoch === generation.current && order === sequence.current) accept({ ...p, ...next });
    } catch (e) {
      if (epoch === generation.current && order === sequence.current && !quiet)
        setError((e as Error).message);
    } finally {
      if (epoch === generation.current) {
        if (!quiet) setBusy(false);
        if (quiet) setPollTick((n) => n + 1);
      }
    }
  }
  useEffect(() => {
    if (!payment || payment.status !== 'pending' || busy) return;
    const id = setTimeout(() => void check(undefined, true), 6000);
    return () => clearTimeout(id);
  }, [payment, busy, pollTick]);
  function clearPayment() {
    generation.current++;
    sequence.current++;
    setPayment(null);
    setBusy(false);
    setRestoring(false);
    setRestoreFailure(null);
    setError('');
    requestKey.current = null;
    forgetPending();
  }
  function openCheckout() {
    if (!payment?.checkoutUrl) return;
    const returnUrl = new URL(`/?payment=${encodeURIComponent(payment.id)}`, location.origin).href;
    if ((payment.method || method) === 'card') {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = payment.checkoutUrl;
      for (const name of ['successUrl', 'failUrl']) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = returnUrl;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
      form.remove();
    } else location.assign(payment.checkoutUrl);
  }
  const success = payment && ['success', 'succeeded', 'paid'].includes(payment.status);
  const statusLabel: Record<string, string> = {
    success: 'Успешно',
    succeeded: 'Успешно',
    paid: 'Успешно',
    pending: 'В обработке',
    failed: 'Ошибка',
    completed: 'Успешно',
  };
  return (
    <Modal title="Кошелёк Fapix" onClose={onClose} wide>
      <div className="wallet-balance">
        <WalletIcon />
        <div>
          <small>{user ? 'Твой баланс' : 'Пополнение игрового аккаунта'}</small>
          <strong>
            {money(user?.balance || 0)} <span>Fapix</span>
          </strong>
          <small>{money((user?.balance || 0) / 2)} ₽ по курсу</small>
        </div>
        <span className="rate">1 ₽ = 2 Fapix</span>
      </div>
      <div className="tabs">
        <button className={tab === 'topup' ? 'active' : ''} onClick={() => setTab('topup')}>
          Пополнить
        </button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
          История пополнений
        </button>
        <button className={tab === 'purchases' ? 'active' : ''} onClick={() => setTab('purchases')}>
          Покупки
        </button>
      </div>
      {tab === 'topup' ? (
        <>
          {mode !== 'arco' && (
            <p className="notice">
              {mode === 'sandbox'
                ? 'Тестовый кошелёк. Настоящие деньги не списываются.'
                : 'Оплата пока недоступна: магазин подключает платёжного провайдера.'}
            </p>
          )}
          {restoring ? (
            <div className="empty" role="status">
              Восстанавливаем платёж…
            </div>
          ) : restoreFailure ? (
            <div className="payment-state">
              <h3>
                {restoreFailure.unavailable ? 'Платёж недоступен' : 'Не удалось проверить платёж'}
              </h3>
              <p role="alert" className="error">
                {restoreFailure.message}
              </p>
              <p>
                {restoreFailure.unavailable
                  ? 'Проверь ссылку и аккаунт, с которого был создан платёж. При смене аккаунта повтори проверку.'
                  : 'Платёж сохранён. Повтори проверку позже — новый платёж создавать не нужно.'}
              </p>
              <button
                className="secondary full"
                onClick={() => setRestoreAttempt((attempt) => attempt + 1)}
              >
                <RefreshCw size={17} />
                Повторить проверку
              </button>
              {restoreFailure.unavailable && (
                <button
                  className="text-button"
                  onClick={() => {
                    clearPayment();
                    onClose();
                  }}
                >
                  Закрыть восстановление
                </button>
              )}
            </div>
          ) : payment ? (
            <div className="payment-state">
              {success ? (
                <>
                  <CheckCircle2 size={52} />
                  <h3>Баланс пополнен</h3>
                  <p>
                    {money((payment.rub || amount) * 2)} Fapix ({money(payment.rub || amount)} ₽){' '}
                    зачислено на аккаунт <b>{payment.login || login}</b>.
                  </p>
                  {resolvedProductName && (
                    <p>Теперь можно купить «{resolvedProductName}» в магазине игры.</p>
                  )}
                  <button
                    className="primary full"
                    onClick={() => {
                      clearPayment();
                      resolvedProductName ? onComplete(resolvedProductName) : onClose();
                    }}
                  >
                    {resolvedProductName ? 'Перейти к покупке' : 'Готово'}
                    <ArrowRight />
                  </button>
                </>
              ) : (
                <>
                  <h3>
                    {payment.status === 'failed'
                      ? 'Платёж не прошёл'
                      : payment.requiresReview
                        ? 'Уточняем статус платежа'
                        : 'Ожидаем оплату'}
                  </h3>
                  <p>
                    {money(payment.rub || amount)} ₽ ·{' '}
                    {(payment.method || method) === 'card' ? 'Банковская карта' : 'СБП'} ·{' '}
                    {money((payment.rub || amount) * 2)} Fapix
                  </p>
                  {payment.requiresReview && (
                    <p className="notice">
                      Провайдер ещё не подтвердил создание платежа. Не оплачивай повторно. Статус
                      обновится после проверки.
                      <br />
                      Номер обращения: {payment.id}
                    </p>
                  )}
                  {payment.checkoutUrl && !payment.requiresReview && (
                    <button className="primary full" onClick={openCheckout}>
                      Открыть страницу оплаты
                      <ArrowRight />
                    </button>
                  )}
                  {payment.paymentMode === 'sandbox' && payment.status !== 'failed' && (
                    <div className="sandbox-actions">
                      <button className="primary" disabled={busy} onClick={() => check('success')}>
                        Тест: успешная оплата
                      </button>
                      <button className="secondary" disabled={busy} onClick={() => check('failed')}>
                        Тест: отказ
                      </button>
                    </div>
                  )}
                  {payment.status !== 'failed' && (
                    <button className="secondary full" disabled={busy} onClick={() => check()}>
                      <RefreshCw size={17} />
                      Проверить статус
                    </button>
                  )}
                  {payment.status === 'failed' && (
                    <button className="text-button" onClick={clearPayment}>
                      Попробовать снова
                    </button>
                  )}
                </>
              )}
            </div>
          ) : (
            <form onSubmit={submit}>
              {resolvedProductName && (
                <p className="purchase-context">
                  Пополнение для покупки <b>{resolvedProductName}</b>. Товар приобретается отдельно
                  в игре.
                </p>
              )}
              <label>
                Логин игрового аккаунта
                <input
                  value={login}
                  onChange={(e) => {
                    setLogin(e.target.value);
                    setMissing(false);
                  }}
                  placeholder="Твой логин"
                  required
                  minLength={3}
                  maxLength={24}
                  pattern="[a-zA-Z0-9_]{3,24}"
                />
              </label>
              {missing && (
                <p className="error" role="alert">
                  Аккаунт не найден.{' '}
                  <button type="button" className="text-button" onClick={registerRecipient}>
                    Создать аккаунт
                  </button>
                </p>
              )}
              <label>
                Сумма пополнения, ₽
                <input
                  type="number"
                  inputMode="numeric"
                  value={rub}
                  onChange={(e) => setRub(e.target.value)}
                  min="1"
                  max="100000"
                  step="1"
                  required
                />
              </label>
              <div className="conversion">
                На баланс <b>{money(valid ? amount * 2 : 0)} Fapix</b>
              </div>
              <div className="quick-amounts">
                {quickAmounts.map((n) => (
                  <button
                    type="button"
                    key={n}
                    className={amount === n ? 'selected' : ''}
                    onClick={() => setRub(String(n))}
                  >
                    {money(n)} ₽
                  </button>
                ))}
              </div>
              <label>Способ оплаты</label>
              <div className="methods">
                <button
                  type="button"
                  className={method === 'card' ? 'selected' : ''}
                  onClick={() => setMethod('card')}
                >
                  <CreditCard />
                  Банковская карта<small>МИР и другие карты</small>
                </button>
                <button
                  type="button"
                  className={method === 'sbp' ? 'selected' : ''}
                  onClick={() => setMethod('sbp')}
                >
                  <QrCode />
                  СБП<small>Через приложение банка</small>
                </button>
              </div>
              <button className="primary full" disabled={!valid || busy || mode === 'disabled'}>
                {busy ? 'Подготавливаем оплату…' : `Пополнить на ${money(valid ? amount : 0)} ₽`}
                <ArrowRight />
              </button>
              <p className="fine-print">
                Зачисление после подтверждения оплаты. Данные карты вводятся на странице платёжного
                провайдера.
              </p>
            </form>
          )}
        </>
      ) : !user ? (
        <div className="empty">Войди в аккаунт, чтобы увидеть историю операций.</div>
      ) : !history ? (
        <div className="empty">Загружаем историю…</div>
      ) : (
        <div className="history">
          {(tab === 'history' ? history.topups : history.purchases).length === 0 ? (
            <div className="empty">
              Пока нет операций. Здесь будет история твоих{' '}
              {tab === 'history' ? 'пополнений' : 'покупок'}.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Операция</th>
                  <th>Сумма</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {(tab === 'history' ? history.topups : history.purchases).map((row) => (
                  <tr key={row.id}>
                    <td>
                      {'name' in row ? row.name : row.method === 'sbp' ? 'СБП' : 'Банковская карта'}
                      <small>{new Date(row.date).toLocaleString('ru-RU')}</small>
                    </td>
                    <td>
                      {money(row.fapix)} Fapix
                      <small>{money('rub' in row ? row.rub : row.fapix / 2)} ₽</small>
                    </td>
                    <td>
                      <span className={`status ${row.status}`}>
                        {statusLabel[row.status] || row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </Modal>
  );
}
