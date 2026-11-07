import type { Controls, RaceState } from '../game/simulation';
import type { Customization } from '../game/types';
import type { RaceFormatId, RaceResult } from './race-formats';

export const ONLINE_VERSION = 1;
export const ONLINE_CAPACITY = 6;
export const MATCHMAKING_MS = 30_000;
export const RECONNECT_MS = 12_000;
export const ONLINE_FORMATS = ['classic', 'sprint', 'elimination', 'endurance'] as const;
export type OnlineFormatId = (typeof ONLINE_FORMATS)[number];
export const ONLINE_TRACKS = ['coast', 'neon', 'canyon', 'sky'] as const;
export type OnlineTrackId = (typeof ONLINE_TRACKS)[number];

export type OnlineIdentity = { actorId: string; name: string; customization: Customization };
export type OnlineRosterEntry = {
  id: number;
  name: string;
  kind: 'human' | 'bot';
  customization: Customization;
  connected: boolean;
};
export type OnlineJoin = { formatId: OnlineFormatId; trackId: OnlineTrackId; roomId?: string };
export type OnlineClientMessage =
  | ({ type: 'join'; version: 1 } & OnlineJoin)
  | { type: 'resume'; version: 1; roomId: string; token: string }
  | { type: 'input'; seq: number; controls: Controls; reset?: boolean }
  | { type: 'leave' };

export type OnlineResult = { carId: number; result: RaceResult };
export type OnlineRaceSnapshot = Omit<RaceState, 'track'>;
export type OnlineRoomMessage = {
  type: 'room';
  roomId: string;
  trackId: OnlineTrackId;
  formatId: OnlineFormatId;
  deadline: number;
  serverNow: number;
  roster: OnlineRosterEntry[];
  localCarId: number;
  resumeToken: string;
};
export type OnlineSnapshotMessage = {
  type: 'snapshot';
  roomId: string;
  tick: number;
  serverNow: number;
  state: OnlineRaceSnapshot;
  roster: OnlineRosterEntry[];
  /** Seconds on the authoritative race clock, not an epoch timestamp. */
  finishDeadline: number | null;
  results?: OnlineResult[];
};
export type OnlineServerMessage =
  | OnlineRoomMessage
  | OnlineSnapshotMessage
  | { type: 'error'; code: string; message: string; fatal?: boolean }
  | { type: 'left' };

export type OnlineConnectionState =
  'connecting' | 'connected' | 'reconnecting' | 'closed' | 'error';
export interface OnlineRaceRuntime {
  readonly race: RaceState;
  readonly localCarId: number;
  readonly roster: OnlineRosterEntry[];
  readonly connectionState: OnlineConnectionState;
  readonly finishDeadline: number | null;
  update(controls: Controls, dt: number): void;
  reset(): void;
  getResult(): RaceResult | null;
  getResults(): OnlineResult[] | null;
}

export const isOnlineFormat = (id: RaceFormatId | string): id is OnlineFormatId =>
  (ONLINE_FORMATS as readonly string[]).includes(id);
