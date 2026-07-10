export interface ScalableWorkload {
  id: string
  namespace: string
  minReplicas: number
  maxReplicas: number
  desired: number
  cpuTargetPct: number
  history: number[]
}

export const scalableWorkloads: ScalableWorkload[] = [
  { id: 'checkout-api', namespace: 'commerce', minReplicas: 2, maxReplicas: 20, desired: 6, cpuTargetPct: 70, history: [3, 3, 4, 4, 5, 5, 6] },
  { id: 'payments', namespace: 'finance', minReplicas: 2, maxReplicas: 12, desired: 4, cpuTargetPct: 65, history: [2, 2, 3, 3, 3, 4, 4] },
  { id: 'catalog', namespace: 'commerce', minReplicas: 2, maxReplicas: 10, desired: 3, cpuTargetPct: 60, history: [2, 2, 2, 3, 3, 3, 3] },
  { id: 'worker-queue', namespace: 'jobs', minReplicas: 1, maxReplicas: 8, desired: 2, cpuTargetPct: 75, history: [1, 1, 1, 2, 2, 2, 2] },
]

/** Pre-mapped fake responses for the simulated kubectl terminal on KubernetesPage. */
export const kubectlResponses: Record<string, string> = {
  'kubectl get pods': [
    'NAME                        READY   STATUS       RESTARTS   AGE',
    'checkout-api-7fd8c          1/1     Running      2          3d',
    'payments-5db77              1/1     Running      0          5d',
    'catalog-6c8b9               1/1     Running      1          2d',
    'identity-8fd42              0/1     Pending      0          4m',
    'worker-queue-4ab22          0/1     CrashLoop    12         1d',
  ].join('\n'),
  'kubectl get nodes': [
    'NAME       STATUS   ROLES    AGE   VERSION',
    'node-01    Ready    control   210d  v1.29.4',
    'node-02    Ready    worker    210d  v1.29.4',
    'node-03    Ready    worker    198d  v1.29.4',
    'node-15    Ready    worker    41d   v1.29.4  (82% CPU)',
  ].join('\n'),
  'kubectl get namespaces': [
    'NAME               STATUS   AGE',
    'commerce-prod      Active   112d',
    'data-sandbox       Active   48d',
    'growth-preview     Active   2m',
  ].join('\n'),
  'kubectl get deployments': [
    'NAME            READY   UP-TO-DATE   AVAILABLE   AGE',
    'checkout-api    6/6     6            6           88d',
    'payments        4/4     4            4           110d',
    'catalog         3/3     3            3           64d',
  ].join('\n'),
  'kubectl get services': [
    'NAME            TYPE        CLUSTER-IP     PORT(S)',
    'checkout-api    ClusterIP   10.96.12.4     80/TCP',
    'payments        ClusterIP   10.96.9.2      80/TCP',
    'gateway         LoadBalancer 10.96.0.1     443:31032/TCP',
  ].join('\n'),
  'kubectl version': 'Client Version: v1.29.4\nServer Version: v1.29.2',
  'kubectl cluster-info': 'Kubernetes control plane is running at https://10.0.0.1:6443\nCoreDNS is running at https://10.0.0.1:6443/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy',
  'kubectl describe pod checkout-api-7fd8c': [
    'Name:         checkout-api-7fd8c',
    'Namespace:    commerce',
    'Status:       Running',
    'IP:           10.28.6.14',
    'Containers:',
    '  checkout-api:',
    '    Image:      registry.internal/checkout-api:2.14.3',
    '    State:      Running',
    '    Restarts:   2',
    'Events:',
    '  Normal  Scheduled  3d   default-scheduler  Successfully assigned',
    '  Normal  Pulled     3d   kubelet            Container image pulled',
  ].join('\n'),
  'kubectl describe pod worker-queue-4ab22': [
    'Name:         worker-queue-4ab22',
    'Namespace:    jobs',
    'Status:       CrashLoopBackOff',
    'IP:           10.28.7.22',
    'Containers:',
    '  worker-queue:',
    '    State:       Waiting',
    '    Reason:      CrashLoopBackOff',
    '    Restarts:    12',
    'Events:',
    '  Warning  BackOff  1m (x40 over 1d)  kubelet  Back-off restarting failed container',
  ].join('\n'),
}
