/** Item 5: mock baseline capacity for the cluster capacity-planning simulator (KubernetesPage). */
export interface ClusterNodeSpec { cpuCores: number; memGiB: number }

export const baseClusterNodeSpec: ClusterNodeSpec = { cpuCores: 32, memGiB: 128 }
export const baseClusterNodeCount = 18
/** Roughly matches the "284/288 pods" and "98,6%" health metrics already shown on the page. */
export const baseClusterUsedCpu = 356
export const baseClusterUsedMem = 1614
