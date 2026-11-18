import type { OrderItem, SaleOrder } from "./database.types";

/** Número da loja em E.164: 55 + DDD 61 + 99289-0326. */
export const STORE_WHATSAPP_NUMBER = "5561992890326";

export type WhatsAppNotificationResult = "sent" | "failed" | "not_configured";

export function formatPrice(price: number) {
  return price.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatOrderItem(item: OrderItem) {
  const addonNames = item.addons?.map((addon) => `+ ${addon.name}`) ?? [];
  if (!item.addons?.length && item.special_sauce) addonNames.push("+ molho especial");
  const details = [...addonNames, item.note ? `obs: ${item.note}` : ""].filter(Boolean);
  return `${item.quantity}× ${item.name}${details.length ? ` (${details.join(", ")})` : ""}`;
}

export function formatStoreOrderMessage(order: SaleOrder) {
  const itemLines = order.items
    .map(
      (item) =>
        `${formatOrderItem(item)} - ${formatPrice((item.unit_price_cents * item.quantity) / 100)}`,
    )
    .join("\n");

  return [
    `🔔 *NOVO PEDIDO #${String(order.id).padStart(4, "0")}*`,
    `Cliente: ${order.customer_name || order.customer_email}`,
    order.customer_phone ? `Telefone: ${order.customer_phone}` : "",
    "",
    "*Itens:*",
    itemLines,
    "",
    `Subtotal: ${formatPrice(order.subtotal_cents / 100)}`,
    `Entrega: ${formatPrice(order.delivery_fee_cents / 100)}`,
    `*Total: ${formatPrice(order.total_cents / 100)}*`,
    "",
    `*Endereço de entrega:* ${order.customer_address}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function getStoreWhatsAppUrl(order: SaleOrder, phone = STORE_WHATSAPP_NUMBER) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(formatStoreOrderMessage(order))}`;
}
