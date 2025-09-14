# Kubernetes Deployment

## Overview
Production-ready Kubernetes deployment with auto-scaling, service mesh, monitoring, and disaster recovery.

## Namespace and RBAC

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: cassandraorm
  labels:
    name: cassandraorm

---
# rbac.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: cassandraorm-sa
  namespace: cassandraorm

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: cassandraorm-role
rules:
- apiGroups: [""]
  resources: ["pods", "services", "endpoints"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments", "statefulsets"]
  verbs: ["get", "list", "watch"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: cassandraorm-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cassandraorm-role
subjects:
- kind: ServiceAccount
  name: cassandraorm-sa
  namespace: cassandraorm
```

## ConfigMaps and Secrets

```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: cassandraorm-config
  namespace: cassandraorm
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  CASSANDRA_KEYSPACE: "production"
  REDIS_DB: "0"
  METRICS_ENABLED: "true"
  TRACING_ENABLED: "true"

---
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: cassandraorm-secrets
  namespace: cassandraorm
type: Opaque
data:
  CASSANDRA_USERNAME: Y2Fzc2FuZHJh
  CASSANDRA_PASSWORD: cGFzc3dvcmQ=
  JWT_SECRET: c3VwZXJzZWNyZXRqd3RrZXk=
  REDIS_PASSWORD: cmVkaXNwYXNzd29yZA==
```

## Application Deployment

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cassandraorm-api
  namespace: cassandraorm
  labels:
    app: cassandraorm-api
    version: v1
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: cassandraorm-api
  template:
    metadata:
      labels:
        app: cassandraorm-api
        version: v1
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3000"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: cassandraorm-sa
      containers:
      - name: api
        image: cassandraorm/api:1.0.0
        imagePullPolicy: Always
        ports:
        - name: http
          containerPort: 3000
          protocol: TCP
        - name: metrics
          containerPort: 9090
          protocol: TCP
        env:
        - name: CASSANDRA_HOSTS
          value: "cassandra-service:9042"
        - name: REDIS_URL
          value: "redis://redis-service:6379"
        envFrom:
        - configMapRef:
            name: cassandraorm-config
        - secretRef:
            name: cassandraorm-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: http
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        volumeMounts:
        - name: config-volume
          mountPath: /app/config
          readOnly: true
      volumes:
      - name: config-volume
        configMap:
          name: cassandraorm-config
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - cassandraorm-api
              topologyKey: kubernetes.io/hostname
```

## Services and Ingress

```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: cassandraorm-api-service
  namespace: cassandraorm
  labels:
    app: cassandraorm-api
spec:
  type: ClusterIP
  ports:
  - name: http
    port: 80
    targetPort: http
    protocol: TCP
  - name: metrics
    port: 9090
    targetPort: metrics
    protocol: TCP
  selector:
    app: cassandraorm-api

---
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: cassandraorm-ingress
  namespace: cassandraorm
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
spec:
  tls:
  - hosts:
    - api.cassandraorm.com
    secretName: cassandraorm-tls
  rules:
  - host: api.cassandraorm.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: cassandraorm-api-service
            port:
              number: 80
```

## Cassandra StatefulSet

```yaml
# cassandra-statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: cassandra
  namespace: cassandraorm
  labels:
    app: cassandra
spec:
  serviceName: cassandra-service
  replicas: 3
  selector:
    matchLabels:
      app: cassandra
  template:
    metadata:
      labels:
        app: cassandra
    spec:
      containers:
      - name: cassandra
        image: cassandra:4.1
        ports:
        - containerPort: 7000
          name: intra-node
        - containerPort: 7001
          name: tls-intra-node
        - containerPort: 7199
          name: jmx
        - containerPort: 9042
          name: cql
        resources:
          limits:
            cpu: "2000m"
            memory: "4Gi"
          requests:
            cpu: "1000m"
            memory: "2Gi"
        securityContext:
          capabilities:
            add:
              - IPC_LOCK
        lifecycle:
          preStop:
            exec:
              command:
              - /bin/sh
              - -c
              - nodetool drain
        env:
        - name: MAX_HEAP_SIZE
          value: 1G
        - name: HEAP_NEWSIZE
          value: 256M
        - name: CASSANDRA_SEEDS
          value: "cassandra-0.cassandra-service.cassandraorm.svc.cluster.local"
        - name: CASSANDRA_CLUSTER_NAME
          value: "K8s-Cluster"
        - name: CASSANDRA_DC
          value: "DC1-K8s"
        - name: CASSANDRA_RACK
          value: "Rack1-K8s"
        - name: POD_IP
          valueFrom:
            fieldRef:
              fieldPath: status.podIP
        readinessProbe:
          exec:
            command:
            - /bin/bash
            - -c
            - /ready-probe.sh
          initialDelaySeconds: 15
          timeoutSeconds: 5
        volumeMounts:
        - name: cassandra-data
          mountPath: /var/lib/cassandra
        - name: cassandra-config
          mountPath: /etc/cassandra
      volumes:
      - name: cassandra-config
        configMap:
          name: cassandra-config
  volumeClaimTemplates:
  - metadata:
      name: cassandra-data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: "fast-ssd"
      resources:
        requests:
          storage: 100Gi

---
# cassandra-service.yaml
apiVersion: v1
kind: Service
metadata:
  labels:
    app: cassandra
  name: cassandra-service
  namespace: cassandraorm
spec:
  clusterIP: None
  ports:
  - port: 9042
    name: cql
  selector:
    app: cassandra
```

## Horizontal Pod Autoscaler

```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: cassandraorm-api-hpa
  namespace: cassandraorm
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: cassandraorm-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "100"
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
```

## Monitoring Stack

```yaml
# monitoring.yaml
apiVersion: v1
kind: ServiceMonitor
metadata:
  name: cassandraorm-api-monitor
  namespace: cassandraorm
  labels:
    app: cassandraorm-api
spec:
  selector:
    matchLabels:
      app: cassandraorm-api
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics

---
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: cassandraorm-alerts
  namespace: cassandraorm
spec:
  groups:
  - name: cassandraorm.rules
    rules:
    - alert: HighErrorRate
      expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "High error rate detected"
        description: "Error rate is {{ $value }} errors per second"
    
    - alert: HighLatency
      expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "High latency detected"
        description: "95th percentile latency is {{ $value }}s"
```

## Network Policies

```yaml
# network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: cassandraorm-network-policy
  namespace: cassandraorm
spec:
  podSelector:
    matchLabels:
      app: cassandraorm-api
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3000
  - from:
    - namespaceSelector:
        matchLabels:
          name: monitoring
    ports:
    - protocol: TCP
      port: 9090
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: cassandra
    ports:
    - protocol: TCP
      port: 9042
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
  - to: []
    ports:
    - protocol: TCP
      port: 53
    - protocol: UDP
      port: 53
```

## Backup and Disaster Recovery

```yaml
# backup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: cassandra-backup
  namespace: cassandraorm
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: cassandraorm/backup:latest
            env:
            - name: CASSANDRA_HOSTS
              value: "cassandra-service:9042"
            - name: S3_BUCKET
              value: "cassandra-backups"
            - name: AWS_REGION
              value: "us-east-1"
            envFrom:
            - secretRef:
                name: backup-secrets
            command:
            - /bin/sh
            - -c
            - |
              echo "Starting backup..."
              nodetool snapshot -t $(date +%Y%m%d_%H%M%S)
              aws s3 sync /var/lib/cassandra/data s3://$S3_BUCKET/$(date +%Y%m%d)/
              echo "Backup completed"
          restartPolicy: OnFailure
          serviceAccountName: backup-sa
```

## Helm Chart

```yaml
# Chart.yaml
apiVersion: v2
name: cassandraorm
description: A Helm chart for CassandraORM
type: application
version: 1.0.0
appVersion: "1.0.0"

# values.yaml
replicaCount: 3

image:
  repository: cassandraorm/api
  pullPolicy: IfNotPresent
  tag: "1.0.0"

service:
  type: ClusterIP
  port: 80

ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: api.cassandraorm.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: cassandraorm-tls
      hosts:
        - api.cassandraorm.com

resources:
  limits:
    cpu: 500m
    memory: 1Gi
  requests:
    cpu: 250m
    memory: 512Mi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70

cassandra:
  enabled: true
  replicas: 3
  storage: 100Gi
  storageClass: fast-ssd
```

## Deployment Commands

```bash
# Apply all manifests
kubectl apply -f k8s/

# Deploy with Helm
helm install cassandraorm ./helm-chart

# Update deployment
kubectl set image deployment/cassandraorm-api api=cassandraorm/api:1.1.0

# Scale deployment
kubectl scale deployment cassandraorm-api --replicas=5

# Check status
kubectl get pods -n cassandraorm
kubectl describe deployment cassandraorm-api -n cassandraorm

# View logs
kubectl logs -f deployment/cassandraorm-api -n cassandraorm

# Port forward for debugging
kubectl port-forward service/cassandraorm-api-service 3000:80 -n cassandraorm
```
