export async function GET() {
  const version = process.env.VERCEL_GIT_COMMIT_SHA || "dev";
  return Response.json(
    { version },
    { headers: { "Cache-Control": "no-store" } },
  );
}
