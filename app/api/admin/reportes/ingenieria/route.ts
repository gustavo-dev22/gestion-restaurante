import { NextResponse } from 'next/server';
import { getIngenieriaReport } from '@/lib/reports';

export async function GET() {
  try {
    return NextResponse.json(await getIngenieriaReport());
  } catch {
    return NextResponse.json({ error: 'Error al calcular matriz' }, { status: 500 });
  }
}
