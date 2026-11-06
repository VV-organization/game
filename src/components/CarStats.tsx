import type { Product } from '../lib/api';

type Stats = NonNullable<Product['stats']>;

const statDefinitions = [
  { key: 'speed', label: 'Скорость', unit: ' км/ч' },
  { key: 'acceleration', label: 'Разгон', unit: '' },
  { key: 'handling', label: 'Контроль', unit: '' },
] as const;

export function getStatMax(products: readonly Product[]): Stats {
  return {
    speed: Math.max(1, ...products.map((p) => p.stats?.speed || 0)),
    acceleration: Math.max(1, ...products.map((p) => p.stats?.acceleration || 0)),
    handling: Math.max(1, ...products.map((p) => p.stats?.handling || 0)),
  };
}

export function CarStats({ stats, max }: { stats?: Stats; max: Stats }) {
  if (!stats) return null;

  return (
    <div className="mini-stats">
      {statDefinitions.map(({ key, label, unit }) => (
        <div key={key}>
          <span className="stat-label">
            {label}
            <span className="stat-separator"> · </span>
            <span className="stat-value">
              {stats[key]}
              {unit}
            </span>
          </span>
          <meter
            min={0}
            max={max[key]}
            value={stats[key]}
            aria-label={`${label}: ${stats[key]}${unit}`}
          />
        </div>
      ))}
    </div>
  );
}
