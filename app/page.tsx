"use client";

import Image from "next/image";
import { type RealtimeChannel, type User } from "@supabase/supabase-js";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  notifyNewOrderArrival,
  playNewOrderAlarm,
  requestNotificationPermission,
  unlockOrderAlarm,
} from "./lib/order-alarm";
import { DEFAULT_CATEGORIES, type AdminCategory } from "./lib/categories";
import { type OrderAddon, type OrderStatus, type SaleOrder } from "./lib/database.types";
import {
  formatOrderItem,
  formatPrice,
  getStoreWhatsAppUrl,
  STORE_WHATSAPP_NUMBER,
  type WhatsAppNotificationResult,
} from "./lib/order-summary";
import { imageForProduct } from "./lib/product-images";
import { getSupabaseClient } from "./lib/supabase";
import CookieConsent from "./components/CookieConsent";
import MetaPixel from "./components/MetaPixel";

type Category = string;
type Tab = "Início" | "Ofertas" | "Pedidos" | "Perfil" | "Admin";
type ProductCategory = string;
type AuthMode = "login" | "register";
type ProfileAction = "password" | "address" | null;
type AdminSection = "sales" | "products" | "categories" | "addons";

type AdminProduct = {
  id: number;
  name: string;
  price_cents: number;
  description: string;
  category: ProductCategory;
  image: string;
  old_price_cents: number | null;
  badge: string | null;
  available: boolean;
  highlighted: boolean;
};
type AdminAddon = OrderAddon & { available: boolean };
type CartLine = {
  productId: number;
  addonIds: number[];
  note: string;
  quantity: number;
};
type Cart = Record<string, CartLine>;

function makeCartKey(productId: number, addonIds: number[], note: string) {
  return `${productId}|${[...addonIds].sort((a, b) => a - b).join(",")}|${note.trim()}`;
}

function lineAddons(line: CartLine, addons: OrderAddon[]) {
  return addons.filter((addon) => line.addonIds.includes(addon.id));
}

function lineUnitPrice(line: CartLine, product: Product, addons: OrderAddon[]) {
  return (
    product.price + lineAddons(line, addons).reduce((total, addon) => total + addon.price_cents / 100, 0)
  );
}

const ADDON_CATEGORIES = ["Burgers", "Hot Dog"];

function productCartQuantity(cart: Cart, productId: number) {
  return Object.values(cart)
    .filter((line) => line.productId === productId)
    .reduce((total, line) => total + line.quantity, 0);
}

type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
  oldPrice?: number;
  category: ProductCategory;
  image: string;
  badge?: string;
  highlighted?: boolean;
};

const seedProducts: Product[] = [
  {
    id: 1,
    name: "Clássico da Casa",
    description: "Smash 160g, queijo prato, cebola caramelizada e molho da casa.",
    price: 32.9,
    category: "Burgers",
    image:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=85",
    badge: "Mais pedido",
    highlighted: true,
  },
  {
    id: 2,
    name: "Duplo Cheddar",
    description: "Dois smash burgers, cheddar cremoso e picles artesanal.",
    price: 36.9,
    oldPrice: 42.9,
    category: "Burgers",
    image:
      "https://images.pexels.com/photos/1633527/pexels-photo-1633527.jpeg?auto=compress&cs=tinysrgb&w=800",
    badge: "Oferta",
    highlighted: true,
  },
  {
    id: 5,
    name: "Hot Dog Especial",
    description: "Salsicha artesanal, molho da casa, queijo e batata palha.",
    price: 24.9,
    category: "Hot Dog",
    image:
      "https://images.unsplash.com/photo-1612392062631-94dd858cba88?auto=format&fit=crop&w=800&q=85",
    badge: "Da casa",
  },
  {
    id: 6,
    name: "Combo Brasa",
    description: "Clássico da Casa, batata rústica e bebida gelada.",
    price: 49.9,
    category: "Combos",
    image:
      "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=85",
    badge: "Completo",
    highlighted: true,
  },
  {
    id: 3,
    name: "Batata rústica",
    description: "Crocante por fora, macia por dentro. Acompanha aioli.",
    price: 18.9,
    category: "Acompanhamentos",
    image:
      "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=800&q=85",
  },
  {
    id: 4,
    name: "Limonada da casa",
    description: "Limão-taiti, toque de siciliano e hortelã fresca.",
    price: 12.9,
    category: "Bebidas",
    image:
      "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=85",
  },
  {
    id: 7,
    name: "Bacon na Brasa",
    description: "Smash 160g, queijo, bacon crocante e maionese defumada.",
    price: 38.9,
    category: "Burgers",
    image:
      "https://images.pexels.com/photos/1639557/pexels-photo-1639557.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  {
    id: 8,
    name: "BBQ Crocante",
    description: "Burger artesanal, cheddar, cebola crispy e molho barbecue.",
    price: 39.9,
    category: "Burgers",
    image:
      "https://images.pexels.com/photos/70497/pexels-photo-70497.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  {
    id: 9,
    name: "Frango Crocante",
    description: "Frango empanado, queijo, alface e molho especial.",
    price: 34.9,
    category: "Burgers",
    image:
      "https://images.pexels.com/photos/1199957/pexels-photo-1199957.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  {
    id: 10,
    name: "Veggie da Horta",
    description: "Burger vegetal, queijo, rúcula e molho de ervas.",
    price: 33.9,
    category: "Burgers",
    image:
      "https://images.pexels.com/photos/1547637/pexels-photo-1547637.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  {
    id: 11,
    name: "Hot Dog Cheddar",
    description: "Salsicha artesanal, cheddar cremoso e cebola crispy.",
    price: 27.9,
    category: "Hot Dog",
    image:
      "https://images.pexels.com/photos/4676409/pexels-photo-4676409.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  {
    id: 12,
    name: "Combo Duplo",
    description: "Dois burgers clássicos, batata rústica e duas bebidas.",
    price: 79.9,
    category: "Combos",
    image:
      "https://images.pexels.com/photos/2338407/pexels-photo-2338407.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  {
    id: 13,
    name: "Anéis de Cebola",
    description: "Cebola empanada e crocante, acompanhada de molho da casa.",
    price: 17.9,
    category: "Acompanhamentos",
    image:
      "https://images.pexels.com/photos/374870/pexels-photo-374870.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  {
    id: 14,
    name: "Frango em Pedaços",
    description: "Tiras de frango empanadas com molho barbecue.",
    price: 22.9,
    category: "Acompanhamentos",
    image:
      "https://images.pexels.com/photos/1337825/pexels-photo-1337825.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  {
    id: 15,
    name: "Milk-shake de Chocolate",
    description: "Milk-shake cremoso de chocolate com cobertura.",
    price: 16.9,
    category: "Bebidas",
    image:
      "https://images.pexels.com/photos/103566/pexels-photo-103566.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  {
    id: 16,
    name: "Soda de Frutas Vermelhas",
    description: "Soda italiana refrescante com frutas vermelhas.",
    price: 14.9,
    category: "Bebidas",
    image:
      "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=800&q=85",
  },
];

function adminProductToProduct(item: AdminProduct): Product {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    price: item.price_cents / 100,
    oldPrice: item.old_price_cents ? item.old_price_cents / 100 : undefined,
    category: item.category,
    image: item.image,
    badge: item.badge ?? undefined,
    highlighted: item.highlighted,
  };
}

const emptyProductForm = {
  name: "",
  price: "",
  description: "",
  category: "Burgers" as ProductCategory,
  image: "",
  oldPrice: "",
  badge: "",
  available: true,
  highlighted: false,
};

async function getAdminToken() {
  const {
    data: { session },
  } = await getSupabaseClient().auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Sua sessão expirou. Entre novamente no painel.");
  return token;
}

function priceToCents(value: string) {
  return Math.round(Number(value.replace(",", ".")) * 100);
}

const activeProfile = { id: "marina", name: "Marina" };
const favoritesStorageEvent = "cardapio:favorites:change";
const orderStatuses: OrderStatus[] = [
  "pending",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "cancelled",
];
const orderStatusLabels: Record<OrderStatus, string> = {
  pending: "Pendente",
  preparing: "Em preparo",
  ready: "Pronto",
  out_for_delivery: "Saiu para entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

function isOrderStatus(value: string): value is OrderStatus {
  return orderStatuses.some((status) => status === value);
}

const navigation: { name: Tab; icon: string }[] = [
  { name: "Início", icon: "home" },
  { name: "Ofertas", icon: "tag" },
  { name: "Pedidos", icon: "receipt" },
  { name: "Perfil", icon: "user" },
];

function Icon({
  name,
  size = 20,
  filled = false,
}: {
  name: string;
  size?: number;
  filled?: boolean;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
        </svg>
      );
    case "tag":
      return (
        <svg {...common}>
          <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
          <circle cx="7.5" cy="7.5" r="1" />
        </svg>
      );
    case "receipt":
      return (
        <svg {...common}>
          <path d="M5 3 7 4.5 9 3l2 1.5L13 3l2 1.5L17 3l2 1.5V21l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L7 21l-2-1.5z" />
          <path d="M9 9h6M9 13h6M9 17h3" />
        </svg>
      );
    case "user":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M5 21a7 7 0 0 1 14 0" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
      );
    case "bag":
      return (
        <svg {...common}>
          <path d="M5 8h14l1 13H4L5 8Z" />
          <path d="M9 9V6a3 3 0 0 1 6 0v3" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "minus":
      return (
        <svg {...common}>
          <path d="M5 12h14" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...common}>
          <path d="M5 12h14m-7-7 7 7-7 7" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "pin":
      return (
        <svg {...common}>
          <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="m5 12 4 4L19 6" />
        </svg>
      );
    case "heart":
      return (
        <svg {...common}>
          <path
            d="M20.8 8.6c0 4.1-8.8 10.1-8.8 10.1S3.2 12.7 3.2 8.6A4.6 4.6 0 0 1 12 6.3a4.6 4.6 0 0 1 8.8 2.3Z"
            fill={filled ? "currentColor" : "none"}
          />
        </svg>
      );
    case "close":
      return (
        <svg {...common}>
          <path d="m18 6-12 12M6 6l12 12" />
        </svg>
      );
    case "admin":
      return (
        <svg {...common}>
          <path d="M12 3 5 6v6c0 4.4 3 8 7 9 4-1 7-4.6 7-9V6l-7-3Z" />
          <path d="m9.5 12 1.8 1.8 3.4-3.6" />
        </svg>
      );
    case "image":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="8.5" cy="9.5" r="1.5" />
          <path d="m4 17 4.5-4.5 3.5 3.5 2.5-2.5L20 19" />
        </svg>
      );
    case "eye":
      return (
        <svg {...common}>
          <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
          <circle cx="12" cy="12" r="2.8" />
        </svg>
      );
    case "eye-off":
      return (
        <svg {...common}>
          <path d="M4 4 20 20" />
          <path d="M9.6 6.1A10.6 10.6 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a17 17 0 0 1-3.2 3.8M6.4 7.9A17 17 0 0 0 2 12s3.6 6.5 10 6.5a10 10 0 0 0 3.6-.7" />
          <path d="M10 10a2.8 2.8 0 0 0 4 4" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path
            d={filled ? "M12 2 15 9l7 3-7 3-3 7-3-7-7-3 7-3z" : ""}
            fill={filled ? "currentColor" : "none"}
          />
        </svg>
      );
  }
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete,
  minLength,
  disabled,
  required = true,
}: {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  autoComplete?: string;
  minLength?: number;
  disabled?: boolean;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <input
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        minLength={minLength}
        required={required}
        disabled={disabled}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
      <button
        className="password-toggle"
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={visible}
        disabled={disabled}
      >
        <Icon name={visible ? "eye-off" : "eye"} size={18} />
      </button>
    </div>
  );
}

function getUserName(user: User) {
  const fullName = user.user_metadata.full_name;
  if (typeof fullName === "string" && fullName.trim()) return fullName.trim();
  return user.email?.split("@")[0] ?? "Cliente";
}

function getUserPhone(user: User) {
  const phone = user.user_metadata.phone;
  return typeof phone === "string" && phone.trim() ? phone.trim() : null;
}

function getUserAddress(user: User) {
  const address = user.user_metadata.address;
  return typeof address === "string" && address.trim() ? address.trim() : "";
}

function getOrderWhatsAppUrl(order: SaleOrder) {
  const phoneDigits = order.customer_phone?.replace(/\D/g, "");
  if (!phoneDigits) return null;
  const phone = phoneDigits.length <= 11 ? `55${phoneDigits}` : phoneDigits;
  const itemLines = order.items
    .map(
      (item) =>
        `${formatOrderItem(item)} - ${formatPrice((item.unit_price_cents * item.quantity) / 100)}`,
    )
    .join("\n");
  const message = [
    `Olá${order.customer_name ? `, ${order.customer_name}` : ""}!`,
    `Confirme seu pedido #${String(order.id).padStart(4, "0")}:`,
    itemLines,
    `Subtotal: ${formatPrice(order.subtotal_cents / 100)}`,
    `Entrega: ${formatPrice(order.delivery_fee_cents / 100)}`,
    `Total: ${formatPrice(order.total_cents / 100)}`,
    `Endereço: ${order.customer_address}`,
    "Responda a esta mensagem para confirmar.",
  ].join("\n\n");
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function getDeliveryCep(address: string) {
  return address.match(/\d{5}-?\d{3}/)?.[0] ?? null;
}

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.getTime(), end: end.getTime() };
}

function subscribeToFavorites(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(favoritesStorageEvent, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(favoritesStorageEvent, onStoreChange);
  };
}

function useProfileFavorites(profileId: string) {
  const storageKey = `cardapio:favorites:${profileId}`;
  const getSnapshot = useCallback(
    () => window.localStorage.getItem(storageKey) ?? "",
    [storageKey],
  );
  const storedFavorites = useSyncExternalStore(
    subscribeToFavorites,
    getSnapshot,
    () => "",
  );

  return useMemo(
    () =>
      storedFavorites
        .split(",")
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0),
    [storedFavorites],
  );
}

function DeliveryLine({
  address,
  onChangeAddress,
}: {
  address: string;
  onChangeAddress: () => void;
}) {
  return (
    <div className="delivery-line">
      <span className="delivery-location">
        <Icon name="pin" size={16} />
        <span>Entregar em</span>
        <strong>{address}</strong>
      </span>
      <button type="button" className="change-address" onClick={onChangeAddress}>
        Alterar
      </button>
    </div>
  );
}

function PreparationTracker() {
  return (
    <div className="prep-tracker" role="status" aria-label="Pedido em preparo">
      <div className="prep-scene" aria-hidden="true">
        <span className="prep-steam steam-1" />
        <span className="prep-steam steam-2" />
        <span className="prep-steam steam-3" />
        <span className="prep-pan">
          <svg viewBox="0 0 64 44" width="62" height="42">
            <path
              d="M6 16h44v8a11 11 0 0 1-11 11H17A11 11 0 0 1 6 24v-8Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <path d="M50 19h9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <path
              d="M15 24c4-4 8 4 12 0s8 4 12 0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span className="prep-flame flame-1" />
        <span className="prep-flame flame-2" />
        <span className="prep-flame flame-3" />
      </div>
      <div className="prep-copy">
        <strong><span className="status-dot" /> Preparando seu pedido</strong>
        <span>A cozinha já está caprichando nos detalhes.</span>
      </div>
    </div>
  );
}

function DeliveryTracker({ address }: { address: string }) {
  const cep = getDeliveryCep(address);
  return (
    <div className="delivery-tracker" role="status" aria-label="Entregador a caminho">
      <div className="delivery-tracker-heading">
        <span className="delivery-tracker-live"><span className="status-dot" /> Entregador a caminho</span>
        {cep && <span>CEP {cep}</span>}
      </div>
      <div className="delivery-road" aria-hidden="true">
        <span className="delivery-road-line" />
        <span className="delivery-road-start"><Icon name="pin" size={14} /></span>
        <span className="delivery-bike">
          <svg viewBox="0 0 64 40" width="54" height="34" aria-hidden="true">
            <circle cx="15" cy="29" r="8" fill="none" stroke="currentColor" strokeWidth="3" />
            <circle cx="49" cy="29" r="8" fill="none" stroke="currentColor" strokeWidth="3" />
            <path
              d="M15 29h10l8-12h9l7 12M33 17l-4-7h-5M31 11l6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="38" cy="7" r="4" fill="currentColor" />
          </svg>
        </span>
        <span className="delivery-road-end"><Icon name="check" size={14} /></span>
      </div>
      <p className="delivery-tracker-address">
        <Icon name="pin" size={14} /> {address}
      </p>
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("Início");
  const [adminSection, setAdminSection] = useState<AdminSection>("sales");
  const [products, setProducts] = useState<Product[]>(seedProducts);
  const [adminProducts, setAdminProducts] = useState<AdminProduct[]>([]);
  const [adminProductSearch, setAdminProductSearch] = useState("");
  const [adminProductCategory, setAdminProductCategory] = useState("all");
  const [productsLoading, setProductsLoading] = useState(false);
  const [adminCategories, setAdminCategories] = useState<AdminCategory[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categoryMessage, setCategoryMessage] = useState<string | null>(null);
  const [categorySaving, setCategorySaving] = useState(false);
  const [addons, setAddons] = useState<OrderAddon[]>([]);
  const [adminAddons, setAdminAddons] = useState<AdminAddon[]>([]);
  const [newAddonName, setNewAddonName] = useState("");
  const [newAddonPrice, setNewAddonPrice] = useState("");
  const [addonError, setAddonError] = useState<string | null>(null);
  const [addonMessage, setAddonMessage] = useState<string | null>(null);
  const [addonSaving, setAddonSaving] = useState(false);
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [productSaving, setProductSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [productMessage, setProductMessage] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>("Todos");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Cart>({});
  const favorites = useProfileFavorites(activeProfile.id);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState("");
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [profileAction, setProfileAction] = useState<ProfileAction>(null);
  const [profileAddress, setProfileAddress] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productAddonIds, setProductAddonIds] = useState<number[]>([]);
  const [productNote, setProductNote] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [orderConfirmOpen, setOrderConfirmOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [orders, setOrders] = useState<number>(0);
  const [saleOrders, setSaleOrders] = useState<SaleOrder[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState<string | null>(null);
  const [salesSearch, setSalesSearch] = useState("");
  const [salesStatus, setSalesStatus] = useState<OrderStatus | "all">("all");
  const [salesRefresh, setSalesRefresh] = useState(0);
  const [todayRange, setTodayRange] = useState<{ start: number; end: number } | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [customerOrders, setCustomerOrders] = useState<SaleOrder[]>([]);
  const [storeWhatsAppUrl, setStoreWhatsAppUrl] = useState<string | null>(null);
  const [storeWhatsAppSent, setStoreWhatsAppSent] = useState(false);
  const [orderConfirmation, setOrderConfirmation] = useState<SaleOrder | null>(null);
  const [newOrderAlert, setNewOrderAlert] = useState<SaleOrder | null>(null);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [customerOrdersLoading, setCustomerOrdersLoading] = useState(false);
  const [customerOrdersError, setCustomerOrdersError] = useState<string | null>(null);
  const [ordersRefresh, setOrdersRefresh] = useState(0);
  const categories = useMemo(() => {
    const names = categoriesLoaded ? adminCategories.map((item) => item.name) : DEFAULT_CATEGORIES;
    return ["Todos", ...names, "Destaques", "Favoritos"];
  }, [adminCategories, categoriesLoaded]);
  const loadCategories = useCallback(async () => {
    try {
      const { data, error } = await getSupabaseClient()
        .from("product_categories")
        .select("id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      setAdminCategories(data ?? []);
    } catch (error) {
      console.error("Não foi possível carregar as categorias:", error);
    } finally {
      setCategoriesLoaded(true);
    }
  }, []);
  const loadAdminAddons = useCallback(async () => {
    try {
      const token = await getAdminToken();
      const response = await fetch("/api/admin/addons", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json().catch(() => null)) as
        | { addons?: AdminAddon[]; error?: string }
        | null;
      if (!response.ok) throw new Error(payload?.error ?? "Não foi possível carregar os adicionais.");
      setAdminAddons(payload?.addons ?? []);
    } catch (error) {
      console.error("Não foi possível carregar os adicionais:", error);
    }
  }, []);
  const favoritesStorageKey = `cardapio:favorites:${activeProfile.id}`;
  const isAdmin = authUser?.app_metadata.role === "admin";
  const activeTabRef = useRef(activeTab);
  const seenOrderIdsRef = useRef<Set<number>>(new Set());
  const ordersSeededRef = useRef(false);
  const whatsappRedirectRef = useRef<number | null>(null);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  // Abas abertas antes de um deploy podem continuar com o bundle antigo.
  // Compara a versão em execução com a do servidor e recarrega uma vez.
  useEffect(() => {
    const clientVersion = process.env.NEXT_PUBLIC_APP_VERSION || "dev";
    const reloadKey = "cardapio:version-reloaded";
    let reloadedVersion: string | null = null;
    try {
      reloadedVersion = sessionStorage.getItem(reloadKey);
    } catch {
      // Armazenamento pode estar indisponível; seguimos sem a verificação.
    }
    if (reloadedVersion === clientVersion) return;

    fetch("/api/version", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { version?: string }) => {
        if (data.version && data.version !== clientVersion) {
          try {
            sessionStorage.setItem(reloadKey, data.version);
          } catch {
            // Ignora falha de armazenamento.
          }
          window.location.reload();
        }
      })
      .catch(() => {});
  }, []);

  // O áudio só pode ser liberado após um gesto do usuário. Registramos o
  // desbloqueio no primeiro clique/toque/tecla para que o alarme toque depois.
  useEffect(() => {
    const unlock = () => {
      unlockOrderAlarm();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => {
      setNotificationPermission(
        typeof window === "undefined" || !("Notification" in window)
          ? "unsupported"
          : Notification.permission,
      );
    });
  }, []);

  const handleIncomingOrder = useCallback((order: SaleOrder) => {
    if (seenOrderIdsRef.current.has(order.id)) return;
    seenOrderIdsRef.current.add(order.id);

    setSaleOrders((current) =>
      current.some((item) => item.id === order.id) ? current : [order, ...current],
    );
    setNewOrderCount((count) => count + 1);
    setNewOrderAlert(order);
    if (activeTabRef.current === "Admin") {
      playNewOrderAlarm();
    }
    notifyNewOrderArrival(
      `Pedido #${String(order.id).padStart(4, "0")} de ${order.customer_name || order.customer_email} - ${formatPrice(order.total_cents / 100)}`,
      `novo-pedido-${order.id}`,
    );
  }, []);

  const deliveryAddress = authUser
    ? getUserAddress(authUser) || "Cadastre seu endereço"
    : "Faça login para informar o endereço";

  useEffect(() => {
    let isMounted = true;
    let unsubscribe = () => {};

    void Promise.resolve()
      .then(() => getSupabaseClient())
      .then((supabase) => {
        if (!isMounted) return null;
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
          if (isMounted) setAuthUser(session?.user ?? null);
        });
        unsubscribe = () => subscription.unsubscribe();
        return supabase.auth.getSession();
      })
      .then((result) => {
        if (!isMounted || !result) return;
        if (result.error) throw result.error;
        setAuthUser(result.data.session?.user ?? null);
        setAuthReady(true);
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        setAuthError(
          error instanceof Error ? error.message : "Não foi possível conectar à autenticação.",
        );
        setAuthReady(true);
      });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    void Promise.resolve()
      .then(() =>
        getSupabaseClient()
          .from("menu_catalog")
          .select("*")
          .order("id", { ascending: true }),
      )
      .then(({ data, error }) => {
        if (!isMounted || error || !data || data.length === 0) return;
        const items = data as AdminProduct[];
        setAdminProducts(items);
        setProducts(items.map(adminProductToProduct));
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadCategories);
  }, [loadCategories]);

  useEffect(() => {
    let isMounted = true;
    void getSupabaseClient()
      .from("product_addons")
      .select("id, name, price_cents")
      .eq("available", true)
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          console.error("Não foi possível carregar os adicionais:", error.message);
          return;
        }
        setAddons(data ?? []);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (activeTab !== "Admin" || !isAdmin) return;
    let isMounted = true;

    void Promise.resolve()
      .then(() =>
        getSupabaseClient()
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false }),
      )
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) throw error;
        setSaleOrders(data);
        if (!ordersSeededRef.current) {
          data.forEach((order) => seenOrderIdsRef.current.add(order.id));
          ordersSeededRef.current = true;
        }
        setSalesError(null);
        setSalesLoading(false);
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        setSalesError(
          error instanceof Error ? error.message : "Não foi possível carregar as vendas.",
        );
        setSalesLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeTab, isAdmin, salesRefresh]);

  useEffect(() => {
    if (activeTab !== "Pedidos" || !authUser) return;
    let isMounted = true;

    void Promise.resolve()
      .then(() =>
        getSupabaseClient()
          .from("orders")
          .select("*")
          .eq("user_id", authUser.id)
          .order("created_at", { ascending: false }),
      )
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) throw error;
        setCustomerOrders(data);
        setCustomerOrdersError(null);
        setCustomerOrdersLoading(false);
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        setCustomerOrdersError(
          error instanceof Error ? error.message : "Não foi possível carregar seus pedidos.",
        );
        setCustomerOrdersLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeTab, authUser, ordersRefresh]);

  useEffect(() => {
    if (!authUser) return;
    let isMounted = true;
    let cleanup = () => {};

    try {
      const supabase = getSupabaseClient();
      const channels: RealtimeChannel[] = [];

      if (isAdmin) {
        channels.push(
          supabase
            .channel("admin-new-orders")
            .on(
              "postgres_changes",
              { event: "INSERT", schema: "public", table: "orders" },
              (payload) => {
                if (!isMounted) return;
                handleIncomingOrder(payload.new as SaleOrder);
              },
            )
            .subscribe((status) => {
              if (isMounted) setRealtimeConnected(status === "SUBSCRIBED");
            }),
        );
      }

      channels.push(
        supabase
          .channel(`customer-orders-${authUser.id}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "orders",
              filter: `user_id=eq.${authUser.id}`,
            },
            (payload) => {
              if (!isMounted) return;
              const updated = payload.new as SaleOrder;
              setCustomerOrders((current) =>
                current.map((order) => (order.id === updated.id ? updated : order)),
              );
            },
          )
          .subscribe(),
      );

      cleanup = () => {
        channels.forEach((channel) => void supabase.removeChannel(channel));
      };
    } catch (error) {
      console.error("Não foi possível acompanhar os pedidos em tempo real:", error);
    }

    return () => {
      isMounted = false;
      cleanup();
      setRealtimeConnected(false);
    };
  }, [authUser, isAdmin, handleIncomingOrder]);

  // Fallback: se o Realtime não estiver ativo (a tabela orders não foi
  // adicionada à publicação supabase_realtime), consultamos novos pedidos
  // periodicamente enquanto o painel administrativo estiver aberto.
  useEffect(() => {
    if (!isAdmin || activeTab !== "Admin") return;
    let isMounted = true;

    const checkNewOrders = async () => {
      try {
        const { data, error } = await getSupabaseClient()
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50);
        if (!isMounted || error || !data) return;
        if (!ordersSeededRef.current) {
          data.forEach((order) => seenOrderIdsRef.current.add(order.id));
          ordersSeededRef.current = true;
          return;
        }
        data.forEach((order) => handleIncomingOrder(order as SaleOrder));
      } catch {
        // Silencioso: o Realtime pode estar ativo e o aviso já ter chegado.
      }
    };

    const timer = window.setInterval(() => void checkNewOrders(), 5000);
    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, [activeTab, isAdmin, handleIncomingOrder]);

  useEffect(() => {
    if (!newOrderAlert) return;
    const timer = window.setTimeout(() => setNewOrderAlert(null), 12000);
    return () => window.clearTimeout(timer);
  }, [newOrderAlert]);

  useEffect(() => {
    if (!orderConfirmation) return;
    const timer = window.setTimeout(() => setOrderConfirmation(null), 10000);
    return () => window.clearTimeout(timer);
  }, [orderConfirmation]);

  const isPromotions = activeTab === "Ofertas";
  const highlightedProducts = useMemo(
    () => products.filter((product) => product.highlighted),
    [products],
  );
  const visibleProducts = useMemo(
    () =>
      products.filter((product) => {
        const matchesCategory =
          activeCategory === "Todos" ||
          (activeCategory === "Favoritos"
            ? favorites.includes(product.id)
            : activeCategory === "Destaques"
              ? Boolean(product.highlighted)
              : product.category === activeCategory);
        const matchesSearch = `${product.name} ${product.description}`
          .toLocaleLowerCase("pt-BR")
          .includes(search.toLocaleLowerCase("pt-BR"));
        const matchesPromotion = !isPromotions || product.oldPrice;
        return matchesCategory && matchesSearch && matchesPromotion;
      }),
    [activeCategory, favorites, isPromotions, products, search],
  );
  const adminProductCategories = useMemo(() => {
    const catalogNames = categoriesLoaded
      ? adminCategories.map((item) => item.name)
      : DEFAULT_CATEGORIES;
    return [...new Set([...adminProducts.map((item) => item.category), ...catalogNames])].sort(
      (a, b) => a.localeCompare(b, "pt-BR"),
    );
  }, [adminCategories, adminProducts, categoriesLoaded]);
  const filteredAdminProducts = useMemo(() => {
    const query = adminProductSearch.trim().toLocaleLowerCase("pt-BR");
    return adminProducts.filter((item) => {
      const matchesCategory =
        adminProductCategory === "all" || item.category === adminProductCategory;
      const searchableText = `${item.name} ${item.description} ${item.category}`.toLocaleLowerCase(
        "pt-BR",
      );
      return matchesCategory && (!query || searchableText.includes(query));
    });
  }, [adminProducts, adminProductCategory, adminProductSearch]);
  const cartCount = Object.values(cart).reduce((total, line) => total + line.quantity, 0);
  const filteredSales = useMemo(() => {
    const query = salesSearch.trim().toLocaleLowerCase("pt-BR");
    return saleOrders.filter((order) => {
      const matchesStatus = salesStatus === "all" || order.status === salesStatus;
      const searchableText = [
        String(order.id),
        order.customer_name ?? "",
        order.customer_email,
        order.customer_phone ?? "",
        ...order.items.map((item) => item.name),
      ]
        .join(" ")
        .toLocaleLowerCase("pt-BR");
      return matchesStatus && (!query || searchableText.includes(query));
    });
  }, [saleOrders, salesSearch, salesStatus]);
  const salesMetrics = useMemo(() => {
    return saleOrders.reduce(
      (metrics, order) => {
        if (order.status !== "cancelled") {
          metrics.revenue += order.total_cents;
          const createdAt = Date.parse(order.created_at);
          if (todayRange && createdAt >= todayRange.start && createdAt < todayRange.end) {
            metrics.todayRevenue += order.total_cents;
          }
        }
        if (order.status !== "delivered" && order.status !== "cancelled") {
          metrics.inProgress += 1;
        }
        return metrics;
      },
      { revenue: 0, todayRevenue: 0, inProgress: 0 },
    );
  }, [saleOrders, todayRange]);
  const subtotal = Object.values(cart).reduce((total, line) => {
    const product = products.find((item) => item.id === line.productId);
    if (!product) return total;
    return total + lineUnitPrice(line, product, addons) * line.quantity;
  }, 0);
  const deliveryFee = subtotal > 0 ? 5 : 0;
  const selectedAddonsTotal = addons
    .filter((addon) => productAddonIds.includes(addon.id))
    .reduce((total, addon) => total + addon.price_cents / 100, 0);
  const showsAddons = selectedProduct
    ? ADDON_CATEGORIES.includes(selectedProduct.category)
    : false;

  function changeCartLine(productId: number, addonIds: number[], note: string, amount: number) {
    setCart((current) => {
      const sortedAddonIds = [...addonIds].sort((a, b) => a - b);
      const key = makeCartKey(productId, sortedAddonIds, note);
      const next = { ...current };
      const quantity = (next[key]?.quantity ?? 0) + amount;
      if (quantity <= 0) delete next[key];
      else next[key] = { productId, addonIds: sortedAddonIds, note: note.trim(), quantity };
      return next;
    });
  }

  function changeQuantity(productId: number, amount: number) {
    changeCartLine(productId, [], "", amount);
  }

  function openProduct(product: Product) {
    setProductAddonIds([]);
    setProductNote("");
    setSelectedProduct(product);
  }

  function toggleFavorite(productId: number) {
    const updatedFavorites = favorites.includes(productId)
      ? favorites.filter((id) => id !== productId)
      : [...favorites, productId];
    window.localStorage.setItem(favoritesStorageKey, updatedFavorites.join(","));
    window.dispatchEvent(new Event(favoritesStorageEvent));
  }

  function openAdminPanel() {
    setNewOrderCount(0);
    setSalesError(null);
    setSalesLoading(true);
    setTodayRange(getTodayRange());
    setSalesRefresh((refresh) => refresh + 1);
    setAdminSection("sales");
    setActiveTab("Admin");
  }

  function openAdminAccess() {
    setAdminError(null);
    setActiveTab("Admin");
  }

  function openOrders() {
    setCustomerOrdersError(null);
    if (authUser) {
      setCustomerOrdersLoading(true);
      setOrdersRefresh((refresh) => refresh + 1);
    } else {
      setCustomerOrdersLoading(false);
    }
    setActiveTab("Pedidos");
  }

  function openAddressEditor() {
    setAuthError(null);
    setAuthMessage(null);
    setCartOpen(false);
    if (!authUser) {
      setAuthMode("login");
      setAuthError("Entre na sua conta para cadastrar ou alterar o endereço.");
    }
    setProfileAddress(authUser ? getUserAddress(authUser) : "");
    setProfileAction("address");
    setActiveTab("Perfil");
  }

  function openPasswordEditor() {
    setAuthError(null);
    setAuthMessage(null);
    setNewPassword("");
    setConfirmNewPassword("");
    setProfileAction("password");
  }

  function refreshSales() {
    setNewOrderCount(0);
    setSalesError(null);
    setSalesLoading(true);
    setTodayRange(getTodayRange());
    setSalesRefresh((refresh) => refresh + 1);
  }

  function showNewOrders() {
    setNewOrderAlert(null);
    openAdminPanel();
  }

  async function enableNotifications() {
    setNotificationPermission(await requestNotificationPermission());
  }

  const loadAdminProducts = useCallback(async () => {
    setProductsLoading(true);
    setProductError(null);
    try {
      const token = await getAdminToken();
      const response = await fetch("/api/admin/products", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json().catch(() => null)) as
        | { products?: AdminProduct[]; error?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Não foi possível carregar os produtos.");
      }
      const items = payload?.products ?? [];
      setAdminProducts(items);
      setProducts(items.map(adminProductToProduct));
    } catch (error) {
      setProductError(
        error instanceof Error ? error.message : "Não foi possível carregar os produtos.",
      );
    } finally {
      setProductsLoading(false);
    }
  }, []);

  function openAdminProducts() {
    setAdminSection("products");
    setCategoryError(null);
    setCategoryMessage(null);
    void loadAdminProducts();
    void loadCategories();
  }

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newCategoryName.trim();
    if (!name) {
      setCategoryError("Informe o nome da categoria.");
      return;
    }
    setCategoryError(null);
    setCategoryMessage(null);
    setCategorySaving(true);
    try {
      const token = await getAdminToken();
      const response = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Não foi possível adicionar a categoria.");
      }
      setNewCategoryName("");
      await loadCategories();
      setCategoryMessage(`Categoria "${name}" adicionada.`);
    } catch (error) {
      setCategoryError(
        error instanceof Error ? error.message : "Não foi possível adicionar a categoria.",
      );
    } finally {
      setCategorySaving(false);
    }
  }

  async function deleteCategory(item: AdminCategory) {
    if (!window.confirm(`Excluir a categoria "${item.name}"?`)) return;
    setCategoryError(null);
    setCategoryMessage(null);
    setCategorySaving(true);
    try {
      const token = await getAdminToken();
      const response = await fetch(`/api/admin/categories/${item.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Não foi possível excluir a categoria.");
      }
      await loadCategories();
      setCategoryMessage(`Categoria "${item.name}" excluída.`);
    } catch (error) {
      setCategoryError(
        error instanceof Error ? error.message : "Não foi possível excluir a categoria.",
      );
    } finally {
      setCategorySaving(false);
    }
  }

  async function moveCategoryProducts(item: AdminCategory) {
    const others = adminCategories
      .filter((category) => category.id !== item.id)
      .map((category) => category.name);
    if (others.length === 0) {
      setCategoryError("Cadastre outra categoria antes de mover os produtos.");
      return;
    }
    const target = window.prompt(
      `Mover os produtos de "${item.name}" para qual categoria?\n\nOpções: ${others.join(", ")}`,
      others[0],
    );
    if (!target) return;
    if (!others.includes(target)) {
      setCategoryError("Categoria de destino inválida.");
      return;
    }

    setCategoryError(null);
    setCategoryMessage(null);
    setCategorySaving(true);
    try {
      const token = await getAdminToken();
      const response = await fetch(`/api/admin/categories/${item.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ target }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { moved?: number; error?: string }
        | null;
      if (!response.ok) throw new Error(payload?.error ?? "Não foi possível mover os produtos.");
      await loadAdminProducts();
      setCategoryMessage(
        `${payload?.moved ?? 0} produto(s) movido(s) para "${target}". Agora você pode apagar "${item.name}".`,
      );
    } catch (error) {
      setCategoryError(
        error instanceof Error ? error.message : "Não foi possível mover os produtos.",
      );
    } finally {
      setCategorySaving(false);
    }
  }

  async function addAddon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newAddonName.trim();
    const priceCents = priceToCents(newAddonPrice);
    if (!name) {
      setAddonError("Informe o nome do adicional.");
      return;
    }
    if (!Number.isFinite(priceCents) || priceCents <= 0) {
      setAddonError("Informe um preço válido para o adicional.");
      return;
    }
    setAddonError(null);
    setAddonMessage(null);
    setAddonSaving(true);
    try {
      const token = await getAdminToken();
      const response = await fetch("/api/admin/addons", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, price_cents: priceCents }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Não foi possível adicionar o adicional.");
      setNewAddonName("");
      setNewAddonPrice("");
      await loadAdminAddons();
      setAddonMessage(`Adicional "${name}" adicionado.`);
    } catch (error) {
      setAddonError(error instanceof Error ? error.message : "Não foi possível adicionar o adicional.");
    } finally {
      setAddonSaving(false);
    }
  }

  async function deleteAddon(item: AdminAddon) {
    if (!window.confirm(`Excluir o adicional "${item.name}"?`)) return;
    setAddonError(null);
    setAddonMessage(null);
    setAddonSaving(true);
    try {
      const token = await getAdminToken();
      const response = await fetch(`/api/admin/addons/${item.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Não foi possível excluir o adicional.");
      await loadAdminAddons();
      setAddonMessage(`Adicional "${item.name}" excluído.`);
    } catch (error) {
      setAddonError(error instanceof Error ? error.message : "Não foi possível excluir o adicional.");
    } finally {
      setAddonSaving(false);
    }
  }

  function startNewProduct() {
    setEditingProductId(null);
    setProductForm(emptyProductForm);
    setProductError(null);
    setProductMessage(null);
  }

  function startEditProduct(item: AdminProduct) {
    setEditingProductId(item.id);
    setProductForm({
      name: item.name,
      price: (item.price_cents / 100).toFixed(2),
      description: item.description,
      category: item.category,
      image: item.image,
      oldPrice: item.old_price_cents ? (item.old_price_cents / 100).toFixed(2) : "",
      badge: item.badge ?? "",
      available: item.available,
      highlighted: item.highlighted,
    });
    setProductError(null);
    setProductMessage(null);
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProductError(null);
    setProductMessage(null);

    const name = productForm.name.trim();
    const priceCents = priceToCents(productForm.price);
    const oldPriceCents = productForm.oldPrice.trim() ? priceToCents(productForm.oldPrice) : null;
    if (!name) {
      setProductError("Informe o nome do produto.");
      return;
    }
    if (!Number.isFinite(priceCents) || priceCents <= 0) {
      setProductError("Informe um preço válido.");
      return;
    }
    if (oldPriceCents !== null && (!Number.isFinite(oldPriceCents) || oldPriceCents <= priceCents)) {
      setProductError("O preço promocional deve ser menor que o preço normal.");
      return;
    }

    setProductSaving(true);
    try {
      const token = await getAdminToken();
      const isEdit = editingProductId !== null;
      const response = await fetch(
        isEdit ? `/api/admin/products/${editingProductId}` : "/api/admin/products",
        {
          method: isEdit ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name,
            price_cents: priceCents,
            description: productForm.description.trim(),
            category: productForm.category,
            image:
              productForm.image.trim() || imageForProduct(name, productForm.description),
            old_price_cents: oldPriceCents,
            badge: productForm.badge.trim() || null,
            available: productForm.available,
            highlighted: productForm.highlighted,
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Não foi possível salvar o produto.");
      }
      await loadAdminProducts();
      setProductMessage(isEdit ? "Produto atualizado com sucesso." : "Produto criado com sucesso.");
      startNewProduct();
    } catch (error) {
      setProductError(
        error instanceof Error ? error.message : "Não foi possível salvar o produto.",
      );
    } finally {
      setProductSaving(false);
    }
  }

  async function uploadProductImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setProductError(null);
    setImageUploading(true);
    try {
      const token = await getAdminToken();
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/admin/products/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const payload = (await response.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;
      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error ?? "Não foi possível enviar a imagem.");
      }
      setProductForm((current) => ({ ...current, image: payload.url as string }));
      setProductMessage("Imagem enviada. Salve o produto para aplicar a alteração.");
    } catch (error) {
      setProductError(
        error instanceof Error ? error.message : "Não foi possível enviar a imagem.",
      );
    } finally {
      setImageUploading(false);
    }
  }

  async function deleteProduct(id: number) {
    if (!window.confirm("Excluir este produto do cardápio?")) return;
    setProductError(null);
    setProductMessage(null);
    try {
      const token = await getAdminToken();
      const response = await fetch(`/api/admin/products/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Não foi possível excluir o produto.");
      if (editingProductId === id) startNewProduct();
      await loadAdminProducts();
      setProductMessage("Produto excluído.");
    } catch (error) {
      setProductError(
        error instanceof Error ? error.message : "Não foi possível excluir o produto.",
      );
    }
  }

  async function toggleProductAvailable(item: AdminProduct) {
    setProductError(null);
    try {
      const token = await getAdminToken();
      const response = await fetch(`/api/admin/products/${item.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: item.name,
          price_cents: item.price_cents,
          description: item.description,
          category: item.category,
          image: item.image,
          old_price_cents: item.old_price_cents,
          badge: item.badge,
          available: !item.available,
          highlighted: item.highlighted,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Não foi possível atualizar o produto.");
      }
      await loadAdminProducts();
    } catch (error) {
      setProductError(
        error instanceof Error ? error.message : "Não foi possível atualizar o produto.",
      );
    }
  }

  async function saveProfileAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authUser) {
      setAuthError("Entre na sua conta para cadastrar ou alterar o endereço.");
      return;
    }
    const address = profileAddress.trim();
    if (!address) {
      setAuthError("Informe um endereço de entrega.");
      return;
    }
    setAuthError(null);
    setAuthMessage(null);
    setAuthLoading(true);
    try {
      const { data, error } = await getSupabaseClient().auth.updateUser({
        data: { ...authUser.user_metadata, address },
      });
      if (error) throw error;
      if (!data.user) throw new Error("O Supabase não retornou o perfil atualizado.");
      setAuthUser(data.user);
      setProfileAction(null);
      setAuthMessage("Endereço atualizado.");
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Não foi possível atualizar o endereço.",
      );
    } finally {
      setAuthLoading(false);
    }
  }

  async function changeAccountPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authUser) {
      setAuthError("Entre na sua conta para alterar a senha.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setAuthError("As senhas não coincidem.");
      return;
    }
    setAuthError(null);
    setAuthMessage(null);
    setAuthLoading(true);
    try {
      const { data, error } = await getSupabaseClient().auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      if (!data.user) throw new Error("O Supabase não retornou a conta atualizada.");
      setAuthUser(data.user);
      setNewPassword("");
      setConfirmNewPassword("");
      setProfileAction(null);
      setAuthMessage("Senha alterada com sucesso.");
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Não foi possível alterar a senha.",
      );
    } finally {
      setAuthLoading(false);
    }
  }

  async function updateOrderStatus(orderId: number, status: OrderStatus) {
    setUpdatingOrderId(orderId);
    setSalesError(null);
    try {
      const { data, error } = await getSupabaseClient()
        .from("orders")
        .update({ status })
        .eq("id", orderId)
        .select("*")
        .single();
      if (error) throw error;
      if (!data) throw new Error("O Supabase não retornou o pedido atualizado.");
      setSaleOrders((current) =>
        current.map((order) => (order.id === orderId ? data : order)),
      );
    } catch (error) {
      setSalesError(
        error instanceof Error ? error.message : "Não foi possível atualizar o pedido.",
      );
    } finally {
      setUpdatingOrderId(null);
    }
  }

  function requestOrderConfirmation() {
    setCheckoutError(null);
    if (!authUser) {
      setCartOpen(false);
      setAuthMode("login");
      setAuthError("Entre na sua conta para finalizar o pedido.");
      setActiveTab("Perfil");
      return;
    }
    if (!getUserAddress(authUser)) {
      setCartOpen(false);
      setProfileAddress("");
      setProfileAction("address");
      setAuthError("Cadastre seu endereço de entrega antes de finalizar o pedido.");
      setActiveTab("Perfil");
      return;
    }
    setCartOpen(false);
    setOrderConfirmOpen(true);
  }

  function cancelWhatsappRedirect() {
    if (whatsappRedirectRef.current !== null) {
      window.clearTimeout(whatsappRedirectRef.current);
      whatsappRedirectRef.current = null;
    }
  }

  async function placeOrder() {
    setCheckoutError(null);
    if (!authUser) {
      setOrderConfirmOpen(false);
      setAuthMode("login");
      setAuthError("Entre na sua conta para finalizar o pedido.");
      setActiveTab("Perfil");
      return;
    }

    setCheckoutLoading(true);
    try {
      const {
        data: { session },
      } = await getSupabaseClient().auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Sua sessão expirou. Entre novamente para finalizar o pedido.");

      const requestedItems = Object.values(cart).map((line) => ({
        id: line.productId,
        quantity: line.quantity,
        addon_ids: line.addonIds,
        note: line.note || null,
      }));

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ items: requestedItems }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { order?: SaleOrder; whatsapp?: WhatsAppNotificationResult; error?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Não foi possível registrar seu pedido.");
      }
      const data = payload?.order;
      if (!data) throw new Error("O Supabase não retornou o pedido criado.");

      const whatsappSent = payload?.whatsapp === "sent";
      setStoreWhatsAppSent(whatsappSent);
      const storeUrl = getStoreWhatsAppUrl(data, STORE_WHATSAPP_NUMBER);
      setStoreWhatsAppUrl(storeUrl);
      setOrderConfirmation(data);
      cancelWhatsappRedirect();
      if (!whatsappSent) {
        // Mostra a confirmação antes de abrir o WhatsApp na mesma aba.
        whatsappRedirectRef.current = window.setTimeout(() => {
          whatsappRedirectRef.current = null;
          window.location.assign(storeUrl);
        }, 1800);
      }

      setOrderConfirmOpen(false);
      setOrders((count) => count + 1);
      setCustomerOrders((current) => [data, ...current.filter((order) => order.id !== data.id)]);
      setCart({});
      setCartOpen(false);
      setActiveTab("Pedidos");
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : "Não foi possível registrar seu pedido.",
      );
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError(null);
    setAuthMessage(null);
    if (authMode === "register" && authPassword !== authPasswordConfirm) {
      setAuthError("As senhas não coincidem.");
      return;
    }
    setAuthLoading(true);
    const email = authEmail.trim();

    try {
      const supabase = getSupabaseClient();

      if (authMode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: authPassword,
          options: {
            data: {
              full_name: authName.trim(),
              phone: authPhone.trim(),
            },
          },
        });
        if (error) throw error;

        setAuthPassword("");
        setAuthPasswordConfirm("");
        if (data.user && data.session) {
          setAuthUser(data.user);
        } else {
          setAuthMode("login");
          setAuthMessage(
            "Cadastro recebido. Confira seu e-mail para confirmar a conta e depois entre.",
          );
        }
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: authPassword,
      });
      if (error) throw error;
      if (!data.user) throw new Error("O Supabase não retornou um usuário autenticado.");

      setAuthUser(data.user);
      setAuthPassword("");
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Não foi possível autenticar sua conta.",
      );
    } finally {
      setAuthLoading(false);
    }
  }

  async function submitAdminLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdminError(null);
    const email = adminEmail.trim();
    if (!email || !adminPassword) {
      setAdminError("Informe o e-mail e a senha de administrador.");
      return;
    }

    setAdminLoading(true);
    try {
      const supabase = getSupabaseClient();

      if (authUser) {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) throw signOutError;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: adminPassword,
      });
      if (error) throw error;

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const adminUser = userData.user;

      if (!adminUser || adminUser.app_metadata.role !== "admin") {
        await supabase.auth.signOut();
        setAuthUser(null);
        setAdminPassword("");
        setAdminError(
          `A conta ${email} entrou, mas ainda não tem o papel "admin" no Supabase. ` +
            "Execute o SQL de promoção e entre novamente.",
        );
        return;
      }

      setAuthUser(adminUser);
      setAdminEmail("");
      setAdminPassword("");
      openAdminPanel();
    } catch (error) {
      setAdminError(
        error instanceof Error ? error.message : "Não foi possível entrar no painel.",
      );
    } finally {
      setAdminLoading(false);
    }
  }

  async function signOut() {
    setAuthError(null);
    setAuthLoading(true);
    try {
      const { error } = await getSupabaseClient().auth.signOut();
      if (error) throw error;
      setAuthUser(null);
      return true;
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Não foi possível encerrar sua sessão.",
      );
      return false;
    } finally {
      setAuthLoading(false);
    }
  }

  async function exitAdminPanel() {
    setAdminError(null);
    if (await signOut()) setActiveTab("Início");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a
          className="brand"
          href="#inicio"
          onClick={() => setActiveTab("Início")}
          aria-label="Brasa & Pão, início"
        >
          <span className="brand-name">
            Brasa <span>&</span> Pão
          </span>
        </a>
        <nav className="bottom-nav" aria-label="Navegação principal">
          {navigation.map(({ name, icon }) => (
            <button
              type="button"
              className={`nav-item${activeTab === name ? " active" : ""}`}
              onClick={() => {
                if (name === "Pedidos") {
                  openOrders();
                } else {
                  if (name === "Ofertas") setActiveCategory("Todos");
                  setActiveTab(name);
                }
              }}
              key={name}
            >
              <span className="nav-icon-wrap">
                <Icon name={icon} size={21} />
                {name === "Pedidos" && orders > 0 && <span className="nav-notice" />}
              </span>
              <span>{name}</span>
            </button>
          ))}
          <button
            type="button"
            className="nav-item mobile-cart-nav"
            onClick={() => setCartOpen(true)}
            aria-label={`Abrir sacola, ${cartCount} itens`}
          >
            <span className="nav-icon-wrap">
              <Icon name="bag" size={21} />
              {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
            </span>
            <span>Sacola</span>
          </button>
        </nav>
        <div className="header-actions">
          <button
            className="header-admin"
            type="button"
            onClick={openAdminAccess}
            aria-label="Acesso administrativo"
          >
            <Icon name="admin" size={19} />
          </button>
          <button
            className="header-cart"
            type="button"
            onClick={() => setCartOpen(true)}
            aria-label={`Abrir carrinho, ${cartCount} itens`}
          >
            <Icon name="bag" size={21} />
            <span className="cart-count">{cartCount}</span>
          </button>
        </div>
      </header>

      <main className="page-content" id="inicio">
        {activeTab !== "Início" && activeTab !== "Admin" && !isPromotions && (
          <DeliveryLine address={deliveryAddress} onChangeAddress={openAddressEditor} />
        )}

        {(activeTab === "Início" || isPromotions) && (
          <>
            <section className="promo-banner" aria-label="Promoção da semana">
              <video
                className="promo-image"
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                poster="/brasa-banner.jpeg"
                aria-hidden="true"
              >
                <source src="/hamburgue.mp4" type="video/mp4" />
              </video>
              <div className="promo-shade" />
              <div className="promo-content">
                <span className="promo-label">QUARTA É DIA DE BURGER</span>
                <h2>Duplo sabor.<br />Preço especial.</h2>
                <p>Duplo Cheddar por apenas {formatPrice(36.9)}</p>
                <button
                  className="promo-cta"
                  type="button"
                  onClick={() => {
                    setActiveTab("Ofertas");
                    setActiveCategory("Todos");
                    window.setTimeout(() => {
                      document.getElementById("ofertas")?.scrollIntoView({ behavior: "smooth" });
                    }, 80);
                  }}
                >
                  Ver oferta <Icon name="arrow" size={16} />
                </button>
              </div>
              <span className="promo-stamp">-14%</span>
            </section>
            <section className="delivery-apps" aria-label="Aplicativos de entrega">
              <div className="delivery-app-link ifood-app" aria-disabled="true">
                <span className="delivery-app-logo">
                  <svg viewBox="0 0 40 40" aria-hidden="true">
                    <path d="M12 8v8m-3-8v5m6-5v5m-3-2v20m14-20v20m0-20c4 0 6 3 6 7v4h-6" />
                  </svg>
                </span>
                <span className="delivery-app-copy">
                  <strong>iFood</strong>
                  <small>Em breve</small>
                </span>
              </div>
              <div className="delivery-app-link app99-app" aria-disabled="true">
                <span className="delivery-app-logo">
                  <svg viewBox="0 0 40 40" aria-hidden="true">
                    <text x="20" y="27" textAnchor="middle">99</text>
                  </svg>
                </span>
                <span className="delivery-app-copy">
                  <strong>99</strong>
                  <small>Em breve</small>
                </span>
              </div>
            </section>
            <section className="hours-panel" aria-label="Horário de funcionamento">
              <span className="hours-icon"><Icon name="clock" size={19} /></span>
              <div>
                <p className="eyebrow">HORÁRIO DE FUNCIONAMENTO</p>
                <strong>18h às 23h30</strong>
                <span>Brasília-DF</span>
              </div>
              <span className="open-status">
                <span className="status-dot" /> Aberto
              </span>
            </section>
            <DeliveryLine address={deliveryAddress} onChangeAddress={openAddressEditor} />

            {activeTab === "Início" && highlightedProducts.length > 0 && (
              <section className="highlights-section" aria-labelledby="highlights-title">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">ESCOLHAS DA CASA</p>
                    <h2 id="highlights-title">Destaques</h2>
                  </div>
                  <button
                    className="highlights-see-all"
                    type="button"
                    onClick={() => {
                      setActiveCategory("Destaques");
                      document.getElementById("cardapio")?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    Ver todos <Icon name="arrow" size={14} />
                  </button>
                </div>
                <div className="highlights-row">
                  {highlightedProducts.map((product) => (
                    <article className="highlight-card" key={product.id}>
                      <button
                        className="highlight-photo"
                        type="button"
                        onClick={() => openProduct(product)}
                        aria-label={`Ver detalhes de ${product.name}`}
                      >
                        <Image src={product.image} alt="" fill unoptimized sizes="160px" />
                        {product.badge && <span className="product-badge">{product.badge}</span>}
                      </button>
                      <div className="highlight-copy">
                        <strong>{product.name}</strong>
                        <span>{formatPrice(product.price)}</span>
                      </div>
                      <button
                        className="highlight-add"
                        type="button"
                        onClick={() => changeQuantity(product.id, 1)}
                        aria-label={`Adicionar ${product.name} à sacola`}
                      >
                        <Icon name="plus" size={16} />
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            )}

            <section className="menu-section" id={isPromotions ? "ofertas" : "cardapio"}>
              {isPromotions && (
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">VANTAGENS PRA VOCÊ</p>
                    <h2>Ofertas especiais</h2>
                  </div>
                  <span className="open-status">
                    <span className="status-dot" /> Aberto
                  </span>
                </div>
              )}

              <label className="search-box">
                <Icon name="search" size={19} />
                <input
                  type="search"
                  placeholder="Buscar no cardápio"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>

              {!isPromotions && (
                <div className="category-list" aria-label="Categorias do cardápio">
                  {categories.map((category) => (
                    <button
                      className={`category-chip${activeCategory === category ? " selected" : ""}`}
                      key={category}
                      type="button"
                      onClick={() => setActiveCategory(category)}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              )}

              <div className="product-grid">
                {visibleProducts.map((product) => (
                  <article className="product-card" key={product.id}>
                    <div className="product-photo">
                      <button
                        className="product-open"
                        type="button"
                        onClick={() => openProduct(product)}
                        aria-label={`Ver detalhes de ${product.name}`}
                      >
                        <Image
                          src={product.image}
                          alt=""
                          fill
                          unoptimized
                          sizes="(max-width: 640px) 45vw, (max-width: 1000px) 30vw, 260px"
                        />
                        {product.badge && (
                          <span className={`product-badge${product.oldPrice ? " sale-badge" : ""}`}>
                            {product.badge}
                          </span>
                        )}
                      </button>
                      <button
                        className={`favorite-button${favorites.includes(product.id) ? " is-favorite" : ""}`}
                        type="button"
                        aria-label={
                          favorites.includes(product.id)
                            ? `Remover ${product.name} dos favoritos`
                            : `Adicionar ${product.name} aos favoritos`
                        }
                        aria-pressed={favorites.includes(product.id)}
                        onClick={() => toggleFavorite(product.id)}
                      >
                        <Icon name="heart" size={17} filled={favorites.includes(product.id)} />
                      </button>
                      {productCartQuantity(cart, product.id) > 0 ? (
                        <div className="quantity-control">
                          <button
                            type="button"
                            onClick={() => changeQuantity(product.id, -1)}
                            aria-label={`Remover ${product.name}`}
                          >
                            <Icon name="minus" size={15} />
                          </button>
                          <span>{productCartQuantity(cart, product.id)}</span>
                          <button
                            type="button"
                            onClick={() => changeQuantity(product.id, 1)}
                            aria-label={`Adicionar mais ${product.name}`}
                          >
                            <Icon name="plus" size={15} />
                          </button>
                        </div>
                      ) : (
                        <button
                          className="add-product"
                          type="button"
                          onClick={() => changeQuantity(product.id, 1)}
                          aria-label={`Adicionar ${product.name} ao carrinho`}
                        >
                          <Icon name="plus" size={18} />
                        </button>
                      )}
                    </div>
                    <div className="product-details">
                      <p className="product-category">{product.category}</p>
                      <h3>
                        <button
                          className="product-title-button"
                          type="button"
                          onClick={() => openProduct(product)}
                        >
                          {product.name}
                        </button>
                      </h3>
                      <p className="product-description">{product.description}</p>
                      <div className="product-price">
                        <strong>{formatPrice(product.price)}</strong>
                        {product.oldPrice && <del>{formatPrice(product.oldPrice)}</del>}
                      </div>
                    </div>
                  </article>
                ))}
                {visibleProducts.length === 0 && (
                  <div className="empty-search">
                    <span>Não encontramos esse item.</span>
                    <button type="button" onClick={() => setSearch("")}>
                      Limpar busca
                    </button>
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {activeTab === "Pedidos" && (
          <section className="utility-page">
            <p className="eyebrow">ACOMPANHE POR AQUI</p>
            <h1>Seus pedidos</h1>
            {storeWhatsAppUrl && (
              <a
                className="store-whatsapp-link"
                href={storeWhatsAppUrl}
                target="_blank"
                rel="noreferrer"
              >
                <Icon name="check" size={16} />{" "}
                {storeWhatsAppSent
                  ? "Resumo enviado ao WhatsApp da loja. Toque para reenviar."
                  : "Pedido enviado! Toque para enviar o resumo no WhatsApp da loja"}
              </a>
            )}
            {customerOrdersError && (
              <p className="auth-feedback error" role="alert">{customerOrdersError}</p>
            )}
            {!authReady ? (
              <p className="auth-loading" role="status">Verificando sua sessão...</p>
            ) : !authUser ? (
              <div className="empty-state">
                <span className="empty-icon"><Icon name="user" size={25} /></span>
                <h2>Entre para ver seus pedidos</h2>
                <p>Faça login para acompanhar o histórico e o status dos seus pedidos.</p>
                <button className="primary-button" type="button" onClick={() => setActiveTab("Perfil")}>
                  Entrar na conta
                </button>
              </div>
            ) : customerOrdersLoading ? (
              <p className="auth-loading" role="status">Carregando seus pedidos...</p>
            ) : customerOrders.length > 0 ? (
              <div className="customer-orders">
                {customerOrders.map((order) => (
                  <article className="customer-order-card" key={order.id}>
                    <div className="customer-order-heading">
                      <div>
                        <strong>Pedido #{String(order.id).padStart(4, "0")}</strong>
                        <time dateTime={order.created_at}>
                          {new Date(order.created_at).toLocaleString("pt-BR")}
                        </time>
                      </div>
                      <span className={`order-status status-${order.status}`}>
                        {orderStatusLabels[order.status]}
                      </span>
                    </div>
                    <p className="customer-order-items">
                      {order.items.map(formatOrderItem).join(" · ")}
                    </p>
                    <p className="customer-order-address">
                      Entrega em: {order.customer_address}
                    </p>
                    {order.status === "preparing" && <PreparationTracker />}
                    {order.status === "out_for_delivery" && (
                      <DeliveryTracker address={order.customer_address} />
                    )}
                    <div className="customer-order-fees">
                      <span>Subtotal</span>
                      <strong>{formatPrice(order.subtotal_cents / 100)}</strong>
                      <span>Entrega</span>
                      <strong>{formatPrice(order.delivery_fee_cents / 100)}</strong>
                    </div>
                    <div className="customer-order-total">
                      <span>Total do pedido</span>
                      <strong>{formatPrice(order.total_cents / 100)}</strong>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-icon"><Icon name="receipt" size={25} /></span>
                <h2>Nenhum pedido por enquanto</h2>
                <p>Quando você fizer um pedido, ele aparecerá aqui.</p>
                <button className="primary-button" type="button" onClick={() => setActiveTab("Início")}>
                  Explorar cardápio
                </button>
              </div>
            )}
          </section>
        )}

        {activeTab === "Admin" && (
          <section className="utility-page admin-page">
            {isAdmin ? (
              <>
                <div className="admin-page-heading">
                  <div>
                    <p className="eyebrow">GESTÃO</p>
                    <h1>
                      {adminSection === "sales"
                        ? "Vendas"
                        : adminSection === "categories"
                          ? "Categorias"
                          : adminSection === "addons"
                            ? "Adicionais"
                            : "Produtos"}
                    </h1>
                  </div>
                  <div className="admin-page-actions">
                    <button
                      className="admin-logout"
                      type="button"
                      onClick={exitAdminPanel}
                      disabled={authLoading}
                    >
                      Sair do painel
                    </button>
                  </div>
                </div>
                <div className="admin-section-tabs" role="tablist" aria-label="Seções do painel">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={adminSection === "sales"}
                    className={adminSection === "sales" ? "active" : undefined}
                    onClick={() => setAdminSection("sales")}
                  >
                    Vendas
                    {newOrderCount > 0 && (
                      <span className="new-order-badge">{newOrderCount}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={adminSection === "products"}
                    className={adminSection === "products" ? "active" : undefined}
                    onClick={openAdminProducts}
                  >
                    Produtos
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={adminSection === "categories"}
                    className={adminSection === "categories" ? "active" : undefined}
                    onClick={() => {
                      setAdminSection("categories");
                      setCategoryError(null);
                      setCategoryMessage(null);
                      void loadCategories();
                    }}
                  >
                    Categorias
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={adminSection === "addons"}
                    className={adminSection === "addons" ? "active" : undefined}
                    onClick={() => {
                      setAdminSection("addons");
                      setAddonError(null);
                      setAddonMessage(null);
                      void loadAdminAddons();
                    }}
                  >
                    Adicionais
                  </button>
                </div>
                {adminSection === "sales" && (
                  <>
                    <div className="admin-sales-actions">
                      <div className="admin-sales-statuses">
                        <span
                          className={`realtime-status${realtimeConnected ? " online" : ""}`}
                          title={
                            realtimeConnected
                              ? "Acompanhando novos pedidos em tempo real"
                              : "Conexão em tempo real indisponível"
                          }
                        >
                          <span className="status-dot" /> {realtimeConnected ? "Ao vivo" : "Offline"}
                        </span>
                        {notificationPermission === "granted" && (
                          <span className="realtime-status online" title="Notificações do navegador ativadas">
                            <span className="status-dot" /> Notificações ativas
                          </span>
                        )}
                      </div>
                      <div className="admin-sales-buttons">
                        {notificationPermission !== "granted" && notificationPermission !== "unsupported" && (
                          <button
                            className="admin-refresh"
                            type="button"
                            onClick={() => void enableNotifications()}
                          >
                            Ativar notificações
                          </button>
                        )}
                        {newOrderCount > 0 && (
                          <button className="new-order-pill" type="button" onClick={showNewOrders}>
                            🔔 {newOrderCount} novo{newOrderCount > 1 ? "s" : ""} pedido
                            {newOrderCount > 1 ? "s" : ""}
                          </button>
                        )}
                        <button
                          className="admin-refresh"
                          type="button"
                          onClick={() => {
                            unlockOrderAlarm();
                            playNewOrderAlarm();
                          }}
                        >
                          Testar alarme
                        </button>
                        <button
                          className="admin-refresh"
                          type="button"
                          onClick={refreshSales}
                          disabled={salesLoading}
                        >
                          {salesLoading ? "Atualizando..." : "Atualizar vendas"}
                        </button>
                      </div>
                    </div>
                    {salesError && <p className="auth-feedback error" role="alert">{salesError}</p>}
                <div className="admin-metrics">
                  <article>
                    <span>Pedidos recebidos</span>
                    <strong>{saleOrders.length}</strong>
                  </article>
                  <article>
                    <span>Faturamento bruto</span>
                    <strong>{formatPrice(salesMetrics.revenue / 100)}</strong>
                  </article>
                  <article>
                    <span>Vendas hoje</span>
                    <strong>{formatPrice(salesMetrics.todayRevenue / 100)}</strong>
                  </article>
                  <article>
                    <span>Em andamento</span>
                    <strong>{salesMetrics.inProgress}</strong>
                  </article>
                </div>
                <div className="admin-filters">
                  <label className="search-box">
                    <Icon name="search" size={18} />
                    <input
                      type="search"
                      value={salesSearch}
                      onChange={(event) => setSalesSearch(event.target.value)}
                      placeholder="Buscar pedido, cliente ou produto"
                    />
                  </label>
                  <label className="admin-filter-status">
                    <span>Filtrar por status</span>
                    <select
                      value={salesStatus}
                      onChange={(event) => {
                        const value = event.target.value;
                        setSalesStatus(value === "all" || isOrderStatus(value) ? value : "all");
                      }}
                    >
                      <option value="all">Todos os status</option>
                      {orderStatuses.map((status) => (
                        <option value={status} key={status}>
                          {orderStatusLabels[status]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="admin-orders" aria-live="polite">
                  {salesLoading ? (
                    <p className="auth-loading">Carregando pedidos...</p>
                  ) : filteredSales.length > 0 ? (
                    filteredSales.map((order) => {
                      const confirmationUrl = getOrderWhatsAppUrl(order);
                      return (
                        <article className="admin-order-card" key={order.id}>
                          <div className="admin-order-heading">
                            <div>
                              <strong>Pedido #{String(order.id).padStart(4, "0")}</strong>
                              <span>{order.customer_name || order.customer_email}</span>
                            </div>
                            <strong>{formatPrice(order.total_cents / 100)}</strong>
                          </div>
                          <p className="admin-order-items">
                            {order.items.map(formatOrderItem).join(" · ")}
                          </p>
                          <p className="admin-order-address">
                            <Icon name="pin" size={14} /> {order.customer_address}
                          </p>
                          <div className="admin-order-footer">
                            <time dateTime={order.created_at}>
                              {new Date(order.created_at).toLocaleString("pt-BR")}
                            </time>
                            {order.customer_phone && <span>{order.customer_phone}</span>}
                            <label>
                              <span>Status</span>
                              <select
                                value={order.status}
                                disabled={updatingOrderId !== null}
                                onChange={(event) => {
                                  if (isOrderStatus(event.target.value)) {
                                    void updateOrderStatus(order.id, event.target.value);
                                  }
                                }}
                              >
                                {orderStatuses.map((status) => (
                                  <option value={status} key={status}>
                                    {orderStatusLabels[status]}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          {confirmationUrl ? (
                            <a
                              className="admin-send-order"
                              href={confirmationUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Abrir resumo para enviar no WhatsApp
                            </a>
                          ) : (
                            <p className="admin-no-phone">Telefone não cadastrado</p>
                          )}
                        </article>
                      );
                    })
                  ) : (
                    <div className="empty-state admin-empty-state">
                      <h2>{saleOrders.length === 0 ? "Nenhuma venda ainda" : "Nenhum pedido encontrado"}</h2>
                      <p>
                        {saleOrders.length === 0
                          ? "Os pedidos feitos pelo cardápio aparecerão aqui."
                          : "Tente mudar a busca ou o filtro de status."}
                      </p>
                    </div>
                  )}
                </div>
                  </>
                )}
                {adminSection === "products" && (
                  <div className="admin-products-layout">
                    <form
                      className="admin-product-form"
                      onSubmit={saveProduct}
                      aria-busy={productSaving}
                    >
                      <div className="admin-product-form-head">
                        <h2>{editingProductId !== null ? "Editar produto" : "Novo produto"}</h2>
                        {editingProductId !== null && (
                          <button
                            className="admin-product-cancel"
                            type="button"
                            onClick={startNewProduct}
                          >
                            Cancelar edição
                          </button>
                        )}
                      </div>
                      {productError && (
                        <p className="auth-feedback error" role="alert">{productError}</p>
                      )}
                      {productMessage && (
                        <p className="auth-feedback success" role="status">{productMessage}</p>
                      )}
                      <label className="admin-product-field">
                        <span>Nome</span>
                        <input
                          type="text"
                          required
                          value={productForm.name}
                          onChange={(event) =>
                            setProductForm({ ...productForm, name: event.target.value })
                          }
                          placeholder="Ex.: Clássico da Casa"
                        />
                      </label>
                      <div className="admin-product-row">
                        <label className="admin-product-field">
                          <span>Preço (R$)</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            value={productForm.price}
                            onChange={(event) =>
                              setProductForm({ ...productForm, price: event.target.value })
                            }
                            placeholder="32,90"
                          />
                        </label>
                        <label className="admin-product-field">
                          <span>Preço promocional (R$)</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={productForm.oldPrice}
                            onChange={(event) =>
                              setProductForm({ ...productForm, oldPrice: event.target.value })
                            }
                            placeholder="Deixe vazio se não houver"
                          />
                        </label>
                      </div>
                      <label className="admin-product-field">
                        <span>Categoria</span>
                        <select
                          value={productForm.category}
                          onChange={(event) =>
                            setProductForm({
                              ...productForm,
                              category: event.target.value as ProductCategory,
                            })
                          }
                        >
                          {categories
                            .filter(
                              (category) =>
                                category !== "Todos" &&
                                category !== "Favoritos" &&
                                category !== "Destaques",
                            )
                            .map((category) => (
                              <option value={category} key={category}>{category}</option>
                            ))}
                        </select>
                      </label>
                      <label className="admin-product-field">
                        <span>Descrição</span>
                        <textarea
                          rows={3}
                          value={productForm.description}
                          onChange={(event) =>
                            setProductForm({ ...productForm, description: event.target.value })
                          }
                          placeholder="Ingredientes e detalhes do produto"
                        />
                      </label>
                      <div className="admin-product-field">
                        <span>Imagem do produto</span>
                        <div className="admin-image-upload">
                          <div className="admin-image-preview">
                            {productForm.image ? (
                              <Image
                                src={productForm.image}
                                alt="Prévia do produto"
                                fill
                                unoptimized
                                sizes="104px"
                              />
                            ) : (
                              <Icon name="image" size={24} />
                            )}
                          </div>
                          <div className="admin-image-controls">
                            <label className="admin-image-file">
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                disabled={imageUploading}
                                onChange={(event) => void uploadProductImage(event)}
                              />
                              <span>{imageUploading ? "Enviando..." : "Escolher imagem"}</span>
                            </label>
                            {productForm.image && (
                              <button
                                className="admin-product-cancel"
                                type="button"
                                onClick={() =>
                                  setProductForm((current) => ({ ...current, image: "" }))
                                }
                              >
                                Remover imagem
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="admin-image-hint">
                          Sem imagem enviada, escolhemos automaticamente uma foto que combina com o
                          nome e a descrição do produto.
                        </p>
                      </div>
                      <label className="admin-product-field">
                        <span>Selo (opcional)</span>
                        <input
                          type="text"
                          value={productForm.badge}
                          onChange={(event) =>
                            setProductForm({ ...productForm, badge: event.target.value })
                          }
                          placeholder="Ex.: Mais pedido, Oferta"
                        />
                      </label>
                      <label className="admin-product-check">
                        <input
                          type="checkbox"
                          checked={productForm.available}
                          onChange={(event) =>
                            setProductForm({ ...productForm, available: event.target.checked })
                          }
                        />
                        <span>Disponível no cardápio</span>
                      </label>
                      <label className="admin-product-check">
                        <input
                          type="checkbox"
                          checked={productForm.highlighted}
                          onChange={(event) =>
                            setProductForm({ ...productForm, highlighted: event.target.checked })
                          }
                        />
                        <span>Destacar na página inicial e no filtro &quot;Destaques&quot;</span>
                      </label>
                      <button className="primary-button" type="submit" disabled={productSaving}>
                        {productSaving
                          ? "Salvando..."
                          : editingProductId !== null
                            ? "Salvar alterações"
                            : "Adicionar produto"}
                      </button>
                    </form>

                    <div className="admin-products-panel">
                      <div className="admin-filters admin-product-filters">
                        <label className="search-box">
                          <Icon name="search" size={18} />
                          <input
                            type="search"
                            value={adminProductSearch}
                            onChange={(event) => setAdminProductSearch(event.target.value)}
                            placeholder="Buscar produto por nome ou descrição"
                            aria-label="Buscar produtos"
                          />
                        </label>
                        <label className="admin-filter-status">
                          <span>Filtrar por categoria</span>
                          <select
                            value={adminProductCategory}
                            onChange={(event) => setAdminProductCategory(event.target.value)}
                          >
                            <option value="all">Todas as categorias</option>
                            {adminProductCategories.map((category) => (
                              <option value={category} key={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          className="admin-refresh admin-filter-clear"
                          type="button"
                          onClick={() => {
                            setAdminProductSearch("");
                            setAdminProductCategory("all");
                          }}
                          disabled={!adminProductSearch && adminProductCategory === "all"}
                        >
                          Limpar
                        </button>
                      </div>

                      <div className="admin-product-list">
                        <div className="admin-product-list-head">
                          <h2>Produtos cadastrados</h2>
                          <button
                            className="admin-refresh"
                            type="button"
                            onClick={() => void loadAdminProducts()}
                            disabled={productsLoading}
                          >
                            {productsLoading ? "Carregando..." : "Atualizar"}
                          </button>
                        </div>
                        {productsLoading ? (
                          <p className="auth-loading">Carregando produtos...</p>
                        ) : filteredAdminProducts.length > 0 ? (
                          filteredAdminProducts.map((item) => (
                            <article
                              className={`admin-product-card${item.available ? "" : " unavailable"}`}
                              key={item.id}
                            >
                              <div className="admin-product-thumb">
                                <Image src={item.image} alt="" fill unoptimized sizes="72px" />
                              </div>
                              <div className="admin-product-info">
                                <strong>{item.name}</strong>
                                <span>{item.category}</span>
                                <span className="admin-product-price">
                                  {formatPrice(item.price_cents / 100)}
                                  {item.old_price_cents && (
                                    <s>{formatPrice(item.old_price_cents / 100)}</s>
                                  )}
                                </span>
                                {item.highlighted && (
                                  <span className="admin-product-highlight">Destaque</span>
                                )}
                                {!item.available && (
                                  <span className="admin-product-hidden">Oculto</span>
                                )}
                              </div>
                              <div className="admin-product-actions">
                                <button
                                  type="button"
                                  onClick={() => void toggleProductAvailable(item)}
                                  disabled={productSaving}
                                >
                                  {item.available ? "Desativar" : "Ativar"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => startEditProduct(item)}
                                  disabled={productSaving}
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  className="danger"
                                  onClick={() => void deleteProduct(item.id)}
                                  disabled={productSaving}
                                >
                                  Excluir
                                </button>
                              </div>
                            </article>
                          ))
                        ) : (
                          <div className="empty-state admin-empty-state">
                            <h2>
                              {adminProducts.length > 0
                                ? "Nenhum produto encontrado"
                                : "Nenhum produto cadastrado"}
                            </h2>
                            <p>
                              {adminProducts.length > 0
                                ? "Ajuste a busca ou o filtro de categoria."
                                : "Use o formulário ao lado para adicionar o primeiro produto."}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {adminSection === "categories" && (
                  <div className="admin-manager-layout">
                    <form className="admin-product-form" onSubmit={addCategory} aria-busy={categorySaving}>
                      <div className="admin-product-form-head">
                        <h2>Adicionar categoria</h2>
                      </div>
                      {categoryError && (
                        <p className="auth-feedback error" role="alert">{categoryError}</p>
                      )}
                      {categoryMessage && (
                        <p className="auth-feedback success" role="status">{categoryMessage}</p>
                      )}
                      <label className="admin-product-field">
                        <span>Nome da categoria</span>
                        <input
                          type="text"
                          required
                          maxLength={40}
                          value={newCategoryName}
                          onChange={(event) => setNewCategoryName(event.target.value)}
                          placeholder="Ex.: Sobremesas"
                        />
                      </label>
                      <button className="primary-button" type="submit" disabled={categorySaving}>
                        {categorySaving ? "Adicionando..." : "Adicionar categoria"}
                      </button>
                      <p className="admin-image-hint">
                        Para apagar uma categoria, primeiro mova os produtos dela para outra categoria.
                      </p>
                    </form>
                    <div className="admin-product-list">
                      <div className="admin-product-list-head">
                        <h2>Categorias cadastradas</h2>
                        <button className="admin-refresh" type="button" onClick={() => void loadCategories()}>
                          Atualizar
                        </button>
                      </div>
                      {!categoriesLoaded ? (
                        <p className="auth-loading">Carregando categorias...</p>
                      ) : adminCategories.length > 0 ? (
                        <div className="admin-manager-list">
                          {adminCategories.map((item) => (
                            <div className="admin-manager-row" key={item.id}>
                              <span>{item.name}</span>
                              <div className="admin-manager-actions">
                                <button
                                  type="button"
                                  disabled={categorySaving}
                                  onClick={() => void moveCategoryProducts(item)}
                                >
                                  Mover produtos
                                </button>
                                <button
                                  type="button"
                                  className="danger"
                                  disabled={categorySaving}
                                  onClick={() => void deleteCategory(item)}
                                >
                                  Apagar
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="empty-state admin-empty-state">
                          <h2>Nenhuma categoria</h2>
                          <p>Adicione uma categoria para organizar o cardápio.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {adminSection === "addons" && (
                  <div className="admin-manager-layout">
                    <form className="admin-product-form" onSubmit={addAddon} aria-busy={addonSaving}>
                      <div className="admin-product-form-head">
                        <h2>Adicionar adicional</h2>
                      </div>
                      {addonError && <p className="auth-feedback error" role="alert">{addonError}</p>}
                      {addonMessage && <p className="auth-feedback success" role="status">{addonMessage}</p>}
                      <label className="admin-product-field">
                        <span>Nome do adicional</span>
                        <input
                          type="text"
                          required
                          maxLength={40}
                          value={newAddonName}
                          onChange={(event) => setNewAddonName(event.target.value)}
                          placeholder="Ex.: Bacon crocante"
                        />
                      </label>
                      <label className="admin-product-field">
                        <span>Preço (R$)</span>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          required
                          value={newAddonPrice}
                          onChange={(event) => setNewAddonPrice(event.target.value)}
                          placeholder="5,00"
                        />
                      </label>
                      <button className="primary-button" type="submit" disabled={addonSaving}>
                        {addonSaving ? "Adicionando..." : "Adicionar adicional"}
                      </button>
                      <p className="admin-image-hint">
                        Os adicionais aparecem para hambúrgueres e hot dogs no momento do pedido.
                      </p>
                    </form>
                    <div className="admin-product-list">
                      <div className="admin-product-list-head">
                        <h2>Adicionais cadastrados</h2>
                        <button className="admin-refresh" type="button" onClick={() => void loadAdminAddons()}>
                          Atualizar
                        </button>
                      </div>
                      {adminAddons.length > 0 ? (
                        <div className="admin-manager-list">
                          {adminAddons.map((item) => (
                            <div className="admin-manager-row" key={item.id}>
                              <span>
                                {item.name} <small>{formatPrice(item.price_cents / 100)}</small>
                              </span>
                              <button
                                type="button"
                                className="danger"
                                disabled={addonSaving}
                                onClick={() => void deleteAddon(item)}
                              >
                                Apagar
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="empty-state admin-empty-state">
                          <h2>Nenhum adicional</h2>
                          <p>Cadastre adicionais para usar nos hambúrgueres e hot dogs.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="auth-page admin-login">
                <h1>Acesso administrativo</h1>
                <p className="auth-intro">
                  Entre com a conta de administrador para consultar as vendas.
                  {authUser && " Ao entrar, a sessão atual será encerrada."}
                </p>
                <div className="auth-card">
                  {adminError && <p className="auth-feedback error" role="alert">{adminError}</p>}
                  <form className="auth-form" onSubmit={submitAdminLogin} aria-busy={adminLoading}>
                    <label className="auth-field">
                      <span>E-mail</span>
                      <input
                        type="email"
                        autoComplete="username"
                        required
                        disabled={adminLoading}
                        value={adminEmail}
                        onChange={(event) => setAdminEmail(event.target.value)}
                        placeholder="admin@empresa.com"
                      />
                    </label>
                    <label className="auth-field">
                      <span>Senha</span>
                      <PasswordInput
                        autoComplete="current-password"
                        disabled={adminLoading}
                        value={adminPassword}
                        onChange={(event) => setAdminPassword(event.target.value)}
                        placeholder="Senha da conta administradora"
                      />
                    </label>
                    <button className="auth-submit" type="submit" disabled={adminLoading}>
                      <span>{adminLoading ? "Aguarde..." : "Entrar no painel"}</span>
                      <Icon name="arrow" size={17} />
                    </button>
                  </form>
                  <p className="auth-provider-note">
                    O acesso é liberado apenas para contas com a função de administrador no Supabase.
                  </p>
                  <button
                    className="admin-login-back"
                    type="button"
                    onClick={() => setActiveTab("Início")}
                  >
                    Voltar ao cardápio
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === "Perfil" && (
          <section className="utility-page">
            <p className="eyebrow">SUA CONTA</p>
            {authError && <p className="auth-feedback error" role="alert">{authError}</p>}
            {authMessage && <p className="auth-feedback success" role="status">{authMessage}</p>}
            {!authReady ? (
              <p className="auth-loading" role="status">Verificando sua sessão...</p>
            ) : authUser ? (
              <>
                <h1>Perfil</h1>
                <div className="profile-card">
                  <div className="profile-avatar">{getUserName(authUser).charAt(0).toUpperCase()}</div>
                  <div>
                    <strong>Olá, {getUserName(authUser)}!</strong>
                    <p>{authUser.email}</p>
                    {getUserPhone(authUser) && <p>{getUserPhone(authUser)}</p>}
                    <p>{getUserAddress(authUser) || "Endereço não cadastrado"}</p>
                  </div>
                  <Icon name="arrow" size={18} />
                </div>
                <div className="profile-options">
                  {isAdmin && (
                    <button type="button" onClick={openAdminPanel}>
                      <Icon name="receipt" size={19} />
                      <span>Painel de vendas</span>
                      <Icon name="arrow" size={17} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCategory("Favoritos");
                      setActiveTab("Início");
                    }}
                  >
                    <Icon name="heart" size={19} /><span>Meus favoritos</span><Icon name="arrow" size={17} />
                  </button>
                  <button type="button" onClick={openAddressEditor}>
                    <Icon name="pin" size={19} /><span>Alterar endereço</span><Icon name="arrow" size={17} />
                  </button>
                  <button type="button" onClick={openOrders}>
                    <Icon name="receipt" size={19} /><span>Meus pedidos</span><Icon name="arrow" size={17} />
                  </button>
                  <button type="button" onClick={openPasswordEditor}>
                    <Icon name="user" size={19} /><span>Alterar senha</span><Icon name="arrow" size={17} />
                  </button>
                  <div><Icon name="user" size={19} /><span>Dados pessoais</span><Icon name="arrow" size={17} /></div>
                  <button type="button" onClick={signOut} disabled={authLoading}>
                    <Icon name="close" size={19} />
                    <span>{authLoading ? "Saindo..." : "Sair da conta"}</span>
                    <Icon name="arrow" size={17} />
                  </button>
                </div>
                {profileAction && (
                  <div className="profile-edit-card">
                    <h2>{profileAction === "address" ? "Endereço de entrega" : "Alterar senha"}</h2>
                    {profileAction === "address" ? (
                      <form className="auth-form" onSubmit={saveProfileAddress}>
                        <label className="auth-field">
                          <span>Endereço completo</span>
                          <textarea
                            autoComplete="street-address"
                            required
                            disabled={authLoading}
                            rows={3}
                            value={profileAddress}
                            onChange={(event) => setProfileAddress(event.target.value)}
                            placeholder="Rua, número, bairro, cidade e CEP"
                          />
                        </label>
                        <div className="profile-edit-actions">
                          <button className="auth-submit" type="submit" disabled={authLoading}>
                            {authLoading ? "Salvando..." : "Salvar endereço"}
                          </button>
                          <button
                            className="profile-cancel"
                            type="button"
                            onClick={() => setProfileAction(null)}
                            disabled={authLoading}
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    ) : (
                      <form className="auth-form" onSubmit={changeAccountPassword}>
                        <label className="auth-field">
                          <span>Nova senha</span>
                          <PasswordInput
                            autoComplete="new-password"
                            minLength={6}
                            disabled={authLoading}
                            value={newPassword}
                            onChange={(event) => setNewPassword(event.target.value)}
                          />
                        </label>
                        <label className="auth-field">
                          <span>Confirmar nova senha</span>
                          <PasswordInput
                            autoComplete="new-password"
                            minLength={6}
                            disabled={authLoading}
                            value={confirmNewPassword}
                            onChange={(event) => setConfirmNewPassword(event.target.value)}
                          />
                        </label>
                        <div className="profile-edit-actions">
                          <button className="auth-submit" type="submit" disabled={authLoading}>
                            {authLoading ? "Salvando..." : "Salvar senha"}
                          </button>
                          <button
                            className="profile-cancel"
                            type="button"
                            onClick={() => setProfileAction(null)}
                            disabled={authLoading}
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
                <p className="profile-note">Precisa de ajuda? <a href="mailto:oi@brasaepao.com.br">Fale com a gente</a></p>
              </>
            ) : (
              <div className="auth-page">
                <h1>{authMode === "login" ? "Acesse sua conta" : "Crie sua conta"}</h1>
                <p className="auth-intro">
                  {authMode === "login"
                    ? "Entre para acompanhar seus pedidos e favoritos."
                    : "Informe seus dados para criar sua conta e pedir com mais facilidade."}
                </p>
                <div className="auth-card">
                  <div className="auth-tabs" role="tablist" aria-label="Acesso à conta">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={authMode === "login"}
                      className={authMode === "login" ? "selected" : ""}
                      onClick={() => {
                        setAuthMode("login");
                        setAuthError(null);
                        setAuthMessage(null);
                      }}
                    >
                      Entrar
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={authMode === "register"}
                      className={authMode === "register" ? "selected" : ""}
                      onClick={() => {
                        setAuthMode("register");
                        setAuthError(null);
                        setAuthMessage(null);
                      }}
                    >
                      Cadastrar
                    </button>
                  </div>
                  <form className="auth-form" onSubmit={submitAuth} aria-busy={authLoading}>
                    {authMode === "register" && (
                      <label className="auth-field">
                        <span>Nome</span>
                        <input
                          autoComplete="name"
                          required
                          disabled={authLoading}
                          value={authName}
                          onChange={(event) => setAuthName(event.target.value)}
                          placeholder="Seu nome"
                        />
                      </label>
                    )}
                    <label className="auth-field">
                      <span>E-mail</span>
                      <input
                        type="email"
                        autoComplete="email"
                        required
                        disabled={authLoading}
                        value={authEmail}
                        onChange={(event) => setAuthEmail(event.target.value)}
                        placeholder="voce@email.com"
                      />
                    </label>
                    {authMode === "register" && (
                      <label className="auth-field">
                        <span>Telefone / WhatsApp</span>
                        <input
                          type="tel"
                          autoComplete="tel"
                          required
                          disabled={authLoading}
                          value={authPhone}
                          onChange={(event) => setAuthPhone(event.target.value)}
                          placeholder="(11) 99999-9999"
                        />
                      </label>
                    )}
                    <label className="auth-field">
                      <span>Senha</span>
                      <PasswordInput
                        autoComplete={authMode === "register" ? "new-password" : "current-password"}
                        minLength={6}
                        disabled={authLoading}
                        value={authPassword}
                        onChange={(event) => setAuthPassword(event.target.value)}
                        placeholder="Mínimo de 6 caracteres"
                      />
                    </label>
                    {authMode === "register" && (
                      <label className="auth-field">
                        <span>Confirmar senha</span>
                        <PasswordInput
                          autoComplete="new-password"
                          minLength={6}
                          disabled={authLoading}
                          value={authPasswordConfirm}
                          onChange={(event) => setAuthPasswordConfirm(event.target.value)}
                          placeholder="Digite a senha novamente"
                        />
                      </label>
                    )}
                    <button className="auth-submit" type="submit" disabled={authLoading}>
                    <span>
                      {authLoading
                        ? "Aguarde..."
                        : authMode === "login"
                          ? "Entrar"
                          : "Criar conta"}
                    </span>
                      <Icon name="arrow" size={17} />
                    </button>
                  </form>
                  <p className="auth-provider-note">
                    A autenticação é gerenciada pelo Supabase. O cadastro pode exigir confirmação do e-mail.
                  </p>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {cartCount > 0 && !cartOpen && (
        <button className="floating-cart" type="button" onClick={() => setCartOpen(true)}>
          <span className="floating-cart-icon"><Icon name="bag" size={20} /><b>{cartCount}</b></span>
          <span>Ver sacola</span>
          <strong>{formatPrice(subtotal + deliveryFee)}</strong>
          <Icon name="arrow" size={17} />
        </button>
      )}

      {selectedProduct && (
        <div className="product-modal-backdrop" onClick={() => setSelectedProduct(null)}>
          <section
            className="product-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="product-detail-photo">
              <Image src={selectedProduct.image} alt={selectedProduct.name} fill unoptimized sizes="520px" />
              <button
                className="close-button product-detail-close"
                type="button"
                onClick={() => setSelectedProduct(null)}
                aria-label="Fechar detalhes do produto"
              >
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className="product-detail-content">
              <p className="product-category">{selectedProduct.category}</p>
              <h2 id="product-detail-title">{selectedProduct.name}</h2>
              <p>{selectedProduct.description}</p>
              <div className="product-detail-price">
                <strong>{formatPrice(selectedProduct.price + selectedAddonsTotal)}</strong>
                {selectedProduct.oldPrice && productAddonIds.length === 0 && (
                  <del>{formatPrice(selectedProduct.oldPrice)}</del>
                )}
              </div>
              <div className="product-options">
                {showsAddons && addons.length > 0 && (
                  <>
                    <p className="product-options-title">Escolha seus adicionais</p>
                    {addons.map((addon) => (
                      <label className="product-option" key={addon.id}>
                        <input
                          type="checkbox"
                          checked={productAddonIds.includes(addon.id)}
                          onChange={(event) =>
                            setProductAddonIds((current) =>
                              event.target.checked
                                ? [...current, addon.id]
                                : current.filter((id) => id !== addon.id),
                            )
                          }
                        />
                        <span>{addon.name}</span>
                        <strong>+ {formatPrice(addon.price_cents / 100)}</strong>
                      </label>
                    ))}
                  </>
                )}
                <label className="product-note-field">
                  <span>Alguma observação?</span>
                  <textarea
                    rows={3}
                    maxLength={200}
                    value={productNote}
                    onChange={(event) => setProductNote(event.target.value)}
                    placeholder="Ex.: sem cebola, ponto da carne..."
                  />
                </label>
              </div>
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  changeCartLine(selectedProduct.id, productAddonIds, productNote, 1);
                  setSelectedProduct(null);
                }}
              >
                Adicionar à sacola <Icon name="plus" size={18} />
              </button>
            </div>
          </section>
        </div>
      )}

      {orderConfirmOpen && (
        <div className="modal-backdrop" onClick={() => setOrderConfirmOpen(false)}>
          <section
            className="cart-sheet confirm-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheet-handle" />
            <div className="cart-heading">
              <div>
                <p className="eyebrow">CONFIRME SEU PEDIDO</p>
                <h2 id="confirm-title">Resumo do pedido</h2>
              </div>
              <button
                className="close-button"
                type="button"
                onClick={() => {
                  setOrderConfirmOpen(false);
                  setCartOpen(true);
                }}
                aria-label="Voltar para a sacola"
              >
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className="cart-items">
              {Object.values(cart).map((line) => {
                const product = products.find((item) => item.id === line.productId);
                if (!product) return null;
                const unitPrice = lineUnitPrice(line, product, addons);
                return (
                  <div
                    className="cart-item"
                    key={makeCartKey(line.productId, line.addonIds, line.note)}
                  >
                    <div className="cart-thumbnail">
                      <Image src={product.image} alt="" fill unoptimized sizes="64px" />
                    </div>
                    <div className="cart-item-copy">
                      <strong>{product.name}</strong>
                      <span>{formatPrice(unitPrice)}</span>
                      {lineAddons(line, addons).length > 0 && (
                        <small className="cart-item-addon">
                          + {lineAddons(line, addons).map((addon) => addon.name).join(", ")}
                        </small>
                      )}
                      {line.note && <small className="cart-item-note">Obs.: {line.note}</small>}
                    </div>
                    <div className="cart-quantity">
                      <span>{line.quantity}×</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="cart-summary">
              <div><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div>
              <div><span>Entrega</span><strong>{formatPrice(deliveryFee)}</strong></div>
              <div className="cart-total"><span>Total</span><strong>{formatPrice(subtotal + deliveryFee)}</strong></div>
            </div>
            <div className="checkout-address">
              <Icon name="pin" size={18} />
              <span>Entregar em <strong>{deliveryAddress}</strong></span>
            </div>
            {checkoutError && <p className="auth-feedback error" role="alert">{checkoutError}</p>}
            <div className="confirm-actions">
              <button
                className="confirm-back"
                type="button"
                onClick={() => {
                  setOrderConfirmOpen(false);
                  setCartOpen(true);
                }}
                disabled={checkoutLoading}
              >
                Voltar
              </button>
              <button
                className="checkout-button"
                type="button"
                onClick={placeOrder}
                disabled={checkoutLoading}
              >
                <span>{checkoutLoading ? "Registrando pedido..." : "Confirmar pedido"}</span>
                <span>{formatPrice(subtotal + deliveryFee)}</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {cartOpen && (
        <div className="modal-backdrop" onClick={() => setCartOpen(false)}>
          <section
            className="cart-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheet-handle" />
            <div className="cart-heading">
              <div><p className="eyebrow">SEU PEDIDO</p><h2 id="cart-title">Sua sacola</h2></div>
              <button className="close-button" type="button" onClick={() => setCartOpen(false)} aria-label="Fechar sacola">
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className="cart-items">
              {Object.values(cart).map((line) => {
                const product = products.find((item) => item.id === line.productId);
                if (!product) return null;
                const unitPrice = lineUnitPrice(line, product, addons);
                return (
                  <div
                    className="cart-item"
                    key={makeCartKey(line.productId, line.addonIds, line.note)}
                  >
                    <div className="cart-thumbnail">
                      <Image src={product.image} alt="" fill unoptimized sizes="64px" />
                    </div>
                    <div className="cart-item-copy">
                      <strong>{product.name}</strong>
                      <span>{formatPrice(unitPrice)}</span>
                      {lineAddons(line, addons).length > 0 && (
                        <small className="cart-item-addon">
                          + {lineAddons(line, addons).map((addon) => addon.name).join(", ")}
                        </small>
                      )}
                      {line.note && <small className="cart-item-note">Obs.: {line.note}</small>}
                    </div>
                    <div className="cart-quantity">
                      <button
                        type="button"
                        onClick={() => changeCartLine(line.productId, line.addonIds, line.note, -1)}
                        aria-label={`Diminuir quantidade de ${product.name}`}
                      >
                        <Icon name="minus" size={14} />
                      </button>
                      <span>{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => changeCartLine(line.productId, line.addonIds, line.note, 1)}
                        aria-label={`Aumentar quantidade de ${product.name}`}
                      >
                        <Icon name="plus" size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="cart-summary">
              <div><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div>
              <div><span>Entrega</span><strong>{formatPrice(deliveryFee)}</strong></div>
              <div className="cart-total"><span>Total</span><strong>{formatPrice(subtotal + deliveryFee)}</strong></div>
            </div>
            <div className="checkout-address">
              <Icon name="pin" size={18} />
              <span>Entregar em <strong>{deliveryAddress}</strong></span>
              <button type="button" onClick={openAddressEditor}>Alterar</button>
            </div>
            {checkoutError && <p className="auth-feedback error" role="alert">{checkoutError}</p>}
            <button
              className="checkout-button"
              type="button"
              onClick={requestOrderConfirmation}
              disabled={checkoutLoading || cartCount === 0}
            >
              <span>Fazer pedido</span>
              <span>{formatPrice(subtotal + deliveryFee)}</span>
            </button>
          </section>
        </div>
      )}

      {orderConfirmation && (
        <div className="order-confirmation-toast" role="status" aria-live="polite">
          <span className="new-order-toast-icon"><Icon name="check" size={20} /></span>
          <div className="new-order-toast-copy">
            <strong>Pedido #{String(orderConfirmation.id).padStart(4, "0")} confirmado!</strong>
            <span>Acompanhe em Pedidos ou envie o resumo no WhatsApp.</span>
          </div>
          <button
            className="new-order-toast-view"
            type="button"
            onClick={() => {
              cancelWhatsappRedirect();
              setOrderConfirmation(null);
              setActiveTab("Pedidos");
            }}
          >
            Ver pedidos
          </button>
          <button
            className="new-order-toast-close"
            type="button"
            onClick={() => {
              cancelWhatsappRedirect();
              setOrderConfirmation(null);
            }}
            aria-label="Fechar confirmação do pedido"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      {newOrderAlert && isAdmin && (
        <div className="new-order-toast" role="status" aria-live="polite">
          <span className="new-order-toast-icon"><Icon name="receipt" size={20} /></span>
          <div className="new-order-toast-copy">
            <strong>Novo pedido #{String(newOrderAlert.id).padStart(4, "0")}</strong>
            <span>
              {newOrderAlert.customer_name || newOrderAlert.customer_email} ·{" "}
              {formatPrice(newOrderAlert.total_cents / 100)}
            </span>
          </div>
          <button className="new-order-toast-view" type="button" onClick={showNewOrders}>
            Ver
          </button>
          <button
            className="new-order-toast-close"
            type="button"
            onClick={() => setNewOrderAlert(null)}
            aria-label="Fechar aviso de novo pedido"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      <footer className="site-footer">
        <span>Brasa &amp; Pão · Cardápio digital</span>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("cardapio:open-cookie-settings"))}
        >
          Preferências de cookies
        </button>
      </footer>
      <CookieConsent />
      <MetaPixel />
    </div>
  );
}
