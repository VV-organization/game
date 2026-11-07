/** These are geometry and motion families, not alternate colors of a smoke emitter. */
export const trailDesigns = [
  {
    name: 'Ignition',
    shape: 'embers',
    primary: '#ff6231',
    secondary: '#ffd983',
    description:
      'Раскалённые угольки вырываются двумя струями, подскакивают и рассыпаются на яркие искры.',
  },
  {
    name: 'Sunset',
    shape: 'ribbons',
    primary: '#ffb938',
    secondary: '#ff69bc',
    description:
      'Длинные золотые и розовые ленты плавно изгибаются за машиной и истончаются на концах.',
  },
  {
    name: 'Arctic',
    shape: 'ice-shards',
    primary: '#71c9ff',
    secondary: '#eaffff',
    description: 'Крупные треугольные осколки льда разлетаются веером и вращаются в воздухе.',
  },
  {
    name: 'Violet',
    shape: 'plasma-rings',
    primary: '#a17aff',
    secondary: '#f6a3ff',
    description: 'Фиолетовые плазменные кольца расширяются, наклоняются и растворяются в воздухе.',
  },
  {
    name: 'Mint',
    shape: 'spiral-sprigs',
    primary: '#22e8bd',
    secondary: '#c7ffed',
    description: 'Мятные трёхлучевые ростки закручиваются в две встречные спирали позади колёс.',
  },
  {
    name: 'Sakura',
    shape: 'petals',
    primary: '#ff91b4',
    secondary: '#ffe4ec',
    description: 'Розовые лепестки мягко покачиваются, переворачиваются и осыпаются за машиной.',
  },
  {
    name: 'Pearl',
    shape: 'bubbles',
    primary: '#eee8ff',
    secondary: '#88fff6',
    description:
      'Перламутровые пузырьки поднимаются, раздуваются и исчезают с тонким светящимся ободком.',
  },
  {
    name: 'Obsidian',
    shape: 'wisps',
    primary: '#a58cff',
    secondary: '#e3d9ff',
    description: 'Полупрозрачные фиолетовые вихри тянутся двумя клубящимися дымными шлейфами.',
  },
  {
    name: 'Acid',
    shape: 'comic-bolts',
    primary: '#b7ff36',
    secondary: '#ffffb1',
    description:
      'Крупные кислотные молнии резко прыгают в стороны и вспыхивают короткими импульсами.',
  },
  {
    name: 'Nebula',
    shape: 'stars',
    primary: '#b989ff',
    secondary: '#70e8ff',
    description:
      'Пятиконечные звёзды с голубыми вспышками кружатся по расходящимся космическим орбитам.',
  },
  {
    name: 'Copper',
    shape: 'gears',
    primary: '#f69c65',
    secondary: '#ffe2aa',
    description:
      'Светящиеся медные шестерёнки вращаются в разные стороны и подпрыгивают над асфальтом.',
  },
  {
    name: 'Azure',
    shape: 'droplets',
    primary: '#388cff',
    secondary: '#8bf8ff',
    description:
      'Бирюзовые капли вылетают низкими дугами, вытягиваются в полёте и разбиваются о дорогу.',
  },
  {
    name: 'Crimson',
    shape: 'claw-slashes',
    primary: '#ff4963',
    secondary: '#ffb2a8',
    description:
      'Тройные алые следы когтей резко рассекают воздух и сжимаются в короткие всполохи.',
  },
  {
    name: 'Jade',
    shape: 'talismans',
    primary: '#31d58b',
    secondary: '#d8ff8c',
    description:
      'Полые нефритовые ромбы парят строем, поворачиваются ребром и вспыхивают золотистым светом.',
  },
  {
    name: 'Orchid',
    shape: 'butterflies',
    primary: '#e682ff',
    secondary: '#ffc4eb',
    description:
      'Световые бабочки взмахивают широкими крыльями и попарно расходятся по волнистым траекториям.',
  },
  {
    name: 'Steel',
    shape: 'pixels',
    primary: '#b5d6ed',
    secondary: '#8bc5ff',
    description:
      'Холодные световые кубики выстраиваются ступенчатым цифровым следом и исчезают дискретно.',
  },
  {
    name: 'Sand',
    shape: 'pinwheels',
    primary: '#f3cc83',
    secondary: '#fff0bd',
    description: 'Песочные трёхлопастные вихри вращаются у земли, расширяются и мягко затихают.',
  },
  {
    name: 'Sage',
    shape: 'leaves',
    primary: '#b1df96',
    secondary: '#ecffc1',
    description: 'Парные шалфейные листья летят широкими плавными дугами и покачиваются на ветру.',
  },
  {
    name: 'Titanium',
    shape: 'pulse-frames',
    primary: '#e0edff',
    secondary: '#87dfff',
    description:
      'Серебристые квадратные импульсы раскрываются в широкие рамки и распадаются световыми волнами.',
  },
  {
    name: 'Midnight',
    shape: 'crescents',
    primary: '#6f91ff',
    secondary: '#d1eaff',
    description: 'Ледяные полумесяцы медленно переворачиваются в синем звёздном потоке и тают.',
  },
].map((design, index) => ({ variant: index + 1, ...design }));
