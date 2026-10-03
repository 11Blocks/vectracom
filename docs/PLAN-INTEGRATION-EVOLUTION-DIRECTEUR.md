# VECTRACOM — Plan d'intégration de l'évolution « réunion directeur ONECOMIT »

> **Statut : validé par Moussa (Green-T).** Document figé le 03/10/2026.
> Principe directeur : **on ne modifie pas l'existant, on croise pour enrichir.**

---

## 1. Verdict

L'évolution issue de la réunion directeur (document « Correction à faire » + fichiers réels) est **cohérente et n'invalide rien** : elle ajoute une couche de réalité métier au-dessus des 20 modules existants. Techniquement = **ajouter des entités transverses + des surcouches (filtres, vues, workflows)**, sans casser ce qui tourne sur le VPS.

## 2. La taxonomie : 6 Items (domaines)

L'**Item** est un axe métier de niveau 1, **au-dessus** du `missionType` (11 types, désormais 12 avec BTS).

| Item | missionType couverts |
|---|---|
| FTTH | INSTALLATION, SURVEY, SAV, SURVEY_OSM |
| INFRA | INFRA |
| Plantation & GC (PP_GC) | PLANTATION, GC, DEVOIEMENT |
| Extension/Densification (EXT_DENSIF) | DENSIFICATION, OSM |
| Déploiement (DEPLOIEMENT) | DEPLOIEMENT |
| BTS (NOUVEAU) | BTS |

L'Item porte : la **composition type d'équipe**, la **conformité type**, la **grille tarifaire**.

## 3. Chaîne de sous-traitance à 3 niveaux + cascade tarifaire

```
SONATEL (racine)
 └─ Niveau 1 : SOFATELCOM
      └─ Niveau 2 : ONECOMIT
           └─ Niveau 3 : ABC SARL / agent (ASSANE DIENG, Malamine…)
```

**Rémunération en cascade de pourcentages** (prouvée par les fichiers MOUHAMED NDOUR et ASSANE DIENG) :

| Lien | % | Exemple « Survey+Installation APP » |
|---|---|---|
| SONATEL → SOFATELCOM | racine | **27 000** |
| SOFATELCOM → ONECOMIT | **65 %** | **17 550** |
| ONECOMIT → niveau 3 | **80 %** | **14 000** |

Les % **varient par item** (S+I APP 80 %, PASSAGE 87 %, Survey 93 %, RELEVE 91 %).
En aval : déduction des charges (carburant, mécanique, location) → **répartition chef/binôme 65/35** (flexible).

## 4. Règle Import SONATEL ≠ Missions

| Menu | Rôle | Libellé |
|---|---|---|
| **IMPORT SONATEL** | importe tout le global planning (5 feuilles, 23 colonnes) **à l'identique** | = colonnes SONATEL exactes (« client » reste « client ») |
| **MISSION** | uniquement les ajouts du directeur | libellés identiques au global planning |
| Nom de mission | suffixe **« -OT »** | ex. « Installation-OT » |

## 5. DISPOSITIF (structure réelle — photo 27/09/2026)

```
Colonnes :  Zones/Équipes   |   Pilotes   |   Instances
```
- Zones au format `nom x/y` : Mbour 53/53, Thiès 5/5, Tivaouane 4/4…
- Pilotes (groupe de chefs) : ABOUBAKRY, Awa Sonko, Marième Diallo, Assane Ndiaye, Ndeye Boury Diop
- Instances = nombre par chef (1–8) ; total 376 (Mbour 354).

## 6. Formats de données réels à respecter

| Feuille | Colonnes clés |
|---|---|
| ATTACHEMENT (facture) | `QTT × PRIX = TOTAL TTC` + `TVA 18 %` |
| PROD | + `Motif blocage OT` (GPS intégré) + `Tâches validées CAP` |
| SAV | + `PILOTE` + `NB` (passages) + `STATUT` (RELEVE/REOR) |

## 7. Primitives structurantes (7)

| # | Primitive | Débloque |
|---|---|---|
| P1 | **Item** (6) | navigation par domaine, équipe/conformité/grille par item |
| P2 | **Zone + Groupe + Pilote** | rattachement, groupes, pilotes, renforts |
| P3 | **Permanence** (rotation SAV/PROD + week-ends/fériés) | astreinte sans refus |
| P4 | **Renfort + frais** (perdiem/carburant/logement) | zone→zone + compta |
| P5 | **Cascade tarifaire multi-niveaux** | marge amont/aval par item |
| P6 | **Rémunération 65/35** | feuille de paie équipe |
| P7 | **Satisfaction client** | note qualité + comportement |

## 8. Conflits réconciliés (croiser, pas supprimer)

- **Emplacements = dépôts** (directeur) vs **véhicule = entrepôt VEHICLE** (conception) → deux concepts distincts.
- **Item = domaine** vs **missionType** → Item (niveau 1) au-dessus de missionType (niveau 2).
- **65/35 « flexible »** → pourcentage configurable par équipe/contrat (65/35 en défaut).

## 9. Lots (ordre + dépendances)

| Lot | Contenu | Test d'acceptation |
|---|---|---|
| **L0** | Item + Zone/Groupe/Pilote + partenaires multi-niveaux + cascade tarifaire | CRUD Item/Zone/Pilote ; rattacher équipe → zone+pilote |
| **L1** | Import v2 à l'identique (libellés SONATEL, 5 feuilles) + séparation Import/Mission + « -OT » | importer → 244 missions + 19 surcharges |
| **L2** | Permanence + filtres Tech/Zone + rajouts + blocages levés | planning de permanence annuel |
| **L3** | Navigation Item + affectation groupe + renfort + frais | renfort Thiès→Dakar +1000/j/membre |
| **L4** | Composition par Item + dossiers + journaliers + rôles stock/flotte | équipe DÉPLOIEMENT = 2 tireurs+1 raccordeur+4 journaliers |
| **L5** | Stock 5 rubriques + achat validé SONATEL + seuil 10 % + emplacements=dépôts | perte >10 % → alerte sanction |
| **L6** | Facturation équipe/groupe + cascade 65/35 + export ATTACHEMENT | régénérer feuille AD/BD |
| **L7** | Cartographie zones productives/saturées/bloquées + satisfaction client | carte Mbour + classement équipes |
| **L8** | Mobile (réplication terrain) | — |

## 10. Questions restantes

1. Format `zone x/y` : équipes prévues/affectées, ou équipes/instances ?
2. « Instances » = techniciens par chef, ou interventions actives ?
3. Le « niveau 2 » de la chaîne correspond-il toujours à ONECOMIT (ou un intermédiaire existe-t-il dans certains cas) ?
4. Satisfaction client : quel canal (SMS/WhatsApp/app) et qui répond ?

## 11. Statut L0 (implémenté le 03/10/2026)

- Migration `012_items_zones_pilotes_pricing.sql` (items, zones, pilotes, pricing_rules + colonnes).
- Entités : `Item`, `Zone`, `Pilote`, `PricingRule` + colonnes sur Team/Technician/Mission/MissionTypeTemplate/Partner.
- Modules + endpoints : `/items`, `/zones`, `/pilotes`, `/pricing-rules`.
- Seeds : `seed-items.ts` (6 domaines), `seed-zones-pilotes.ts`.
- BTS ajouté aux `MISSION_TYPES`.

## 12. Statut L1 → L3 (implémenté le 03/10/2026)

| Lot | Contenu | Vérifié |
|---|---|---|
| **L1** | normalisation `type_tache` (backfill 1043) + suffixe « -OT » + label Backlog | endpoints + UI |
| **L2** | permanence (rotation SAV/PROD) + filtres Tech/Zone + rajouts (`rajout=true` à la création manuelle) + blocages levés (`POST /missions/:id/lever-blocage` → reprogrammation) | 110 créneaux, 57 blocages filtrables, lever-blocage testé |
| **L3** | renforts zone→zone (`/renforts`, perdiem/jour/membre + coût calculé) + frais de mission (`/mission-expenses`, carburant/repas/logement/perdiem/autre + synthèse) | CRUD testé, coût = jours × membres × perdiem |
| **L4** | composition d'équipe par Item (page `/items`, onglet par domaine, composition éditable) + enrichissement technicien (fonction, item, zone, dossier CNI/CV/diplôme) | 6 items aux compositions exactes (DÉPLOIEMENT = 2 tireurs+1 raccordeur+4 journaliers), update technicien testé |
| **L5** | achats validés SONATEL (`/stock-purchases`, workflow en_attente → valide_sonatel → facture) + suivi pertes (taux par article, alerte sanction > 10 %) + mouvement `perte` | CRUD + workflow testés, pertes summary 11 articles, seuil 10 % |
| **L6** | rémunération équipe 65/35 (`/remuneration`, feuille de paie par équipe/période, répartition chef % éditable) | 56 équipes, 100 000 → 65 000 chef / 35 000 binôme |
