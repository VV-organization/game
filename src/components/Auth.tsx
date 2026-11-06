import { useState, type FormEvent } from 'react';
import { ArrowRight, Flag } from 'lucide-react';
import { api, type User } from '../lib/api';
import { Modal } from './Modal';
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
  const [register, setRegister] = useState(initialRegister || !!initialLogin),
    [login, setLogin] = useState(initialLogin),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api<{ user: User }>(`/auth/${register ? 'register' : 'login'}`, {
        login,
        password,
      });
      onUser(r.user);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={register ? 'Твой путь к старту' : 'С возвращением'} onClose={onClose}>
      <div className="auth-mark">
        <Flag size={32} />
      </div>
      <p className="muted">
        {register
          ? 'Создай аккаунт, чтобы сохранить покупки и свой гараж.'
          : 'Войди в гоночный аккаунт и продолжай с того же места.'}
      </p>
      <form onSubmit={submit}>
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
            placeholder="Не менее 8 символов"
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="primary full" disabled={busy}>
          {busy ? 'Подождите…' : register ? 'Создать аккаунт' : 'Войти'}
          <ArrowRight size={20} />
        </button>
      </form>
      <button
        className="text-button full"
        onClick={() => {
          setRegister(!register);
          setError('');
        }}
      >
        {register ? 'Уже есть аккаунт? Войти' : 'Первый заезд? Создать аккаунт'}
      </button>
    </Modal>
  );
}
