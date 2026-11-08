import { NextResponse } from 'next/server';
import { getInventarioReport } from '@/lib/reports';

export async function GET() {
  try {
    return NextResponse.json(await getInventarioReport());
  } catch {
    return NextResponse.json({ error: 'Error al obtener inventario' }, { status: 500 });
  }
}
