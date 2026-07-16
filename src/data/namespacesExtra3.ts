/** Item 6: real creation timestamps (ISO) per namespace, used to compute non-prod expiration countdowns. */
export const namespaceCreatedAt: Record<string, string> = {
  'commerce-prod': '2026-04-12T09:12:00',
  'data-sandbox': '2026-06-29T11:00:00',
  'growth-preview': '2026-07-11T08:00:00',
}

export const NON_PROD_TTL_DAYS = 14
export const RENEWAL_EXTENSION_DAYS = 14

/** Item 7: simulated RBAC — mock users, roles and per-namespace bindings (read-only viewer). */
export type RbacRole = 'admin' | 'developer' | 'readonly'

export interface RbacBinding { user: string; role: RbacRole; namespace: string }

export const mockRbacUsers = ['ana.silva', 'bruno.costa', 'carla.mendes', 'diego.alves', 'elisa.rocha']

export const rbacBindings: RbacBinding[] = [
  { user: 'ana.silva', role: 'admin', namespace: 'commerce-prod' },
  { user: 'bruno.costa', role: 'developer', namespace: 'commerce-prod' },
  { user: 'carla.mendes', role: 'readonly', namespace: 'commerce-prod' },
  { user: 'diego.alves', role: 'admin', namespace: 'data-sandbox' },
  { user: 'elisa.rocha', role: 'developer', namespace: 'data-sandbox' },
  { user: 'bruno.costa', role: 'developer', namespace: 'growth-preview' },
  { user: 'carla.mendes', role: 'admin', namespace: 'growth-preview' },
]

/** Item 8: mock Helm-style release history per namespace. */
export interface NamespaceRelease { release: string; version: string; date: string }

export const namespaceReleases: Record<string, NamespaceRelease[]> = {
  'commerce-prod': [
    { release: 'checkout-api', version: 'v2.4.1', date: '02/07/2026' },
    { release: 'checkout-api', version: 'v2.3.0', date: '15/05/2026' },
    { release: 'catalog-svc', version: 'v1.9.2', date: '20/04/2026' },
    { release: 'catalog-svc', version: 'v1.9.0', date: '13/04/2026' },
  ],
  'data-sandbox': [
    { release: 'etl-pipeline', version: 'v0.8.0', date: '30/06/2026' },
    { release: 'etl-pipeline', version: 'v0.7.1', date: '29/06/2026' },
  ],
  'growth-preview': [
    { release: 'growth-preview-app', version: 'v0.1.0', date: '11/07/2026' },
  ],
}
