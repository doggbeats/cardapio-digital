import { randomUUID } from "node:crypto";
import { getServiceClient, requireAdmin } from "../../../../lib/admin-server";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (!(await requireAdmin(request))) return errorResponse("Não autorizado.", 401);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse("Arquivo inválido.", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) return errorResponse("Selecione uma imagem.", 400);
  if (!ALLOWED_TYPES.has(file.type)) {
    return errorResponse("Use uma imagem JPG, PNG, WEBP ou GIF.", 400);
  }
  if (file.size > MAX_BYTES) {
    return errorResponse("A imagem deve ter no máximo 5 MB.", 400);
  }

  const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const path = `${randomUUID()}.${extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const storage = getServiceClient().storage.from("product-images");

  const { error } = await storage.upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return errorResponse(error.message, 400);

  const { data } = storage.getPublicUrl(path);
  return Response.json({ url: data.publicUrl }, { status: 201 });
}
