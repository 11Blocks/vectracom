# AGENT.md — VECTRACOM 1.0 (Référence rapide)

> Ce fichier est la référence synthétique du projet pour tout développeur ou IA qui reprend le code.
> Sources : dossiers `vectracom 1` (initial) et `vectracom latest` (version finale, à jour du 28/08).

## 1. Vue d'ensemble

VECTRACOM est une plateforme SaaS multi-tenant de gestion des opérations terrain pour les sous-traitants télécom (SONATEL), éditée par Green-T, avec ONECOMIT (3STB) comme client pilote. Elle couvre le cycle complet : import planning SONATEL → missions terrain offline-first → preuves, stock, facturation → KPI, incidents, IA Vision. Philosophie : « Si le chef d'équipe n'utilise pas l'application chaque jour, le reste ne crée pas de valeur. »

## 2. Les 20 modules finaux

1. Authentification & rôles (7 rôles, Console Green-T) — 2. Équipes & Techniciens (binômes, compétences) — 3. Planning + Import SONATEL — 4. Missions — Formulaire dynamique (11 types) — 5. Fiches de chantier numériques — 6. Stock (CONSUMABLE/ASSET, bordereau 3STB) — 7. Véhicules (fusion stock mobile) — 8. Conformité SONATEL — 9. RH (employés, congés, présence) — 10. Comptabilité opérationnelle — 11. Facturation client (ONECOMIT → SONATEL) — 12. Rapports (5 prédéfinis) — 13. KPI SONATEL — 14. Notifications (5 actives) — 15. Couche IA (9 agents) — 16. Incidents & Alertes Réseau (PIO/PBO/Chambre) — 17. IA Vision (YOLO + Gemini) — 18. Abonnements SaaS (Green-T → Clients) — 19. Business Monitoring — 20. Plateforme Monitoring.

## 3. Les 7 rôles

| Rôle | Périmètre |
|---|---|
| `super_admin` | Green-T — tenants + business monitoring |
| `finance_admin` | Factures, paiements, relances, abonnements |
| `support_admin` | Support clients, tickets |
| `admin` | Configuration, équipes, planning, RH, conformité |
| `direction` | Dashboard, rapports, validation, KPI |
| `chef_equipe` | Planning perso, exécution missions, stock, véhicule, RH perso |
| `magasinier` | Entrées/sorties/transferts stock, prêts outillage |

## 4. Les 11 types de missions

DÉPLOIEMENT, DENSIFICATION, INSTALLATION, SURVEY, SURVEY_OSM, SAV, INFRA, OSM, GC, PLANTATION, DEVOIEMENT.

**DÉPLOIEMENT vs DENSIFICATION** : DÉPLOIEMENT = nouvelle zone (nouvelle cité) — pas de client final, pas de signature, photos Avant/Pendant/Après. DENSIFICATION = ajout de points de branchement en zone existante saturée — client final + signature + 4 photos. Compétences d'équipe distinctes (Deploiement vs Densif FTTH).

## 5. Chef d'équipe / binôme

Un binôme SONATEL = 2 techniciens. `is_team_leader` (boolean) désigne le responsable du rapport de mission et de la saisie terrain (principal utilisateur mobile) ; le second est rattaché via `team_leader_id` et peut n'avoir aucun compte (`user_id` optionnel). Mission : `team_id` obligatoire + `technician_ids[]` souple (0, 1 ou 2).

## 6. Charte graphique

| Usage | Couleur | Hex |
|---|---|---|
| Système / validation | Vert menthe | `#0f9d70` |
| IA / suggestion | **Ambre — EXCLUSIF IA** | `#f5a623` |
| Échéance critique (<7j) | Rouge | `#C0392B` |
| Échéance 7-30j | Orange | `#D9822B` |
| Fond / texte | Noir profond / blanc | `#0a0f0d` / `#e8ede9` |

**Règle stricte : l'ambre est réservé aux sorties IA. Jamais pour une alerte calculée** (rouge/orange/vert).

## 7. Workflow IA Vision

Photo (WhatsApp « Remontée » ou mobile + GPS + annotation) → **YOLOv8** (détection rapide objets : PBO, poteau, câble) → **Gemini** (analyse contextuelle, OCR, classification PBO/PIO/Chambre, scores de confiance) → proposition d'intervention → **validation humaine obligatoire** (l'IA propose, ne décide jamais) → correction éventuelle → `incident_feedback` → **Active Learning** (réentraînement périodique, précision > 95 % visée à 3 mois). Inclus dans le forfait de base.

## 8. Les 5 notifications actives (push/WhatsApp)

1. Attribution d'intervention urgente → push technicien
2. Échéance légale/sécurité (véhicule, habilitation) → in-app + WhatsApp manager, J-7 puis J-1
3. Rupture de stock seuil critique → in-app magasinier
4. Signalement d'incident critique → push admins
5. Relance de paiement (J+15/J+20/J+30) → email + WhatsApp client

Tout le reste est explicitement exclu (confirmations, statuts mineurs, résumés quotidiens).

## 9. Blocage progressif des accès (impayé SaaS)

| Échéance | Statut | Accès |
|---|---|---|
| J+0 | `RETARD_J1` | Complet |
| J+15 | `RETARD_J15` | Complet (relance auto) |
| J+20 | `RETARD_J20` | **Lecture seule** (mobile/web/API) |
| J+30 | `SUSPENDU` | Bloqué, données archivées |
| J+60 | `RESILIE` | Bloqué + purge |

## 10. Incidents — 3 rubriques

- **PBO** (boîtes raccordement) : DESORGANISE, SANS_COUVERCLE, ENDOMAGE, CABLE_DESORDRE
- **PIO** (poteaux, câbles, accessoires) : POTEAU_A_TERRE, POTEAU_INCLINE, CABLE_PENDANT, CABLE_COUPE
- **Chambre** (caniveaux, BPE) : BOUCHEE, ENDOMAGEE, INONDEE, ACCESSIBLE

Statuts : signalement → en_cours → en_attente → corrige → cloture (rapport PDF). Un incident peut générer des missions SAV liées.

## 11. Structure tarifaire SaaS (FCFA HT)

**Licences/mois** : Mobile 10 000 · Web 25 000 · Dashboard RAG 15 000 · Géolocalisation 5 000.
**Frais uniques** : Onboarding 350 000 · Plateforme annuelle 300 000.
**Options/mois** : IA Vision PBO 50 000 · Pré-audit photo 20 000 · Agent Planning avancé 30 000 · Raccourci vocal 10 000.
**Dépassements** : photos 5 000/10 000 (base 10 000/mois) · requêtes IA 500/unité (base 100/mois) · stockage 10 000/10 GB (base 10 GB) · API 1 000/1 000 requêtes (base 500/jour). Forfait Premium disponible (100 000 photos, 1 000 IA, 50 GB, 5 000 API/jour).

## 12. Base de données — 47 tables

Auth/tenant : `companies`, `users` · Équipes : `teams`, `technicians` · Planning/Missions : `sonatel_column_mappings`, `mission_type_templates`, `missions`, `mission_field_reports` · Stock/Véhicules : `warehouses`, `stock_items`, `item_serials`, `item_batches`, `stock_levels`, `stock_movements`, `price_items`, `vehicles`, `vehicle_checks`, `vehicle_documents` · Conformité : `compliance_checklist_templates`, `compliance_records`, `company_compliance_documents` · RH : `employees`, `leave_requests`, `attendance` · Compta/Facturation : `expenses`, `invoices`, `invoice_lines`, `invoice_penalties`, `invoices_saas`, `saas_transactions` · KPI : `sonatel_kpi_logs`, `sonatel_kpi_alerts` · Incidents/IA Vision : `incidents`, `incident_ai_analysis`, `incident_feedback` · SaaS : `saas_plans`, `saas_addons`, `saas_limits`, `company_subscriptions`, `saas_usage_tracking`, `saas_overage_bills` · Monitoring : `platform_monitoring_logs`, `geolocation_tracking` · Audit/Notifs : `notifications`, `notification_settings`, `push_tokens`, `audit_logs`, `rag_conversations`, `rag_messages`, `site_checklist_templates`.

Toute table métier hérite de `BaseEntity` (`companyId` + `TenantGuard`).

## 13. Principes transverses

- **Multi-tenant strict** : `companyId` + `TenantGuard` sur chaque requête ; JWT scopé par entreprise.
- **Offline-first mobile** : WatermelonDB + SyncQueue, écriture locale d'abord, sync arrière-plan, retry ×3, photos purgées 48 h après sync.
- **L'IA propose, jamais ne décide** : validation humaine systématique.
- **Mobile ultra-léger** : < 40 Mo, ouverture < 1 s, **max 4 onglets par rôle**, code splitting par rôle.
- **Stack** : NestJS 10 + PostgreSQL/TypeORM + Redis 7 · Next.js (App Router) · React Native/Expo + WatermelonDB · YOLOv8 + Gemini · Docker.
- Hors périmètre V1 : paiement en ligne (Stripe → V2), signature électronique légale (capture dessinée seulement).

## 14. Ordre de développement (16 phases, ~30 semaines)

1. Socle (Auth, tenants, infra) – 2 sem. · 2. Planning & Import SONATEL – 2 · 3. Missions & formulaire dynamique – 3 · 4. Équipes & Techniciens – 2 · 5. Stock & Bordereau – 2 · 6. Véhicules – 1 · 7. Conformité & Fiches chantier – 1 · 8. RH & Comptabilité – 1 · 9. Facturation client – 2 · 10. KPI SONATEL – 2 · 11. Rapports (5) – 1 · 12. Incidents & IA Vision – 2 · 13. SaaS – 3 · 14. Business & Platform Monitoring – 2 · 15. Notifications & IA – 2 · 16. Intégration & Recette – 2.
