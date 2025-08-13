# Trilio Photo Gallery – OpenShift Scaffold (two-tier, PVC-backed)

This package is preconfigured for OpenShift with a Route at:
**jeff-trilio-demo.apps.ocp-dev.demo.presales.trilio.io**

## Components
- Frontend (Node/Express) → PVC at `/data/media`
- MySQL 8 → PVC for `/var/lib/mysql`
- InitContainers seed media + DB
- Service is **ClusterIP**, exposed via **Route**
- OpenShift-friendly Dockerfile + pod securityContext (runs as arbitrary UID)

## Build & Push Frontend Image
```bash
cd app
docker build -t <YOUR_REGISTRY>/trilio-photo-gallery:latest .
docker push <YOUR_REGISTRY>/trilio-photo-gallery:latest
```
Then edit `k8s/07-frontend-deployment.yaml` and replace the image `ghcr.io/placeholder/trilio-photo-gallery:latest`.

## Deploy to OpenShift
```bash
oc apply -f k8s/00-namespace.yaml
oc apply -f k8s/01-mysql-secret.yaml
oc apply -f k8s/02-mysql-pvc.yaml
oc apply -f k8s/03-mysql-deployment.yaml
oc apply -f k8s/04-media-pvc.yaml
oc apply -f k8s/05-configmap-sql.yaml
oc apply -f k8s/06-configmap-media.yaml
oc apply -f k8s/07-frontend-deployment.yaml
oc apply -f k8s/08-route.yaml
# Optional (non-OpenShift ingress controllers):
# oc apply -f k8s/09-ingress.yaml
```

Wait for pods:
```bash
oc get pods -n trilio-demo -w
```

Access the app:
```
https://jeff-trilio-demo.apps.ocp-dev.demo.presales.trilio.io
```

## Demo Flow (with TVK)
1. App is pre-populated with seed images & rows.
2. Upload a couple of images (creates new PVC content & DB rows).
3. Create a TVK BackupPlan for namespace `trilio-demo` and take a Backup.
4. Simulate disaster (delete via UI or `oc delete pvc --all -n trilio-demo` / workloads).
5. Restore using TVK; verify images & metadata return.

---
Generated 2025-08-13T00:05:30.156133Z
