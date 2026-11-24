import { useEffect, useState } from 'react';
import { ArrowRight, Trophy } from 'lucide-react';
import { api } from '../lib/api';
import { cupTime, type CupBoard } from '../shared/weekly-cup';
import type { OnlineTrackId } from '../shared/online-protocol';
import './WeeklyCup.css';

const names = {
  coast: ['Лазурный берег', 'Azure Coast'],
  neon: ['Неоновый квартал', 'Neon District'],
  canyon: ['Красный каньон', 'Red Canyon'],
  sky: ['Небесная трасса', 'Sky Circuit'],
};

export function WeeklyCup({
  login,
  full = false,
  english = false,
  onEnter,
  onStandings,
}: {
  login?: string;
  full?: boolean;
  english?: boolean;
  onEnter: (track: OnlineTrackId) => void;
  onStandings?: () => void;
}) {
  const [board, setBoard] = useState<CupBoard | null>(null);
  const [failed, setFailed] = useState(false);
  const [request, setRequest] = useState(0);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const data = await api<CupBoard>('/weekly-cup');
        if (!active) return;
        if (!Array.isArray(data.rows) || !names[data.trackId]) throw new Error('Invalid standings');
        setBoard(data);
        setFailed(false);
        timer = setTimeout(load, Math.max(1000, Math.min(60000, data.endsAt - Date.now())));
      } catch {
        if (active) setFailed(true);
      }
    }
    void load();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [request]);
  const t = (ru: string, en: string) => (english ? en : ru);
  const rows = board?.rows ?? [];
  const myIndex = login ? rows.findIndex((row) => row.nickname === login) : -1;
  const mine = rows[myIndex];
  const shown = full
    ? rows
    : rows.filter((_, i) => i < 3 || (myIndex >= 0 && Math.abs(i - myIndex) <= 1));
  return (
    <section
      className={'weekly-cup' + (full ? ' weekly-cup-full' : '')}
      aria-label={t('Кубок недели', 'Weekly cup')}
    >
      <div className="weekly-cup-summary">
        <h2>
          <Trophy aria-hidden="true" />
          {t('Кубок недели', 'Weekly cup')}
        </h2>
        {board && (
          <>
            <p>
              {names[board.trackId][english ? 1 : 0]} · {t('Спринт, 1 круг', 'Sprint, 1 lap')}
            </p>
            <small>
              {t('До', 'Until')}{' '}
              {new Date(board.endsAt).toLocaleString(english ? 'en-GB' : 'ru-RU', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'UTC',
              })}{' '}
              UTC
            </small>
            {mine && (
              <p>
                <b>
                  {t('Твой рекорд', 'Your best')} · {cupTime(mine.finishMs)}
                </b>
              </p>
            )}
            <button className="cup-enter" onClick={() => onEnter(board.trackId)}>
              {mine ? t('Улучшить время', 'Beat your time') : t('Принять участие', 'Enter cup')}
              <ArrowRight size={16} />
            </button>
            {onStandings && (
              <button className="cup-link" onClick={onStandings}>
                {t('Вся таблица', 'Full standings')}
              </button>
            )}
          </>
        )}
      </div>
      <div className="weekly-cup-times">
        {failed && (
          <p role="status">
            {t('Не удалось обновить рейтинг.', 'Could not load standings.')}{' '}
            <button className="cup-link" onClick={() => setRequest((n) => n + 1)}>
              {t('Повторить', 'Retry')}
            </button>
          </p>
        )}
        {!board && !failed && <p role="status">{t('Загружаем рейтинг…', 'Loading standings…')}</p>}
        {board && (
          <>
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('Место', 'Rank')}</th>
                  <th scope="col">{t('Ник', 'Name')}</th>
                  <th scope="col">{t('Результат', 'Time')}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <tr key={row.nickname} className={row.nickname === login ? 'cup-me' : undefined}>
                    <td>{row.place}</td>
                    <th scope="row">{row.nickname}</th>
                    <td>{cupTime(row.finishMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <details>
              <summary>{t('Правила кубка', 'Cup rules')}</summary>
              <p>
                {t(
                  'В зачёте сравниваются лучшие финиши игроков и контрольные времена игры. У всех базовый карт. Попытки без ограничений, учитывается лучший финиш за неделю.',
                  'The standings compare player finishes and game benchmark times. Everyone drives a stock kart. Enter as often as you like. Your best finish this week counts.',
                )}
              </p>
            </details>
          </>
        )}
      </div>
    </section>
  );
}
