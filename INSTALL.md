# VECTRACOM — Guide d'installation

## Prérequis

| Outil | Version minimale |
|-------|-----------------|
| Node.js | 18.x |
| npm | 9.x |
| Docker | 20.x |
| Docker Compose | 2.x |

## Installation

### 1. Cloner et installer les dépendances

```bash
cd VECTRACOM\ 1.0
npm install
```

### 2. Variables d'environnement

```bash
cp .env.example .env
# Éditer .env avec vos valeurs :
# - JWT_SECRET (obligatoire en production)
# - POSTGRES_PASSWORD
# - GREEN_T_ADMIN_EMAIL / GREEN_T_ADMIN_PASSWORD
```

### 3. Démarrer l'infrastructure

```bash
# PostgreSQL + Redis
docker compose up -d postgres redis

# Vérifier
docker compose ps
```

### 4. Lancer le backend

```bash
npm run backend:dev
# API : http://localhost:3100/api/v1/health
```

### 5. Seeder les données (première fois)

```bash
# Créer le super_admin Green-T
npm run backend:seed

# Tous les seeds (13, ordonnés, idempotents)
cd backend && npx ts-node scripts/seed-all.ts
```

### 6. Vérifier

```bash
curl http://localhost:3100/api/v1/health
# → {"status":"ok","service":"vectracom-backend","db":"up"}
```

## Ports

| Service | Port par défaut |
|---------|----------------|
| PostgreSQL | 5432 (5434 en dev si conflit) |
| Redis | 6379 |
| Backend API | 3100 (dev) / 3000 (prod) |

## Dépannage

| Problème | Solution |
|----------|----------|
| Port 5432 occupé | Changer `POSTGRES_PORT` dans `.env` |
| `EADDRINUSE` | `netstat -ano \| grep :3100` puis tuer le processus |
| Migrations en échec | `docker compose down -v && docker compose up -d postgres` |
| Seeds en échec | Vérifier `DATABASE_URL` dans `backend/.env` |
