// @vitest-environment happy-dom
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { OnlineClientView } from '../game/online-client';
import { OnlineLobby } from './OnlineLobby';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const queued = (): OnlineClientView => ({
  connection: 'connected',
  runtime: null,
  error: null,
  room: {
    type: 'room',
    roomId: 'ABC123',
    trackId: 'coast',
    formatId: 'sprint',
    deadline: 130000,
    serverNow: 100000,
    localCarId: 1,
    resumeToken: 'private',
    roster: [
      { id: 0, name: 'racer_one', kind: 'human', customization: {}, connected: true },
      { id: 1, name: 'turbo_anton', kind: 'human', customization: {}, connected: true },
    ],
  },
});
it('shows real roster, remaining slots and the server deadline despite a different local clock', () => {
  vi.useFakeTimers();
  vi.setSystemTime(8000000);
  render(
    <OnlineLobby state={queued()} onCancel={vi.fn()} onRetry={vi.fn()} onFindOther={vi.fn()} />,
  );
  expect(screen.getByText('turbo_anton')).toBeTruthy();
  expect(screen.getAllByText('Ищем гонщика')).toHaveLength(4);
  expect(screen.getByText('00:30')).toBeTruthy();
  act(() => {
    vi.advanceTimersByTime(10000);
  });
  expect(screen.getByText('00:20')).toBeTruthy();
  expect((screen.getByLabelText('Ссылка на комнату') as HTMLInputElement).value).toContain(
    '/play?room=ABC123',
  );
  expect(document.body.textContent).not.toContain('private');
});
it('lets a player cancel or retry an unavailable server without pretending a race started', async () => {
  const cancel = vi.fn(),
    retry = vi.fn();
  const user = userEvent.setup();
  render(
    <OnlineLobby
      state={{ ...queued(), room: null, connection: 'error', error: 'Нет связи с сервером' }}
      onCancel={cancel}
      onRetry={retry}
      onFindOther={vi.fn()}
    />,
  );
  expect(screen.getByRole('alert').textContent).toContain('Нет связи');
  await user.click(screen.getByRole('button', { name: 'Повторить подключение' }));
  expect(retry).toHaveBeenCalledOnce();
  await user.click(screen.getByRole('button', { name: 'В паддок' }));
  expect(cancel).toHaveBeenCalledOnce();
});
it('never flashes 31 seconds when a room arrives between clock updates', () => {
  vi.useFakeTimers();
  vi.setSystemTime(8000000);
  const actions = { onCancel: vi.fn(), onRetry: vi.fn(), onFindOther: vi.fn() };
  const view = render(
    <OnlineLobby state={{ ...queued(), room: null, connection: 'connecting' }} {...actions} />,
  );
  vi.setSystemTime(8000020);
  view.rerender(<OnlineLobby state={queued()} {...actions} />);
  expect(screen.queryByText('00:31')).toBeNull();
  expect(screen.getByText('00:30')).toBeTruthy();
});
