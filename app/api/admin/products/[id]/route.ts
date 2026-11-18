import { getServiceClient, requireAdmin } from "../../../../lib/admin-server";
import { isCategoryAllowed } from "../../../../lib/admin-categories";
import { imageForProduct } from "../../../../lib/product-images";

type ProductInput = {
  name?: unknown;
  price_cents?: unknown;
  description?: unknown;
  category?: unknown;
  image?: unknown;
  old_price_cents?: unknown;
  badge?: unknown;
  available?: unknown;
  highlighted?: unknown;
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
  if (
    oldPriceCents !== null &&
    (!Number.isFinite(oldPriceCents) || oldPriceCents <= priceCents)
  ) {
    return "O preço promocional deve ser menor que o preço normal.";
  }
  return {
    name,
    description,
    price_cents: priceCents,
    category,
    image: image || imageForProduct(name, description),
    old_price_cents: oldPriceCents,
    badge: badge || null,
    available: input.available !== false,
    highlighted: input.highlighted === true,
  };
}

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function PUT(request: Request, ctx: RouteContext<"/api/admin/products/[id]">) {
  if (!(await requireAdmin(request))) return errorResponse("Não autorizado.", 401);
  const { id } = await ctx.params;
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) return errorResponse("ID inválido.", 400);

  let body: ProductInput;
  try {
    body = (await request.json()) as ProductInput;
  } catch {
    return errorResponse("Corpo inválido.", 400);
  }
  const values = validate(body);
  if (typeof values === "string") return errorResponse(values, 400);
  if (!(await isCategoryAllowed(values.category))) {
    return errorResponse("Escolha uma categoria válida.", 400);
  }

  const { data, error } = await getServiceClient()
    .from("menu_catalog")
    .update(values)
    .eq("id", productId)
    .select()
    .single();
  if (error) return errorResponse(error.message, 400);
  return Response.json({ product: data });
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/admin/products/[id]">) {
  if (!(await requireAdmin(request))) return errorResponse("Não autorizado.", 401);
  const { id } = await ctx.params;
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) return errorResponse("ID inválido.", 400);

  const { error } = await getServiceClient()
    .from("menu_catalog")
    .delete()
    .eq("id", productId);
  if (error) return errorResponse(error.message, 400);
  return Response.json({ ok: true });
}
