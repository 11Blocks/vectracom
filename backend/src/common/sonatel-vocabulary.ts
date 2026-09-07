/**
 * Vocabulaire métier SONATEL normalisé — issu des fichiers réels
 * (TRAITEES/PROD de l'attachement, feuille SAV 1 033 lignes).
 * Utilisé par l'import, le formulaire terrain et la facturation.
 */

/** Motifs de blocage SONATEL (colonne « Motif blocage OT » / « Client avisé »). */
export const SONATEL_BLOCAGE_MOTIFS = [
  { value: 'zone_ineligible', label: 'Zone inéligible fibre', keywords: ['zone inéligible', 'ineligible'] },
  { value: 'saturation', label: 'Saturation (PBO/MEB)', keywords: ['saturation', 'sature'] },
  { value: 'absence_signal', label: 'Absence de signal', keywords: ['absence signal', 'abs au pbo', 'abs de signal'] },
  { value: 'rnr', label: 'RNR (réseau non raccordable)', keywords: ['rnr'] },
  { value: 'deploiement_en_cours', label: 'Déploiement en cours', keywords: ['deploiement en cours', 'déploiement en cours'] },
  { value: 'contrainte_raccordement', label: 'Contrainte de raccordement', keywords: ['contrainte raccordement'] },
  { value: 'poteau_a_planter', label: 'Poteau à planter', keywords: ['poteau à planter', 'poteau a planter'] },
  { value: 'gc_a_faire', label: 'Travaux génie civil à faire', keywords: ['genie civile', 'génie civil', 'gc a faire'] },
  { value: 'client_injoignable', label: 'Client injoignable', keywords: ['client injoignable', 'injoignable'] },
  { value: 'desistement_client', label: 'Désistement client', keywords: ['desistement', 'désistement'] },
  { value: 'blocage_client', label: 'Blocage client (report/refus)', keywords: ['blocage client'] },
  { value: 'mauvaise_adresse', label: 'Mauvaise adresse', keywords: ['mauvaise adresse'] },
  { value: 'pas_de_plan_b', label: 'Pas de plan B', keywords: ['pas de plan b'] },
  { value: 'attente_validation_ci', label: 'Attente validation CI', keywords: ['attente validation', 'attente autorisation'] },
  { value: 'rupture_poteau', label: 'Rupture poteau SONATEL', keywords: ['rupture poteau'] },
] as const;

/** Catalogue des actions SAV réelles (feuille SAV de l'attachement — 1 033 lignes analysées). */
export const SAV_ACTIONS = [
  { value: 'reprise_soudure_pto', label: 'Reprise soudure au PTO' },
  { value: 'reprise_soudure_pbo', label: 'Reprise soudure au PBO' },
  { value: 'reprise_soudure_bti', label: 'Reprise soudure au BTI' },
  { value: 'reprise_soudure_bpe', label: 'Reprise soudure au BPE' },
  { value: 'pigtail_change', label: 'Pigtail changé' },
  { value: 'connecteur_change', label: 'Connecteur changé (PBO/PTO)' },
  { value: 'jarretiere_change', label: 'Jarretière optique changée' },
  { value: 'modem_change', label: 'Modem changé' },
  { value: 'cable_1083_change', label: 'Câble 1083 changé / repris' },
  { value: 'reconfig_ont', label: 'Reconfiguration ONT/modem (IPV4…)' },
  { value: 'boitier_alim_change', label: "Boîtier d'alimentation changé" },
  { value: 'cable_alim_change', label: "Cable d'alimentation changé" },
  { value: 'pose_piton', label: 'Pose de piton + normalisation' },
  { value: 'lovage_pto', label: 'Normalisation lovage PTO' },
  { value: 'tirage_cable', label: 'Reprise tirage câble' },
  { value: 'abs_pbo_traitement', label: 'ABS au PBO traité' },
  { value: 'signal_corrige', label: 'Signal hors norme corrigé' },
] as const;

/** Issues d'une intervention SAV (attachement : colonne ACTION EFFECTUEE). */
export const SAV_OUTCOMES = [
  { value: 'RELEVE', label: 'Relevé (dépannage réalisé)' },
  { value: 'REOR', label: 'Réorientation (abs signal/technique)' },
  { value: 'DEPLACEMENT', label: 'Déplacement (facturé sans relève)' },
] as const;

/** Classifie un texte libre de blocage SONATEL → motif normalisé + GPS éventuel. */
export function classifyBlocage(text: string): { motif: string | null; label: string | null } {
  const t = text.toLowerCase();
  for (const m of SONATEL_BLOCAGE_MOTIFS) {
    if (m.keywords.some((k) => t.includes(k))) {
      return { motif: m.value, label: m.label };
    }
  }
  return { motif: null, label: null };
}
