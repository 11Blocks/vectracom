# VECTRACOM — Backlog des corrections secondaires

> Créé le 10/11/2026 après l'audit des modules L0–L7. **Aucune de ces corrections n'est codée.**
> Prérequis commun : les correctifs d'isolation tenant (`fix(security)`) sont en place.
> Effort : S ≤ ½ j · M ≈ 1–2 j · L ≥ 3 j. Sévérité : 🔴 argent/données faux · 🟠 fonctionnel · 🟡 robustesse.

## Classement par ratio impact / effort

| Rang | ID | Correction | Sévérité | Effort | Dépendances |
|---|---|---|---|---|---|
| 1 | **MIG-1** ✅ (11/11/2026, `3a92e6c`) | `apply-migrations.sh` : appliquer toutes les migrations en `-1 -v ON_ERROR_STOP=1`, au lieu de 001→005 avec erreurs ignorées | 🔴 une installation neuve n'a pas les tables L0–L7 | S | aucune |
| 1b | **MIG-2** ✅ (11/11/2026) — 021 appliquée en prod, sans effet | Dérive de schéma : 14 tables (chat_*, daily_*, dispositif_entries, geofence_zones, geopositions, rag_*, recruitment_candidates, settings_change_logs, vehicle_events, vision_uploads) n'ont aucune migration ; une base neuve échoue à 011. Rattrapage : `CREATE TABLE IF NOT EXISTS recruitment_candidates` en tête de 011 + migration 021 recréant les 13 autres à l'identique du schéma prod (lecture seule `pg_dump -s`), sans effet sur dev/prod | 🔴 installation neuve impossible | M | MIG-1 |
| 1c | **MIG-3** ✅ option B (11/11/2026) | Dérive de colonnes : une base neuve (001→021) diffère de la prod sur 53 tables — 46 colonnes absentes (missions ×19, warehouses ×8, item_serials ×8, des `updated_at`…), 119 types (`timestamptz` vs `timestamp`…), 152 NULL/NOT NULL, 6 défauts. Option A : migration 022 d'alignement (≈ 320 changements gardés par des conditions, sans effet sur la prod). Option B : schéma de référence = `pg_dump -s` de la prod pour les installations neuves, les migrations ne servant qu'ensuite | 🔴 base neuve inutilisable par le backend | A : L · B : M | MIG-2 |
| 1d | **MIG-4a** (trouvé 11/11/2026, à trancher plus tard) | Aligner la prod : créer les 28 index réellement absents de la prod (dont l’unique `uq_company_settings_company`) et la clé `fk_mission_team` (missions → teams), après vérification en lecture seule des doublons de données et des missions orphelines | 🟡 base neuve plus stricte que la prod, aucun risque de plantage | M | MIG-3 |
| 1e | **MIG-4b** (trouvé 11/11/2026, à trancher plus tard) | Retirer des migrations 001 et 002 les 38 index qui doublent un index prod existant sous un autre nom | 🟡 index inutiles sur une base neuve | S | MIG-3 |
| 2 | **PAY-1** ✅ (codé 11/11/2026, à valider) | Payroll : refuser toute modification d'une feuille au statut `validee` (400) | 🔴 une paie validée peut être réécrite | S | aucune — active le `it.todo` correspondant |
| 3 | **PRC-1** | Pricing : pourcentage ≤ 100, revalidé aussi en modification (aujourd'hui ≤ 1000, et `update` accepte NaN) ; parent ≠ enfant ; `effectiveFrom` ≤ `effectiveTo` | 🔴 règle de cascade aberrante possible | S | à faire avec la cascade (`computeCascade`) |
| 4 | **STK-1** | Pertes : alerte si 0 entrée et pertes > 0 ; trancher définitivement le seuil `>=` (provisoire) ou `>` | 🟠 perte non signalée | S | décision Moussa sur le seuil — active le `it.todo` |
| 5 | **TER-1** | Territory/partners : renvoyer 400 (et non 500) sur nom de zone déjà pris en modification | 🟡 erreur 500 visible | S | aucune |
| 6 | **ITM-1** | Items : valider `missionTypes` contre `MISSION_TYPES`, refuser qu'un type appartienne à deux items, valider le contenu de `teamComposition` | 🟠 navigation par item incohérente | S | aucune |
| 7 | **PRC-2** | Pricing : refuser les cycles dans la chaîne et les périodes d'effet qui se chevauchent pour un même couple parent/enfant/prestation | 🔴 cascade indéterminée | M | migration 020 (`prestation_key`) + `computeCascade` |
| 8 | **PER-1** | Permanence : jours fériés paramétrables par année (Pâques, Ascension, Pentecôte calculés ; Korité, Tabaski, Maouloud, Tamkharit saisis) — aujourd'hui figés sur 2026 | 🟠 calendrier faux dès 2027 | M | table ou paramètre tenant pour les fêtes lunaires |
| 9 | **PER-2** | Permanence : rotation équitable tenant compte de l'historique (aujourd'hui repart de zéro à chaque appel) | 🟠 astreinte inéquitable | M | PER-1 conseillé avant |
| 10 | **PAR-1** | Partners : `exclusiveZone` → lien vers `zones` (FK) ; rendre `level` et `parentPartnerId` modifiables via l'API | 🟠 chaîne de sous-traitance non éditable | M | migration de données (texte → zone_id) ; utile à la cascade |
| 11 | **PAY-2** | Payroll : calculer le revenu depuis les missions validées de la période et déduire les charges (carburant, mécanique, location) avant 65/35 | 🔴 revenu saisi à la main | L | `computeCascade` + frais de mission (L3) ; règles de déduction à confirmer |

## Ordre proposé

1. **Lot rapide (≈ 2 j)** : MIG-1, PAY-1, PRC-1, STK-1, TER-1, ITM-1 — indépendants, chacun avec ses tests.
2. **Avec la cascade tarifaire** : PRC-2, puis PAR-1.
3. **Permanence** : PER-1 puis PER-2.
4. **En dernier** : PAY-2 (dépend de la cascade et d'une validation métier des charges déductibles).

## Hors backlog (suivis ailleurs)

- Cascade tarifaire `computeCascade` + migration 020 `prestation_key` — plan validé, implémentation à venir.
- B2 / C1 / C2 et questions Q1–Q4 — `docs/QUESTIONS-DIRECTEUR-ONECOMIT.md`.
- L8 mobile — bloqué (déploiement des correctifs tenant, endpoints chef d'équipe, visibilité rémunération).
