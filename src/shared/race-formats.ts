export type RaceFormatId = 'classic' | 'sprint' | 'time-attack' | 'elimination' | 'endurance';

export type RaceFormat = {
  id: RaceFormatId;
  name: string;
  label: string;
  description: string;
  laps: number | null;
  duration: number | null;
  eliminationInterval: number | null;
  opponents: number;
  pickups: boolean;
};

export const RACE_FORMATS: readonly RaceFormat[] = [
  {
    id: 'classic',
    name: 'Классика',
    label: 'Классика · 3 круга',
    description: 'Три круга, пять соперников. Пересеки финиш первым.',
    laps: 3,
    duration: null,
    eliminationInterval: null,
    opponents: 5,
    pickups: true,
  },
  {
    id: 'sprint',
    name: 'Спринт',
    label: 'Спринт · 1 круг',
    description: 'Всего один круг. Борись за лидерство с первого поворота.',
    laps: 1,
    duration: null,
    eliminationInterval: null,
    opponents: 5,
    pickups: true,
  },
  {
    id: 'time-attack',
    name: 'Тайм-атака',
    label: 'Тайм-атака · 2 минуты',
    description:
      'Покажи лучший полный круг за две минуты. Только ты и трасса, без случайных бонусов.',
    laps: null,
    duration: 120,
    eliminationInterval: null,
    opponents: 0,
    pickups: false,
  },
  {
    id: 'elimination',
    name: 'На выбывание',
    label: 'На выбывание · каждые 30 с',
    description: 'Каждые 30 секунд последний выбывает. Останься единственным на трассе.',
    laps: null,
    duration: null,
    eliminationInterval: 30,
    opponents: 5,
    pickups: true,
  },
  {
    id: 'endurance',
    name: 'Выносливость',
    label: 'Выносливость · 3 минуты',
    description: 'Проедь дальше всех за три минуты. Круги не ограничены — держи темп.',
    laps: null,
    duration: 180,
    eliminationInterval: null,
    opponents: 5,
    pickups: true,
  },
];

export function isRaceFormatId(value: unknown): value is RaceFormatId {
  return RACE_FORMATS.some((format) => format.id === value);
}

export function getRaceFormat(id: unknown): RaceFormat {
  return RACE_FORMATS.find((format) => format.id === id) || RACE_FORMATS[0];
}

export type RaceResult = {
  position: number;
  time: number;
  trackId: string;
  formatId: RaceFormatId;
  bestLap: number | null;
  distance: number;
  completedLaps: number;
  eliminated: boolean;
};
