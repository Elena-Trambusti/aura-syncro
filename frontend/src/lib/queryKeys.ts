/** Tenant-prefixed React Query key: [tenantKey, ...parts] */
export function tq(tenantKey: string, ...parts: readonly unknown[]) {
  return [tenantKey, ...parts] as const
}
