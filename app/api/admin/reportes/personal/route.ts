import { NextResponse } from 'next/server';
import { getPersonalReport } from '@/lib/reports';

export async function GET() {
  try {
    return NextResponse.json(await getPersonalReport());
  } catch {
    return NextResponse.json({ error: 'Error al generar ranking' }, { status: 500 });
  }
}
