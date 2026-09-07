import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AFFECT_TARGET_FIELDS,
  PLANNING_TARGET_FIELDS,
  SheetType,
  SonatelColumnMapping,
} from './column-mapping.entity';

/** Mapping par défaut d'un fichier SONATEL standard (colonnes habituelles). */
export const DEFAULT_PLANNING_MAPPING: Array<{ sourceColumnName: string; targetField: string }> = [
  { sourceColumnName: 'Demande', targetField: 'dossierNumber' },
  { sourceColumnName: 'NomduClient', targetField: 'client' },
  { sourceColumnName: 'Tâches', targetField: 'task' },
  { sourceColumnName: 'Adresse', targetField: 'zone' },
  { sourceColumnName: "Dated'intervention", targetField: 'dateMission' },
  { sourceColumnName: 'OLT', targetField: 'olt' },
  { sourceColumnName: 'CommandeClient', targetField: 'produit' },
  { sourceColumnName: 'ST', targetField: 'subcontractor' },
  { sourceColumnName: 'EQUIPE', targetField: 'equipe' },
  { sourceColumnName: 'Segment', targetField: 'segment' },
  { sourceColumnName: 'COPER', targetField: 'coper' },
  { sourceColumnName: 'CommandeClient', targetField: 'commandeClient' },
  { sourceColumnName: 'Typedelogement', targetField: 'typeLogement' },
  { sourceColumnName: "Client avisé", targetField: 'clientAvise' },
  { sourceColumnName: 'Contactclient', targetField: 'contactClient' },
  { sourceColumnName: 'Heure', targetField: 'heure' },
  { sourceColumnName: 'AGE', targetField: 'ageDays' },
  { sourceColumnName: 'SR', targetField: 'srPlaque' },
  { sourceColumnName: 'CoordonnéesGPSsurEasyWork', targetField: 'gpsEasyWork' },
  { sourceColumnName: 'CI-PRCL', targetField: 'ciPrcl' },
];

export const DEFAULT_AFFECT_MAPPING: Array<{ sourceColumnName: string; targetField: string }> = [
  { sourceColumnName: 'Demande', targetField: 'dossierNumber' },
  { sourceColumnName: 'Equipe', targetField: 'team' },
  { sourceColumnName: 'Techniciens', targetField: 'technicians' },
  { sourceColumnName: 'HeureDebut', targetField: 'heureDebut' },
  { sourceColumnName: 'HeureFin', targetField: 'heureFin' },
];

export interface EffectiveMappings {
  planning: Array<{ sourceColumnName: string; targetField: string }>;
  affect: Array<{ sourceColumnName: string; targetField: string }>;
  /** true si le tenant n'a rien personnalisé (défauts appliqués). */
  usingDefaults: boolean;
}

@Injectable()
export class ColumnMappingService {
  constructor(
    @InjectRepository(SonatelColumnMapping)
    private readonly mappingRepository: Repository<SonatelColumnMapping>,
  ) {}

  /**
   * Mapping effectif du tenant : repli sur les défauts PÉRI-ONGLET —
   * un tenant qui personnalise PLANNING garde les défauts AFFECT s'il
   * n'a rien défini pour cet onglet (et réciproquement).
   */
  async getEffective(companyId: string): Promise<EffectiveMappings> {
    const stored = await this.mappingRepository.find({
      where: { companyId },
      order: { sheetType: 'ASC', sourceColumnName: 'ASC' },
    });
    const toPair = (m: SonatelColumnMapping) => ({
      sourceColumnName: m.sourceColumnName,
      targetField: m.targetField,
    });
    const storedPlanning = stored.filter((m) => m.sheetType === 'planning').map(toPair);
    const storedAffect = stored.filter((m) => m.sheetType === 'affect').map(toPair);
    return {
      planning: storedPlanning.length > 0 ? storedPlanning : DEFAULT_PLANNING_MAPPING,
      affect: storedAffect.length > 0 ? storedAffect : DEFAULT_AFFECT_MAPPING,
      usingDefaults: stored.length === 0,
    };
  }

  /**
   * Remplace l'ensemble du mapping d'un onglet pour le tenant
   * (suppression + réinsertion, une seule règle par colonne source).
   */
  async replace(
    companyId: string,
    sheetType: SheetType,
    mappings: Array<{ sourceColumnName: string; targetField: string }>,
  ) {
    const validTargets =
      sheetType === 'planning' ? PLANNING_TARGET_FIELDS : AFFECT_TARGET_FIELDS;

    const seen = new Set<string>();
    for (const m of mappings) {
      if (!(validTargets as readonly string[]).includes(m.targetField)) {
        throw new BadRequestException(
          `Champ cible invalide « ${m.targetField} » pour l'onglet ${sheetType} (attendu : ${validTargets.join(', ')})`,
        );
      }
      const key = m.sourceColumnName.trim();
      if (seen.has(key)) {
        throw new BadRequestException(`Colonne source dupliquée : « ${key} »`);
      }
      seen.add(key);
    }

    await this.mappingRepository.manager.transaction(async (em) => {
      await em.delete(SonatelColumnMapping, { companyId, sheetType });
      if (mappings.length > 0) {
        await em.insert(
          SonatelColumnMapping,
          mappings.map((m) => ({
            id: undefined,
            companyId,
            sheetType,
            sourceColumnName: m.sourceColumnName.trim(),
            targetField: m.targetField,
          })),
        );
      }
    });

    return this.getEffective(companyId);
  }
}
