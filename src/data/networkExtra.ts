import type { GraphLink } from '../types'

/** Extra link on top of the infra topology (NetworkPage) that closes a demonstrative
 * dependency cycle: VPC-App -> VPC-Data -> DB-Primary -> VPC-App. */
export const extraInfraLinks: GraphLink[] = [
  { source: 'DB-Primary', target: 'VPC-App', value: 18 },
]

/** Extra link on top of serviceLinks (ServicesPage/mockData) that closes a demonstrative
 * dependency cycle: checkout -> payments -> fraud -> checkout. */
export const extraServiceLinks: GraphLink[] = [
  { source: 'fraud', target: 'checkout', value: 22 },
]
