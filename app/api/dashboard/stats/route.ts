import { NextResponse } from 'next/server';
import { getDashboardStats } from '@/lib/reports';

export async function GET() {
  try {
    return NextResponse.json(await getDashboardStats());
  } catch {
    return NextResponse.json({ error: 'Error al obtener estadísticas' }, { status: 500 });
  }
}
