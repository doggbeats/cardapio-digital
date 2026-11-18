import { getServiceClient, requireAdmin } from "../../../lib/admin-server";

const CATEGORIES = new Set(["Burgers", "Hot Dog", "Combos", "Acompanhamentos", "Bebidas"]);

type ProductInput = {
  name?: unknown;
  price_cents?: unknown;
  description?: unknown;
  category?: unknown;
  image?: unknown;
  old_price_cents?: unknown;
  badge?: unknown;
  available?: unknown;
};

function validate(input: ProductInput) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const category = typeof input.category === "string" ? input.category : "";
  const image = typeof input.image === "string" ? input.image.trim() : "";
  const badge = typeof input.badge === "string" ? input.badge.trim() : "";

  const priceCents =
    typeof input.price_cents === "number" ? Math.round(input.price_cents) : Number.NaN;
  const oldPriceCents =
    input.old_price_cents === null || input.old_price_cents === ""
      ? null
      : typeof input.old_price_cents === "number"
        ? Math.round(input.old_price_cents)
        : Number.NaN;

  if (!name) return "Informe o nome do produto.";
  if (!Number.isFinite(priceCents) || priceCents <= 0) return "Informe um preço válido.";
  if (!CATEGORIES.has(category)) return "Escolha uma categoria válida.";
  if (
    oldPriceCents !== null &&
    (!Number.isFinite(oldPriceCents) || oldPriceCents <= priceCents)
  ) {
    return "O preço promocional deve ser menor que o preço normal.";
  }
  if (!image) return "Informe a URL da imagem.";

  return {
    name,
    description,
    price_cents: priceCents,
    category,
    image,
    old_price_cents: oldPriceCents,
    badge: badge || null,
    available: input.available !== false,
  };
}

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function GET(request: Request) {
  if (!(await requireAdmin(request))) return errorResponse("Não autorizado.", 401);
  const { data, error } = await getServiceClient()
    .from("menu_catalog")
    .select("*")
    .order("id", { ascending: true });
  if (error) return errorResponse(error.message, 400);
  return Response.json({ products: data });
}

export async function POST(request: Request) {
  if (!(await requireAdmin(request))) return errorResponse("Não autorizado.", 401);

  let body: ProductInput;
  try {
    body = (await request.json()) as ProductInput;
  } catch {
    return errorResponse("Corpo inválido.", 400);
  }
  const values = validate(body);
  if (typeof values === "string") return errorResponse(values, 400);

  const { data: next } = await getServiceClient()
    .from("menu_catalog")
    .select("id")
    .order("id", { ascending: false })
    .limit(1);
  const id = (next?.[0]?.id ?? 0) + 1;

  const { data, error } = await getServiceClient()
    .from("menu_catalog")
    .insert({ id, ...values })
    .select()
    .single();
  if (error) return errorResponse(error.message, 400);
  return Response.json({ product: data }, { status: 201 });
}
