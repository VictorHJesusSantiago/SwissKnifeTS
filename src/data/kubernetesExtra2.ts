export interface ManifestTemplate { id: string; label: string; content: string }

export const manifestTemplates: ManifestTemplate[] = [
 {
  id: 'deployment',
  label: 'Deployment',
  content: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: sample-app
  labels:
    app: sample-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: sample-app
  template:
    metadata:
      labels:
        app: sample-app
    spec:
      containers:
        - name: sample-app
          image: registry.internal/sample-app:1.0.0
          ports:
            - containerPort: 8080
`,
 },
 {
  id: 'service',
  label: 'Service',
  content: `apiVersion: v1
kind: Service
metadata:
  name: sample-app
spec:
  selector:
    app: sample-app
  ports:
    - port: 80
      targetPort: 8080
  type: ClusterIP
`,
 },
 {
  id: 'configmap',
  label: 'ConfigMap',
  content: `apiVersion: v1
kind: ConfigMap
metadata:
  name: sample-app-config
data:
  LOG_LEVEL: "info"
  FEATURE_FLAG_NEW_UI: "true"
`,
 },
]

export interface RestartingPod { name: string; namespace: string; restarts: number; lastRestart: string }

export const restartingPods: RestartingPod[] = [
 { name: 'worker-queue-4ab22', namespace: 'jobs', restarts: 12, lastRestart: 'há 4 min' },
 { name: 'checkout-api-7fd8c', namespace: 'commerce', restarts: 2, lastRestart: 'há 3 dias' },
 { name: 'payments-webhook-9k2p1', namespace: 'finance', restarts: 6, lastRestart: 'há 2 h' },
 { name: 'catalog-6c8b9', namespace: 'commerce', restarts: 1, lastRestart: 'há 2 dias' },
 { name: 'notifier-cronjob-3xa0', namespace: 'platform', restarts: 8, lastRestart: 'há 40 min' },
]

export interface NamespaceEvent { id: string; type: 'created' | 'scaled' | 'quota' | 'drain' | 'cordon' | 'other'; message: string; time: string }

export const seedNamespaceEvents: Record<string, NamespaceEvent[]> = {
 'commerce-prod': [
  { id: 'e1', type: 'created', message: 'Namespace criado', time: '12/04/2026 09:12' },
  { id: 'e2', type: 'scaled', message: 'checkout-api escalado para 6 réplicas', time: '18/04/2026 14:02' },
  { id: 'e3', type: 'quota', message: 'Quota de CPU ajustada para 8 vCPU', time: '02/05/2026 10:45' },
 ],
 'data-sandbox': [
  { id: 'e1', type: 'created', message: 'Namespace criado', time: '21/05/2026 11:00' },
 ],
 'growth-preview': [
  { id: 'e1', type: 'created', message: 'Namespace criado', time: 'Agora' },
 ],
}

/** Simplified per-namespace manifest text, used for the manifest diff comparison feature. */
export const namespaceManifestSamples: Record<string, string> = {
 'commerce-prod': `apiVersion: v1
kind: Namespace
metadata:
  name: commerce-prod
  labels:
    team: commerce
    environment: producao
spec:
  finalizers:
    - kubernetes
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: commerce-prod-quota
spec:
  hard:
    requests.cpu: "8"
    requests.memory: 16Gi
    persistentvolumeclaims: "10"
`,
 'data-sandbox': `apiVersion: v1
kind: Namespace
metadata:
  name: data-sandbox
  labels:
    team: data-platform
    environment: sandbox
spec:
  finalizers:
    - kubernetes
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: data-sandbox-quota
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    persistentvolumeclaims: "10"
`,
 'growth-preview': `apiVersion: v1
kind: Namespace
metadata:
  name: growth-preview
  labels:
    team: growth
    environment: preview
spec:
  finalizers:
    - kubernetes
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: growth-preview-quota
spec:
  hard:
    requests.cpu: "2"
    requests.memory: 4Gi
    persistentvolumeclaims: "10"
`,
}
