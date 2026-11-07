import { useMemo, useState, type CSSProperties } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CarFront,
  Check,
  CircleDot,
  Coins,
  Flag,
  Gauge,
  Gem,
  HardHat,
  Home,
  Keyboard,
  Layers3,
  Palette,
  Paintbrush,
  Radio,
  Shield,
  Shirt,
  Sparkles,
  SquareUserRound,
  Sun,
  Smartphone,
  Trophy,
  Waves,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { Product } from '../lib/api';
import { customizationFor } from '../lib/customization';
import ProductThumbnail from '../game/ProductThumbnail';
import './Landing.css';

interface LandingProps {
  onPlay: (trackId?: string) => void;
  onGarage: () => void;
  onLogin: () => void;
  signedIn: boolean;
  onTopup: (rub: number, productName?: string) => void;
  topupEnabled: boolean;
  products: Product[];
  popularIds?: string[];
  catalogError?: string;
  onRetry?: () => void;
}

type Language = 'ru' | 'en';
const assets = '/assets/reference/';
const featuredPrices = [622, 1168, 2078, 4154, 5806, 10410];

const categories: Record<
  string,
  { ru: string; en: string; icon: LucideIcon; description: string }
> = {
  car: {
    ru: 'Карт',
    en: 'Racing kart',
    icon: CarFront,
    description: 'Find a new favourite for your next race.',
  },
  color: {
    ru: 'Цвет кузова',
    en: 'Kart paint',
    icon: Paintbrush,
    description: 'A fresh colour for your personal racing kart.',
  },
  body: {
    ru: 'Обвес',
    en: 'Body kit',
    icon: Layers3,
    description: 'Give your kart a distinctive new silhouette.',
  },
  wheels: {
    ru: 'Диски',
    en: 'Wheel set',
    icon: CircleDot,
    description: 'The finishing touch for your racing setup.',
  },
  garage: {
    ru: 'Гараж',
    en: 'Garage',
    icon: Home,
    description: 'A new home for your growing collection.',
  },
  decor: {
    ru: 'Декор',
    en: 'Garage decor',
    icon: Trophy,
    description: 'Make your garage feel like your own.',
  },
  helmet: {
    ru: 'Шлем',
    en: 'Racing helmet',
    icon: HardHat,
    description: 'A new signature look for your driver.',
  },
  suit: {
    ru: 'Комбинезон',
    en: 'Racing suit',
    icon: Shirt,
    description: 'Bring your own style to the starting grid.',
  },
  plate: {
    ru: 'Номер',
    en: 'Racing number',
    icon: SquareUserRound,
    description: 'Add a personal detail to your racing kart.',
  },
  decal: {
    ru: 'Ливрея',
    en: 'Kart livery',
    icon: Palette,
    description: 'Stand out on every corner of the circuit.',
  },
  underglow: {
    ru: 'Подсветка',
    en: 'Underglow',
    icon: Sun,
    description: 'Add a colourful glow beneath your kart.',
  },
  trail: {
    ru: 'След',
    en: 'Racing trail',
    icon: Waves,
    description: 'Leave a little colour in your wake.',
  },
  profile: {
    ru: 'Профиль',
    en: 'Driver profile',
    icon: SquareUserRound,
    description: 'A personal touch for your driver profile.',
  },
  bundle: {
    ru: 'Комплект',
    en: 'Style collection',
    icon: Gem,
    description: 'A coordinated collection for your next race.',
  },
  windowTint: {
    ru: 'Визор',
    en: 'Visor tint',
    icon: Shield,
    description: 'A fresh finish for your driver’s visor.',
  },
};

const tracks = [
  {
    id: 'skyway',
    ru: 'Небесная трасса',
    en: 'Sky Circuit',
    tagRu: 'Выше облаков',
    tagEn: 'Above the clouds',
    ruCopy: 'Скоростные прямые и плавные дуги среди облаков.',
    enCopy: 'Fast straights and sweeping turns among the clouds.',
  },
  {
    id: 'coast',
    ru: 'Лазурный берег',
    en: 'Azure Coast',
    tagRu: 'Твоя первая гонка',
    tagEn: 'Your first race',
    ruCopy: 'Морской бриз, широкие повороты и твой первый идеальный дрифт.',
    enCopy: 'Ocean air. Open corners. Your first perfect drift.',
  },
  {
    id: 'city',
    ru: 'Неоновый квартал',
    en: 'Neon District',
    tagRu: 'Огни большого города',
    tagEn: 'City after dark',
    ruCopy: 'Поймай свой ритм среди огней ночного города.',
    enCopy: 'Find your rhythm under the city lights.',
  },
  {
    id: 'canyon',
    ru: 'Красный каньон',
    en: 'Red Canyon',
    tagRu: 'Пыль и адреналин',
    tagEn: 'Dust and adrenaline',
    ruCopy: 'Красные скалы и быстрые повороты. На пейзажи времени нет.',
    enCopy: 'Red rocks, fast turns, absolutely no sightseeing.',
  },
];

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`landing-brand${compact ? ' landing-brand-small' : ''}`}
      aria-label="FApix Racing"
    >
      <img src={`${assets}logo-mark.svg`} alt="" width="43" height="43" />
      <span>
        <strong>FApix</strong>
        <small>RACING</small>
      </span>
    </span>
  );
}

function initialLanguage(): Language {
  try {
    return localStorage.getItem('fapix-landing-language') === 'en' ? 'en' : 'ru';
  } catch {
    return 'ru';
  }
}

export function Landing({
  onPlay,
  onGarage,
  onLogin,
  signedIn,
  onTopup,
  topupEnabled,
  products,
  popularIds,
  catalogError,
  onRetry,
}: LandingProps) {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const t = (en: string, ru: string) => (language === 'ru' ? ru : en);
  const number = (value: number) =>
    new Intl.NumberFormat(language === 'ru' ? 'ru-RU' : 'en-GB').format(value);
  const featured = useMemo(
    () =>
      featuredPrices
        .map(
          (price, index) =>
            products.find((product) => product.id === popularIds?.[index]) ??
            products.find((product) => product.price === price),
        )
        .filter((product): product is Product => Boolean(product)),
    [products, popularIds],
  );

  const changeLanguage = (next: Language) => {
    setLanguage(next);
    try {
      localStorage.setItem('fapix-landing-language', next);
    } catch {
      /* Language still works when storage is unavailable. */
    }
  };

  const productName = (product: Product) =>
    language === 'ru'
      ? product.name
      : `${(categories[product.category] ?? categories.bundle).en} · ${String(product.variant).padStart(2, '0')}`;

  return (
    <div className="landing" lang={language}>
      <a className="landing-skip" href="#racing-home">
        {t('Skip to content', 'Перейти к содержимому')}
      </a>
      <header className="landing-header">
        <a
          className="landing-home"
          href="#racing-home"
          aria-label={t('FApix Racing home', 'Главная FApix Racing')}
        >
          <Brand />
        </a>
        <nav aria-label={t('Main navigation', 'Основная навигация')}>
          <a href="#tracks">{t('The tracks', 'Трассы')}</a>
          <a href="#power-ups">{t('Power-ups', 'Бонусы')}</a>
          <a href="#how-to-play">{t('How to play', 'Как играть')}</a>
        </nav>
        <div className="landing-header-actions">
          <div
            className="landing-language"
            role="group"
            aria-label={t('Interface language', 'Язык интерфейса')}
          >
            <button
              className={language === 'en' ? 'active' : ''}
              aria-pressed={language === 'en'}
              onClick={() => changeLanguage('en')}
            >
              EN
            </button>
            <button
              className={language === 'ru' ? 'active' : ''}
              aria-pressed={language === 'ru'}
              onClick={() => changeLanguage('ru')}
            >
              RU
            </button>
          </div>
          <button className="landing-login" onClick={onLogin}>
            {signedIn ? t('My paddock', 'Мой паддок') : t('Log in', 'Войти')}
            <ArrowUpRight size={16} />
          </button>
        </div>
      </header>

      <main className="landing-main" id="racing-home">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <h1 id="landing-title">
              {t('Tiny karts.', 'Маленький карт.')}
              <br />
              {t('Big rivalries.', 'Большая гонка.')}
            </h1>
            <p>
              {t(
                'Pick your line. Grab a power-up. Turn your group chat into a starting grid.',
                'Лови траекторию. Подбирай бонусы. Преврати дружеский чат в стартовую решётку.',
              )}
            </p>
            <div className="landing-hero-actions">
              <button className="landing-button landing-button-orange" onClick={() => onPlay()}>
                {signedIn
                  ? t('Back to racing', 'Вернуться в гонку')
                  : t('Play free', 'Играть бесплатно')}
                <ArrowRight size={21} />
              </button>
            </div>
          </div>
          <figure className="landing-hero-art">
            <img
              src={`${assets}fapix-hero.png`}
              alt={t(
                'Orange racing kart drifting along a tropical island circuit',
                'Оранжевый карт на гоночной трассе тропического острова',
              )}
              fetchPriority="high"
              width="1536"
              height="1024"
            />
            <figcaption>{t('World of FApix · Key art', 'Мир FApix · Иллюстрация')}</figcaption>
          </figure>
        </section>

        <section
          className="landing-section landing-shop"
          id="popular"
          aria-labelledby="popular-title"
        >
          <div className="landing-section-heading">
            <div>
              <span className="landing-eyebrow">
                <Sparkles size={14} />
                {t('A little more you', 'Добавь немного себя')}
              </span>
              <h2 id="popular-title">
                {t('Your next', 'Твоя следующая')}
                <br />
                {t('favourite.', 'любимая вещь.')}
              </h2>
            </div>
            <div className="landing-shop-intro">
              <p>
                {t(
                  'Six picks for your garage. Top up your Fapix balance, then choose your upgrade in the game.',
                  'Шесть находок для твоего гаража. Пополни баланс Fapix и забери понравившуюся вещь в игре.',
                )}
              </p>
              <span className="landing-exchange">
                <Coins size={15} />1 ₽ = 2 Fapix
              </span>
            </div>
          </div>
          {featured.length > 0 ? (
            <div className="landing-products">
              {featured.map((product, index) => {
                const category = categories[product.category] ?? categories.bundle;
                const Icon = category.icon;
                const rub = product.price / 2;
                return (
                  <article
                    className="landing-product"
                    key={product.id}
                    style={{ '--product-color': product.color || '#ff7547' } as CSSProperties}
                  >
                    <div className="landing-product-art">
                      <Icon
                        className="landing-product-icon"
                        size={94}
                        strokeWidth={1.35}
                        aria-hidden="true"
                      />
                      <ProductThumbnail
                        product={{ ...product, name: productName(product) }}
                        customization={
                          product.category === 'bundle'
                            ? customizationFor(undefined, products, product)
                            : undefined
                        }
                      />
                      <span className="landing-product-category">
                        {t(category.en, category.ru)}
                      </span>
                      <span className="landing-product-edition" aria-hidden="true">
                        FA<span>0{index + 1}</span>
                      </span>
                    </div>
                    <div className="landing-product-content">
                      <h3>{productName(product)}</h3>
                      <p>{language === 'ru' ? product.description : category.description}</p>
                      <div className="landing-product-price">
                        <strong>
                          <Coins size={19} />
                          {number(product.price)} <span>Fapix</span>
                        </strong>
                        <span>{number(rub)} ₽</span>
                      </div>
                      <button
                        className="landing-button landing-button-orange"
                        disabled={!topupEnabled}
                        title={
                          !topupEnabled
                            ? t(
                                'Top-ups are temporarily unavailable',
                                'Пополнение временно недоступно',
                              )
                            : undefined
                        }
                        onClick={() => onTopup(rub, product.name)}
                      >
                        {t(`Top up ${number(rub)} ₽`, `Пополнить на ${number(rub)} ₽`)}
                        <ArrowRight size={18} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="landing-collection-loading" role={catalogError ? 'alert' : 'status'}>
              <Palette size={28} />
              {catalogError ? (
                <>
                  <h3>{t('The collection is taking a pit stop.', 'Коллекция на пит-стопе.')}</h3>
                  <p>
                    {language === 'ru'
                      ? catalogError
                      : 'Could not load the collection. Please try again.'}
                  </p>
                  {onRetry && (
                    <button className="landing-button landing-button-ink" onClick={onRetry}>
                      {t('Try again', 'Попробовать ещё раз')}
                      <ArrowRight size={17} />
                    </button>
                  )}
                </>
              ) : (
                <p>{t('Getting the collection ready…', 'Загружаем коллекцию…')}</p>
              )}
            </div>
          )}
          <p className="landing-shop-note">
            <Check size={15} />
            {topupEnabled
              ? t(
                  'Top-ups add Fapix to your balance. You choose and buy the item in your garage.',
                  'Пополнение зачисляет Fapix на баланс. Саму вещь ты выбираешь и покупаешь в гараже.',
                )
              : t('Top-ups are temporarily unavailable.', 'Пополнение временно недоступно.')}
          </p>
        </section>

        <section
          className="landing-section landing-tracks-section"
          id="tracks"
          aria-labelledby="tracks-title"
        >
          <div className="landing-section-heading">
            <h2 id="tracks-title">
              {t('Find your', 'Найди свой')}
              <br />
              {t('happy place.', 'любимый поворот.')}
            </h2>
            <p>
              {t(
                'Coast, city, canyon and a circuit among the clouds. Four worlds. Your racing line.',
                'Побережье, город, каньон и трасса среди облаков. Четыре мира. Твоя траектория.',
              )}
            </p>
          </div>
          <div className="landing-tracks">
            {tracks.map((track) => (
              <article className="landing-track" key={track.id}>
                <div className="landing-track-art">
                  <img
                    src={`${assets}track-${track.id}.svg`}
                    alt={t(`${track.en} circuit illustration`, `Иллюстрация трассы «${track.ru}»`)}
                    loading="lazy"
                    width="400"
                    height="210"
                  />
                </div>
                <div className="landing-track-copy">
                  <span>{t(track.tagEn, track.tagRu)}</span>
                  <h3>{t(track.en, track.ru)}</h3>
                  <p>{t(track.enCopy, track.ruCopy)}</p>
                  <button
                    onClick={() =>
                      onPlay(
                        (
                          {
                            skyway: 'sky',
                            coast: 'coast',
                            city: 'neon',
                            canyon: 'canyon',
                          } as Record<string, string>
                        )[track.id],
                      )
                    }
                    aria-label={t(`Explore ${track.en}`, `Посмотреть трассу «${track.ru}»`)}
                  >
                    <ArrowUpRight size={22} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-powerups" id="power-ups" aria-labelledby="powerups-title">
          <div className="landing-powerups-intro">
            <h2 id="powerups-title">
              {t('A little chaos.', 'Немного хаоса.')}
              <br />
              {t('A lot of fun.', 'Много веселья.')}
            </h2>
            <p>
              {t(
                'Pick up a surprise on the track. Keep it for the perfect moment. Then press E — or tap your item.',
                'Подбери бонус на трассе. Прибереги его для нужного момента. И нажми E — или кнопку бонуса на экране.',
              )}
            </p>
          </div>
          <div className="landing-powerup-grid">
            <article className="landing-powerup landing-powerup-turbo">
              <div className="landing-powerup-icon">
                <Zap size={61} strokeWidth={2.2} />
              </div>
              <h3>{t('Turbo', 'Турбо')}</h3>
              <p>
                {t(
                  'A burst of speed. A very satisfying overtake.',
                  'Рывок вперёд. И очень приятный обгон.',
                )}
              </p>
            </article>
            <article className="landing-powerup landing-powerup-shield">
              <div className="landing-powerup-icon">
                <Shield size={61} strokeWidth={2.2} />
              </div>
              <h3>{t('Shield', 'Щит')}</h3>
              <p>
                {t(
                  'A little protection when the race gets crowded.',
                  'Немного защиты, когда на трассе становится тесно.',
                )}
              </p>
            </article>
            <article className="landing-powerup landing-powerup-pulse">
              <div className="landing-powerup-icon">
                <Radio size={61} strokeWidth={2.2} />
              </div>
              <h3>{t('Pulse', 'Импульс')}</h3>
              <p>
                {t(
                  'Catch your rivals off guard. Make your move.',
                  'Застань соперников врасплох. И лови свой момент.',
                )}
              </p>
            </article>
          </div>
        </section>

        <section
          className="landing-section landing-how"
          id="how-to-play"
          aria-labelledby="how-title"
        >
          <div className="landing-section-heading">
            <h2 id="how-title">
              {t('Less waiting.', 'Меньше ожидания.')}
              <br />
              {t('More racing.', 'Больше гонки.')}
            </h2>
            <p>
              {t(
                'No downloads. No long instructions. Your first race is just a few clicks away.',
                'Без загрузок и длинных инструкций. До твоей первой гонки — всего несколько кликов.',
              )}
            </p>
          </div>
          <ol className="landing-steps">
            <li>
              <span>1</span>
              <h3>{t('Meet your kart.', 'Знакомься со своим картом.')}</h3>
              <p>
                {t(
                  'Jump into a practice race. Create an account whenever you are ready to build your collection.',
                  'Начни с тренировочной гонки. Создай аккаунт, когда захочешь собрать свою коллекцию.',
                )}
              </p>
            </li>
            <li>
              <span>2</span>
              <h3>{t('Pick your playground.', 'Выбирай свой мир.')}</h3>
              <p>
                {t(
                  'Find a circuit you love. Learn the corners, chase the perfect line and challenge the AI drivers.',
                  'Найди любимую трассу. Изучай повороты, лови идеальную траекторию и обгоняй соперников-ботов.',
                )}
              </p>
            </li>
            <li>
              <span>3</span>
              <h3>{t('Make it your race.', 'Сделай эту гонку своей.')}</h3>
              <p>
                {t(
                  'Three laps. Power-ups. A new personal best to beat. Cross the line and come back for more.',
                  'Три круга. Бонусы. И новый личный рекорд. Пересекай финишную черту и возвращайся за реваншем.',
                )}
              </p>
            </li>
          </ol>
          <div className="landing-controls">
            <div>
              <Keyboard size={28} />
              <p>
                <strong>{t('On your keyboard', 'На клавиатуре')}</strong>
                <small>
                  {t(
                    'WASD / arrows — drive · Space — drift · E — item · Esc — pause',
                    'WASD / стрелки — управление · Пробел — дрифт · E — бонус · Esc — пауза',
                  )}
                </small>
              </p>
            </div>
            <div>
              <Smartphone size={28} />
              <p>
                <strong>{t('On your phone', 'На телефоне')}</strong>
                <small>
                  {t(
                    'Touch controls appear on your racing screen.',
                    'Кнопки управления появятся прямо на экране гонки.',
                  )}
                </small>
              </p>
            </div>
          </div>
        </section>

        <section className="landing-garage-banner" aria-labelledby="garage-banner-title">
          <div>
            <span className="landing-eyebrow">
              <Gauge size={15} />
              {t('Your personal paddock', 'Твой личный паддок')}
            </span>
            <h2 id="garage-banner-title">
              {t('A kart with', 'Карт с твоим')}
              <br />
              {t('your personality.', 'характером.')}
            </h2>
          </div>
          <div>
            <p>
              {t(
                'Paint, wheels, helmets and more. Collect your favourites and bring your look to the starting grid.',
                'Цвета, диски, шлемы и не только. Собирай любимые вещи и выезжай на старт в своём стиле.',
              )}
            </p>
            <button className="landing-button landing-button-ink" onClick={onGarage}>
              {t('Explore the garage', 'Заглянуть в гараж')}
              <ArrowRight size={20} />
            </button>
          </div>
        </section>
      </main>

      <section className="landing-final" aria-labelledby="final-title">
        <Flag size={35} />
        <h2 id="final-title">{t('See you on the grid.', 'Увидимся на старте.')}</h2>
        <button className="landing-button landing-button-orange" onClick={() => onPlay()}>
          {t('Let’s race', 'Поехали')}
          <ArrowRight size={21} />
        </button>
        <button className="landing-account-link" onClick={onLogin}>
          {signedIn
            ? t('My paddock', 'Мой паддок')
            : t('Already have an account? Log in', 'Уже есть аккаунт? Войти')}
        </button>
      </section>
      <footer className="landing-footer">
        <a href="#racing-home" aria-label={t('Back to top', 'Наверх')}>
          <Brand compact />
        </a>
        <p>
          © {new Date().getFullYear()} FApix Racing.{' '}
          {t('Made for the next lap.', 'Создано ради следующего круга.')}
        </p>
        <div
          className="landing-payment-marks"
          aria-label={t(
            'Payment methods: MIR, Faster Payments System',
            'Способы оплаты: МИР и СБП',
          )}
        >
          <img
            className="landing-mir"
            src="/assets/payments/mir.svg"
            alt="МИР"
            width={62}
            height={24}
          />
          <span className="landing-sbp">
            <img src="/assets/payments/sbp.svg" alt="" width={23} height={28} />
            СБП
          </span>
        </div>
        <a className="landing-footer-play" href="#popular">
          {t('Explore the collection', 'Выбрать свой стиль')}
          <ArrowDown size={15} />
        </a>
      </footer>
    </div>
  );
}

export default Landing;
