import type { SaleOrder } from "./database.types";
import {
  formatStoreOrderMessage,
  type WhatsAppNotificationResult,
} from "./order-summary";

export type { WhatsAppNotificationResult };

/**
 * Envia o resumo do pedido para o WhatsApp da loja via WhatsApp Cloud API.
 * Sem credenciais configuradas, a API retorna "not_configured" e o cliente
 * abre o link wa.me com a mensagem pronta como alternativa.
 */
export async function notifyStoreOnWhatsApp(
  order: SaleOrder,
): Promise<WhatsAppNotificationResult> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const storePhone = process.env.WHATSAPP_STORE_PHONE_NUMBER;

  if (!accessToken || !phoneNumberId || !storePhone) return "not_configured";

  const apiVersion = process.env.WHATSAPP_API_VERSION || "v23.0";
  const recipient = storePhone.replace(/\D/g, "");
  if (!recipient) return "failed";

  try {
    const response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: recipient,
          type: "text",
          text: { body: formatStoreOrderMessage(order) },
        }),
      },
    );

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      console.error(`WhatsApp API retornou ${response.status}: ${details.slice(0, 500)}`);
      return "failed";
    }

    return "sent";
  } catch (error) {
    console.error("Falha ao enviar resumo do pedido pelo WhatsApp:", error);
    return "failed";
  }
}
