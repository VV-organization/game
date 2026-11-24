// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from './App';
import { captureGameParams, gameParams } from './lib/navigation';
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
    captureGameParams();
    const user = userEvent.setup();
    if (mode === 'practice') {
      vi.mocked(api)
        .mockImplementationOnce(async () => ({ products: [], popularIds: [] }))
        .mockImplementationOnce(async () => ({ user: account, paymentMode: 'disabled' }));
    }
    render(<App />);
    if (mode === 'practice') {
      await user.click(await screen.findByRole('button', { name: 'Тренировка' }));
      await user.click(screen.getByRole('button', { name: 'Начать гонку' }));
      expect(gameParams().get('startMode')).toBe('practice');
      expect(location.search).toBe('');
    }
    await screen.findByText('Твой путь к старту');
    expect(screen.queryByText('Онлайн начался')).toBeNull();
    expect(screen.queryByText('Тренировка началась')).toBeNull();
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Уже есть аккаунт? Войти',
      }),
    );
    await user.type(screen.getByLabelText('Логин'), 'pilot');
    await user.type(screen.getByLabelText('Пароль'), 'test-password');
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Войти' }),
    );
    expect(
      await screen.findByText(mode === 'practice' ? 'Тренировка началась' : 'Онлайн начался'),
    ).toBeTruthy();
    expect(vi.mocked(api).mock.calls.some(([path]) => path === '/auth/register')).toBe(false);
  },
);

it.each(['landing', 'direct'] as const)(
  'requires email registration at the %s entry before mounting the game screen',
  async (entry) => {
    const action = userEvent.setup();
    history.replaceState({}, '', entry === 'landing' ? '/' : '/play');
    const page = render(<App />);
    if (entry === 'landing')
      await action.click(screen.getByRole('button', { name: 'Играть бесплатно' }));
    expect(screen.queryByRole('heading', { level: 1, name: 'Увидимся на старте.' })).toBeNull();
    expect(await screen.findByLabelText('Почта')).toBeTruthy();
    if (entry === 'landing') expect(location.pathname).toBe('/');
    expect(screen.queryByRole('button', { name: 'Найти гонку' })).toBeNull();
    await action.click(screen.getByRole('button', { name: 'Закрыть', hidden: true }));
    await waitFor(() => expect(location.pathname).toBe('/'));
    expect(screen.queryByRole('heading', { level: 1, name: 'Увидимся на старте.' })).toBeNull();
    expect(page.container.querySelector('dialog')).toBeNull();
  },
);
it('opens the race setup after a guest signs in from Play free', async () => {
  history.replaceState({}, '', '/');
  const action = userEvent.setup();
  render(<App />);
  await action.click(screen.getByRole('button', { name: 'Играть бесплатно' }));
  await action.click(
    within(await screen.findByRole('dialog')).getByRole('button', {
      name: 'Уже есть аккаунт? Войти',
    }),
  );
  await action.type(screen.getByLabelText('Логин'), 'pilot');
  await action.type(screen.getByLabelText('Пароль'), 'test-password');
  await action.click(
    within(await screen.findByRole('dialog')).getByRole('button', { name: 'Войти' }),
  );
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Увидимся на старте.' }),
  ).toBeTruthy();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(location.pathname).toBe('/play');
});

it('restores a track selected on the landing page after reload and verification', async () => {
  history.replaceState({}, '', '/');
  const action = userEvent.setup();
  const original = render(<App />);
  const trackButton = screen.getByRole('button', { name: /Посмотреть трассу.*Неонов/ });
  await action.click(trackButton);
  await screen.findByLabelText('Почта');
  original.unmount();
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === '/session') return { user: null, paymentMode: 'disabled' };
    if (path === '/auth/registration')
      return {
        registration: {
          maskedEmail: 'p***@example.test',
          expiresAt: Date.now() + 600000,
          resendAt: Date.now() + 60000,
        },
      };
    if (path === '/auth/registration/verify') return { user: account };
    return { products: [], popularIds: [] };
  });
  render(<App />);
  await action.type(await screen.findByLabelText('Код из письма'), '012345');
  await action.click(screen.getByRole('button', { name: 'Подтвердить почту' }));
  expect(await screen.findByRole('button', { name: /^Выбрана Неоновый квартал/ })).toBeTruthy();
  expect(location.pathname).toBe('/play');
});
