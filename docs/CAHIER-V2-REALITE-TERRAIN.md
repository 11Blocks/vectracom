# VECTRACOM — Cahier des charges V2 « Réalité terrain »

**Date : 04/09/2026 — Référence : consolidation des 4 phases de documents ONECOMIT/SOFATELCOM/3STB/SONATEL**

Sources mémorisées : document ERP fondateur du directeur ONECOMIT ; FOCUS 31/07 (stock multi-dépôts) ;
suivis conso Mbour (26 450 lignes de formulaires) ; suivi modems F6600 (2 259 séries) ; RETOUR BT PROD FIBRE ;
PV photo (poteau planté, GC avant/pendant/après) ; rapports terrain ND_TYPE_CLIENT (SAV, INFRA, Survey+RIT) ;
fiche de transmission manuscrite WhatsApp ; **bordereau 3STB VALIDÉ 2025 (79 items)** ; fiche de chantier
DENSIF + PRESENCE 3STB ; **attachement ONECOMIT JUIN (9 feuilles, 26,9 M F HT)** ; validation équipes 3STB
(9 domaines) ; surveys OSM (Touba Mosquée, SONATEL DSI) ; PBO À CHANGER (26 PBO géolocalisés) ; flux remontées
WhatsApp (PIO/PBO/CHAMBRE) ; **Planning global FTTH 30/07/2026 (5 feuilles)**. En attente : 3 fichiers
« dashboard performance » ONECOMIT.

---

## 0. Décision d'architecture transverse : le Partenaire

ONECOMIT travaille pour **deux donneurs d'ordre** aux règles différentes :
- **SOFATELCOM** — exclusivité zone Mbour : maintenance + installation (grille propre : Survey 3 250 F,
  Survey+Installation 17 550 F, Relevé dérangement 5 000 F, Changement PBO 6 500 F…)
- **3STB** — national : extension/déploiement/GC (bordereau 2025 : 79 items GC lourds)

→ Le concept de **Partenaire** (avec sa grille tarifaire) doit exister : sur la mission, la facture,
l'attachement. C'est le prérequis de presque tout le Lot D.

---

## 1. Liste complète des améliorations

### A. Référentiels & données réelles
| # | Écart | Source |
|---|-------|--------|
| A1 | Bordereau seedé = 52 items conception ; réel = **79 items 3STB 2025** (conduites 700–1 050 F/m, chambres L2T–L6T 70 k–235 k, chaussée jusqu'à 450 k, mobilisation NRO 50–80 k, MEB 144 110 k, épissurage/fibre…) | Bordereau VALIDÉ 2025 |
| A2 | Une seule grille de prix ; réalité = **2 grilles** (SOFATELCOM prestation / 3STB bordereau) | Attachement juin |
| A3 | Import planning : colonnes manquantes **COPER, CommandeClient, TypeLogement, ClientAvisé, AGE, CI-PRCL, GPS EasyWork, SR** | Planning global |
| A4 | Feuilles **SURCH** (non affectés) et **TRAITEES** (97 col. CRM : motifs blocage, Backlog/Temps de cycle, marché, DRV, OVTO) non importées | Planning global |
| A5 | Équipes seedées génériques ; réalité = ~45 FTTH + 3 plantation/GC + 2 INFRA + 3 déploiement, **compositions différentes** (chef+binôme / chef+2 binômes / chef+5-6 journaliers) | ERP fondateur |

### B. Missions & exécution terrain
| # | Écart | Source |
|---|-------|--------|
| B1 | Champ **SR/PLAQUE** absent (ex. A07/PBO-82) alors qu'il structure tout (incidents, SAV, plantation) | Tous fichiers |
| B2 | **Motifs de blocage SONATEL** avec GPS intégrée (Zone inéligible_14.39…, Saturation, Absence Signal, RNR, Contrainte raccordement) ≠ nos 7 motifs d'échec | TRAITEES/PROD |
| B3 | **Catalogue d'actions SAV** normalisées (Reprise soudure PTO/PBO/BTI, Pigtail, Connecteur, Jarretière, Modem, Câble 1083, Reconfig ONT/ONT, Boîtier alim…) + issues **RELEVE / REOR / DEPLACEMENT** + champ **NBSI** (nb passages par ND) | Feuille SAV |
| B4 | Champs workflow : **Tâches validées CAP, VA CAP (OUI/NON), Pilote SONATEL nommé, Code opération** | Attachement |
| B5 | Fiche chantier DENSIF réelle : **bande métrique (départ/arrivée/distance), mesures 1310/1550 nm + dossier de mesures, gaine verte/grise, pré-recette, coordonnées GPS, signatures chef + superviseur** | Fiche 3STB + joj |
| B6 | Survey OSM : tableau **Central/PEP/PEZ-PMZ/Plaque/BPE**, **état GC existant** (long. aérien/souterrain, chambres, BPE joint 36FO, poteaux dont inclinés), besoins (câbles, poteau, baie, ODF) | Touba + DSI |
| B7 | Rapports terrain actuels sans convention ; réel = fichiers **ND_TYPE_CLIENT** (photos) | 4 rapports PDF |

### C. Incidents & remontées
| # | Écart | Source |
|---|-------|--------|
| C1 | Pas d'**export Excel par rubrique** (3 fichiers PIO/PBO/CHAMBRE) au format de l'agent transcripteur pour SONATEL | Directeur + workflow |
| C2 | **PBO À CHANGER** : import du format (zone/année/semaine/plaque/constitution/défaut/GPS/équipe) → incidents + missions « Changement PBO » 6 500 F | PBO xlsx |
| C3 | POI valorisées (implantation 6 500, normalisation câble 130 F/m, dépose appui 8 912, reconditionnement PBO 1 541,80) : incident → valorisation bordereau | Feuille POI |

### D. Facturation & attachement
| # | Écart | Source |
|---|-------|--------|
| D1 | Facture mono-grille ; réel = **attachement multi-feuilles par partenaire** : PROD (Survey/S+I/Installation/Config/Déplacement+remontée blocage), SAV (Relevé/Déplacement/Diagnostic), TS (Changement PBO, POI, Plantation, INFRA) | Attachement juin |
| D2 | Lignes réelles absentes : **CHARGE MAGASIN, REGULE PÉNALITÉS, RÉGULARISATION PROD, TENUS (pantalons), MACRON** (primes vestimentaires), TVA 18 % vérifiée | Synthèse attachement |
| D3 | INFRA : valorisation **reflectométrie 22 750 F + raccordement-soudure 2 275 F**, localisation TRANSPORT/DISTRIBUTION, n° de semaine | Feuille INFRA |
| D4 | Facture GC : travaux supplémentaires SAV valorisés au bordereau (conduite allégée 780/m, PVC 520/m…) | FACTURE GC MAI |

### E. RH & conformité
| # | Écart | Source |
|---|-------|--------|
| E1 | Validation équipes : ajouter les **9 domaines d'habilitation** (Déploiement Plaque, Densif FTTH, Extension FTTH, OSM, FTTM, Dévoiement, Réhabilitation, Backbone, Basculement Upgrade) + validation 3 étapes (documentaire/physique/compétences) | Validation 3STB |
| E2 | **Journaliers** (5-6 par équipe déploiement) : pointage, salaires — pas de concept | ERP + compositions |
| E3 | Notifications multicanal réelles : **sonore, SMS, WhatsApp, email** pour échéances (assurance, VT, entretien, documents) | ERP fondateur |

### F. Planning & dispositif
| # | Écart | Source |
|---|-------|--------|
| F1 | Vue **SURCH** (surcharge/débordement Touba, zones sans équipe) inexistante | Planning global |
| F2 | **DISPOSITIF** : grille quotidienne zones × instances × pilotes × équipes × axes (PL06/PL08/PL29/RJT29/A_MER/P_J) — le « qui travaille où » | Feuille DISPOSITIF |
| F3 | **Répartition automatique équilibrée** PROD/SAV/permanences (aléatoire uniforme, anti-répétition, contraintes admin) — l'Agent Planning IA propose | ERP fondateur |
| F4 | **AFFECT horaire** (heureDebut/heureFin/technicien) — dispatch du jour | Feuille AFFECT |
| F5 | Horizons planning : journalier ✅, semaine ✅, mois ✅ ; manque **trimestriel → annuel** | ERP fondateur |

### G. Stock
| # | Écart | Source |
|---|-------|--------|
| G1 | **Tracking modems par n° de série de bout en bout** (livraison SONATEL → carton → équipe → client, retours récupérés) — 2 259 F6600 tracés | Suivi modems |
| G2 | **Pièces récupérées** (bonnes/défectueuses) → circuit feraillerie (vente) | ERP fondateur |
| G3 | Import **FOCUS** (stock réel multi-dépôts DAKAR/MBOUR/KAOLACK, ~1 000 réf. FIBRE/CUIVRE avec commentaires) | FOCUS 31/07 |

### H. Comptabilité
| # | Écart | Source |
|---|-------|--------|
| H1 | **Appro caisse par rubrique** (carburant, outils rechange, dépannage véhicules, prestation équipes, salaires journaliers, prêts équipes) | ERP fondateur |
| H2 | **Comptabilité matière** (entrées/sorties valorisées) | ERP fondateur |

### I. Véhicules & outillage
| # | Écart | Source |
|---|-------|--------|
| I1 | Outillage par équipe (liste outillage) à suivre comme le stock | ERP fondateur |
| I2 | Notifications échéances multicanal (cf. E3) + entretien (vidange, cartouches, nettoyage) | ERP fondateur |

### J. Pilotage
| # | Écart | Source |
|---|-------|--------|
| J1 | Diagrammes par rubrique + **interprétation IA** (l'Assistant RAG peut porter l'interprétation) | ERP fondateur |
| J2 | **Dashboards performance ONECOMIT** (3 fichiers à venir) → à intégrer une fois reçus | Annonce directeur |
| J3 | KPI Optimax ✅ (78 indicateurs) — à brancher sur les nouvelles données (SR, VA CAP, NBSI) | Cumulé |

---

## 2. Plan complet proposé

> Principe : on garde tout, on ajoute et on améliore. Chaque lot est livrable et vérifiable
> (tsc 0 erreur, endpoints testés, pages vérifiées au navigateur), comme les lots précédents.

### LOT P1 — Fondations référentiels (priorité absolue)
1. **Partenaires** : entité `partners` (SOFATELCOM, 3STB) + champ sur mission/import/facture.
2. **Deux grilles tarifaires** : re-seed bordereau 3STB 2025 réel (79 items) + grille prestations
   SOFATELCOM (Survey 3 250, S+I 17 550, Relevé 5 000, Déplacement 1 500/1 950, Config 3 250…),
   versionnées, sélectionnées selon le partenaire de la mission.
3. **Import Planning global v2** : colonnes étendues (COPER, CommandeClient, TypeLogement,
   ClientAvisé, AGE, SR, GPS EasyWork, CI-PRCL) + feuille SURCH → missions non affectées en
   surcharge + feuille TRAITEES (motifs blocage, classification) en historique.
   *Test d'acceptation : importer le vrai `Planning global FTTH 30 07 2026.xlsx` → 244 missions
   + 19 surcharges, colonnes SR/AGE visibles.*

### LOT P2 — Missions fidèles à SONATEL
1. Champs missions : SR/PLAQUE, COPER, segment/marché, code opération, pilote SONATEL, VA CAP, NBSI.
2. **Motifs de blocage** enrichis avec extraction GPS automatique (ex. « Zone inéligible_14.39,-16.94 »).
3. **Catalogue d'actions SAV** (select normalisée) + issue RELEVE/REOR/DEPLACEMENT ; alimente la
   feuille SAV de l'attachement.
4. Fiche chantier DENSIF enrichie : bande métrique, mesures 1310/1550 nm, gaine verte/grise,
   pré-recette, GPS, double signature.
5. Template Survey OSM enrichi : infrastructures (Central/PEP/PEZ/BPE), état GC, besoins.
6. PV exportés au format **ND_TYPE_CLIENT.pdf**.

### LOT P3 — Incidents & remontées sans friction
1. **Export Excel par rubrique** (PIO / PBO / CHAMBRE) au format du fichier de l'agent → à envoyer
   à SONATEL (période de transition) ; SONATEL reste dans le groupe WhatsApp.
2. Import **PBO À CHANGER** (année/semaine/plaque/défaut/GPS) → incidents PBO + génération missions
   « Changement PBO » (6 500 F) sur validation humaine.
3. Valorisation POI/GC : incident PIO → lignes bordereau (implantation, normalisation au mètre,
   dépose, reconditionnement) → feuille POI de l'attachement.

### LOT P4 — Attachement & facturation réels
1. Facture par **partenaire** : attachement multi-feuilles (PROD/SAV/TS/POI/INFRA/GC).
2. Lignes spéciales : charge magasin, régule pénalités (lié au moteur KPI Optimax ✅),
   TENUS/MACRON, régularisation, TVA 18 %.
3. INFRA : reflectométrie + raccordement, semaine, localisation.
4. Export Excel « format ONECOMIT » (reproduction des 9 feuilles de juin) en plus du PDF.
   *Test d'acceptation : régénérer juin 2026 à partir des données plateforme ≈ 26 876 914 F HT.*

### LOT P5 — RH & conformité SONATEL
1. **9 domaines d'habilitation** par équipe + validation 3 étapes (doc/physique/compétences),
   export au format « VALIDATION EQUIPES 3STB ».
2. **Journaliers** : effectif variable des équipes déploiement, pointage chantier, salaires
   (relié à la feuille PRESENCE ✅ déjà conforme).
3. Notifications multicanal (SMS/WhatsApp/email + sonore web) sur échéances véhicules/documents/stocks.

### LOT P6 — Planning & dispositif
1. Vue **SURCH** (surcharge par zone, débordement).
2. **Module DISPOSITIF** : grille quotidienne zone × équipe × axe, roulement, génération depuis
   les équipes actives ; export au format SONATEL.
3. **Répartition automatique** (Agent Planning IA — propose, jamais décide) : équilibrage
   PROD/SAV/permanences, anti-répétition, contraintes admin ; validation humaine avant application.
4. AFFECT horaire (créneaux techniciens) + horizons trimestriel/annuel (vues agrégées).

### LOT P7 — Stock & logistique
1. **Parc sérialisé modems de bout en bout** : réception SONATEL (lot/carton) → équipe →
   installation client (ND lié) → retour récupéré ; recherche par série/ND ; état des parcs.
2. **Pièces récupérées** : statut bon/défectueux, circuit feraillerie (sortie valorisée).
3. Import FOCUS (référentiel réel multi-dépôts) + matching avec items bordereau.

### LOT P8 — Comptabilité & coûts
1. **Appro caisse par rubrique** (carburant, rechanges, dépannage, prestations, salaires
   journaliers, prêts équipes) avec justificatifs (extraction reçus IA ✅).
2. Comptabilité matière (valorisation mouvements ✅ stock → synthèse mensuelle).
3. Coût complet par véhicule (✅ événements) / équipe / chantier → rapports.

### LOT P9 — Pilotage
1. Rapports par rubrique avec diagrammes ✅ + **interprétation IA** via Assistant RAG (sources =
   données + documents).
2. Intégration des 3 **dashboards performance** ONECOMIT dès réception (vues équivalentes).
3. KPI Optimax : brancher les nouveaux champs (SR pour zones, VA CAP pour validations, NBSI
   pour répétitions).

### LOT P10 — Mobile (après validation web)
Équivalent terrain du web : missions par template, photos + pré-audit IA, conso matériel,
incidents avec GPS, présence, dépenses — synchronisation offline-first.

---

## 3. Ordre de réalisation & dépendances

| Phase | Lots | Dépend de |
|-------|------|-----------|
| 1 | P1 (partenaires, grilles, import v2) | — |
| 2 | P2 (missions fidèles) | P1 |
| 3 | P3 (incidents) + P4 (attachement) | P1, P2 |
| 4 | P5 (RH) + P6 (planning/dispositif) | — (P6 import v2 utile) |
| 5 | P7 (stock) + P8 (compta) | P1 (bordereau) |
| 6 | P9 (pilotage) + dashboards performance | tous |
| 7 | P10 (mobile) | web stabilisé |

Chaque lot : backend d'abord (entités + endpoints testés sur données réelles extraites des
fichiers fournis), puis front dans l'harmonie existante (palette, AppShell, pattern prototype),
puis vérification complète (tsc 0 erreur, endpoints 200, navigateur).
