// Keep game invitations and payment references available on reload without exposing them in page views.
const privateParams = [
  'room',
  'payment',
  'startMode',
  'startTrack',
  'startFormat',
  'startRoom',
  'startCup',
];

export function gameParams(): URLSearchParams {
  return new URLSearchParams(history.state?.gameParams);
}

export function saveGameParams(params: URLSearchParams) {
  history.replaceState({ ...history.state, gameParams: params.toString() }, '');
}

export function captureGameParams() {
  const url = new URL(location.href);
  const params = gameParams();
  let changed = false;
  for (const key of privateParams) {
    const value = url.searchParams.get(key);
    if (value === null) continue;
    params.set(key, value);
    url.searchParams.delete(key);
    changed = true;
  }
  if (changed) history.replaceState({ ...history.state, gameParams: params.toString() }, '', url);
}
