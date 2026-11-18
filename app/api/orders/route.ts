import { createClient } from "@supabase/supabase-js";

type OrderRequest = {
  items?: unknown;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function notifyWebhook(order: unknown) {
  const webhookUrl = process.env.ORDER_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    const secret = process.env.ORDER_WEBHOOK_SECRET;
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { "X-Webhook-Secret": secret } : {}),
      },
      body: JSON.stringify({ event: "order.created", order }),
    });
    if (!response.ok) {
      console.error(`Webhook de pedido retornou status ${response.status}`);
    }
  } catch (error) {
    console.error("Falha ao enviar webhook de pedido:", error);
  }
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonError("Não autenticado.", 401);
  }

  let body: OrderRequest;
  try {
    body = (await request.json()) as OrderRequest;
  } catch {
    return jsonError("Corpo da requisição inválido.", 400);
  }
  if (!Array.isArray(body.items)) {
    return jsonError("Itens do pedido inválidos.", 400);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return jsonError("Supabase não configurado.", 500);
  }

  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
  });

  const { data: order, error } = await supabase.rpc("place_order", {
    p_items: body.items,
  });
  if (error) {
    return jsonError(error.message, 400);
  }
  if (!order) {
    return jsonError("O Supabase não retornou o pedido criado.", 500);
  }

  await notifyWebhook(order);

  return Response.json({ order });
}
