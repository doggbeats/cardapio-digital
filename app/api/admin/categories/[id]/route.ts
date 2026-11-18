import { getServiceClient, requireAdmin } from "../../../../lib/admin-server";
import { isCategoryAllowed } from "../../../../lib/admin-categories";

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(request))) return errorResponse("Não autorizado.", 401);

  const { id } = await ctx.params;
  const categoryId = Number(id);
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return errorResponse("ID inválido.", 400);
  }

  const supabase = getServiceClient();
  const { data: category, error: fetchError } = await supabase
    .from("product_categories")
    .select("name")
    .eq("id", categoryId)
    .single();
  if (fetchError || !category) return errorResponse("Categoria não encontrada.", 404);

  const { count, error: countError } = await supabase
    .from("menu_catalog")
    .select("id", { count: "exact", head: true })
    .eq("category", category.name);
  if (countError) return errorResponse(countError.message, 400);
  if (count && count > 0) {
    return errorResponse(
      `Não foi possível excluir: ${count} produto${count > 1 ? "s" : ""} usam esta categoria. Mova-os antes.`,
      400,
    );
  }

  const { error } = await supabase.from("product_categories").delete().eq("id", categoryId);
  if (error) return errorResponse(error.message, 400);
  return Response.json({ ok: true });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(request))) return errorResponse("Não autorizado.", 401);

  const { id } = await ctx.params;
  const categoryId = Number(id);
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return errorResponse("ID inválido.", 400);
  }

  let body: { target?: unknown };
  try {
    body = (await request.json()) as { target?: unknown };
  } catch {
    return errorResponse("Corpo inválido.", 400);
  }
  const target = typeof body.target === "string" ? body.target.trim() : "";
  if (!target) return errorResponse("Escolha a categoria de destino.", 400);

  const supabase = getServiceClient();
  const { data: category, error: fetchError } = await supabase
    .from("product_categories")
    .select("name")
    .eq("id", categoryId)
    .single();
  if (fetchError || !category) return errorResponse("Categoria não encontrada.", 404);
  if (category.name === target) {
    return errorResponse("Escolha uma categoria diferente da atual.", 400);
  }
  if (!(await isCategoryAllowed(target))) {
    return errorResponse("A categoria de destino não existe.", 400);
  }

  const { count, error: countError } = await supabase
    .from("menu_catalog")
    .select("id", { count: "exact", head: true })
    .eq("category", category.name);
  if (countError) return errorResponse(countError.message, 400);
  if (!count) return errorResponse("Não há produtos nesta categoria.", 400);

  const { error } = await supabase
    .from("menu_catalog")
    .update({ category: target })
    .eq("category", category.name);
  if (error) return errorResponse(error.message, 400);
  return Response.json({ moved: count });
}
