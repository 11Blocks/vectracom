# VECTRACOM — Cahier des charges complémentaire (V1.1)

> Audit du 03/09/2026 — comparaison code produit ↔ pièces jointes contractuelles (cahier des charges V1, référence import SONATEL, annexe Optimax ICP-Pénalités, conformité SONATEL 3 piliers, présentation ONECOMIT, README prototype).
> **Principes intangibles** : le rendu visuel actuel est validé et ne doit pas être modifié ; l'architecture (NestJS + PostgreSQL + Redis multi-tenant, 24 modules, 209 endpoints) est validée et conservée ; le pattern front du prototype (AppShell + Sidebar + composants par module, tableaux filtrables, dialogs, Zustand, design system VECTRACOM, règle ambre = IA) est la référence pour toutes les nouvelles pages.

---

## 0. Constat global

Le backend couvre ~85 % du périmètre documentaire. Le front n'exploite réellement que 13 pages sur 31 ; les autres restent des listes basiques ou des placeholders. Trois Modules backend sont complets mais **jamais branchés en front** (rapports 5 + exports, bordereau de prix 52 items, checklists de chantier). Le module KPI n'implémente que 13 indicateurs sur ~50 définis par l'annexe Optimax.

| Volet | Couverture actuelle | Écart principal |
|---|---|---|
| Backend modules | 24 modules, 209 endpoints | Véhicules (réparations/carburant), incidents→SAV, réaffectation mission, KPI complets |
| Front pages riches | 13/31 | 18 pages basiques ou placeholders |
| KPI Optimax | 13/~50 | Maintenance préventive, événements, contrôle détaillé, ext./densif., stock étendu |
| Bordereau 3STB | Backend complet (recherche, catégories) | Aucune exposition front |
| Rapports | 5 endpoints + PDF/Excel | Page front = placeholder générique |

---

## LOT 1 — Brancher le front sur ce qui existe déjà en backend (aucun dev backend)

### 1.1 Stock (`/stock`) — reproduire le pattern prototype complet
Backend disponible : `stock-items` (CRUD, low-stock), `stock-items/:id/serials`, `stock-items/:id/levels`, `stock-movements` (GET/POST), `warehouses` (CRUD), `stock-serials/:id/traceability`, `price-items` (GET/search/categories).
- Onglets **Consommables / Équipements (sérialisés)**.
- Bouton **Ajouter article** (référence, désignation, catégorie CONSUMABLE/ASSET, famille FIBRE/CUIVRE, unité, seuil).
- Table : Référence · Désignation · **Qté totale** · Seuil alerte · Statut (OK/低 alerte) — comme la maquette prototype.
- Section **Emplacements** : cartes par entrepôt (dépôt central, véhicules, sites) avec quantités par emplacement (`levels`) et articles en alerte par emplacement.
- Section **Mouvements récents** : les 6 types (entrée, transfert, consommation, échange SAV, ajustement, retour) avec dépôt source → destination, note, date — bouton **Enregistrer mouvement** (dialog : type, article, quantité, source, destination, note, mission/technicien optionnels).
- Fiche article (dialog) : niveaux par entrepôt, séries (ASSET) avec statut, bouton **Traçabilité** d'un série (chaîne SONATEL → dépôt → véhicule → consommation).
- Alerte stock faible persistante (badge dans la sidebar + carte dashboard déjà présente).

### 1.2 Bordereau de prix (`/stock/bordereau` ou onglet dans Stock)
Backend : `GET /price-items`, `GET /price-items/search?q=`, `GET /price-items/categories`.
- Table des 52 items 3STB : N° item · Désignation · Unité · PU (FCFA) · Catégorie (OSM, GC, DENSIF…) · Version.
- Recherche plein texte, filtre par catégorie, recherche par N° d'item.

### 1.3 Rapports (`/rapports`) — remplacer le placeholder
Backend : `GET /reports/performance|olt|stock-vehicles|kpi|incidents` + `POST /reports/export-pdf|export-excel`.
- 5 cartes-rapports (Performance, OLT, Stock & Véhicules, KPI SONATEL, Incidents).
- Chaque rapport : période (dates ou mois), rendu Recharts (le pattern dashboard), boutons **Export PDF** / **Export Excel** (téléchargement blob).
- Performance : taux OK/NOK global, classement techniciens/binômes, top 3 motifs NOK.
- OLT : dossiers reçus/exécutés/en attente par zone, taux de réussite (format réunion de cadrage SONATEL).
- Stock & Véhicules : consommé vs installations validées, kilométrage et coûts carburant par véhicule.

### 1.4 Facturation — liste (`/invoices`)
Backend : `POST /invoices/generate` (période), `GET /invoices`.
- Bouton **Générer la facture du mois** (dialog période → brouillon).
- Synthèse du mois par rubrique (PRODUCTION / SAV / TS) avec montants, comme l'attachement ONECOMIT.
- Renvoi vers le détail déjà riche (lignes, corrections, pénalités, exports) — ne pas retoucher le détail validé.

### 1.5 Missions — liste (`/missions`)
Backend : `POST /missions`, `PATCH /missions/:id/status`.
- Onglets par statut avec compteurs (planifiée/en cours/terminée/validée/rejetée/à compléter).
- **Créer une mission** manuelle (client/site, type de tâche, équipe, binôme techniciens, véhicule, date, zone).
- Actions rapides valider/rejeter/attribution, recherche, filtres, lignes cliquables (le détail 6 étapes existe déjà).

### 1.6 Véhicules (`/vehicles`)
Backend : `GET/POST /vehicles/:id/checks`, `GET/POST/DELETE /vehicles/:id/documents`, `GET /vehicles/:id/expiry-badges`.
- Cartes véhicules avec **badges échéances** (rouge <7j, orange <30j, vert) par assurance/visite technique.
- **Checklist de prise de poste** (15 s : huile, eau, freins, pneus, batterie, éclairage, observations, photo) — dialogue à l'ouverture de la première mission du jour.
- **Pochette digitale** : documents (carte grise, assurance, visite technique) consultables, ajout/suppression.
- Historique des checks par véhicule.

### 1.7 Conformité (`/compliance` + `/compliance/checklists`)
Backend : `compliance/records`, `company_compliance_documents`, `site-checklists` templates (GET/POST/PUT par type).
- Dossiers équipe : statuts incomplet/en attente/validé/rejeté/à corriger, pièces manquantes/expirées, observations, actions (relance, mise à jour, export).
- **Éditeur de checklists paramétrables** (page checklists actuelle = placeholder) : templates par type de mission, items, jamais codé en dur.
- **3 piliers contractuels** : Code de Conduite Fournisseur, Directives SST, Gestion déchets D3E — statut signature/dépôt par document entreprise.

### 1.8 Incidents — liste (`/incidents`)
Backend : `POST /incidents`.
- Widget stats (critiques, en cours, signalés, corrigés + par rubrique PBO/PIO/Chambre).
- **Signaler un incident** (rubrique, zone, défaut, sévérité, clients impactés, ND, photos).
- Filtres rubrique/statut/sévérité/zone ; le détail riche existe déjà.

### 1.9 Notifications (`/notifications`)
Backend : `PUT /notifications/settings`, `PUT /notifications/read-all`, `POST /notifications/test`.
- **Marquer tout lu**.
- **Paramètres canaux/types** (push, in-app, WhatsApp ; urgente, échéance, rupture, incident, relance paiement) + bouton test.

### 1.10 Assistant IA / Dashboard RAG (`/assistant`)
Backend : `POST /rag/ask`, `GET /rag/conversations[/:id]`.
- Chat Agent Direction : bulles, conversations persistées, questions suggérées (« Quelles équipes sont en retard ? », « Combien de véhicules à contrôler ? »). Sorties IA en ambre.

### 1.11 Géolocalisation (`/geolocation`)
Backend : module geolocation (positions, historique).
- Vue liste/cartes des positions des techniciens, fraîcheur du point, badge option payante (pattern déjà posé par les licences GEOLOCATION).

### 1.12 IA Vision — boucle complète (`/ia-vision`, `/ia-vision/feedback`)
Backend : `POST /ia-vision/analyze`, `GET /ia-vision/analyses`, `PUT /ia-vision/validate/:id`, `GET /ia-vision/feedback`, `POST /ia-vision/feedback/process`, `POST /ia-vision/retrain`.
- Page analyses : photo, détection (rubrique, référence, défaut, GPS), confiance, boutons Valider / Corriger / Rejeter (correction → feedback).
- Page feedback (placeholder actuel) : historique des corrections, précision IA, boutons **Traiter le feedback** et **Relancer l'entraînement** (Active Learning).

### 1.13 Monitoring (`/monitoring`, `/monitoring/business`)
Backend : `GET /monitoring/status|metrics|alerts`, `POST /monitoring/collect`, `GET /business/mrr|arr|churn|nrr|arpu|ltv|cac`.
- Graphes temps réel Recharts (CPU, RAM, latence IA, requêtes API) + alertes avec résolution.
- Business : StatCards MRR/ARR/Churn/NRR/ARPU/LTV/CAC + CA par tenant.

---

## LOT 2 — Module KPI Optimax complet (backend + front)

**Référence : Annexe 5 ICP-Pénalités Optimax Juin 26.** Le moteur actuel couvre 13 indicateurs ; il manque ~37 indicateurs et les deux modes de calcul de pénalité.

### 2.1 Extensions du moteur (backend)
- Deux modes de pénalité : `TCO` = (Objectif − taux) × TCO mensuel du segment ; `FORFAIT` = montant × nombre d'unités (PBO, ligne, équipe, jour).
- Plafond global : 20 % du montant Production & SAV ; 20 % par lot extension/densification.
- Bonus : détection 3 mois consécutifs tous KPI atteints → +1 M FCFA par point > 100 % (capping 5 M).
- Saisie mensuelle du TCO par segment (production EM/HM-MM/B2B, redevance maintenance, lots ext./densif.) pour le calcul.

### 2.2 Nouvelles familles de KPI (backend + affichage)
1. **Production complète** : On Time EM 3 j ≥95 %, Backlog <4 j EM ≤5 %, On Time HM/MM 2 j ≥95 %, Backlog <3 j HM/MM ≤5 %, On Time B2B 2 j ≥98 %, Backlog <3 j B2B ≤2 %.
2. **Autres technologies** (5G/satellite/TDD) : On Time 3 j ≥95 %, backlog ≤5 %, zéro >5 j.
3. **Fiabilisation des constitutions** : renseignées 100 %, remontée ≤5 j 100 %, fiabilité parc ≥98 %.
4. **Maintenance curative étendue** : relèves 6H B2B ≥95 %, 12H HM/MM ≥95 %, 15H voix/EM ≥95 %, 8H HM/MM ≥90 %, 24H cuivre ≥95 %, backlog 12H 100 %, dérangements causés relevés 1H ≥95 %, sans confirmation client RIT <1 %, signalisations mensuelles (2 %/5 %), prématurés 90 j <2 %.
5. **Maintenance préventive** : PBO dégradés 3 j (10 000 F/PBO), lignes dégradées 2 j ≥80 % et 5 j 100 % (5 000 F/ligne), planning préventif ≥95 %, rapport inspection M+5 (50 000 F), correction écarts 5 j ≥95 %, remontées réseau 1 j ≥95 %, PBO non corrigés ≤5/mois.
6. **Événements exceptionnels** : partage dispositifs le jeudi 100 %, paliers effectifs événements (80/60/40/50/80/100 % selon J-48h→J+72h) — alimenté par la feuille de présence hebdo ; 30 000 F/équipe manquante/jour.
7. **Contrôle SAV/Production détaillé** : taux contrôle SAV 5 % / production interne 10 % (500 000 F/point), conformité 99 %/98 %, correction 24H 100 % (50 000 F/jour retard), répétition anomalies même équipe ≤2 % (100 000 F/point), environnement des tiers (constats → suspension).
8. **Plaintes** : traitement conforme 100 %, correction <7 j.
9. **Extensions & densification** : planning livraison (500 000 F/j/lot), démarrage 3 j Dakar/5 j région (300 000 F/j/lot), attachements ≥99 % (amende 5 %/25 % PO), recette ≥98 % (amende 5 %/25 % PO + quotas), levée réserves 3 j (100 000 F/j), attachement 3 j après recette (300 000 F/j/lot), ATP 100 % (500 000 F/intervention + suspension 1 mois).
10. **Stock étendu** : corrections anomalies 95 %, répétitions 0 %, retours défectueux 7 j, conformité stockage 100 %, stock dormant ≤5 % (100 000 F/point).
11. **Pénalités de zone** : PBO ouvert 48 h, câbles pendants 48 h, appui commun non armé, SR/PMZ non fermé (50 000 → 100 000 F) — alimentées par le module Incidents.

### 2.3 Front KPI
- Regrouper la page KPI existante par familles (onglets : Production, SAV, Préventif, Contrôle, Stock, Événements, Ext./Densif., Plaintes, Zone).
- Chaque KPI : target, valeur, statut vert/orange/rouge, formule, **détail du calcul de pénalité** (mode TCO vs forfait), volume d'unités concernées.
- Bandeau plafond 20 % + indicateur bonus 3 mois consécutifs.
- Rapport mensuel Optimax exportable (PDF/Excel) prêt pour l'Acceptance SONATEL (déjà exigé par le contrat : rapport écrit mensuel par ICP + plan de maîtrise par non-atteinte — ajouter champ « plan de maîtrise » par KPI non atteint).

---

## LOT 3 — Missions dynamiques 11 types + bordereau + recette OSM

### 3.1 Formulaire piloté par template (front)
Backend : `mission_type_templates` (seed 11 types), étape `data` (JSONB) via `POST /missions/:id/field-report/step/data`.
- Le détail mission actuel (6 étapes INSTALLATION) devient le template INSTALLATION ; les autres types affichent leurs étapes/champs issus du template : SURVEY (réseau, qualité ADSL, accessoires, résultat), SURVEY_OSM (tracé GPS, zones Central/PEP/PEZ/PMZ/Plaque/BPE, état GC), SAV (constat, tests WiFi/débit/téléphonie, échange matériel), INFRA (type incident A00-B18, câble 6/12/24fo, tirage, soudure brins, cause, signal), OSM (départ/arrivée, tirage souterrain/aérien, nb FO, chambres, conduite, réfection), GC (longueur, conduite PVC, réfection), PLANTATION (nb poteaux, type, GPS), DEVOIEMENT, DENSIFICATION, DÉPLOIEMENT.
- Photos attendues par type (4 photos classiques vs Avant/Pendant/Après vs Poteau planté vs Départ/Arrivée).
- Signature client uniquement si le type a un client final (tableau du cahier des charges).
- Motifs d'échec enrichis : client_absent, pbo_sature, genie_civil_bloque, rupture_poteau, attente_validation_ci, client_injoignable, desistement_client.

### 3.2 Étape 5 = deux onglets : Stock consommé | Prestations (bordereau)
Backend : `priceItemsUsed` accepté dans le DTO data ; `price-items` avec recherche.
- Onglet Prestations : combobox items du bordereau (N° + désignation), quantité, PU auto, **total par ligne et montant total de la mission** (recalcule `montantTotal`).
- Onglet Stock consommé : référentiel stock (déjà présent), décrément à la validation.

### 3.3 Recette OSM (workflow de validation formelle)
Backend : `recetteStatus` (en_attente/en_cours/acceptee/reserves/rejetee) + `recetteDocuments` existent.
- Panneau recette dans le détail mission OSM : statut, dépôt des documents (dossier mesure fibre, recette en surface), levée de réserves, signatures SONATEL + sous-traitant.

### 3.4 Fiches de chantier numériques (front)
Backend : `site-checklists` (templates OSM/GC/DENSIFICATION/SURVEY_OSM, GET/POST/PUT, saisie par mission).
- Onglet « Fiche de chantier » dans le détail mission pour ces types : sections du template cochables/renseignables, liaison automatique aux items du bordereau (montant calculé).

---

## LOT 4 — Compléments backend requis par les documents

1. **Véhicules — pannes, réparations, pièces, carburant, coûts** (nouvelles entités `vehicle_repairs`, `fuel_logs` ou lumps dans une table `vehicle_events`) : fiche véhicule avec onglets Check auto / Pannes / Réparations / Pièces remplacées / Carburant / Coût par véhicule. Alimente le rapport Usage stock & véhicules.
2. **Incidents → Missions SAV** : `POST /incidents/:id/generate-sav` — proposition de création de missions SAV pour les ND impactés (groupées ou individuelles), jamais automatique (validation humaine), lien `relatedMissionIds`.
3. **Réaffectation de mission** : `PUT /missions/:id` (équipe, binôme, véhicule, créneau) — règle : pas de double affectation d'une même équipe sur un même créneau ; équipe désactivée ne reçoit pas de mission.
4. **Planning vue mois + export** : vue mois front ; export PDF/Excel de la vue courante (même moteur que les rapports).
5. **Génération auto de la facture** (cron 1er du mois) : brouillon automatique à partir des missions clôturées regroupées par type + application pénalités KPI du mois (le service generate existe, ajouter le cron + notification silencieuse).
6. **Score qualité & PV** : s'assurer que `montantTotal` et `priceItemsUsed` alimentent la génération de facture (rattachement ligne d'attachement ONECOMIT : Survey, Survey+Installation, Installation, Relevé dérangement, Changement PBO, POI, Plantation, INFRA).

---

## LOT 5 — Alignements fins

- Dashboard : conserver tel quel ; ajouter uniquement les widgets prévus par le cahier des charges si les modules arrivent (dossiers SONATEL incomplets quand conformité livrée) — pas de placeholder vide.
- Planning : vue Jour (liste filtrée par date) en complément de Tableau/Semaine.
- RH : sous-module Recrutement (candidats, pièces, statut) — documenté phase 3, optionnel.
- Mobile : l'audit front web terminé, ouvrir un chantier mobile équivalent (formulaire dynamique par template, signalement incident, présence, dépenses) — à planifier séparément.

---

## Ordre de réalisation proposé

| Phase | Contenu | Volume estimé |
|---|---|---|
| P1 | Lot 1 complet (13 pages branchées, zéro dev backend) | ~13 pages à enrichir |
| P2 | Lot 3 (missions dynamiques + bordereau + recette + fiches chantier) | 1 page détail + 2 nouvelles vues |
| P3 | Lot 2 (KPI Optimax ~37 nouveaux + moteur pénalités 2 modes + plafond/bonus) | backend + front KPI |
| P4 | Lot 4 (véhicules complets, incidents→SAV, réaffectation, cron facture) | backend + front |
| P5 | Lot 5 (polish, mobile) | selon recette |

**Critères d'acceptation** : chaque table est cliquable → détail ; chaque action documentée a un bouton visible ; aucun endpoint métier sans exposition front ; la page Stock reproduit exactement le pattern prototype fourni (onglets, ajout, emplacements, mouvements) ; la page Rapports remplace définitivement le pivot Excel ; le KPI dashboard couvre 100 % de l'annexe Optimax.
