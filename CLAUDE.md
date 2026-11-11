# CLAUDE.md — VECTRACOM

> Référence pour toute session Claude Code. Mis à jour le 11/11/2026.
> Sources : `AGENT.md`, `.cursor/rules/vectracom-validated-baseline.mdc`, `docs/PLAN-INTEGRATION-EVOLUTION-DIRECTEUR.md`, `docs/RAPPORT-VERIFICATION-L0-L7.md`.

## 1. Projet en bref

- SaaS multi-tenant de gestion des opérations terrain pour sous-traitants télécom de **SONATEL**.
- Éditeur : **Green-T** · client pilote : **ONECOMIT** (3STB).
- Contexte métier (données réelles), priorités et règles de flexibilité : voir **§1b**, **§1c** et **§12**.
- 20 modules dans le code (14 présentés au directeur, voir §1b) : import planning SONATEL, missions offline-first, stock, véhicules, RH, comptabilité, facturation, KPI, incidents PBO/PIO/Chambre, IA Vision, abonnements SaaS, monitoring.
- IA en **mode règles** tant que `GEMINI_API_KEY` / YOLO ne sont pas configurés (`GET ai/status`).
- Prod : **https://vectracom.track-it.org** (VPS partagé avec TrackIT).
- GitHub : `11Blocks/vectracom`, branche `main`.

## 1b. Contexte métier ONECOMIT — données réelles (11/11/2026)

> Sources : document de cadrage « VECTRACOM — Présentation à la Direction d'ONECOMIT » (PDF, septembre 2026) et précisions de Moussa (Green-T) du 11/11/2026, issues de la revue du directeur ONECOMIT. **Ce sont des faits, pas des hypothèses.** Ils décrivent la situation actuelle ; le code doit rester configurable (voir §12).

### Chaîne de sous-traitance
- ONECOMIT est **sous-traitant** de SONATEL via Sofatelcom **et donneur d'ordre** pour ses propres sous-traitants (ABC SARL…), à qui il remet un **bordereau de prix de sous-traitance**.
- Règles de cascade en prod (vérifiées le 11/11/2026) : SONATEL → SOFATELCOM **100 %** · SOFATELCOM → ONECOMIT **65 %** · ONECOMIT → ABC SARL **80 %**. Exemple : **27 000 → 17 550 → 14 040** (au franc près, pas d'arrondi au millier).
- Pilotes : pilotes SONATEL et pilotes « REGIS » (Sofatelcom).

### Les 6 items (domaines) et la composition réelle des équipes
| Item | Composition actuelle | Agents | Types de mission (code) |
|---|---|---|---|
| FTTH | 1 chef, 1 binôme, 1 stagiaire | 2–3 | INSTALLATION, SURVEY, SAV, SURVEY_OSM |
| INFRA | 1 chef, 1 binôme, 1 stagiaire | 2–3 | INFRA |
| PP & GC | 1 chef, 1 binôme, 2 journaliers | 4 | PLANTATION, GC, DEVOIEMENT |
| EXT / DENSIF (+ OSM) | 2 chefs tireurs, 1 chef raccordeur, 4 journaliers | 7 | DENSIFICATION, OSM |
| DÉPLOIEMENT | 2 chefs tireurs, 1 chef raccordeur, 4 journaliers | 7 | DEPLOIEMENT |
| BTS | 1 chef, 1 binôme, 1 stagiaire | 2–3 | BTS |

Il y a 6 items (et non 3). La composition est stockée en base (`items.team_composition`, seed `seed-items.ts`), pas dans le code.

### Zones — deux notions distinctes, toutes deux réelles
- **Zones OLT (réseau SONATEL)** : 13 zones des dashboards de performance — Thiaroye, Mbour, Kaolack, Touba, Kaffrine, Fatick, Popenguine, Koungheul, Sokone, Nioro, Fimela, Porokhane, Mbodjene. Servent au suivi (Dashboard_OLT).
- **Zones d'affectation (SOFATELCOM)** : 4 zones — Mbour, Thiès, Tivaouane, + 1 (à préciser). Les équipes y sont affectées **de manière permanente** ; en cas de surcharge, **renfort** d'une zone à l'autre (module renforts).
- En base : table `zones` (18 zones en prod au 03/10/2026), configurable par tenant.

### Équipes
- Plus de **80 équipes** (ou binômes) sur le terrain, chacune pilotée par un chef d'équipe. Les noms figurent dans les données et le PDF ; **ne pas les recopier dans le dépôt** (données personnelles).

### Les 9 types d'intervention métier et leurs 12 valeurs dans le code
| Type métier (PDF) | Valeur(s) `MISSION_TYPES` | Formulaire (étapes) |
|---|---|---|
| SURVEY | SURVEY (+ SURVEY_OSM pour l'étude OSM) | 5 : client, réseau, qualité ADSL, accessoires, résultat |
| INSTALLATION / raccordement | INSTALLATION | 6 : SST (bloquant), identification + GPS, technique (dBm), 4 photos, matériel, clôture (signature) |
| SAV / dépannage | SAV | 5 : client, constat, tests, remplacement, signature |
| INFRA / réseau | INFRA | 5 : identification, incident (codes A00, A03, A07, B13…), matériel, photos, clôture |
| OSM | OSM | 5 : identification, travaux, mesures, photos, recette (signature SONATEL + 3STB) |
| Plantation de poteaux | PLANTATION | 4 : localisation, poteaux, photos, validation |
| Génie civil | GC | 4 : localisation, travaux, photos avant/pendant/après, validation |
| Déploiement / extension / densification | DEPLOIEMENT, DENSIFICATION | — |
| Dévoiement | DEVOIEMENT | — |
| (item BTS, ajouté par le directeur, absent du PDF) | BTS | — |

`AGENT.md` parle de 11 types : il date d'avant l'ajout de BTS. La référence du code est `MISSION_TYPES` (12 valeurs).

### Processus
1. **Import du planning SONATEL** : Excel multi-onglets ; colonnes OLT, Demande, ND, Commande client (FIB_KHE, FIB_PRO_M_B…), Date validation, Âge, Nom et contact client, Date d'intervention, Tâches, Équipe, Statut (OK/NOK), Commentaires. Libellés repris à l'identique (§5).
2. **Exécution terrain** : le chef d'équipe se rend sur site (camionnette), exécute et remplit le formulaire du type de mission.
3. **Suivi** : dashboards Excel DAILY, Dashboard (par équipe), Dashboard_OLT (par zone) — taux de réussite et raisons d'échec.
4. **Facturation** : bordereau de prix de **52 items** (catégories OSM, GC, DENSIF, DÉPLOIEMENT…).
- Sources actuelles remplacées : fiches SAV / Survey / INFRA (PDF SENPLIPRO), fiches OSM, fiches de chantier, fiches de validation des équipes (Excel).

### Les 14 modules présentés au directeur et les 20 du code
- PDF (14) : authentification & rôles · équipes & techniciens · console Green-T · dashboard direction · planning + import SONATEL · missions terrain · stock · véhicules · conformité SONATEL · RH · comptabilité opérationnelle · rapports · notifications · couche IA.
- Code (20, `AGENT.md`) : la console Green-T est incluse dans « authentification & rôles », le dashboard direction dans rapports/KPI. Modules du code **en plus** du PDF : fiches de chantier, facturation client, KPI SONATEL, incidents & alertes réseau, IA Vision, abonnements SaaS, business monitoring, plateforme monitoring.

### Principes promis au directeur
- « Si le chef d'équipe n'utilise pas l'application chaque jour, le reste ne crée pas de valeur. »
- Mobile ultra-léger (< 40 Mo, ouverture < 1 s, 4 onglets max par rôle) · offline-first · multi-tenant strict · l'IA propose, ne décide jamais.

### Chat Matrix (remplacement de WhatsApp)
- Promesse : chat interne lié aux missions et incidents, serveur Dendrite + pont `mautrix-whatsapp`, ~10 jours (PDF). Choisi plutôt que Rocket.Chat (SDK React Native, offline, pont WhatsApp).
- Dans le code : `infra/dendrite/`, `infra/mautrix-whatsapp/`, module `backend/src/modules/chat` (salons `matrix_room_id`, `matrix_event_id`), écrans mobiles Messages / Conversation. **Niveau d'avancement réel : à évaluer** (lecture seule).

### Stock — les 5 rubriques (B2)
Stock · Focus Stock · Suivi Consommation · Comptabilité Matière · Ventilation aux Équipes. Les 5 rubriques sont réelles ; **leur filtrage par item est une hypothèse de travail**, à confirmer par le directeur (Q_B2) — rien n'est codé.

## 1c. Priorités actuelles (11/11/2026)
1. **S0** — faille chef d'équipe (§9) : à corriger en premier.
2. **Questions au directeur** (§11, `docs/QUESTIONS-DIRECTEUR-ONECOMIT.md`) : envoi par Moussa.
3. **Chat Matrix** : évaluer l'existant, puis compléter.
4. **L8 mobile — plus tard** : le plan est prêt, **on ne code pas maintenant**. Le mobile n'est pas prioritaire.

## 2. Stack et ports

| Composant | Techno | Port local | Notes |
|---|---|---|---|
| API | NestJS 10 + TypeORM | **3100** | préfixe `/api/v1` |
| Web admin | Next.js | **3101** | le script `npm run dev` et le README disent 3001 — la référence est 3101 |
| Mobile | Expo (SDK 57) + EAS | Metro 8081 | `mobile/app.json` → `apiUrl` IP LAN |
| Base | PostgreSQL 15 | **5434** | conteneur `vectracom-postgres`, `TYPEORM_SYNCHRONIZE=false` |
| Cache | Redis 7 | **6380** | conteneur `vectracom-redis` |

Ports **interdits** (TrackIT) : 3000, 5433, 6379, 8080.

## 3. Arborescence

```
backend/src/modules/      37 modules NestJS (missions, planning, stock, invoices, kpi-sonatel…)
backend/src/common/       décorateurs (Roles, CurrentUser), pagination, BaseEntity
backend/scripts/          seeds TS + fill-platform-pipeline.cjs (pipeline données réelles)
backend/test/e2e/         smoke tests shell (phase1→15) + full-scenario.sh
backend/test/unit|integration/   VIDES — aucun test unitaire à ce jour
web-admin/src/app/        58 pages (App Router)
mobile/src/               24 écrans, file offline (offline/queue.ts), services API
infra/postgres/migrations/  001 → 019 (SQL idempotent)
scripts/                  deploy-vps.sh, apply-migrations.sh, SQL démo
docs/                     plan, rapports, cahiers (01…10_*.md et CONTEXT.md sont VIDES)
```

Hors dépôt (dossier parent `green_T_4.1/`) : `vectracom 1/` (specs d'origine), `.docs-extrait*` (fichiers terrain réels), `_backups/`.

## 4. Commandes courantes

```bash
docker compose up -d postgres redis          # base + cache
cd backend && npm run dev                    # API 3100
cd web-admin && npm run dev                  # web
cd mobile && npm start                       # Metro / Expo Go

cd backend && npx tsc --noEmit               # typecheck (doit rester à 0 erreur)
cd web-admin && npx tsc --noEmit
cd backend && npm run test:e2e               # recette HTTP (API locale démarrée)
cd backend && npm test                       # Jest — aucun spec pour l'instant

SKIP_PLANNING=1 node backend/scripts/fill-platform-pipeline.cjs   # rejouer le pipeline de données
```

**Migrations** : `scripts/apply-migrations.sh [conteneur] [base]` applique **toutes** les migrations `infra/postgres/migrations/NNN_*.sql` (découverte automatique, numérotation continue vérifiée), chacune dans une transaction en mode strict (`-1 -v ON_ERROR_STOP=1`) : au premier échec, le fichier est annulé et le script s'arrête. Toutes les migrations sont idempotentes (relance sans risque).
```bash
bash scripts/apply-migrations.sh vectracom-postgres vectracom      # base locale par défaut
```
⚠️ La base de dev locale n'a que 001→011 (au 11/11/2026) ; la 013 normalise des données de missions : ne pas lancer sur la base de dev sans accord. En prod, appliquer une migration seule, après sauvegarde, comme décrit au §8.

⚠️ **Dérive de schéma (constatée le 11/11/2026)** — la prod (et la dev) ont été façonnées en partie par TypeORM `synchronize`, puis la prod restaurée depuis un dump local :
- ✅ **Tables (MIG-2)** : 14 tables n'avaient aucune migration (`chat_memberships`, `chat_messages`, `chat_rooms`, `daily_attendances`, `daily_workers`, `dispositif_entries`, `geofence_zones`, `geopositions`, `rag_chunks`, `rag_documents`, `recruitment_candidates`, `settings_change_logs`, `vehicle_events`, `vision_uploads`). Corrigé : `recruitment_candidates` en tête de 011, les 13 autres en 021, à l'identique de la prod. Une base vide passe désormais 001→021 et obtient les mêmes 80 tables que la prod.
- ✅ **Colonnes (MIG-3, option B)** : les migrations seules différaient encore de la prod sur 53 tables (46 colonnes absentes, 119 types, 152 NULL/NOT NULL, 6 défauts). Réglé en faisant de **`infra/postgres/docker-init/01-schema.sql` le schéma de référence = export de la structure de la prod** (`pg_dump --schema-only --no-owner --no-privileges`, sans données). Une base neuve part de ce schéma, puis `apply-migrations.sh` applique 001→021 par-dessus, sans effet. **À régénérer après toute évolution du schéma de prod** (procédure en tête du fichier ; retirer les lignes `\restrict` / `\unrestrict`). `001_initial_schema.sql` reste l'historique, ce n'est plus le schéma d'installation. Vérifié le 11/11/2026 : tables, colonnes, types, NULL, défauts et contraintes de la prod sont tous reproduits.
- ⚠️ **Index (MIG-4, ouvert)** : appliquées sur ce schéma, les migrations 001 et 002 ajoutent **66 index et 1 clé étrangère que la prod n'a pas** (la prod n'a jamais été construite par 001). 38 de ces index doublent un index prod existant sous un autre nom ; les autres sont réellement absents de la prod, dont l'index unique `uq_company_settings_company` et la clé `fk_mission_team` (missions → teams). Une base neuve est donc un peu **plus stricte** que la prod (rien de la prod n'y manque).
- Ne jamais lancer le backend avec `synchronize` contre une base partagée ; toute nouvelle table ou colonne passe par une migration.

Comptes de test locaux : `admin@onecomit.sn` (admin tenant), `admin@green-t.sn` (super admin). Mots de passe : voir la baseline Cursor — ne pas les recopier ailleurs.

## 5. Conventions

- **Charte** : vert `#0f9d70` = système/validation ; **ambre `#f5a623` réservé exclusivement aux sorties IA** ; rouge `#C0392B` < 7 j ; orange `#D9822B` 7–30 j. Mobile : jamais de hex brut dans `screens/` (voir `mobile/TOKEN.md`).
- **Multi-tenant** : toute requête filtre par `companyId` (issu du JWT via `@CurrentUser('companyId')`). **Tout ID entrant (équipe, zone, pilote, partenaire, technicien…) doit être vérifié contre le tenant.**
- **Rôles** : `@Roles(...)` sur chaque contrôleur. Tenant : admin (écriture), direction (lecture + validations), chef_equipe (terrain), magasinier, gestionnaire_flotte. Console : super_admin, finance_admin, support_admin.
- **Pagination** : `PageQueryDto` / `pageParams` / `withTotal` ; corps = tableau, total dans l'en-tête `X-Total-Count`.
- **Schéma** : uniquement par migration SQL idempotente numérotée ; jamais `synchronize`.
- **Libellés SONATEL** repris à l'identique ; missions créées manuellement suffixées **« -OT »** et marquées `rajout=true`.
- **Cascade tarifaire** (décision Moussa, 10/11/2026) : calcul **au franc près, sans arrondi au millier** — 27 000 × 65 % = 17 550 ; 17 550 × 80 % = **14 040**. Les taux s'appliquent aux **prestations** (S+I APP 80 / PASSAGE 87 / Survey 93 / RELEVE 91), pas seulement aux items : colonne `pricing_rules.prestation_key` (migration 020, à venir). Priorité de la règle appliquée : `prestation_key` > `item_id` > règle par défaut (les deux à NULL).
- **Règles de cascade — limites acceptées** (décision Moussa, 11/11/2026) :
  - (c) Deux créations simultanées avec dates différentes ne sont pas bloquées par l'index (seul un doublon exact de date de début l'est ; le chevauchement est contrôlé par l'API, pas par la base). Risque accepté (1 admin).
  - (d) En modification, item/parent/enfant ne sont pas modifiables (historique propre). Désactiver + recréer.
- **Zones — nom unique** (TER-1, 11/11/2026) : création et modification passent par la même vérification (nom nettoyé des espaces, unique dans le tenant ; erreur 23505 de la base → même 400). Changements de comportement :
  - TER-1a : en création, le message « La zone « X » existe déjà » devient « Nom de zone déjà utilisé » (uniformisation).
  - TER-1b : en modification, un nom vide ou d'un seul caractère est maintenant refusé (400), alors qu'il était accepté avant.
- **Items — validations** (ITM-1, 11/11/2026) : `missionTypes` dans la liste fermée `MISSION_TYPES`, sans doublon, un type au plus dans un item du tenant ; `teamComposition` : rôles de `EQUIPE_ROLES`, un rôle au plus une fois, effectif entier 1–50. Un champ non envoyé n'est pas revalidé. Changement visible :
  - ITM-1a : sur `/items`, un rôle en double dans la composition est refusé (400 « Rôle en double »). Avant, la composition était enregistrée telle quelle.
- **Contrainte `pricing_rules`** : la contrainte d'unicité de `pricing_rules` s'appelle `pricing_rules_company_id_parent_partner_id_child_partner_id_key` (créée par 012 sans nom ; le `@Unique('uq_pricing_rule')` de l'ancienne entité ne correspondait pas à la base). La migration 020 la retrouve par type (`contype = 'u'`), pas par nom, et la remplace par l'index `uq_pricing_rule_v2` (NULLS NOT DISTINCT). Ne pas la renommer.
- **Visibilité de la rémunération** (décision Moussa, 10/11/2026) : **chacun ne voit que ce qui le concerne**. Le chef d'équipe voit uniquement sa part, le binôme uniquement la sienne ; admin et direction voient tout. À appliquer côté API (pas seulement dans l'écran) pour L8 mobile.
- **IA** : propose, ne décide jamais — validation humaine obligatoire.
- Graphiques vides : composant `ChartEmpty`, jamais un graphique muet.
- Langue : UI, messages d'erreur et commits en français (`feat(Lx): …`, `fix(module): …`).

## 6. Règles de travail (impératives)

1. Tout valider **en local** (typecheck + smoke test) avant de proposer un déploiement.
2. **Aucun commit, aucun push** sans accord explicite de Moussa.
3. **Aucune connexion VPS** sans accord ; lecture seule d'abord ; toute écriture (deploy, restart, migration, `.env`) = accord explicite.
4. Ne jamais supposer une réponse métier : poser la question (voir §11).
5. Remplir/faire évoluer **toute** la plateforme de façon cohérente, pas un module isolé.
6. Signaler l'état ✅ / ⚠️ / ❌ dans les comptes rendus.

## 7. 🔴 Zones à risque

| Zone | Règle |
|---|---|
| **TrackIT** (prod) | **Ne jamais toucher** : dossier VPS `/mnt/data/apps/Trakit`, ports 3000/5433/8080, `manager.track-it.org`, conteneurs TrackIT/Traccar/RAG/Nginx/Caddy/Postgres TrackIT. |
| `.env`, `.env.dev`, `.env.prod` | Ignorés par git, contiennent des secrets. Backup avant toute modif (`../_backups/<date>/`). Ne jamais afficher les valeurs. |
| `docker-compose.yml` du VPS | Différent du local ; jamais écrasé (exclu de `deploy-vps.sh`). |
| Volume `vectracom_uploads` | Monté sur `/app/uploads` ; ne jamais le supprimer. |
| Base de prod | Restore du dump local = mots de passe remis aux valeurs locales. Sauvegarde dans `~/backups/vectracom_<date>/` avant toute migration. |
| Clés SSH | VECTRACOM : `~/.ssh/trackit_vps`. `cle-vps-traccar` = Traccar uniquement. |

## 8. Déploiement

- VPS `ubuntu@83.228.222.179`, dossier **`/mnt/data/apps/Vectracom`**.
- Conteneurs : `vectracom-backend`, `vectracom-web` (image `vectracom-web-admin`), `vectracom-postgres`, `vectracom-redis`.
- ❌ **Ne pas utiliser `scripts/deploy-vps.sh` depuis ce PC Windows** : `rsync` est absent, le script n'exclut que les `.env*` de la racine (il enverrait `backend/.env`, `web-admin/.env`, `web-admin/.env.local`, `mobile/.env`, `mobile/android/`, les logs) et `--delete` efface sur le VPS tout fichier absent en local.
- ✅ **Méthode validée (10/11/2026)** : n'envoyer que les fichiers **suivis par git** modifiés depuis la version en prod, **en forçant le LF** :
  ```bash
  git -c core.autocrlf=false -c core.eol=lf archive HEAD $(git diff --name-only <hash_prod> HEAD) \
    | ssh -i ~/.ssh/trackit_vps ubuntu@83.228.222.179 "tar -x -C /mnt/data/apps/Vectracom"
  ```
  ⚠️ **Piège `autocrlf`** : ce PC a `core.autocrlf=true`. Sans les deux options `-c`, `git archive` convertit les fichiers en **CRLF** : le TypeScript compile quand même, mais **les scripts bash sont cassés** sur Linux et les md5 ne correspondent plus.
- Vérification : comparer au blob git (`git show HEAD:<fichier> | md5sum`), pas au fichier de travail Windows ; `md5sum -c` sur le VPS pour tous les fichiers envoyés ; `grep -c $'\r'` doit donner 0.
- Avant : sauvegarde `~/backups/vectracom_<date>/` (tag image `vectracom-backend:rollback-<date>`, `tar` de `backend/src`, `pg_dump` vérifié).
- Puis rebuild **du seul service modifié** : `docker compose build backend && docker compose up -d --no-deps backend`, health `GET /api/v1/health` (interne `127.0.0.1:3100` et public). Le log « localhost:3000 » est le port interne du conteneur (mappé sur 3100), pas TrackIT.
- Retour arrière : `docker tag vectracom-backend:rollback-<date> vectracom-backend && docker compose up -d --no-deps backend`.
- Pas de hash git sur le VPS : la version en prod se déduit par `md5sum`.
- Dernier déploiement (11/11/2026, 11:30) : backend et web = `de5508c` (cascade tarifaire + simulation), migration 020 appliquée en prod. Sauvegarde : `~/backups/vectracom_20261111/` (images `rollback-20261111`).
- 11/11/2026, 13:15 : fichiers de `a17dc04` envoyés (migrations, schéma de référence, script, docs) et migration 021 appliquée en prod — sans effet, comme attendu (243 index, 164 contraintes, 80 tables, 1 090 colonnes avant et après). Sauvegarde : `~/backups/vectracom_20261111b/`. **Ne pas relancer 011 en prod** (son `UPDATE employees` recalcule les statuts « en congé »).
- 11/11/2026, 17:05 : backend et web = `a72cdbc` (PAY-1, STK-1, TER-1, ITM-1), sans migration. Sauvegarde : `~/backups/vectracom_20261111c/` (images `rollback-20261111c`).
- 11/11/2026, 17:50 : web seul = `262ba05` (UI-1, UI-1b, UI-1c) ; backend inchangé (`a72cdbc`). Sauvegarde : `~/backups/vectracom_20261111d/` (image `vectracom-web-admin:rollback-20261111d`).

## 9. État d'avancement (évolution « réunion directeur »)

| Lot | Contenu | État |
|---|---|---|
| L0 | Item (6 domaines), Zone, Pilote, cascade tarifaire | ✅ CRUD + **calcul de cascade** (`pricing/cascade.ts`, `GET /pricing-rules/simulate`, panneau sur `/partenaires`, validations %/cycles/dates/chevauchements) — ✅ migration 020 appliquée et déployée en prod le 11/11/2026 ; **factures non branchées** (accord Moussa requis : risque de double réduction) ; prestations Q7/Q8 en attente |
| L1 | Normalisation tâches SONATEL + « -OT » | ✅ — import 5 feuilles **partiel** (C1) |
| L2 | Permanence SAV/PROD, filtres, rajouts, levée blocages | ✅ |
| L3 | Renforts zone→zone + frais de mission | ✅ |
| L4 | Composition équipe par Item, dossier technicien, rôle flotte | ✅ |
| L5 | Achats validés SONATEL + pertes (seuil 10 %) | ✅ — 3 rubriques stock sur 5 (B2) |
| L6 | Rémunération 65/35 | ✅ — pas de facturation par équipe (C2) |
| L7 | Cartographie zones + classement + satisfaction client | ✅ |
| L8 | Mobile : réplication des lots L0–L7 | ⏳ socle mobile OK, aucun écran L0–L7 — **plan prêt, non prioritaire** (§1c) |
| S0 | Faille chef d'équipe : `POST /missions/:id/lever-blocage` et `GET /missions` ne limitent pas le chef à son équipe — un chef peut voir et débloquer les missions de **toutes** les équipes du tenant | ❌ **priorité 1** (§1c) |
| Matrix | Chat interne (Dendrite + `mautrix-whatsapp`) en remplacement de WhatsApp | ⚠️ code présent (`infra/dendrite`, `infra/mautrix-whatsapp`, module `chat`), avancement réel **à évaluer** |

Dette connue (11/11/2026) : isolation tenant corrigée et déployée ; 148 tests unitaires (aucun côté mobile) ; reste S0 ci-dessus, les listes figées du §12 et le backlog (`docs/BACKLOG-CORRECTIONS.md` : MIG-4a/4b, PER-1/2, PAR-1, PAY-2, UI-2).

## 10. Documents de référence

- `AGENT.md` — référence fonctionnelle (modules, rôles, types de mission, charte, IA, notifications).
- `.cursor/rules/vectracom-validated-baseline.mdc` — ports, VPS, comptes, pipeline de données, historique des chantiers.
- `docs/PLAN-INTEGRATION-EVOLUTION-DIRECTEUR.md` — taxonomie Item, cascade, lots L0→L8.
- `docs/RAPPORT-VERIFICATION-L0-L7.md` — vérification prod et trous restants.
- `docs/CAHIER-V2-REALITE-TERRAIN.md`, `docs/CAHIER-DES-CHARGES-COMPLEMENTAIRE.md`, `API_GUIDE.md`, `USER_GUIDE.md`.
- `docs/QUESTIONS-DIRECTEUR-ONECOMIT.md` — les 10 points métier en attente (message prêt à envoyer).
- `docs/BACKLOG-CORRECTIONS.md` — corrections secondaires priorisées.
- Document de cadrage présenté au directeur (PDF, septembre 2026, **hors dépôt**) : `C:\Users\USER\Documents\MYWORKSPACE\VECTRACOM\guide utilisateur\VECTRACOM — Présentation à la Direction d'ONECOMIT.pdf`. Résumé dans §1b. Sa section « Statut » est dépassée (le DNS `vectracom.track-it.org` est en ligne).

## 11. Contacts / questions en attente

Interlocuteurs : **Moussa (Green-T)** valide techniquement ; le **directeur ONECOMIT** tranche le métier.

| # | Question | Bloque |
|---|---|---|
| B2 | Les 5 rubriques (réelles) : Stock, Focus Stock, Suivi Consommation, Comptabilité Matière, Ventilation aux Équipes. **Q_B2** : filtrées par item ou globales ? Hypothèse de travail « par item » — **ne rien coder avant confirmation** | L5 |
| C1 | Import « 5 feuilles à l'identique » : quelles feuilles, quelles colonnes, quel comportement en cas de surcharge ? | L1 |
| C2 | Faut-il une facturation par équipe/groupe (en plus de la facture par client) ? | L6 |
| Q1 | Format `zone x/y` : équipes prévues/affectées, ou équipes/instances ? | L0/L7 |
| Q2 | « Instances » = techniciens par chef, ou interventions actives ? | L0/L7 |
| Q3 | Le niveau 2 de la chaîne est-il toujours ONECOMIT ? | L0 (cascade) |
| Q4 | Satisfaction client : quel canal (SMS / WhatsApp / app) et qui répond ? | L7 |
| Q7 | « S+I APP » est-il une variante appartement de `survey + installation` ? Si oui, quelle clé ? | taux 80 % par prestation |
| Q8 | « PASSAGE » correspond-il à `deplacement sav` ou à une autre clé ? | taux 87 % par prestation |
| Q9 | Une règle de cascade qui pointe vers un partenaire **désactivé** doit-elle continuer à s'appliquer, ou être ignorée ? Par défaut : elle s'applique (comportement actuel). À trancher. 🟡 | cascade |
| Zone | Quelle est la **4ᵉ zone d'affectation SOFATELCOM** (Mbour, Thiès, Tivaouane, + ?) | §1b |
| L8-1 | Les binômes ont-ils un compte ? Avec quel rôle ? Par défaut : seuls les chefs ont un compte. | L8 |
| L8-2 | Rémunération mobile : le chef voit-il le revenu de l'équipe et le pourcentage (qui permettent de recalculer la part de l'autre) ? Par défaut : seulement son montant et le statut. | L8 |
| L8-3 | Frais de mission : écran séparé de « Dépense » (comptabilité) ? Par défaut : deux écrans distincts. | L8 |
| L8-4 | Un chef peut-il modifier ou supprimer un frais saisi ? Par défaut : le jour même seulement. | L8 |
| L8-5 | S0 corrigé à part, avant L8 ? **Tranché : oui** (§1c). | S0 |
| Seuil | **Décision Moussa** (pas le directeur) : seuil de pertes à 10,0 % pile — alerte (`>=`) ou non (`>`) ? **`>=` provisoire** depuis le 10/11/2026 (`purchases/loss-rate.ts`), à trancher après la réponse à Q_B2 ou plus tôt. | L5 / STK-1 |

Ne pas implémenter de choix sur ces points sans réponse ; si une hypothèse par défaut est utilisée, la rendre configurable et la signaler.

## 12. Ce que Claude ne doit pas deviner — et contrainte de flexibilité

### Ne jamais deviner (lire §1b, §5, §11 ou demander)
- La composition des équipes par item et le nombre d'agents.
- Les zones (OLT et zones d'affectation SOFATELCOM) et la 4ᵉ zone SOFATELCOM, encore à préciser.
- La chaîne de sous-traitance et les pourcentages.
- La règle de visibilité « chacun ne voit que ce qui le concerne », à appliquer côté API (§5).
- Le fait que le mobile n'est pas prioritaire (§1c).
- Le seuil de pertes `>=` 10 %, provisoire (§11).
- Toute réponse métier encore ouverte (§11) : poser la question, ne pas supposer.

### Flexibilité : exigence de conception, pas une alternative aux données réelles
Les chiffres de §1b sont la réalité actuelle d'ONECOMIT ; le code doit pourtant accepter d'autres configurations (3, 5, 10 agents ; 2, 6 zones ; 1, 3 chefs…) **sans modification de code**.
- Jamais de logique liée à un nombre ou à un nom réel : pas de `if (agents.length === 7)`, pas de `const ZONES = ['Mbour', …]`.
- Les données réelles vivent en **base ou en configuration** (seed, table, JSON) : compositions dans `items.team_composition`, zones dans `zones`, pourcentages dans `pricing_rules`, répartition chef/binôme dans `teams.repartition_chef_pct`.
- Le code lit ces valeurs, il ne les connaît pas.

Listes encore figées dans le code (constat du 11/11/2026, à rendre configurables si le métier l'exige ; voir backlog) :
| Liste | Où | Effet |
|---|---|---|
| `ITEM_CODES` (6 items) | `items/entities/item.entity.ts`, validé par `@IsIn` | un 7ᵉ item demande une modification de code |
| `MISSION_TYPES` (12) | `missions/entities/mission-type-template.entity.ts` | idem pour un nouveau type |
| `EQUIPE_ROLES` (7 rôles) | `items/entities/item.entity.ts` | idem pour un nouveau rôle d'équipe |
| `PRICE_GRIDS` (2 grilles) | `partners/entities/partner.entity.ts` | idem pour une 3ᵉ grille |
| `PRESTATIONS` (6 clés) | `pricing/prestations.ts` | volontaire : alignées sur les factures |
| Seuil de pertes 10 % | `purchases/loss-rate.ts` | devrait devenir un paramètre du tenant |
| Jours fériés 2026 | `permanence/permanence.module.ts` | PER-1 |
| Table de noms de zones | `reports/performance-dashboard.service.ts` (normalisation d'affichage) | à vérifier si de nouvelles zones apparaissent |

Les listes de **statuts** (workflow : brouillon/validée, signalement/en cours…) restent dans le code : ce sont des états de l'application, pas de la configuration métier.
