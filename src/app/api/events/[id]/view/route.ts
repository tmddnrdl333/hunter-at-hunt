import { eq, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) {
    return Response.json({ ok: false }, { status: 400 });
  }
  db.update(schema.events)
    .set({ viewCount: sql`${schema.events.viewCount} + 1` })
    .where(eq(schema.events.id, numId))
    .run();
  return Response.json({ ok: true });
}
