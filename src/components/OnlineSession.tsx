import { lazy, Suspense, useEffect, useSyncExternalStore } from 'react';
import { Flag } from 'lucide-react';
import { OnlineClient } from '../game/online-client';
import type { OnlineJoin } from '../shared/online-protocol';
import type { RaceResult } from '../shared/race-formats';
import { OnlineLobby } from './OnlineLobby';
const Race = lazy(() => import('../game/Race'));

export function OnlineSession({
  client,
  onExit,
  onRematch,
  onFinish,
}: {
  client: OnlineClient;
  onExit: () => void;
  onRematch: (settings: OnlineJoin) => void;
  onFinish: (result: RaceResult, carVariant?: number) => void;
}) {
  const state = useSyncExternalStore(client.subscribe, client.getSnapshot);
  useEffect(() => {
    let started = false;
    const start = setTimeout(() => {
      started = true;
      void client.connect();
    }, 0);
    return () => {
      clearTimeout(start);
      if (started) client.leave();
    };
  }, [client]);
  const settings: OnlineJoin = {
    formatId: state.room?.formatId || 'classic',
    trackId: state.room?.trackId || 'coast',
  };
  if (state.runtime && state.room && state.connection !== 'error' && state.connection !== 'closed')
    return (
      <Suspense
        fallback={
          <div className="game-loading">
            <Flag size={40} />
            <h2>Выходим на старт…</h2>
          </div>
        }
      >
        <Race
          trackId={state.room.trackId}
          formatId={state.room.formatId}
          online={state.runtime}
          customization={
            state.runtime.roster.find((car) => car.id === state.runtime!.localCarId)?.customization
          }
          onExit={onExit}
          onRematch={() => onRematch(settings)}
          onFinish={(result) =>
            onFinish(
              { ...result, online: true },
              state.runtime!.race.cars.find((car) => car.id === state.runtime!.localCarId)
                ?.customization.car || 0,
            )
          }
        />
      </Suspense>
    );
  return (
    <OnlineLobby
      state={state}
      onCancel={onExit}
      onRetry={() => client.retry()}
      onFindOther={() => onRematch(settings)}
    />
  );
}
