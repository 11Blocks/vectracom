# VECTRACOM — Guide API

Base URL : `http://localhost:3100/api/v1`

## Authentification

```bash
# Login
curl -X POST /auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@onecomit.sn", "password": "..."}'
# → { "accessToken": "eyJ...", "user": {...} }

# Utiliser le token
curl -H "Authorization: Bearer <token>" /auth/me
```

## Endpoints principaux

### Auth
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/auth/login` | Connexion (public) |
| POST | `/auth/register` | Créer un tenant (console Green-T) |
| POST | `/auth/forgot-password` | Mot de passe oublié (public) |
| GET | `/auth/me` | Profil courant |

### Planning & Import SONATEL
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/planning/import/preview` | Upload Excel → aperçu |
| POST | `/planning/import/confirm` | Confirmer l'import |
| GET | `/planning/import/mappings` | Mapping colonnes |
| PUT | `/planning/import/mappings` | Personnaliser le mapping |
| GET | `/planning/missions` | Missions (filtres équipe/technicien/période/statut) |

### Missions
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/missions` | Créer une mission |
| GET | `/missions/:id` | Détail |
| PATCH | `/missions/:id/status` | Changer statut |
| POST | `/missions/:id/field-report/step/:stepId` | Sauvegarder une étape (1-6) |
| POST | `/missions/:id/field-report/validate` | Validation interne |
| POST | `/missions/:id/field-report/sonatel-approve` | Approbation SONATEL |
| GET | `/missions/:id/pv-recette` | PV de recette PDF |
| GET | `/mission-templates` | 11 templates |

### Stock
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/warehouses` | Emplacements |
| GET | `/stock-items` | Articles (filtres catégorie/famille/low-stock) |
| POST | `/stock-movements` | Mouvement (entrée/transfert/consommation/…) |
| GET | `/stock-items/low-stock` | Alertes seuil |
| GET | `/price-items` | Bordereau 3STB (52 items) |
| GET | `/price-items/search?q=` | Recherche plein texte |

### Véhicules
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/vehicles` | Liste (filtres équipe/statut/échéance) |
| POST | `/vehicles/:id/checks` | Checklist (1×/jour) |
| GET | `/vehicles/:id/expiry-badges` | Badges rouge/orange/vert |
| GET | `/vehicles/:id/documents` | Pochette digitale |

### Conformité & Fiches chantier
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/compliance/checklists` | Checklists paramétrables |
| GET | `/compliance/records` | Records par équipe |
| GET | `/site-checklists/templates` | 4 templates (OSM/GC/DENSIF/SURVEY_OSM) |
| POST | `/site-checklists/:missionId` | Sauvegarder une fiche |

### RH & Comptabilité
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/employees` | Employés |
| POST | `/leave-requests` | Demande de congé |
| PUT | `/leave-requests/:id/approve` | Valider/refuser |
| POST | `/attendance` | Feuille présence hebdo |
| POST | `/expenses` | Dépense |
| GET | `/expenses/summary?month=` | Synthèse mensuelle |

### Facturation & KPI
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/invoices/generate` | Facture mensuelle |
| PUT | `/invoices/:id/correct` | Correction tracée |
| POST | `/invoices/:id/finalize` | Finaliser |
| POST | `/invoices/:id/export-pdf` | PDF |
| POST | `/invoices/:id/export-excel` | Excel |
| GET | `/kpi-sonatel/dashboard` | 19 KPI temps réel |
| POST | `/kpi-sonatel/recalculate` | Recalcul forcé |
| POST | `/kpi-sonatel/penalties/apply` | Pénalités → facture |

### Incidents & IA Vision
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/incidents` | Signaler un incident |
| PUT | `/incidents/:id/assign` | Assigner une équipe |
| POST | `/incidents/:id/report` | Rapport PDF |
| POST | `/ia-vision/analyze` | Analyser une photo (YOLO+Gemini) |
| PUT | `/ia-vision/validate/:analysisId` | Valider/corriger/rejeter |
| POST | `/ia-vision/feedback/process` | Batch Active Learning |

### Rapports
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/reports/performance` | Missions & techniciens |
| GET | `/reports/olt` | Zones OLT |
| GET | `/reports/stock-vehicles` | Stock & véhicules |
| GET | `/reports/kpi` | KPI + historique 12 mois |
| GET | `/reports/incidents` | Statistiques incidents |
| POST | `/reports/export-pdf` | Export PDF |
| POST | `/reports/export-excel` | Export Excel |

### SaaS (Green-T)
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/saas/plans` | 4 plans tarifaires |
| POST | `/saas/addons/:type/activate` | Activer une option |
| POST | `/saas/licenses/assign` | Attribuer une licence |
| POST | `/saas/invoices/generate` | Facture SaaS |
| PUT | `/saas/invoices/:id/pay` | Marquer payée |

### Monitoring
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/monitoring/status` | Statut plateforme |
| GET | `/monitoring/alerts` | Alertes techniques |
| GET | `/business/dashboard` | KPI business Green-T |

### Notifications & IA
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/notifications` | Liste |
| POST | `/notifications/test` | Test par canal |
| POST | `/notifications/cron/run-daily` | Cron manuel |
| POST | `/ai/terrain/transcribe` | Agent Terrain |
| POST | `/rag/ask` | Dashboard RAG (licencié) |
| POST | `/ai/planning/suggest/:missionId` | Agent Planning |
| POST | `/ai/photo-audit` | Pré-audit photo |
| POST | `/ai/receipt` | Extraction de reçu |
| POST | `/ai/voice-command` | Raccourci vocal |

## Codes d'erreur

| Code | Signification |
|------|---------------|
| 400 | Requête invalide (validation, transition interdite) |
| 401 | Non authentifié / token expiré |
| 403 | Accès refusé (rôle, tenant, blocage J+20/J+30) |
| 404 | Ressource introuvable |
| 409 | Conflit (doublon, déjà existant) |
| 500 | Erreur interne |

## Rate limits (SaaS)

| Statut | Accès |
|--------|-------|
| ACTIF / RETARD_J1 / RETARD_J15 | Complet |
| RETARD_J20 | Lecture seule |
| SUSPENDU / RESILIE | Bloqué |
