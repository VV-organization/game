// @vitest-environment happy-dom
import { Window } from 'happy-dom';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

function browser(url: string) {
  const win = new Window({ url, settings: { disableJavaScriptFileLoading: true } });
  for (const [name, value] of Object.entries({
    window: win,
    document: win.document,
    history: win.history,
    location: win.location,
  }))
    vi.stubGlobal(name, value);
}

it('keeps deep links functional while excluding payment and room references from counter URLs', async () => {
  browser('https://fapixracing.com/play?room=ABC123&payment=private-id&utm_source=race');
  history.replaceState({ pendingTrack: 'coast' }, '');
  const { captureGameParams, gameParams } = await import('./navigation');
  const { startAnalytics, trackPage } = await import('./analytics');
  captureGameParams();
  expect(gameParams().get('room')).toBe('ABC123');
  expect(gameParams().get('payment')).toBe('private-id');
  expect(history.state.pendingTrack).toBe('coast');
  expect(location.search).toBe('?utm_source=race');
  const initial = location.href;
  startAnalytics();
  startAnalytics();
  trackPage();
  history.pushState({}, '', '/records');
  trackPage();
  history.replaceState({}, '', '/records');
  trackPage();
  history.replaceState({}, '', '/play');
  trackPage();
  expect(Array.from(document.scripts, (s) => s.src)).toEqual([
    'https://www.googletagmanager.com/gtm.js?id=GTM-PT5STLLL',
    'https://mc.yandex.ru/metrika/tag.js?id=114649333',
  ]);
  expect(
    window.dataLayer?.filter((e) => (e as { event?: string }).event === 'gtm.js'),
  ).toHaveLength(1);
  const commands = window.ym!.a!;
  expect(commands[0]).toEqual([
    114649333,
    'init',
    expect.objectContaining({ defer: true, webvisor: true, ecommerce: 'dataLayer' }),
  ]);
  expect(
    commands
      .slice(1)
      .map(([id, method, url, options]) => [
        id,
        method,
        url,
        (options as { referer: string }).referer,
      ]),
  ).toEqual([
    [114649333, 'hit', initial, ''],
    [114649333, 'hit', location.origin + '/records', initial],
    [114649333, 'hit', location.origin + '/play', location.origin + '/records'],
  ]);
});

it('does not start counters on a development host', async () => {
  browser('http://localhost:5173/');
  const { startAnalytics, trackPage } = await import('./analytics');
  startAnalytics();
  trackPage();
  expect(document.scripts).toHaveLength(0);
  expect(window.dataLayer).toBeUndefined();
});
