# Trilio Photo Gallery – OpenShift (12-image seed, CSP-safe UI)

**What’s included**
- Node/Express frontend (no inline JS; `app/public/app.js`)
- MySQL schema + seed
- Build-time fetcher to download **12 Trilio blog images** → baked into image (`public/media/*`) and `db/seed.sql`
- OpenShift-ready Deployment with **initContainers that seed from the image** (not ConfigMaps)
- Restricted-v2 compliant security contexts; no `fsGroup`; PVC write enabled via `chmod 0777` in init
- Route at `jeff-trilio-demo.apps.ocp-dev.demo.presales.trilio.io`

## Build & Push (immutable tag recommended)
```bash
cd app
TAG=v$(date +%Y%m%d-%H%M)
docker build -t <YOUR_REGISTRY>/trilio-photo-gallery:$TAG .
docker push <YOUR_REGISTRY>/trilio-photo-gallery:$TAG
```
When building on a M1 Mac, you need to also build for amd64:
```bash
cd app
% docker buildx build . \
  --platform linux/amd64,linux/arm64 \
  -t docker.io/jeffligon/trilio-photo-gallery-demo:latest \
  -t docker.io/jeffligon/trilio-photo-gallery-demo:v1.2 \
  --push
```
## Configure image in k8s/07-frontend-deployment.yaml
Replace `<YOUR_REGISTRY>` and `<TAG>` in **three places** (seed-media, seed-db, and web).

## Deploy to OpenShift
```bash
oc apply -f k8s/00-namespace.yaml
oc apply -f k8s/01-mysql-secret.yaml
oc apply -f k8s/02-mysql-pvc.yaml
oc apply -f k8s/03-mysql-deployment.yaml
oc apply -f k8s/04-media-pvc.yaml
oc apply -f k8s/05-sql-configmap.yaml
oc apply -f k8s/07-frontend-deployment.yaml
oc apply -f k8s/08-route.yaml
```

Wait for pods:
```bash
oc rollout status deploy/trilio-gallery-frontend -n trilio-demo
```

Open:
```
http://jeff-trilio-demo.apps.ocp-dev.demo.presales.trilio.io
```

## Verify seeding worked
```bash
# Expect 12 files:
oc rsh -n trilio-demo deploy/trilio-gallery-frontend -- sh -lc "ls -l /data/media | wc -l; ls -l /data/media | head"

# DB has 12 rows:
oc rsh -n trilio-demo deploy/trilio-gallery-mysql --   sh -lc "mysql -uroot -p'trilio123' -e \"USE triliogallery; SELECT COUNT(*) FROM photos; SELECT title,filename FROM photos LIMIT 5;\""
```

## Notes
- `server.js` adds **no-cache headers** for HTML/JS, so your UI updates appear immediately.
- `imagePullPolicy: Always` forces pulls on every rollout (use immutable tags to be precise).
- `scripts/fetch-seed.mjs` reads `seed-sources.json`, fetches `og:image` (or first `<img>`) and writes `public/media/*` + `db/seed.sql` with correct `size_bytes`.
- If any URL fails at build time, the script logs and continues; you can swap entries in `seed-sources.json`.

## Git Commands
```bash
# Make sure everything is committed first
git add -A
git commit -m "Stable working version with seed DB init (2025-08-20)"

# 1. Create a stable branch you can keep working on
git branch stable-20250820
git push -u origin stable-20250820

# 2. Create a tag that freezes *this exact commit forever*
git tag v1.0-stable-20250820
git push origin v1.0-stable-20250820
```

How you use them later

To get the exact snapshot you have now (never changes):
```bash
git checkout v1.0-stable-20250820
```

To get the branch that may include your later tweaks:
```bash
git checkout stable-20250820
git pull
```

Pro tip: you can keep doing this with future stable points. For example:
```bash
git tag v1.1-stable-20250825
git push origin v1.1-stable-20250825
```

## Release Notes
v1.0 Stable - Initial Release (image: docker.io/jeffligon/trilio-photo-gallery-demo:v1.5)
  - Grid works
  - Upload works
  - Simulate disaster works 
Known Issues to fix:
  - Seeded grid photos don't match photo descriptions
  - Simulate disaster works but deletes files out of PVC and database
  - Restore only restores to original grid, any uploaded photos don't remain
 