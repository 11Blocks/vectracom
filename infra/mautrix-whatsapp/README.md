# Mautrix WhatsApp — pont Remontée (profil Docker `remontee`)

Le chat Remontée VECTRACOM fonctionne **sans** WhatsApp via Nest + Postgres.
Ce profil branche un téléphone WhatsApp (via [mautrix-whatsapp](https://docs.mau.fi/bridges/go/whatsapp/index.html))
pour faire entrer les messages du **groupe Remontée** dans VECTRACOM.

## Architecture

```
Groupe WA « Remontée »
    → mautrix-whatsapp → Matrix (Dendrite, profil matrix)
    → forwarder (script / bot) → POST /api/v1/remontee/ingest
         ├─ salon chat Remontée (source=whatsapp)
         └─ si photo → IA Vision → incident signalement + message système
```

Sans mautrix : tester avec `POST /api/v1/remontee/simulate` (JWT admin).

## Variables `.env` backend

```env
REMONTEE_BRIDGE_SECRET=change-me-long-random
REMONTEE_WHATSAPP_GROUP=Remontée
# Optionnel si Dendrite :
MATRIX_HOMESERVER=http://localhost:8008
```

## Démarrage (ops)

1. Dendrite (une fois) — voir `infra/dendrite/README.md` :

```bash
docker compose --profile matrix up -d dendrite
```

2. Générer la config mautrix (premier run) :

```bash
mkdir -p infra/mautrix-whatsapp
docker run --rm -v "%cd%/infra/mautrix-whatsapp:/data" dock.mau.dev/mautrix/whatsapp:latest
# Édite config.yaml : homeserver address, database (postgres), permissions
```

Points critiques dans `config.yaml` :

- `homeserver.address` → URL Dendrite (ex. `http://dendrite:8008` en réseau compose)
- Filtrer / ne bridger **que** le groupe nommé comme `REMONTEE_WHATSAPP_GROUP` (Remontée)
- Ne pas exposer le bridge hors réseau privé

3. Lancer le bridge :

```bash
docker compose --profile remontee up -d mautrix-whatsapp
```

4. Login QR WhatsApp :

```bash
docker logs -f vectracom-mautrix-whatsapp
# Suivre les instructions mautrix : !wa login dans Matrix, scanner le QR
```

5. Forward vers Nest — après chaque message Matrix du room Remontée, appeler :

```bash
curl -s -X POST http://localhost:3100/api/v1/remontee/ingest \
  -H "Content-Type: application/json" \
  -H "X-Remontee-Secret: $REMONTEE_BRIDGE_SECRET" \
  -d "{
    \"companyId\": \"<uuid-tenant>\",
    \"text\": \"PBO cassé zone X\",
    \"photoUrl\": \"https://…/photo.jpg\",
    \"senderName\": \"+22177…\",
    \"groupName\": \"Remontée\"
  }"
```

Exemple sans photo (texte seul) : omettre `photoUrl` / `runVision`.

## Simulation admin (sans WhatsApp)

```bash
curl -s -X POST http://localhost:3100/api/v1/remontee/simulate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"Test Remontée\",\"senderName\":\"Ops\"}"
```

Avec photo (déclenche IA Vision) :

```bash
curl -s -X POST http://localhost:3100/api/v1/remontee/simulate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"PBO 12\",\"photoUrl\":\"https://…/img.jpg\",\"runVision\":true}"
```

## Status

`GET /api/v1/remontee/status` (public) — indique si le secret est configuré.

## Re-link / perte de session

Si le téléphone se déconnecte : `!wa login` à nouveau, rescanner le QR.
Ne jamais partager `REMONTEE_BRIDGE_SECRET` ni les credentials mautrix.

## Settings VECTRACOM

- Notifications sortantes WhatsApp Business (`WHATSAPP_TOKEN`) = **autre** canal (alertes).
- Remontée = **ingress** via ce bridge (groupe terrain → salon Messages).
- Activer `whatsappEnabled` dans les settings notif seulement pour l’envoi Business API, pas pour l’ingest Remontée.
