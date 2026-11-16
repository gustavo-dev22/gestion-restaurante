import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeLocal } from "@/lib/rbac";
import { idSchema } from "@/lib/api-validation";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeLocal(request, "products:manage");
  if (auth instanceof NextResponse) return auth;

  const { id: rawId } = await params;
  const parsed = idSchema.safeParse(rawId);
  if (!parsed.success) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const historial = await prisma.productoPrecioHistorial.findMany({
    where: { productoId: parsed.data },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(historial);
}
