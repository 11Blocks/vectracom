# VECTRACOM — Guide utilisateur

## Connexion

```
POST /api/v1/auth/login
{ "email": "admin@onecomit.sn", "password": "..." }
```

Retourne un JWT à inclure dans `Authorization: Bearer <token>`.

## Rôles et permissions

| Rôle | Périmètre |
|------|-----------|
| `super_admin` | Console Green-T : tenants, abonnements, monitoring |
| `finance_admin` | Factures SaaS, relances, abonnements |
| `support_admin` | Support clients, tickets |
| `admin` | Configuration, équipes, planning, RH, conformité |
| `direction` | Dashboard, rapports, validation, KPI |
| `chef_equipe` | Planning perso, exécution missions, stock camionnette |
| `magasinier` | Entrées/sorties/transferts de stock |

## Modules principaux

### Planning & Import SONATEL
- **Import** : `POST /planning/import/preview` (upload Excel) → aperçu → `POST /confirm`
- **Filtrage ST** : seules les lignes du sous-traitant connecté sont importées
- **Idempotence** : un même n° de dossier n'est jamais dupliqué

### Missions terrain (6 étapes)
1. **SST** (bloquante) : checklist EPI + photo
2. **Identification** : GPS auto, code équipement
3. **Technique** : mesure dBm (alerte si < -25)
4. **Photos** : 4 preuves visuelles + pré-audit IA
5. **Matériel** : items bordereau + échange SAV
6. **Clôture** : signature, score qualité (0-100)

### Stock
- **CONSUMABLE** (quantité) vs **ASSET** (n° de série)
- Mouvements : entrée, transfert, consommation, échange SAV, ajustement, retour
- Alerte seuil : `GET /stock-items/low-stock`

### Véhicules
- Checklist 15 secondes (1×/jour)
- Badges : rouge ≤7j, orange ≤30j, vert
- Fusion stock : un véhicule = un entrepôt VEHICLE

### Facturation (ONECOMIT → SONATEL)
- Génération mensuelle : missions clôturées → lignes par type + bordereau
- Pénalités KPI intégrées automatiquement
- Export PDF (présentation) + Excel (analyse)

### KPI SONATEL (19 indicateurs)
- Production (8), SAV (5), Contrôle (5), Stock (1)
- Dashboard temps réel : `GET /kpi-sonatel/dashboard?period=YYYY-MM`
- Bonus : 3 mois consécutifs à 100 % → 1 M FCFA/point (plafond 5 M)

### Incidents & IA Vision
- Signalement : photo + GPS + annotation (WhatsApp ou mobile)
- IA Vision : YOLO (détection) + Gemini (analyse) → proposition
- **L'IA propose, l'admin valide/corrige/rejette**
- Active Learning : corrections → réentraînement périodique

### Rapports (5)
1. Performance missions & techniciens
2. Activité par zone OLT
3. Usage stock & véhicules
4. KPI SONATEL (synthèse + historique 12 mois)
5. Incidents (statistiques, délais, zones)

## Notifications (5 actives uniquement)

| Type | Canal | Déclencheur |
|------|-------|-------------|
| Mission urgente | Push mobile | Attribution intervention |
| Échéance | In-app + WhatsApp | J-7 puis J-1 (véhicule, habilitation) |
| Rupture stock | In-app | Seuil franchi |
| Incident critique | Push admins | Signalement severity ≥ MAJEUR |
| Relance paiement | Email + WhatsApp | J+15, J+20, J+30 |

## IA (9 agents — toujours en proposition)

L'IA **ne décide jamais seule** : toute suggestion est marquée `requiresHumanValidation: true`.

## SaaS (Green-T)

- **Licences** : Mobile 10 000 · Web 25 000 · RAG 15 000 · Géoloc 5 000 FCFA/mois
- **Options** : IA Vision 50 000 · Pré-audit 20 000 · Planning 30 000 · Vocal 10 000
- **Blocage progressif** : J+20 lecture seule → J+30 suspendu → J+60 résilié
