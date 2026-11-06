export type CarDesign = {
  variant: number;
  name: string;
  description: string;
  color: string;
};

export const carDesigns: readonly CarDesign[] = [
  {
    variant: 1,
    name: 'Apex GT-R',
    description:
      'Открытый гоночный карт: широкий низкий нос, трубчатые бамперы и отдельные боковые понтоны.',
    color: '#ff794b',
  },
  {
    variant: 2,
    name: 'Vortex S',
    description:
      'Формульный болид с длинным узким носом, открытой подвеской и двумя широкими антикрыльями.',
    color: '#23c8be',
  },
  {
    variant: 3,
    name: 'Falcon RS',
    description:
      'Высокий раллийный багги с каркасом безопасности, зубастыми шинами и круглыми прожекторами.',
    color: '#f6c83f',
  },
  {
    variant: 4,
    name: 'Spectre R',
    description:
      'Ретро-гонщик с вытянутым сигарообразным кузовом, овальной решёткой и открытыми колёсами.',
    color: '#588cc7',
  },
  {
    variant: 5,
    name: 'Stellar GT',
    description:
      'Открытый GT-родстер с округлыми крыльями, широкой кормой и утопленными круглыми фарами.',
    color: '#e74750',
  },
  {
    variant: 6,
    name: 'Tempest V8',
    description:
      'Мускулистый хот-род с широким капотом, открытым нагнетателем и боковыми выхлопными трубами.',
    color: '#34424b',
  },
  {
    variant: 7,
    name: 'Phantom X',
    description: 'Низкий клиновидный спорткар с гранёным носом и острыми световыми подписями.',
    color: '#8864dd',
  },
  {
    variant: 8,
    name: 'Zenith R',
    description:
      'Прототип выносливости с обтекателями колёс, центральным кокпитом и высоким спинным плавником.',
    color: '#f2f3e9',
  },
  {
    variant: 9,
    name: 'Nova Hyper',
    description:
      'Одноместный болид с раздвоенным носом, двумя передними лезвиями и открытой подвеской.',
    color: '#b7e842',
  },
  {
    variant: 10,
    name: 'Eclipse One',
    description:
      'Футуристический прототип с дугой над кокпитом, скульптурными крыльями и раздельным хвостом.',
    color: '#dbdfe8',
  },
];

export const originDesign: CarDesign = {
  variant: 0,
  name: 'Origin',
  description: 'Лёгкий учебный карт с открытой рамой и простым передним щитком.',
  color: '#f18b54',
};

export function getCarDesign(variant = 0): CarDesign {
  return carDesigns.find((design) => design.variant === variant) || originDesign;
}
