/** Mock "owning team" per topology node id, reused for the ownership map filter (NetworkPage). */
export type NetworkTeam = 'Commerce' | 'IAM' | 'Platform' | 'Data Platform' | 'Growth'

export const nodeOwners: Record<string, NetworkTeam> = {
  Internet: 'Platform',
  WAF: 'Platform',
  'LB-Prod': 'Platform',
  'VPC-App': 'Commerce',
  'VPC-Data': 'Data Platform',
  'NAT-01': 'Platform',
  'DB-Primary': 'Data Platform',
  Redis: 'Data Platform',
  VPN: 'IAM',
}

export const teamColors: Record<NetworkTeam, string> = {
  Commerce: '#4f8cff',
  IAM: '#c084fc',
  Platform: '#34d399',
  'Data Platform': '#f8c56a',
  Growth: '#ff5a3c',
}

export const allTeams: NetworkTeam[] = ['Commerce', 'IAM', 'Platform', 'Data Platform', 'Growth']
