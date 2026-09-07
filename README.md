# VECTRACOM

Plateforme SaaS multi-tenant de gestion des opérations terrain pour sous-traitants télécom (SONATEL).  
Client pilote : **ONECOMIT** · Éditeur : **Green-T**.

## Installation rapide

### Prérequis
- Node.js 20+
- Docker Desktop (PostgreSQL + Redis)
- Expo Go (SDK 57) sur le téléphone

```bash
git clone https://github.com/11Blocks/vectracom.git
cd vectracom
npm install
docker compose up -d postgres redis
cp .env.example .env   # adapter si besoin
```

### Backend (API NestJS — port 3100)

```bash
cd backend
npm install
npm run dev
# → http://localhost:3100/api/v1
```

### Web Admin (Next.js — port 3001)

```bash
cd web-admin
npm install
npm run dev
# → http://localhost:3001
```

### Mobile (Expo)

1. Dans `mobile/app.json`, mets ton IP LAN :
   `"apiUrl": "http://<TON_IP_LAN>:3100/api/v1"`
2. Lance Metro :

```bash
cd mobile
npm install
npm start
# ou : npx expo start --lan
```

3. Ouvre **Expo Go** sur le téléphone (même Wi‑Fi que le PC)
4. Scanne le QR code affiché par Metro, **ou** saisis :
   `exp://<TON_IP_LAN>:8081`

## Comptes de test (ONECOMIT)

| Rôle | Email | Mot de passe |
|------|--------|--------------|
| Admin tenant | `admin@onecomit.sn` | `ChangeMe!2026` |

> Utilise ce compte pour le web et le mobile.

## Démarrage en 3 commandes

Depuis la racine du repo (Docker déjà up) :

```bash
cd backend && npm run dev
cd web-admin && npm run dev
cd mobile && npm start
```

## Stock API (rappel)

Les routes stock sont préfixées (pas `/stock`) :
- `GET /api/v1/stock-items`
- `GET /api/v1/warehouses`
- `GET /api/v1/stock-movements`

## Docs

- [INSTALL.md](./INSTALL.md) · [USER_GUIDE.md](./USER_GUIDE.md) · [API_GUIDE.md](./API_GUIDE.md) · [AGENT.md](./AGENT.md)

## Licence

© 2026 Green-T. Tous droits réservés.
