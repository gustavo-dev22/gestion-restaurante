import type {
  CashAction,
  CashPermissions,
} from "@/lib/auth/cash-permissions";

export function can(
  permissions: CashPermissions,
  path: string,
  action: CashAction
): boolean {
  return Boolean(permissions[path]?.includes(action));
}
