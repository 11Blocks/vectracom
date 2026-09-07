import { Injectable } from '@nestjs/common';

/**
 * Raccourci vocal universel (bouton ambre) : décompose une commande vocale
 * en intention + entités et propose les actions. Jamais d'exécution directe.
 */
@Injectable()
export class VoiceShortcutService {
  processVoiceCommand(command: string, missionId?: string) {
    const text = command.toLowerCase();

    let intent = 'inconnu';
    if (/(cree|créé|creer|nouvel?le|ajoute).*(mission|sav|intervention)|mission sav/.test(text)) intent = 'creer_mission';
    else if (/cloture|clôtur|termine|terminé/.test(text)) intent = 'cloturer_mission';
    else if (/depense|reçu|recu|achat|carburant/.test(text)) intent = 'enregistrer_depense';
    else if (/incident|panne|poteau|cable|câble|pbo/.test(text)) intent = 'signaler_incident';
    else if (/conge|congé|absence/.test(text)) intent = 'demander_conge';
    else if (/stock|matiere|materiel/.test(text)) intent = 'consulter_stock';
    else if (/photo/.test(text)) intent = 'prendre_photo';

    const entities: Record<string, string> = {};
    const typeMatch = text.match(/\b(installation|survey|sav|osm|gc|infra|densification|deploiement|déploiement)\b/);
    if (typeMatch) entities.missionType = typeMatch[1].toUpperCase();
    const zoneMatch = text.match(/\b(?:a|à|sur)\s+([a-zéèà\s]{3,20})(?:\s+demain|\s+matin|\s+apres|$)/);
    if (zoneMatch) entities.zone = zoneMatch[1].trim();
    const timeMatch = text.match(/\b(\d{1,2})\s*h(eur)?s?\b/);
    if (timeMatch) entities.heure = `${timeMatch[1].padStart(2, '0')}:00`;
    if (text.includes('demain')) entities.quand = 'demain';
    const amountMatch = text.match(/(\d[\d\s]{2,})\s*(f|fcfa|franc)/);
    if (amountMatch) entities.montant = amountMatch[1].replace(/\s/g, '');

    const actionsByIntent: Record<string, string[]> = {
      creer_mission: ['ouvrir_formulaire_mission', 'pre_remplir_type', 'pre_remplir_zone'],
      cloturer_mission: ['ouvrir_etape_cloture', 'pre_remplir_compte_rendu'],
      enregistrer_depense: ['ouvrir_depense_rapide', 'pre_remplir_montant'],
      signaler_incident: ['ouvrir_signalement_incident', 'capturer_photo_gps'],
      demander_conge: ['ouvrir_demande_conge'],
      consulter_stock: ['ouvrir_stock_camionnette'],
      prendre_photo: ['ouvrir_appareil_photo'],
      inconnu: ['reformuler_commande'],
    };

    return {
      command,
      missionId: missionId ?? null,
      intent,
      entities,
      proposedActions: actionsByIntent[intent],
      autoExecute: false,
      note: 'Commande décomposée par l’IA — exécution après confirmation utilisateur',
    };
  }

  suggestActions(command: string) {
    return this.processVoiceCommand(command).proposedActions;
  }
}
