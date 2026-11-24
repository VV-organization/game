// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from './App';
import { api } from './lib/api';
vi.mock('./lib/api', async (load) => ({
  ...(await load<typeof import('./lib/api')>()),
  api: vi.fn(),
}));
vi.mock('./game/KartPreview', () => ({ default: () => null }));
vi.mock('./game/Race', () => ({ default: () => <div>Тренировка началась</div> }));
vi.mock('./components/OnlineSession', () => ({ OnlineSession: () => <div>Онлайн начался</div> }));
const account = {
  id: 'id',
  login: 'pilot',
  emailVerified: true,
  balance: 0,
  owned: [],
  equipped: {},
};
beforeEach(() => {
  history.replaceState({}, '', '/play');
  sessionStorage.clear();
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === '/session') return { user: null, paymentMode: 'disabled' };
    if (path === '/auth/registration') return { registration: null };
    if (path === '/auth/login') return { user: account };
    return { products: [], popularIds: [] };
  });
});
afterEach(cleanup);
it.each(['practice', 'invite'] as const)(
  'gates %s and continues the chosen race after password login',
  async (mode) => {
    if (mode === 'invite') history.replaceState({}, '', '/play?room=ABC123');
    const user = userEvent.setup();
    render(<App />);
    if (mode === 'practice') {
      await user.click(await screen.findByRole('button', { name: 'Тренировка' }));
      await user.click(screen.getByRole('button', { name: 'Начать гонку' }));
      expect(location.search).toContain('startMode=practice');
    }
    await screen.findByText('Твой путь к старту');
    expect(screen.queryByText('Онлайн начался')).toBeNull();
    expect(screen.queryByText('Тренировка началась')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Уже есть аккаунт? Войти' }));
    await user.type(screen.getByLabelText('Логин'), 'pilot');
    await user.type(screen.getByLabelText('Пароль'), 'test-password');
    await user.click(screen.getByRole('button', { name: 'Войти' }));
    expect(
      await screen.findByText(mode === 'practice' ? 'Тренировка началась' : 'Онлайн начался'),
    ).toBeTruthy();
    expect(vi.mocked(api).mock.calls.some(([path]) => path === '/auth/register')).toBe(false);
  },
);
