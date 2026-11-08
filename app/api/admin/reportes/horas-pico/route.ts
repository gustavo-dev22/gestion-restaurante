import { NextResponse } from 'next/server';
import { getHorasPicoReport } from '@/lib/reports';

export async function GET() {
  try {
    return NextResponse.json(await getHorasPicoReport());
  } catch {
    return NextResponse.json({ error: 'Error al procesar reporte' }, { status: 500 });
  }
}
