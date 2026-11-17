import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeLocal } from "@/lib/rbac";

export async function GET(request: Request) {
  const auth = await authorizeLocal(request, "inventory:read");
  if (auth instanceof NextResponse) return auth;

  const almacenes = await prisma.almacen.findMany({
    where: { activo: true },
    orderBy: { id: "asc" },
  });
  return NextResponse.json(almacenes);
}
