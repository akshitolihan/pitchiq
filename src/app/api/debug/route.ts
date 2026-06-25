export const dynamic = "force-dynamic";

export async function GET() {
  const raw = process.env.DATABASE_URL ?? "";
  const codes = Array.from(raw.slice(0, 20)).map(c => c.charCodeAt(0));
  return Response.json({ length: raw.length, first20charCodes: codes, preview: raw.slice(0, 30) });
}
