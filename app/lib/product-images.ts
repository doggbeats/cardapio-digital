const IMAGES = {
  burger:
    "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=85",
  doubleBurger:
    "https://images.pexels.com/photos/1633527/pexels-photo-1633527.jpeg?auto=compress&cs=tinysrgb&w=800",
  baconBurger:
    "https://images.pexels.com/photos/1639557/pexels-photo-1639557.jpeg?auto=compress&cs=tinysrgb&w=800",
  bbqBurger:
    "https://images.pexels.com/photos/70497/pexels-photo-70497.jpeg?auto=compress&cs=tinysrgb&w=800",
  crispyChicken:
    "https://images.pexels.com/photos/1199957/pexels-photo-1199957.jpeg?auto=compress&cs=tinysrgb&w=800",
  veggieBurger:
    "https://images.pexels.com/photos/1547637/pexels-photo-1547637.jpeg?auto=compress&cs=tinysrgb&w=800",
  hotDog:
    "https://images.unsplash.com/photo-1612392062631-94dd858cba88?auto=format&fit=crop&w=800&q=85",
  hotDogCheddar:
    "https://images.pexels.com/photos/4676409/pexels-photo-4676409.jpeg?auto=compress&cs=tinysrgb&w=800",
  combo:
    "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=85",
  fries:
    "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=800&q=85",
  onionRings:
    "https://images.pexels.com/photos/374870/pexels-photo-374870.jpeg?auto=compress&cs=tinysrgb&w=800",
  chicken:
    "https://images.pexels.com/photos/1337825/pexels-photo-1337825.jpeg?auto=compress&cs=tinysrgb&w=800",
  milkshake:
    "https://images.pexels.com/photos/103566/pexels-photo-103566.jpeg?auto=compress&cs=tinysrgb&w=800",
  lemonade:
    "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=85",
  berrySoda:
    "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=800&q=85",
  fallback:
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=85",
};

type ImageRule = {
  keywords: string[];
  image: string;
};

// A ordem importa: regras mais específicas vêm primeiro.
const IMAGE_RULES: ImageRule[] = [
  { keywords: ["limonada", "limao", "lemonade"], image: IMAGES.lemonade },
  {
    keywords: ["soda", "frutas vermelhas", "refrigerante", "berry", "cereja", "framboesa"],
    image: IMAGES.berrySoda,
  },
  { keywords: ["milk shake", "milkshake", "shake", "sorvete", "acai", "açaí"], image: IMAGES.milkshake },
  { keywords: ["hot dog", "hotdog", "salsicha"], image: IMAGES.hotDog },
  { keywords: ["batata", "fritas", "rustica"], image: IMAGES.fries },
  { keywords: ["cebola", "onion"], image: IMAGES.onionRings },
  { keywords: ["frango", "chicken"], image: IMAGES.chicken },
  { keywords: ["combo"], image: IMAGES.combo },
  { keywords: ["veggie", "vegetal", "vegano", "vegetariano"], image: IMAGES.veggieBurger },
  { keywords: ["bbq", "barbecue", "defumad"], image: IMAGES.bbqBurger },
  { keywords: ["bacon"], image: IMAGES.baconBurger },
  { keywords: ["cheddar", "duplo", "hamburguer", "burger", "smash"], image: IMAGES.doubleBurger },
  { keywords: ["suco", "juice", "bebida", "drink", "agua", "coca", "refresco"], image: IMAGES.berrySoda },
  { keywords: ["doce", "bolo", "dessert", "sobremesa"], image: IMAGES.milkshake },
];

function normalize(value: string) {
  return value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Escolhe uma foto coerente com o nome/descrição quando o produto não tem imagem enviada. */
export function imageForProduct(name: string, description = "") {
  const text = normalize(`${name} ${description}`);
  const rule = IMAGE_RULES.find((candidate) =>
    candidate.keywords.some((keyword) => text.includes(normalize(keyword))),
  );
  return rule?.image ?? IMAGES.fallback;
}
