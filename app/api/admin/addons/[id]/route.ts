import { getServiceClient, requireAdmin } from "../../../../lib/admin-server";

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(request))) return errorResponse("Não autorizado.", 401);

  const { id } = await ctx.params;
  const addonId = Number(id);
  if (!Number.isInteger(addonId) || addonId <= 0) {
    return errorResponse("ID inválido.", 400);
  }

  const { error } = await getServiceClient().from("product_addons").delete().eq("id", addonId);
  if (error) return errorResponse(error.message, 400);
  return Response.json({ ok: true });
}
