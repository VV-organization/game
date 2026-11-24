const counterId = 114649333;
const containerId = 'GTM-PT5STLLL';

type Metrika = ((id: number, method: string, ...args: unknown[]) => void) & {
  a?: unknown[][];
  l?: number;
};

declare global {
  interface Window {
    ym?: Metrika;
    dataLayer?: unknown[];
  }
}

let previousUrl: URL | undefined;

function loadScript(src: string) {
  const script = document.createElement('script');
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

export function trackPage() {
  if (!window.ym || previousUrl?.pathname === location.pathname) return;
  const url = new URL(location.href);
  const referer = previousUrl?.href ?? document.referrer;
  previousUrl = url;
  window.ym(counterId, 'hit', url.href, { referer, title: document.title });
}

export function startAnalytics() {
  if (location.hostname !== 'fapixracing.com' || previousUrl) return;
  const dataLayer = (window.dataLayer ??= []);
  // The published Google container handles initial views and History API navigation.
  function gtag(..._args: unknown[]) {
    dataLayer.push(arguments);
  }
  gtag('consent', 'default', {
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    ad_storage: 'denied',
  });
  dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  loadScript('https://www.googletagmanager.com/gtm.js?id=' + containerId);

  const queue: Metrika = (...args) => (queue.a ??= []).push(args);
  queue.l = Date.now();
  window.ym ??= queue;
  window.ym(counterId, 'init', {
    defer: true,
    ssr: true,
    webvisor: true,
    clickmap: true,
    ecommerce: 'dataLayer',
    accurateTrackBounce: true,
    trackLinks: true,
    referrer: document.referrer,
    url: location.href,
  });
  trackPage();
  loadScript('https://mc.yandex.ru/metrika/tag.js?id=' + counterId);
}
