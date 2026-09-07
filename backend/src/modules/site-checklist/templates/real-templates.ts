/**
 * Fiche de chantier DENSIF réelle 3STB — template enrichi du lot P2
 * (source : « FICHE CHANTIER 3STB (1).xlsx » + « Fiche de chantier joj Mbour.pdf »).
 * Structure : en-tête OSM/client/site, bande métrique, items bordereau
 * cochables, mesures optiques 1310/1550 nm, pré-recette, GPS, signatures
 * chef d'équipe + superviseur.
 */
export const DENSIF_TEMPLATE = {
  templateType: 'DENSIF',
  label: 'Fiche de chantier DENSIF — 3STB 2025',
  description: 'Bande métrique, travaux bordereau, mesures optiques 1310/1550 nm, pré-recette, double signature',
  sections: [
    {
      section: 'En-tête',
      items: [
        { id: 'date', label: 'Date', type: 'date', required: true },
        { id: 'osm', label: 'OSM / N° de ligne', type: 'text', required: true },
        { id: 'client', label: 'Client', type: 'text', required: true },
        { id: 'siteSonatel', label: 'Site SONATEL', type: 'text' },
        { id: 'typeCable', label: 'Type de câble', type: 'select', options: ['1083', '1082', 'Huawei 10/83', 'Aérien 1-36 FO'] },
      ],
    },
    {
      section: 'Bande métrique',
      items: [
        { id: 'depart', label: 'Départ (chambre/poteau)', type: 'text', required: true },
        { id: 'arrivee', label: 'Arrivée (chambre/client)', type: 'text', required: true },
        { id: 'distance', label: 'Distance (m)', type: 'number', required: true },
        { id: 'gps', label: 'Coordonnées GPS', type: 'text' },
      ],
    },
    {
      section: 'Étiquetage & gaines',
      items: [
        { id: 'etiquetteChambre', label: 'Étiquetage chambre', type: 'boolean' },
        { id: 'etiquetteClient', label: 'Étiquetage client', type: 'boolean' },
        { id: 'etiquetteSite', label: 'Étiquetage site Sonatel', type: 'boolean' },
        { id: 'gaineFlexible', label: 'Pose gaine flexible', type: 'boolean' },
        { id: 'gaineVerte', label: 'Gaine verte (m)', type: 'number' },
        { id: 'gaineGrise', label: 'Gaine grise (m)', type: 'number' },
      ],
    },
    {
      section: 'Travaux (items bordereau)',
      items: [
        { id: 'conduiteEnrobee', label: 'Conduite enrobée (m)', type: 'number' },
        { id: 'conduiteAllegee', label: 'Conduite allégée (m)', type: 'number' },
        { id: 'tirageConduite', label: 'Aiguillage et tirage en conduite (m)', type: 'number' },
        { id: 'tirageAerien', label: 'Tirage câble aérien (m)', type: 'number' },
        { id: 'clouageFacade', label: 'Clouage façade (m)', type: 'number' },
        { id: 'refectionTrottoir', label: 'Réfection trottoir (m²)', type: 'number' },
        { id: 'refectionChaussee', label: 'Réfection chaussée (m²)', type: 'number' },
        { id: 'posePvcFourreau', label: 'Pose PVC dans fourreau acier (m)', type: 'number' },
        { id: 'encorbellement', label: 'Pose en encorbellement tuyau acier (m)', type: 'number' },
        { id: 'pinceAncrage', label: 'Pose pince ancrage/suspension', type: 'number' },
        { id: 'gaineProtection', label: 'Gaine de protection 3 m', type: 'number' },
        { id: 'nettoyageChambre', label: 'Nettoyage chambre', type: 'number' },
        { id: 'chambreL2T', label: 'Chambre L2T', type: 'number' },
        { id: 'fixationBpeChambre', label: 'Fixation BPE dans chambre', type: 'number' },
        { id: 'fixationBpePoteau', label: 'Fixation BPE sur poteau', type: 'number' },
        { id: 'deviation12fo', label: 'Déviation 12 FO sur joint existant', type: 'number' },
      ],
    },
    {
      section: 'Mesures optiques',
      items: [
        { id: 'mesure12fo', label: 'Mesure section 12 FO tête-à-tête 1310/1550 nm', type: 'boolean' },
        { id: 'mesure24fo', label: 'Mesure section 24 FO tête-à-tête 1310/1550 nm', type: 'boolean' },
        { id: 'dossierMesures', label: 'Dossier de mesures fourni', type: 'boolean' },
        { id: 'teteCable12', label: 'Pose/raccordement tête câble 12 FO', type: 'number' },
        { id: 'teteCable24', label: 'Pose/raccordement tête câble 24 FO', type: 'number' },
      ],
    },
    {
      section: 'Pré-recette & signatures',
      items: [
        { id: 'preRecette', label: 'Pré-recette réalisée', type: 'boolean' },
        { id: 'observations', label: 'Observations', type: 'text' },
        { id: 'signatureChef', label: 'Signature chef d\'équipe', type: 'photos', required: true },
        { id: 'signatureSuperviseur', label: 'Signature superviseur', type: 'photos', required: true },
      ],
    },
  ],
};

/**
 * Survey OSM réel — template enrichi du lot P2
 * (source : « SURVEY OSM TOUBA MOSQUEE.xlsx » + « Fiche de survey OSM SONATEL DSI.pdf »).
 */
export const SURVEY_OSM_TEMPLATE = {
  templateType: 'SURVEY_OSM',
  label: 'Fiche de survey OSM — SONATEL',
  description: 'Infrastructure (Central/PEP/PEZ-PMZ/Plaque/BPE), état GC existant, besoins, signature',
  sections: [
    {
      section: 'En-tête',
      items: [
        { id: 'typeProjet', label: 'Type de projet', type: 'select', options: ['OSM', 'Extension', 'Densification'], required: true },
        { id: 'nomClient', label: 'Nom du client', type: 'text', required: true },
        { id: 'prestataire', label: 'Prestataire', type: 'text' },
        { id: 'gpsTrace', label: 'Position nouvelle — coordonnées GPS du tracé', type: 'text', required: true },
      ],
    },
    {
      section: 'Infrastructure (une ligne par ouvrage)',
      items: [
        { id: 'central', label: 'Central', type: 'text' },
        { id: 'pep', label: 'PEP', type: 'text' },
        { id: 'pezPmz', label: 'PEZ / PMZ', type: 'text', required: true },
        { id: 'plaque', label: 'Plaque', type: 'text' },
        { id: 'bpe', label: 'BPE', type: 'text' },
        { id: 'commentaireInfra', label: 'Commentaire (occupé, enterré…)', type: 'text' },
      ],
    },
    {
      section: 'État GC aéro/souterrain existant',
      items: [
        { id: 'longAerien', label: 'Longueur aérien (m)', type: 'number' },
        { id: 'longSouterrain', label: 'Longueur souterrain (m)', type: 'number' },
        { id: 'chambresExistantes', label: 'Chambres existantes', type: 'number' },
        { id: 'bpeExistant', label: 'BPE existant (ex. joint 36FO)', type: 'text' },
        { id: 'poteauxExistants', label: 'Poteaux existants', type: 'number' },
        { id: 'poteauxInclines', label: 'Poteaux incliné(s)', type: 'number' },
      ],
    },
    {
      section: 'Besoins',
      items: [
        { id: 'besoinCables', label: 'Câbles (m)', type: 'number' },
        { id: 'besoinPoteaux', label: 'Poteaux', type: 'number' },
        { id: 'besoinBaie', label: 'Baie client', type: 'number' },
        { id: 'besoinOdf', label: 'ODF', type: 'number' },
        { id: 'dispoRack', label: 'Disponibilité rack pour ODF', type: 'boolean' },
      ],
    },
    {
      section: 'Signature',
      items: [
        { id: 'nomPrenom', label: 'Nom - Prénom', type: 'text', required: true },
        { id: 'signature', label: 'Signature', type: 'photos' },
      ],
    },
  ],
};
