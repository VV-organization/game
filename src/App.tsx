import { lazy, Suspense, useEffect, useMemo, useState, useRef } from 'react';
import {
  ArrowRight,
  Flag,
  Paintbrush,
  ShoppingBag,
  Wallet as WalletIcon,
  House,
  HelpCircle,
  ChevronRight,
  LogOut,
  Plus,
  Trophy,
  Gamepad2,
  Check,
  Users,
  Keyboard,
  Smartphone,
  X,
} from 'lucide-react';
import { parseRecords, recordOutcome, recordTime, type RaceRecord } from './lib/records';
import {
  getRaceFormat,
  RACE_FORMATS,
  type RaceFormatId,
  type RaceResult,
} from './shared/race-formats';
import { getCarDesign } from './shared/car-designs';
import { RaceFormatPicker } from './components/RaceFormatPicker';
import { api, money, type Product, type User, type PaymentMode } from './lib/api';
import { Landing } from './components/Landing';
import { Auth } from './components/Auth';
import { Wallet, savedPaymentId } from './components/Wallet';
import { Modal } from './components/Modal';
import { Catalog, categoryNames, ProductArt } from './components/Catalog';
import { CarStats, getStatMax } from './components/CarStats';
import { customizationFor } from './lib/customization';
const Race = lazy(() => import('./game/Race'));
const KartPreview = lazy(() => import('./game/KartPreview'));
const tracks = [
  {
    id: 'coast',
    art: 'coast',
    name: 'Лазурный берег',
    subtitle: 'Соль, солнце и полный газ',
    description: 'Широкие повороты вдоль океана. Идеальное место для первого дрифта.',
    level: 'Легко',
    color: '#7ccfc5',
  },
  {
    id: 'neon',
    art: 'city',
    name: 'Неоновый квартал',
    subtitle: 'Твой ритм ночного города',
    description: 'Неоновые арки и связки городских поворотов. Держи траекторию.',
    level: 'Средне',
    color: '#ac8dea',
  },
  {
    id: 'canyon',
    art: 'canyon',
    name: 'Красный каньон',
    subtitle: 'Горячий асфальт. Холодный расчёт.',
    description: 'Красные скалы, быстрые дуги и ни секунды на пейзажи.',
    level: 'Сложно',
    color: '#e6ae78',
  },
  {
    id: 'sky',
    art: 'skyway',
    name: 'Небесная трасса',
    subtitle: 'Выше облаков. Быстрее ветра.',
    description: 'Плоский автодром над облаками с быстрыми прямыми и плавными поворотами.',
    level: 'Сложно',
    color: '#a2cce2',
  },
];
type Page = 'home' | 'play' | 'garage' | 'shop' | 'records';
const initialPage = (): Page => {
  const p = location.pathname.slice(1);
  return ['play', 'garage', 'shop', 'records'].includes(p) ? (p as Page) : 'home';
};
type RecordItem = RaceRecord;
function loadRecords(): RecordItem[] {
  try {
    return parseRecords(localStorage.getItem('fapix-records'));
  } catch {
    return [];
  }
}
export default function App() {
  const [page, setPage] = useState<Page>(initialPage),
    [products, setProducts] = useState<Product[]>([]),
    [popularIds, setPopularIds] = useState<string[]>([]),
    [authRegister, setAuthRegister] = useState(false),
    [user, setUser] = useState<User | null>(null),
    [paymentMode, setPaymentMode] = useState<PaymentMode>('disabled'),
    [loadError, setLoadError] = useState(''),
    [loaded, setLoaded] = useState(false),
    [auth, setAuth] = useState<string | null>(null),
    [wallet, setWallet] = useState<{
      rub: number;
      productName?: string;
      paymentId?: string;
    } | null>(() => {
      const paymentId = new URLSearchParams(location.search).get('payment') || savedPaymentId();
      return paymentId ? { rub: 311, paymentId } : null;
    }),
    [help, setHelp] = useState(false),
    [trackId, setTrackId] = useState('coast'),
    [formatId, setFormatId] = useState<RaceFormatId>('classic'),
    [recordsFormat, setRecordsFormat] = useState<RaceFormatId | 'all'>('all'),
    [racing, setRacing] = useState(false),
    [busy, setBusy] = useState(''),
    [toast, setToast] = useState(''),
    [preview, setPreview] = useState<Product | null>(null),
    [records, setRecords] = useState<RecordItem[]>(loadRecords),
    [purchase, setPurchase] = useState<Product | null>(null);
  const purchaseKey = useRef<{ id: string; key: string } | null>(null);
  const raceFormat = getRaceFormat(formatId);
  const visibleRecords = records.filter(
    (record) => recordsFormat === 'all' || (record.formatId || 'classic') === recordsFormat,
  );
  const authContinuation = useRef<((account: User) => void) | null>(null);
  function openWallet(value: { rub: number; productName?: string }) {
    if (paymentMode !== 'arco') {
      setToast('Пополнение временно недоступно');
      return;
    }
    setWallet({ ...value, paymentId: savedPaymentId() });
  }
  function closeWallet() {
    authContinuation.current = null;
    setWallet(null);
    if (location.search.includes('payment=')) history.replaceState({}, '', location.pathname);
  }
  function openAuth(register = false, login = '', onAuthenticated?: (account: User) => void) {
    authContinuation.current = onAuthenticated || null;
    setAuthRegister(register);
    setAuth(login);
  }
  function closeAuth() {
    authContinuation.current = null;
    setAuth(null);
  }
  function navigate(next: Page) {
    setPage(next);
    history.pushState({}, '', next === 'home' ? '/' : `/${next}`);
    window.scrollTo({ top: 0 });
    setPreview(null);
  }
  async function load() {
    setLoadError('');
    try {
      const [c, s] = await Promise.all([
        api<{ products: Product[]; popularIds: string[] }>('/catalog'),
        api<{ user: User | null; paymentMode: PaymentMode }>('/session'),
      ]);
      setProducts(c.products);
      setPopularIds(c.popularIds);
      setUser(s.user);
      setPaymentMode(s.paymentMode);
      setLoaded(true);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
    const pop = () => {
      setPage(initialPage());
      setRacing(false);
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  const customization = useMemo(() => customizationFor(user?.equipped, products), [user, products]);
  const statMax = useMemo(() => getStatMax(products), [products]);
  const equippedCar = products.find((p) => p.id === user?.equipped.car);
  const shownCustomization = useMemo(
    () => customizationFor(user?.equipped, products, preview),
    [user, products, preview],
  );
  const avatarProduct = products.find((p) => p.id === user?.equipped.profile);
  const AvatarIcon = [
    Flag,
    Trophy,
    Gamepad2,
    Users,
    Paintbrush,
    ShoppingBag,
    WalletIcon,
    House,
    HelpCircle,
    Keyboard,
    Smartphone,
  ][(avatarProduct?.variant || 0) % 11];
  const track = tracks.find((t) => t.id === trackId)!;
  async function act(p: Product) {
    if (!user) {
      openAuth();
      return;
    }
    if (!user.owned.includes(p.id)) {
      if (user.balance < p.price) {
        openWallet({ rub: Math.ceil((p.price - user.balance) / 2), productName: p.name });
        return;
      }
      purchaseKey.current = { id: p.id, key: crypto.randomUUID() };
      setPurchase(p);
      return;
    }
    setBusy(p.id);
    try {
      const r = await api<{ user: User }>('/equip', { productId: p.id });
      setUser(r.user);
      setPreview(null);
      setToast(`«${p.name}» теперь на тебе`);
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  async function buy() {
    if (!purchase) return;
    setBusy(purchase.id);
    try {
      const r = await api<{ user: User }>('/purchase', {
        productId: purchase.id,
        idempotencyKey:
          purchaseKey.current?.id === purchase.id ? purchaseKey.current.key : crypto.randomUUID(),
      });
      setUser(r.user);
      setToast(`«${purchase.name}» в твоей коллекции`);
      setPurchase(null);
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  function finish(result: RaceResult) {
    const next = [
      { ...result, carVariant: customization.car || 0, date: new Date().toISOString() },
      ...records,
    ].slice(0, 50);
    setRecords(next);
    try {
      localStorage.setItem('fapix-records', JSON.stringify(next));
    } catch {
      /* Records are optional local history. */
    }
  }
  const loading = (
    <div className="game-loading">
      <Flag size={40} />
      <h2>Готовим стартовую решётку…</h2>
    </div>
  );
  if (racing)
    return (
      <Suspense fallback={loading}>
        <Race
          trackId={trackId}
          formatId={formatId}
          customization={customization}
          onExit={() => setRacing(false)}
          onFinish={finish}
        />
      </Suspense>
    );
  return (
    <>
      {page === 'home' ? (
        <Landing
          signedIn={!!user}
          onGarage={() => navigate('garage')}
          popularIds={popularIds}
          catalogError={loadError}
          onRetry={load}
          products={products}
          onPlay={(id) => {
            if (id) setTrackId(id);
            navigate('play');
          }}
          onLogin={() => (user ? navigate('play') : openAuth())}
          onTopup={(rub, productName) => openWallet({ rub, productName })}
          topupEnabled={paymentMode === 'arco'}
        />
      ) : (
        <div className="paddock">
          <aside className="sidebar">
            <button
              className="brand-mark"
              aria-label="FApix Racing — главная"
              onClick={() => navigate('home')}
            >
              <img src="/assets/reference/logo-mark.svg" alt="FApix Racing" />
            </button>
            <nav>
              {(
                [
                  { id: 'play', label: 'Играть', Icon: Flag },
                  { id: 'garage', label: 'Гараж', Icon: Paintbrush },
                  { id: 'shop', label: 'Магазин', Icon: ShoppingBag },
                  { id: 'records', label: 'Заезды', Icon: Trophy },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  className={page === id ? 'active' : ''}
                  onClick={() => navigate(id)}
                >
                  <Icon />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <button onClick={() => setHelp(true)}>
                <HelpCircle />
                <span>Как играть</span>
              </button>
              <button onClick={() => navigate('home')}>
                <House />
                <span>На сайт</span>
              </button>
            </div>
          </aside>
          <div className="paddock-body">
            <header className="game-header">
              <div className="breadcrumb">
                Паддок
                <ChevronRight size={16} />
                <span>
                  {{ play: 'Играть', garage: 'Гараж', shop: 'Магазин', records: 'Заезды' }[page]}
                </span>
              </div>
              <div className="header-actions">
                <button
                  className="balance"
                  disabled={paymentMode !== 'arco'}
                  aria-label="Пополнить баланс"
                  title={
                    paymentMode !== 'arco' ? 'Пополнение временно недоступно' : 'Пополнить баланс'
                  }
                  onClick={() => openWallet({ rub: 311 })}
                >
                  <span className="coin">F</span>
                  <span className="balance-amount">
                    <span>
                      {money(user?.balance || 0)} <small>Fapix</small>
                    </span>
                    <small className="balance-equivalent">
                      {money((user?.balance || 0) / 2)} ₽
                    </small>
                  </span>
                  <Plus size={16} />
                </button>
                <button
                  className="profile-button"
                  onClick={() => (user ? setHelp(true) : openAuth())}
                >
                  <span>
                    <b>{user?.login || 'Гость'}</b>
                    <small>{user ? 'Гоночный аккаунт' : 'Свободная тренировка'}</small>
                  </span>
                  <i
                    style={
                      avatarProduct
                        ? {
                            background: avatarProduct.color,
                            borderRadius: avatarProduct.variant % 2 ? '50%' : '14px',
                            borderColor: '#f7f1e4',
                          }
                        : undefined
                    }
                  >
                    {avatarProduct ? (
                      <AvatarIcon size={22} />
                    ) : (
                      (user?.login || 'G').slice(0, 1).toUpperCase()
                    )}
                  </i>
                </button>
              </div>
            </header>
            <main className="paddock-main">
              {loadError && (
                <div className="error">
                  Не удалось загрузить аккаунт и каталог: {loadError}{' '}
                  <button onClick={load}>Повторить</button>
                </div>
              )}
              {page === 'play' && (
                <>
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">ТВОЙ СЛЕДУЮЩИЙ ЗАЕЗД</span>
                      <h1>Увидимся на старте.</h1>
                    </div>
                    <span className="session-pill">
                      <span />
                      Локальная тренировка
                    </span>
                  </div>
                  <div className="play-layout">
                    <div className="kart-stage">
                      <Suspense fallback={loading}>
                        <KartPreview customization={customization} />
                      </Suspense>
                      <div className="stage-top">
                        <span className="pill">ГОТОВ К СТАРТУ</span>
                        <span>FApix Racing · Garage 01</span>
                      </div>
                      <div className="stage-caption">
                        <div>
                          <small>Твой карт</small>
                          <h2>
                            {products.find((p) => p.id === user?.equipped.car)?.name || 'Origin'}
                          </h2>
                        </div>
                        <button className="glass-button" onClick={() => navigate('garage')}>
                          Настроить карт
                          <ArrowRight size={18} />
                        </button>
                      </div>
                    </div>
                    <section className="race-settings panel">
                      <div className="section-title">
                        <h2>Готов к гонке?</h2>
                        <Flag />
                      </div>
                      <div className="mode-choice">
                        <span>
                          <Gamepad2 size={18} />
                          {raceFormat.opponents ? 'С пятью ботами' : 'Одиночный заезд'}
                        </span>
                        <button
                          onClick={() =>
                            setToast(
                              'Сейчас доступна тренировка с ботами. Сетевая гонка ещё не подключена.',
                            )
                          }
                        >
                          <Users size={18} />
                          Онлайн
                        </button>
                      </div>
                      <RaceFormatPicker value={formatId} onChange={setFormatId} />
                      <img
                        className="selected-track-art"
                        src={`/assets/reference/track-${track.art}.svg`}
                        alt={track.name}
                      />
                      <div className="track-summary">
                        <h3>{track.name}</h3>
                        <span style={{ color: track.color }}>{track.level}</span>
                      </div>
                      <p className="muted">{track.subtitle}</p>
                      <div className="race-meta">
                        <span>
                          <Users size={16} />
                          {raceFormat.opponents ? 'Ты и 5 ботов' : 'Только ты'}
                        </span>
                        <span>
                          {raceFormat.pickups ? '✦ Бонусы включены' : 'Без случайных бонусов'}
                        </span>
                      </div>
                      <button className="primary full start-race" onClick={() => setRacing(true)}>
                        <Flag size={19} />
                        Начать гонку
                        <ArrowRight />
                      </button>
                      <p className="fine-print">Без скачивания. Без ожидания. Просто газуй.</p>
                    </section>
                  </div>
                  <div className="section-heading">
                    <h2>Найди свой любимый поворот.</h2>
                    <span>04 трассы · 04 настроения</span>
                  </div>
                  <div className="track-grid">
                    {tracks.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTrackId(t.id)}
                        className={`track-card ${t.id === trackId ? 'selected' : ''}`}
                      >
                        <div className="track-image">
                          <img src={`/assets/reference/track-${t.art}.svg`} alt="" />
                          <span>
                            {t.id === trackId ? (
                              <>
                                <Check size={14} />
                                Выбрана
                              </>
                            ) : (
                              t.level
                            )}
                          </span>
                        </div>
                        <div>
                          <h3>{t.name}</h3>
                          <p>{t.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="welcome-strip">
                    <Flag />
                    <div>
                      <h3>{user ? 'Твой стиль. Твои правила.' : 'Сохрани свой гоночный стиль'}</h3>
                      <p>
                        {user
                          ? 'Загляни в магазин и собери карт, который узнают с первого поворота.'
                          : 'Аккаунт открывает личный гараж, коллекцию и кошелёк Fapix.'}
                      </p>
                    </div>
                    <button
                      className="secondary"
                      onClick={() => (user ? navigate('shop') : openAuth(true))}
                    >
                      {user ? 'В магазин' : 'Создать аккаунт'}
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </>
              )}
              {(page === 'shop' || page === 'garage') && (
                <>
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">
                        {page === 'shop' ? 'СОБЕРИ СВОЙ ХАРАКТЕР' : 'ТВОЯ ЛИЧНАЯ КОЛЛЕКЦИЯ'}
                      </span>
                      <h1>
                        {page === 'shop' ? 'Больше, чем просто карт.' : 'Победы начинаются здесь.'}
                      </h1>
                    </div>
                    <button
                      className="secondary"
                      onClick={() => navigate(page === 'shop' ? 'garage' : 'shop')}
                    >
                      {page === 'shop' ? 'Мой гараж' : 'В магазин'}
                      <ArrowRight size={17} />
                    </button>
                  </div>
                  {(preview || page === 'garage') && (
                    <div className="garage-preview">
                      {preview && preview.category === 'profile' ? (
                        <ProductArt product={preview} products={products} />
                      ) : (
                        <Suspense fallback={loading}>
                          <KartPreview
                            customization={shownCustomization}
                            focus={
                              preview?.category === 'decor' ||
                              preview?.category === 'helmet' ||
                              preview?.category === 'suit' ||
                              preview?.category === 'plate' ||
                              preview?.category === 'decal' ||
                              preview?.category === 'underglow' ||
                              preview?.category === 'trail'
                                ? preview.category
                                : undefined
                            }
                          />
                        </Suspense>
                      )}
                      <div>
                        <span className="eyebrow">
                          {preview
                            ? preview.category === 'profile'
                              ? 'ПРЕДПРОСМОТР'
                              : 'ПРИМЕРКА'
                            : 'ВЫБРАННЫЙ КАРТ'}
                        </span>
                        <h2>{preview?.name || equippedCar?.name || 'Origin'}</h2>
                        <p>
                          {preview?.description ||
                            'Все настройки машины и гонщика отправятся с тобой на трассу.'}
                        </p>
                        <CarStats stats={(preview || equippedCar)?.stats} max={statMax} />
                        {preview && (
                          <>
                            <p>
                              {money(preview.price)} Fapix · {money(preview.price / 2)} ₽
                            </p>
                            <button
                              className="primary"
                              disabled={busy === preview.id}
                              onClick={() => act(preview)}
                            >
                              {user?.owned.includes(preview.id) ? 'Надеть' : 'Купить'}
                              <ArrowRight size={18} />
                            </button>
                            <button className="text-button" onClick={() => setPreview(null)}>
                              Завершить примерку
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  {!user && page === 'garage' && (
                    <div className="notice">
                      Базовый карт доступен без аккаунта.{' '}
                      <button className="text-button" onClick={() => openAuth()}>
                        Войти и сохранить коллекцию
                      </button>
                    </div>
                  )}
                  {!loaded && !loadError ? (
                    <div className="empty">Загружаем коллекцию…</div>
                  ) : (
                    <Catalog
                      products={products}
                      user={user}
                      garage={page === 'garage'}
                      busy={busy}
                      onAction={act}
                      onPreview={(p) => {
                        setPreview(p);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    />
                  )}
                </>
              )}
              {page === 'records' && (
                <>
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">КАЖДЫЙ ПОВОРОТ ИМЕЕТ ЗНАЧЕНИЕ</span>
                      <h1>Твои заезды.</h1>
                    </div>
                    <button className="primary" onClick={() => navigate('play')}>
                      На старт
                      <ArrowRight />
                    </button>
                  </div>
                  <p className="muted">
                    История тренировок на этом устройстве. За тренировки Fapix не начисляются.
                  </p>
                  <label className="records-filter">
                    Формат в истории
                    <select
                      value={recordsFormat}
                      onChange={(event) =>
                        setRecordsFormat(
                          event.target.value === 'all'
                            ? 'all'
                            : getRaceFormat(event.target.value).id,
                        )
                      }
                    >
                      <option value="all">Все форматы</option>
                      {RACE_FORMATS.map((format) => (
                        <option key={format.id} value={format.id}>
                          {format.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {records.length ? (
                    <div className="panel records">
                      <table>
                        <thead>
                          <tr>
                            <th>Трасса</th>
                            <th>Формат</th>
                            <th>Результат</th>
                            <th>Заезд</th>
                            <th>Дата</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleRecords.map((r, i) => (
                            <tr key={i}>
                              <td>
                                {tracks.find((t) => t.id === r.trackId)?.name || r.trackId}
                                {r.carVariant !== undefined && (
                                  <small>{getCarDesign(r.carVariant).name}</small>
                                )}
                              </td>
                              <td>{getRaceFormat(r.formatId).name}</td>
                              <td>
                                <b>{recordOutcome(r)}</b>
                                {r.formatId === 'time-attack' && r.bestLap && (
                                  <small>Лучший круг</small>
                                )}
                                {r.formatId === 'endurance' && r.distance !== undefined && (
                                  <small>
                                    {(r.distance / 1000).toLocaleString('ru-RU', {
                                      maximumFractionDigits: 2,
                                    })}{' '}
                                    км · Круги: {r.completedLaps || 0}
                                  </small>
                                )}
                              </td>
                              <td>{recordTime(r.time)}</td>
                              <td>{new Date(r.date).toLocaleDateString('ru-RU')}</td>
                            </tr>
                          ))}
                          {!visibleRecords.length && (
                            <tr>
                              <td colSpan={5}>В этом формате пока нет заездов.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty panel">
                      <Trophy size={48} />
                      <h2>Первая история ещё впереди.</h2>
                      <p>Заверши заезд — здесь появится твой результат.</p>
                      <button className="primary" onClick={() => navigate('play')}>
                        Поехали
                        <ArrowRight />
                      </button>
                    </div>
                  )}
                </>
              )}
            </main>
            <footer className="game-footer">
              <span>FApix Racing</span>
              <span>Маленькие карты. Очень личные победы.</span>
              <button onClick={() => setHelp(true)}>Управление и помощь</button>
            </footer>
          </div>
        </div>
      )}
      {auth !== null && (
        <Auth
          initialRegister={authRegister}
          initialLogin={auth}
          onClose={closeAuth}
          onUser={(account) => {
            setUser(account);
            const resume = authContinuation.current;
            authContinuation.current = null;
            resume?.(account);
          }}
        />
      )}
      {wallet && (
        <Wallet
          user={user}
          mode={paymentMode}
          initialRub={wallet.rub}
          initialPaymentId={wallet.paymentId}
          productName={wallet.productName}
          onClose={closeWallet}
          onUser={setUser}
          onRegister={(login, onAuthenticated) => openAuth(true, login, onAuthenticated)}
          onComplete={(productName) => {
            closeWallet();
            navigate('shop');
            setPreview(products.find((p) => p.name === productName) || null);
          }}
        />
      )}
      {purchase && (
        <Modal title="Добавить в коллекцию?" onClose={() => setPurchase(null)}>
          <p className="eyebrow">{categoryNames[purchase.category]}</p>
          <h3>{purchase.name}</h3>
          <p>{purchase.description}</p>
          <div className="purchase-total">
            <span>К списанию</span>
            <b>
              {money(purchase.price)} Fapix
              <small>{money(purchase.price / 2)} ₽</small>
            </b>
          </div>
          <p className="muted">
            После покупки: {money((user?.balance || 0) - purchase.price)} Fapix (
            {money(((user?.balance || 0) - purchase.price) / 2)} ₽)
          </p>
          <button className="primary full" disabled={busy === purchase.id} onClick={buy}>
            {busy ? 'Покупаем…' : 'Подтвердить покупку'}
            <ArrowRight />
          </button>
        </Modal>
      )}
      {help && (
        <Modal title="Решай всё в повороте." onClose={() => setHelp(false)}>
          <p className="muted">Три круга, пять соперников и твоя идеальная траектория.</p>
          <div className="help-controls">
            <Keyboard />
            <dl>
              <dt>WASD / стрелки</dt>
              <dd>Газ, тормоз, повороты</dd>
              <dt>Пробел</dt>
              <dd>Дрифт</dd>
              <dt>Shift</dt>
              <dd>Ускорение</dd>
              <dt>E</dt>
              <dd>Использовать бонус</dd>
              <dt>Esc</dt>
              <dd>Пауза</dd>
            </dl>
          </div>
          <p>
            <Smartphone size={18} /> На телефоне используй экранные кнопки.
          </p>
          <p className="notice">
            Сейчас доступны тренировки с ботами. Сетевые гонки не подключены. Результаты тренировок
            сохраняются на этом устройстве.
          </p>
          {user && (
            <button
              className="secondary full"
              onClick={async () => {
                try {
                  await api('/auth/logout', {});
                  setUser(null);
                  setHelp(false);
                } catch (e) {
                  setToast((e as Error).message);
                }
              }}
            >
              <LogOut size={18} />
              Выйти из аккаунта {user.login}
            </button>
          )}
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button aria-label="Закрыть уведомление" onClick={() => setToast('')}>
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}
