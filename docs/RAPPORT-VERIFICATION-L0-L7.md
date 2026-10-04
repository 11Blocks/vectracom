# VECTRACOM — Rapport de vérification L0 → L7 (production)

**Date : 03/10/2026 · VPS : 83.228.222.179 · Branch : main (`74908eb`)**

Méthode : smoke test HTTP de tous les endpoints en prod + relecture du code
(DTO/services/pages) pour détecter ce qui est promis mais non câblé.

---

## 1. Ce qui fonctionne en production (vérifié HTTP 200)

| Lot | Endpoints | Statut |
|---|---|---|
| **L0** | `/items`, `/zones`, `/pilotes`, `/pricing-rules` | ✅ |
| **L1** | `/missions` (filtre zone, libellés -OT) | ✅ |
| **L2** | `/permanence` (backend) | ✅ backend |
| **L3** | `/renforts`, `/mission-expenses` | ✅ |
| **L4** | `/items` (composition), `/technicians` (fonction/item/zone/dossier) | ✅ |
| **L5** | `/stock-purchases`, `/stock-purchases/pertes` | ✅ |
| **L6** | `/remuneration` | ✅ |
| **L7** | `/cartographie/zones`, `/cartographie/equipes`, `/cartographie/feedback` | ✅ |
| **Stock** | `/warehouses`, `/stock-items`, `/stock-movements`, `/stock-serials` | ✅ |

Compteurs réels : 6 items · 18 zones · 5 pilotes · 56 équipes · 12 zones cartographiées ·
80 KPI SONATEL (sept.) · 57 missions bloquées filtrables.

---

## 2. Trous / omissions / à améliorer (par priorité)

### ✅ Résolus (04/10/2026)

| # | Action | Lot |
|---|---|---|
| A1 | Page `/permanence` + `PUT /permanence/:id` (assignation par créneau) | L2 |
| A2 | `zoneId`/`pilotId`/`itemId` câblés équipe (backend + page `/equipes`) | L0/L4 |
| B1 | Répartition 65/35 éditable via page équipes | L6 |
| B3 | Rôle `gestionnaire_flotte` (véhicules + nav dédiée) | L4 |

### 🟡 Restants

| # | Constat | Bloqué par |
|---|---|---|
| **B2** | Stock « 5 rubriques » (seulement FIBRE/CUIVRE/OUTILLAGE) | confirmation des 5 rubriques exactes |
| **C1** | Import v2 « 5 feuilles à l'identique » (seulement planning+affect) | cadrage (long) |
| **C2** | Facturation par équipe/groupe (la facture reste par client) | confirmation si requis |

---

## 3. Plan d'action priorisé

| Ordre | Action | Lot | Effort | Débloque |
|---|---|---|---|---|
| 1 | **Page `/permanence`** : vue calendrier des créneaux, génération annuelle, assignation rotation, menu. | L2 | M | Astreinte utilisable |
| 2 | **Câbler `zoneId`/`pilotId`/`itemId` + `repartitionChefPct`** dans DTO+service équipe **et** la page `/equipes` (sélecteurs zone/pilote/item + champ répartition %). | L0/L4/L6 | M | Rattachement + 65/35 éditable |
| 3 | **Rôle `gestionnaire_flotte`** (vehicles) + filtre menu. | L4 | S | Second poste |
| 4 | **5 rubriques stock** : confirmer la liste, étendre `STOCK_FAMILIES`. | L5 | S (après confirmation) | Classification |
| 5 | **Import v2 5 feuilles** : étendre `column-mapping` (sheetType + SURCH/TRAITEES/DISPOSITIF). | L1 | L | Fidélité SONATEL |
| 6 | **Facturation par équipe** (agrégat missions→facture par équipe). | L6 | L | Vue équipe (si confirmé) |

Effort : S = court · M = moyen · L = long (nécessite cadrage).

---

## 4. Bilan honnête

- **L0, L2(backend), L3, L5, L6, L7** : livrés et **vérifiés en prod**.
- **L1** : normalisation + « -OT » OK ; l'import « 5 feuilles à l'identique » est **partiel**.
- **L2** : backend OK, **UI manquante** (permanence).
- **L4** : composition + dossier technicien OK ; **rattachement équipe (zone/pilote/item) et rôle flotte manquants**.
- **L6** : 65/35 OK ; **édition via UI et facturation par équipe manquantes**.

**Rien n'est cassé en prod** (tous les endpoints répondent 200) — les lacunes sont des
« promis mais pas câblés », pas des régressions. Priorité : **A1 → A2 → B1**.
