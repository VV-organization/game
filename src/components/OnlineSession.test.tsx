// @vitest-environment happy-dom
import { StrictMode } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { OnlineClient } from '../game/online-client';
import { OnlineSession } from './OnlineSession';

vi.mock('./OnlineLobby', () => ({ OnlineLobby: () => <div>Lobby</div> }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it('preserves reload recovery through StrictMode effect cleanup and sends resume', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  const sent: unknown[] = [];
  const socket = {
    readyState: 0,
    onopen: null as null | (() => void),
    close: vi.fn(),
    send: (data: string) => sent.push(JSON.parse(data)),
  };
  const factory = vi.fn(() => socket as unknown as WebSocket);
  const client = new OnlineClient(
    { formatId: 'classic', trackId: 'coast' },
    {
      resume: {
        roomId: 'saved-room',
        token: 'saved-token',
        formatId: 'classic',
        trackId: 'coast',
        at: 1000,
      },
      storage: null,
      prepareSession: async () => {},
      socketFactory: factory,
    },
  );
  const leave = vi.spyOn(client, 'leave');
  const mounted = render(
    <StrictMode>
      <OnlineSession client={client} onExit={vi.fn()} onRematch={vi.fn()} onFinish={vi.fn()} />
    </StrictMode>,
  );
  expect(leave).not.toHaveBeenCalled();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(factory).toHaveBeenCalledOnce();
  socket.readyState = 1;
  act(() => socket.onopen?.());
  expect(sent).toEqual([
    { type: 'resume', version: 1, roomId: 'saved-room', token: 'saved-token' },
  ]);
  mounted.unmount();
  expect(leave).toHaveBeenCalledOnce();
  expect(socket.close).toHaveBeenCalledOnce();
});
