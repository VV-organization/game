import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Flag } from 'lucide-react';
import { api, type User } from '../lib/api';
import type { RegistrationStatus } from '../shared/types';
import { Modal } from './Modal';

type StateResponse = { registration: RegistrationStatus | null };

export function Auth({
  onClose,
  onUser,
  initialLogin = '',
  initialRegister = false,
}: {
  onClose: () => void;
  onUser: (u: User) => void;
  initialLogin?: string;
  initialRegister?: boolean;
}) {
  const [register, setRegister] = useState(initialRegister || !!initialLogin);
  const [login, setLogin] = useState(initialLogin);
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<RegistrationStatus | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(register);
  const [now, setNow] = useState(Date.now);
  const requestId = useRef(crypto.randomUUID());
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    if (register) {
      setRestoring(true);
      void api<StateResponse>('/auth/registration')
        .then((data) => {
          if (active) setStatus(data.registration);
        })
        .catch(() => {})
        .finally(() => {
          if (active) setRestoring(false);
        });
    } else setRestoring(false);
    return () => {
      active = false;
    };
  }, [register]);
  useEffect(() => {
    if (!status) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [status]);
  const wait = status ? Math.max(0, Math.ceil((status.resendAt - now) / 1000)) : 0;
  const checking = register && !!status;
  async function perform(action: 'submit' | 'resend') {
    if (busy || restoring) return;
    setBusy(true);
    setError('');
    try {
      if (!register || (checking && !editing && action === 'submit')) {
        const result = register
          ? await api<{ user: User }>('/auth/registration/verify', { code })
          : await api<{ user: User }>('/auth/login', { login, password });
        if (alive.current) onUser(result.user);
      } else {
        const result = checking
          ? await api<StateResponse>('/auth/registration/resend', editing ? { email } : {})
          : await api<StateResponse>('/auth/register', {
              login,
              password,
              email,
              requestId: requestId.current,
            });
        if (alive.current) {
          setStatus(result.registration);
          setCode('');
          setEditing(false);
          setPassword('');
          setNow(Date.now());
        }
      }
    } catch (e) {
      if (alive.current) {
        const failure = (e as { code?: string }).code;
        if (
          failure === 'REGISTRATION_EXPIRED' ||
          (checking &&
            !editing &&
            action === 'submit' &&
            (failure === 'LOGIN_TAKEN' || failure === 'EMAIL_TAKEN'))
        ) {
          setStatus(null);
          setEditing(false);
          requestId.current = crypto.randomUUID();
        }
        setError((e as Error).message);
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void perform('submit');
  }
  return (
    <Modal
      title={checking ? 'Подтверждение почты' : register ? 'Твой путь к старту' : 'С возвращением'}
      onClose={onClose}
    >
      <div className="auth-mark">
        <Flag size={32} />
      </div>
      <p className="muted">
        {checking
          ? editing
            ? 'Введите адрес, на который отправить новый код.'
            : `Введите код из письма на ${status!.maskedEmail}. Код действует 10 минут.`
          : register
            ? 'Подтверди почту один раз, чтобы начать гонку.'
            : 'Войди по логину и паролю.'}
      </p>
      <form onSubmit={submit}>
        {!checking && (
          <>
            <label>
              Логин
              <input
                autoFocus
                autoComplete="username"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
                minLength={3}
                maxLength={24}
                pattern="[a-zA-Z0-9_]{3,24}"
                placeholder="Например, turbo_anton"
              />
            </label>
            <label>
              Пароль
              <input
                type="password"
                autoComplete={register ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                maxLength={128}
              />
            </label>
          </>
        )}
        {register && (!checking || editing) && (
          <label>
            Почта
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={254}
            />
          </label>
        )}
        {checking && !editing && (
          <label>
            Код из письма
            <input
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              pattern="[0-9]{6}"
              maxLength={6}
            />
          </label>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {checking && !editing && status!.expiresAt <= now && (
          <p role="status">Срок действия кода истёк. Запросите новый код.</p>
        )}
        <button className="primary full" disabled={busy || restoring || (editing && wait > 0)}>
          {busy
            ? 'Подождите…'
            : !register
              ? 'Войти'
              : checking && !editing
                ? 'Подтвердить почту'
                : 'Получить код'}
          <ArrowRight size={20} />
        </button>
      </form>
      {checking && (
        <>
          {!editing && (
            <button
              className="text-button full"
              disabled={busy || wait > 0}
              onClick={() => void perform('resend')}
            >
              {wait ? `Отправить ещё раз через ${wait} с` : 'Отправить ещё раз'}
            </button>
          )}
          <button
            className="text-button full"
            disabled={busy}
            onClick={() => {
              setEditing(!editing);
              setError('');
              setEmail('');
            }}
          >
            {editing ? 'Вернуться к коду' : 'Изменить почту'}
          </button>
          {editing && wait > 0 && <p className="muted">Повторная отправка через {wait} с</p>}
        </>
      )}
      <button
        className="text-button full"
        disabled={busy}
        onClick={() => {
          setRegister(!register);
          setStatus(null);
          setEditing(false);
          setPassword('');
          setError('');
        }}
      >
        {register ? 'Уже есть аккаунт? Войти' : 'Первый заезд? Создать аккаунт'}
      </button>
    </Modal>
  );
}
