# Dendrite (optionnel — profil `matrix`)

Le chat VECTRACOM fonctionne **sans Dendrite** via Nest + Postgres
(`GET/POST /api/v1/chat/...`). Dendrite est prévu pour un miroir Matrix plus tard.

## Activer Dendrite (dev)

1. Générer les clés (une fois, depuis la racine du repo) :

```bash
mkdir -p infra/dendrite
docker run --rm --entrypoint="" -v "%cd%/infra/dendrite:/mnt" matrixdotorg/dendrite-monolith:latest \
  /usr/bin/generate-keys -private-key /mnt/matrix_key.pem -tls-cert /mnt/server.crt -tls-key /mnt/server.key
```

2. Copier `dendrite.yaml.example` → `dendrite.yaml` et ajuster si besoin.

3. Lancer :

```bash
docker compose --profile matrix up -d dendrite
```

4. Dans le `.env` backend :

```
MATRIX_HOMESERVER=http://localhost:8008
```

5. Vérifier : `GET /api/v1/chat/matrix/ping`
