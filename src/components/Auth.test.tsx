// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { Auth } from './Auth';
import { api } from '../lib/api';
vi.mock('../lib/api', () => ({ api: vi.fn() }));
afterEach(cleanup);
it('lets a player restart if another registration claims the login before verification', async () => {
  vi.mocked(api)
    .mockResolvedValueOnce({
      registration: {
        maskedEmail: 'p***@example.test',
        expiresAt: Date.now() + 600000,
        resendAt: Date.now() + 60000,
      },
    })
    .mockRejectedValueOnce(
      Object.assign(new Error('Этот логин уже занят'), { code: 'LOGIN_TAKEN' }),
    );
  const user = userEvent.setup();
  render(<Auth initialRegister onClose={vi.fn()} onUser={vi.fn()} />);
  const code = await screen.findByLabelText('Код из письма');
  expect(code.closest('dialog.ym-hide-content')).toBeTruthy();
  expect(code.classList.contains('ym-disable-keys')).toBe(true);
  await user.type(code, '012345');
  await user.click(screen.getByRole('button', { name: 'Подтвердить почту' }));
  for (const label of ['Логин', 'Пароль', 'Почта']) {
    expect((await screen.findByLabelText(label)).classList.contains('ym-disable-keys')).toBe(true);
  }
  expect(screen.getByRole('alert').textContent).toContain('логин уже занят');
});
