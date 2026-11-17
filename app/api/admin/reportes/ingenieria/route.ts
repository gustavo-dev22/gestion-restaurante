import { NextResponse } from 'next/server';
import { getIngenieriaReport } from '@/lib/reports';

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    return NextResponse.json(await getIngenieriaReport());
  } catch {
    return NextResponse.json({ error: 'Error al calcular matriz' }, { status: 500 });
  }
}
