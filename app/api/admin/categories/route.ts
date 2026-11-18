import { getServiceClient, requireAdmin } from "../../../lib/admin-server";

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function GET(request: Request) {
  if (!(await requireAdmin(request))) return errorResponse("Não autorizado.", 401);

  const { data, error } = await getServiceClient()
    .from("product_categories")
    .select("*")
    .order("name", { ascending: true });
  if (error) return errorResponse(error.message, 400);
  return Response.json({ categories: data });
}

export async function POST(request: Request) {
  if (!(await requireAdmin(request))) return errorResponse("Não autorizado.", 401);

  let body: { name?: unknown };
  try {
    body = (await request.json()) as { name?: unknown };
  } catch {
    return errorResponse("Corpo inválido.", 400);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return errorResponse("Informe o nome da categoria.", 400);
  if (name.length > 40) return errorResponse("Use no máximo 40 caracteres.", 400);

  const { data, error } = await getServiceClient()
    .from("product_categories")
    .insert({ name })
    .select()
    .single();
  if (error?.code === "23505") {
    return errorResponse("Já existe uma categoria com esse nome.", 400);
  }
  if (error) return errorResponse(error.message, 400);
  return Response.json({ category: data }, { status: 201 });
}
