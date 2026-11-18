import { getServiceClient, requireAdmin } from "../../../lib/admin-server";

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function GET(request: Request) {
  if (!(await requireAdmin(request))) return errorResponse("Não autorizado.", 401);

  const { data, error } = await getServiceClient()
    .from("product_addons")
    .select("*")
    .order("name", { ascending: true });
  if (error) return errorResponse(error.message, 400);
  return Response.json({ addons: data });
}

export async function POST(request: Request) {
  if (!(await requireAdmin(request))) return errorResponse("Não autorizado.", 401);

  let body: { name?: unknown; price_cents?: unknown };
  try {
    body = (await request.json()) as { name?: unknown; price_cents?: unknown };
  } catch {
    return errorResponse("Corpo inválido.", 400);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const priceCents =
    typeof body.price_cents === "number" ? Math.round(body.price_cents) : Number.NaN;

  if (!name) return errorResponse("Informe o nome do adicional.", 400);
  if (name.length > 40) return errorResponse("Use no máximo 40 caracteres.", 400);
  if (!Number.isFinite(priceCents) || priceCents <= 0) {
    return errorResponse("Informe um preço válido para o adicional.", 400);
  }
  if (priceCents > 100000) return errorResponse("Preço muito alto.", 400);

  const { data, error } = await getServiceClient()
    .from("product_addons")
    .insert({ name, price_cents: priceCents })
    .select()
    .single();
  if (error?.code === "23505") {
    return errorResponse("Já existe um adicional com esse nome.", 400);
  }
  if (error) return errorResponse(error.message, 400);
  return Response.json({ addon: data }, { status: 201 });
}
