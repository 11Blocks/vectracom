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

### 🔴 Bloquant — fonctionnalité promise mais inutilisable

| # | Constat | Impact |
|---|---|---|
| **A1** | **Permanence (L2) : aucune interface.** Backend OK (génère + assigne les créneaux), mais **pas de page UI ni d'entrée menu**. Le directeur ne peut pas utiliser la rotation SAV/PROD. | Astreinte inopérante |
| **A2** | **Équipe → zone/pilote/item (L0/L4) : non câblé.** L'entité `teams` a `zoneId`/`pilotId`/`itemId`, mais ni les DTO/service backend, ni la page `/equipes` ne les exposent. Le test L0 « rattacher équipe → zone+pilote » est **impossible**. | Rattachement structurel bloqué |

### 🟠 Important — fait à moitié

| # | Constat | Impact |
|---|---|---|
| **B1** | **Répartition 65/35 (L6) : non éditable via UI.** Le champ `repartitionChefPct` est dans l'API, la page rémunération l'**affiche**, mais aucune page ne permet de le **modifier** (le « flexible » du directeur est seulement en API). | 65/35 figé |
| **B2** | **Stock « 5 rubriques » (L5) : seulement 3 familles** (`FIBRE`/`CUIVRE`/`OUTILLAGE`). Les 5 rubriques exactes restent à confirmer avec le directeur. | Classification incomplète |
| **B3** | **Rôle « gestionnaire flotte » (L4) : absent.** Seul `magasinier` existe ; le directeur veut « un gars pour le stock, un autre pour le véhicule ». | Second poste non couvert |

### 🟡 À clarifier / à consolider

| # | Constat | Impact |
|---|---|---|
| **C1** | **Import v2 « à l'identique » (L1) : partiel.** Le mapping colonnes gère **2 onglets** (`planning` + `affect`), pas les 5 feuilles réelles (PLANNING / SURCH / TRAITEES / DISPOSITIF / AFFECT). | Fidélité import incomplète |
| **C2** | **Facturation par équipe/groupe (L6) : partiel.** La répartition 65/35 (feuille de paie) est faite, mais **pas** d'agrégation de facture *par équipe* (la facture reste par client). À confirmer si requis. | Vue équipe manquante |

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
