import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Flag,
  LoaderCircle,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { OnlineClientView } from '../game/online-client';
import { getRaceFormat } from '../shared/race-formats';
import { MATCHMAKING_MS, ONLINE_CAPACITY } from '../shared/online-protocol';

const tracks = {
  coast: ['Лазурный берег', 'coast'],
  neon: ['Неоновый квартал', 'city'],
  canyon: ['Красный каньон', 'canyon'],
  sky: ['Небесная трасса', 'skyway'],
};

export function OnlineLobby({
  state,
  onCancel,
  onRetry,
  onFindOther,
}: {
  state: OnlineClientView;
  onCancel: () => void;
  onRetry: () => void;
  onFindOther: () => void;
}) {
  const [now, setNow] = useState(Date.now),
    [copied, setCopied] = useState(false);
  const room = state.room;
  const anchor = useMemo(
    () => ({ local: Date.now(), server: room?.serverNow || Date.now() }),
    [room],
  );
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, []);
  const remaining = room
    ? Math.max(
        0,
        Math.ceil((room.deadline - (anchor.server + Math.max(0, now - anchor.local))) / 1000),
      )
    : 30;
  const track = tracks[room?.trackId || 'coast'];
  const invite = room ? `${location.origin}/play?room=${encodeURIComponent(room.roomId)}` : '';
  const failed = state.connection === 'error' || state.connection === 'closed';
  const connected =
    room?.roster.filter((driver) => driver.kind === 'human' && driver.connected).length || 0;
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(invite);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <main className="online-page">
      <header className="online-header">
        <button className="text-button" onClick={onCancel}>
          <ArrowLeft size={18} />В паддок
        </button>
        <span className="online-wordmark">
          FApix<span>RACING / ONLINE</span>
        </span>
        <span className={`online-status ${failed ? 'is-error' : ''}`}>
          {failed ? <WifiOff size={16} /> : <Wifi size={16} />}
          {failed ? 'Нет соединения' : 'Общий заезд'}
        </span>
      </header>
      <div className="online-heading">
        <span className="eyebrow">ТВОИ СОПЕРНИКИ УЖЕ БЛИЗКО</span>
        <h1>{failed ? 'Вернёмся на связь.' : 'Собираем стартовую решётку.'}</h1>
        <p>
          {failed
            ? 'Попробуй подключиться снова или вернись в паддок.'
            : 'Одна трасса. Шесть картов. Победа решается в повороте.'}
        </p>
      </div>
      {failed ? (
        <section className="online-error panel">
          <WifiOff size={40} />
          <p role="alert">{state.error || 'Соединение с сервером закрыто.'}</p>
          <div>
            <button className="primary" onClick={onRetry}>
              Повторить подключение
              <ArrowRight size={17} />
            </button>
            <button className="secondary" onClick={onFindOther}>
              Найти другую гонку
            </button>
          </div>
        </section>
      ) : (
        <div className="online-lobby-grid">
          <section className="online-track panel">
            <img src={`/assets/reference/track-${track[1]}.svg`} alt="" />
            <div className="online-track-content">
              <span className="eyebrow">СЛЕДУЮЩИЙ ЗАЕЗД</span>
              <h2>{room ? track[0] : 'Подключаемся к серверу'}</h2>
              <p>
                {room ? getRaceFormat(room.formatId).label : 'Готовим место на стартовой решётке…'}
              </p>
              <div className="online-search-timer">
                <div>
                  <small>{room ? 'До конца подбора' : 'Подключение'}</small>
                  <strong>{room ? `00:${String(remaining).padStart(2, '0')}` : '•••'}</strong>
                </div>
                <LoaderCircle size={28} className="online-spinner" />
              </div>
              <div className="online-search-progress">
                <span
                  style={{
                    width: `${Math.min(100, (1 - remaining / (MATCHMAKING_MS / 1000)) * 100)}%`,
                  }}
                />
              </div>
              <p className="online-rule">
                Полная решётка стартует сразу. Через 30 секунд свободные места займёт AI.
              </p>
            </div>
          </section>
          <section className="online-roster panel">
            <div className="section-title">
              <h2>На старте</h2>
              <span>
                <Users size={16} />
                {connected} / {ONLINE_CAPACITY}
              </span>
            </div>
            <div className="online-seats">
              {Array.from({ length: ONLINE_CAPACITY }, (_, id) => {
                const driver = room?.roster.find((entry) => entry.id === id);
                return (
                  <div
                    key={id}
                    className={`online-seat ${driver ? 'is-filled' : ''} ${driver?.id === room?.localCarId ? 'is-you' : ''}`}
                  >
                    <span className="online-seat-number">0{id + 1}</span>
                    <div className="online-seat-avatar">
                      {driver ? (
                        <Flag size={22} />
                      ) : (
                        <LoaderCircle size={20} className="online-spinner" />
                      )}
                    </div>
                    <div>
                      <b>{driver?.name || 'Ищем гонщика'}</b>
                      <small>
                        {driver
                          ? `${driver.kind === 'bot' ? 'AI' : driver.id === room?.localCarId ? 'ТЫ' : 'ИГРОК'}${driver.connected ? ' · На связи' : ' · Переподключается'}`
                          : 'Свободное место'}
                      </small>
                    </div>
                    {driver?.connected && <Check className="online-ready" size={16} />}
                  </div>
                );
              })}
            </div>
            <button className="secondary full" onClick={onCancel}>
              Отменить поиск
            </button>
          </section>
        </div>
      )}
      {room && !failed && (
        <section className="online-invite panel">
          <div>
            <span className="eyebrow">ПОВОРОТЫ ЛУЧШЕ С ДРУЗЬЯМИ</span>
            <h3>Пригласи в эту гонку</h3>
            <p>
              Код комнаты <b>{room.roomId}</b> · войти можно до старта.
            </p>
          </div>
          <div className="online-invite-link">
            <input
              aria-label="Ссылка на комнату"
              readOnly
              value={invite}
              onFocus={(event) => event.currentTarget.select()}
            />
            <button className="secondary" onClick={copyInvite}>
              {copied ? <Check size={17} /> : <Copy size={17} />}
              {copied ? 'Скопировано' : 'Копировать'}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
