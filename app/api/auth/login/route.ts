import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  const SYSTEM_ID = 13;

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SASI_API}/Auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // Caso: SASI dice que las credenciales no valen
    if (!data.success) {
      return NextResponse.json({ 
        success: false, 
        message: 'Usuario o contraseña incorrectos.' 
      }, { status: 200 }); // Retornamos 200 para no ensuciar consola
    }

    // Caso: Credenciales OK, validamos acceso al Sistema 13
    const tieneAcceso = data.usuario.sistemas.some(
      (s: any) => s.id === SYSTEM_ID && s.activo
    );

    if (!tieneAcceso) {
      return NextResponse.json({ 
        success: false, 
        message: 'Acceso denegado: No tienes permisos para el Sistema de Restaurante.' 
      }, { status: 200 });
    }

    // Caso: Todo perfecto
    return NextResponse.json(data); // Aquí data.success ya es true

  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      message: 'Error de comunicación con SASI' 
    }, { status: 200 });
  }
}