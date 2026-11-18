import { getServiceClient } from "./admin-server";
import { DEFAULT_CATEGORIES } from "./categories";

export async function getCategoryNames() {
  const { data, error } = await getServiceClient()
    .from("product_categories")
    .select("name")
    .order("name", { ascending: true });
  if (error) {
    console.error("Não foi possível carregar as categorias:", error.message);
    return DEFAULT_CATEGORIES;
  }
  return data.map((row) => row.name);
}

export async function isCategoryAllowed(category: string) {
  return (await getCategoryNames()).includes(category);
}
