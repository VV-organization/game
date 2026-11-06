import ProductThumbnail from '../game/ProductThumbnail';
import { customizationFor } from '../lib/customization';
import { useMemo, useState } from 'react';
import {
  Search,
  Check,
  ArrowUpRight,
  Car,
  Palette,
  Disc3,
  HardHat,
  Shirt,
  Warehouse,
  Flower2,
  Sticker,
  Sparkles,
  Package,
  RectangleHorizontal,
  Wind,
  UserRound,
  Sun,
  SlidersHorizontal,
  Flag,
  Trophy,
  Gamepad2,
  Users,
  Paintbrush,
  ShoppingBag,
  Wallet,
  House,
  HelpCircle,
  Keyboard,
  Smartphone,
} from 'lucide-react';
import type { Product, User } from '../lib/api';
import { money } from '../lib/api';
import { CarStats, getStatMax } from './CarStats';
export const categoryNames: Record<string, string> = {
  car: 'Машины',
  color: 'Цвет',
  body: 'Обвес',
  wheels: 'Диски',
  garage: 'Помещение',
  decor: 'Декор',
  helmet: 'Шлем',
  suit: 'Комбинезон',
  plate: 'Номера',
  decal: 'Винилы',
  underglow: 'Подсветка',
  trail: 'Эффекты',
  profile: 'Профиль',
  bundle: 'Комплекты',
  windowTint: 'Визоры',
};
const icons: Record<string, typeof Car> = {
  car: Car,
  color: Palette,
  body: SlidersHorizontal,
  wheels: Disc3,
  garage: Warehouse,
  decor: Flower2,
  helmet: HardHat,
  suit: Shirt,
  plate: RectangleHorizontal,
  decal: Sticker,
  underglow: Sun,
  trail: Wind,
  profile: UserRound,
  bundle: Package,
  windowTint: Sparkles,
};
const profileIcons = [
  Flag,
  Trophy,
  Gamepad2,
  Users,
  Paintbrush,
  ShoppingBag,
  Wallet,
  House,
  HelpCircle,
  Keyboard,
  Smartphone,
];
function countLabel(count: number) {
  const ending = count % 100;
  return `${count} ${ending >= 11 && ending <= 14 ? 'товаров' : count % 10 === 1 ? 'товар' : count % 10 >= 2 && count % 10 <= 4 ? 'товара' : 'товаров'}`;
}
export function ProductArt({ product, products }: { product: Product; products: Product[] }) {
  const isProfile = product.category === 'profile',
    Icon = isProfile ? profileIcons[product.variant % 11] : icons[product.category] || Package;
  return (
    <div
      className={`product-art art-${product.category}`}
      style={{ '--product-color': product.color } as React.CSSProperties}
    >
      <div className="art-halo" />
      {isProfile ? (
        <div
          style={{
            background: product.color,
            borderRadius: product.variant % 2 ? '50%' : '24px',
            border: '4px solid #f7f1e4',
            width: 86,
            height: 86,
            display: 'grid',
            placeItems: 'center',
            color: '#f5f4ef',
            boxShadow: '0 10px 24px #0004',
          }}
        >
          <Icon size={42} strokeWidth={1.6} />
        </div>
      ) : (
        <>
          <ProductThumbnail
            product={product}
            customization={
              product.category === 'bundle'
                ? customizationFor(undefined, products, product)
                : undefined
            }
          />
          <Icon className="product-fallback-icon" size={62} strokeWidth={1.15} />
        </>
      )}
      <span>{String(product.variant).padStart(2, '0')}</span>
    </div>
  );
}
export function Catalog({
  products,
  user,
  garage,
  onAction,
  onPreview,
  busy,
}: {
  products: Product[];
  user: User | null;
  garage: boolean;
  onAction: (p: Product) => void;
  onPreview: (p: Product) => void;
  busy: string;
}) {
  const [category, setCategory] = useState('all'),
    [query, setQuery] = useState(''),
    [sort, setSort] = useState('default');
  const owned = useMemo(() => new Set(user?.owned || []), [user]);
  const statMax = useMemo(() => getStatMax(products), [products]);
  const visible = useMemo(
    () =>
      products
        .filter(
          (p) =>
            (!garage || owned.has(p.id)) &&
            (category === 'all' || p.category === category) &&
            `${p.name} ${p.description}`.toLowerCase().includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          sort === 'low' ? a.price - b.price : sort === 'high' ? b.price - a.price : 0,
        ),
    [products, garage, owned, category, query, sort],
  );
  return (
    <>
      <div className="catalog-controls">
        <div className="search-field">
          <Search size={19} />
          <input
            aria-label="Поиск товаров"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найди свой стиль"
          />
        </div>
        <select aria-label="Сортировка" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="default">По коллекции</option>
          <option value="low">Сначала дешевле</option>
          <option value="high">Сначала дороже</option>
        </select>
        <span className="muted">{countLabel(visible.length)}</span>
      </div>
      <div className="category-tabs">
        <button className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>
          Всё
        </button>
        {Object.entries(categoryNames).map(([id, name]) => (
          <button
            key={id}
            className={category === id ? 'active' : ''}
            onClick={() => setCategory(id)}
          >
            {name}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <div className="empty panel">
          <Package size={38} />
          <h3>{garage ? 'Твоя коллекция начинается здесь' : 'Ничего не найдено'}</h3>
          <p>
            {garage
              ? 'Базовый карт уже готов к гонке. Купленные предметы появятся здесь.'
              : 'Попробуй другой запрос или категорию.'}
          </p>
        </div>
      ) : (
        <div className="catalog-grid">
          {visible.map((p) => {
            const has = owned.has(p.id),
              equipped =
                p.category === 'bundle' && p.bundle?.length
                  ? has &&
                    p.bundle.every((id) => {
                      const component = products.find((item) => item.id === id);
                      return !!component && user?.equipped[component.category] === id;
                    })
                  : user?.equipped[p.category] === p.id;
            return (
              <article className={`product-card ${equipped ? 'equipped' : ''}`} key={p.id}>
                <button
                  className="product-preview"
                  aria-label={`Примерить ${p.name}`}
                  onClick={() => onPreview(p)}
                >
                  <ProductArt product={p} products={products} />
                  <span className="preview-label">
                    Примерить
                    <ArrowUpRight size={15} />
                  </span>
                </button>
                <div className="product-info">
                  <span className="eyebrow">{categoryNames[p.category]}</span>
                  <h3>{p.name}</h3>
                  <p>{p.description}</p>
                  <CarStats stats={p.stats} max={statMax} />
                  <div className="product-bottom">
                    <div>
                      <b>
                        {money(p.price)} <small>FP</small>
                      </b>
                      <small>{money(p.price / 2)} ₽</small>
                    </div>
                    <button
                      disabled={equipped || busy === p.id}
                      className={has ? 'secondary' : 'primary'}
                      onClick={() => onAction(p)}
                    >
                      {busy === p.id ? (
                        '…'
                      ) : equipped ? (
                        <>
                          <Check size={16} />
                          Надето
                        </>
                      ) : has ? (
                        'Надеть'
                      ) : (
                        'Купить'
                      )}
                    </button>
                  </div>
                  {has && (
                    <span className="owned">
                      <Check size={13} />В коллекции
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
