import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MissionType,
  MissionTypeTemplate,
  RequiredPhoto,
  TemplateStep,
} from './entities/mission-type-template.entity';

const SST_STEP: TemplateStep = {
  id: 'step1_sst',
  label: 'Sécurité SST',
  icon: 'shield',
  blocking: true,
  fields: [
    { id: 'sstChecklist', label: 'Checklist EPI', type: 'checklist', required: true, options: ['casque', 'gants', 'chaussures', 'gilet', 'lunettes'] },
    { id: 'sstPhotoUrl', label: 'Photo EPI porté', type: 'photos', required: true },
  ],
};

const IDENTIFICATION_STEP: TemplateStep = {
  id: 'step2_identification',
  label: 'Identification & géolocalisation',
  icon: 'map-pin',
  fields: [
    { id: 'interventionType', label: "Type d'intervention", type: 'select', options: ['nouveau', 'reprise', 'depannage'] },
    { id: 'equipmentCode', label: 'Code équipement', type: 'text' },
    { id: 'gps', label: 'Position GPS', type: 'text', required: true },
  ],
};

const TECHNIQUE_STEP: TemplateStep = {
  id: 'step3_technique',
  label: 'Exécution technique',
  icon: 'wrench',
  fields: [
    { id: 'initialEquipmentState', label: 'État initial équipement', type: 'text' },
    { id: 'actionRealized', label: 'Action réalisée', type: 'text', required: true },
    { id: 'dbmMeasurement', label: 'Mesure dBm', type: 'number' },
  ],
};

const CLOTURE_STEP: TemplateStep = {
  id: 'step6_cloture',
  label: 'Clôture',
  icon: 'check-circle',
  fields: [
    { id: 'fieldStatus', label: 'Statut terrain', type: 'select', required: true, options: ['succes', 'echec'] },
    { id: 'failureReason', label: 'Motif échec', type: 'text' },
    { id: 'observations', label: 'Observations', type: 'text' },
    { id: 'signatureTechnicianUrl', label: 'Signature technicien', type: 'signature', required: true },
    { id: 'signatureClientUrl', label: 'Signature client', type: 'signature' },
  ],
};

const MATERIEL_STEP: TemplateStep = {
  id: 'step5_materiel',
  label: 'Matériel consommé',
  icon: 'package',
  fields: [
    { id: 'materialsConsumed', label: 'Items bordereau consommés', type: 'checklist' },
    { id: 'exchangeSav', label: 'Échange SAV (ancien/nouveau S/N)', type: 'text' },
  ],
};

function photosStep(labels: string[]): TemplateStep {
  return {
    id: 'step4_photos',
    label: 'Preuves visuelles',
    icon: 'camera',
    fields: labels.map((label) => ({ id: label, label, type: 'photos' as const, required: true })),
  };
}

const FOUR_CLASSIC_PHOTOS: RequiredPhoto[] = [
  { type: 'site', label: 'Photo site', count: 1 },
  { type: 'pbo_interior', label: 'Photo intérieur PBO', count: 1 },
  { type: 'pbo_closed', label: 'Photo PBO fermé', count: 1 },
  { type: 'pto_modem', label: 'Photo PTO/modem', count: 1 },
];

const AVANT_PENDANT_APRES: RequiredPhoto[] = [
  { type: 'avant', label: 'Avant travaux', count: 1 },
  { type: 'pendant', label: 'Pendant travaux', count: 1 },
  { type: 'apres', label: 'Après travaux', count: 1 },
];

const STANDARD_WORKFLOW = {
  statuses: ['planifiee', 'en_cours', 'terminee', 'validee', 'rejetee', 'a_completer'],
};

/** Les 11 templates par défaut, repli quand le tenant n'a rien personnalisé. */
export const DEFAULT_MISSION_TEMPLATES: MissionTypeTemplate[] = (
  [
    {
      typeName: 'INSTALLATION' as const,
      label: 'Installation — raccordement client',
      description: 'Raccordement FTTH individuel : 6 étapes, 4 photos, signatures',
      steps: [SST_STEP, IDENTIFICATION_STEP, TECHNIQUE_STEP, photosStep(['photoSiteUrl', 'photoPboInteriorUrl', 'photoPboClosedUrl', 'photoPtoModemUrl']), MATERIEL_STEP, CLOTURE_STEP],
      requiredPhotos: FOUR_CLASSIC_PHOTOS,
      clientFinal: true,
    },
    {
      typeName: 'DENSIFICATION' as const,
      label: 'Densification — zone saturée',
      description: 'Ajout de points de branchement en zone existante (client final)',
      steps: [SST_STEP, IDENTIFICATION_STEP, TECHNIQUE_STEP, photosStep(['photoSiteUrl', 'photoPboInteriorUrl', 'photoPboClosedUrl', 'photoPtoModemUrl']), MATERIEL_STEP, CLOTURE_STEP],
      requiredPhotos: FOUR_CLASSIC_PHOTOS,
      clientFinal: true,
    },
    {
      typeName: 'SURVEY' as const,
      label: 'Survey — pré-installation',
      description: 'Reconnaissance avant installation',
      steps: [SST_STEP, IDENTIFICATION_STEP, TECHNIQUE_STEP, photosStep(['photoSiteUrl', 'photoPboInteriorUrl', 'photoPboClosedUrl', 'photoPtoModemUrl']), CLOTURE_STEP],
      requiredPhotos: [{ type: 'selon_besoin', label: 'Photos selon besoin', count: 4 }],
      clientFinal: true,
    },
    {
      typeName: 'SURVEY_OSM' as const,
      label: 'Survey OSM',
      description: 'Survey tracé + infrastructures (Central, PEP, PEZ/PMZ, plaque, BPE)',
      steps: [SST_STEP, IDENTIFICATION_STEP, TECHNIQUE_STEP, photosStep(['photoTracé', 'photoInfrastructure']), CLOTURE_STEP],
      requiredPhotos: [
        { type: 'tracé', label: 'Tracé GPS', count: 1 },
        { type: 'infrastructures', label: 'Infrastructures', count: 1 },
      ],
      clientFinal: true,
    },
    {
      typeName: 'SAV' as const,
      label: 'SAV — dépannage client',
      description: 'Dépannage avec échange possible de matériel',
      steps: [SST_STEP, IDENTIFICATION_STEP, TECHNIQUE_STEP, photosStep(['photoSiteUrl', 'photoPboInteriorUrl', 'photoPboClosedUrl', 'photoPtoModemUrl']), MATERIEL_STEP, CLOTURE_STEP],
      requiredPhotos: [{ type: 'selon_besoin', label: 'Photos selon besoin', count: 4 }],
      clientFinal: true,
    },
    {
      typeName: 'INFRA' as const,
      label: 'Infra — réseau / coupures',
      description: 'Travaux réseau, pas de client final',
      steps: [SST_STEP, IDENTIFICATION_STEP, TECHNIQUE_STEP, photosStep(['photoAvant', 'photoPendant', 'photoApres']), CLOTURE_STEP],
      requiredPhotos: AVANT_PENDANT_APRES,
      clientFinal: false,
    },
    {
      typeName: 'OSM' as const,
      label: 'OSM — liaison spécialisée',
      description: 'Liaison sécurisée entreprise + recette formelle',
      steps: [SST_STEP, IDENTIFICATION_STEP, TECHNIQUE_STEP, photosStep(['photoDepart', 'photoArrivee', 'photoTravaux']), MATERIEL_STEP, CLOTURE_STEP],
      requiredPhotos: [
        { type: 'depart', label: 'Photo départ', count: 1 },
        { type: 'arrivee', label: "Photo arrivée", count: 1 },
        { type: 'travaux', label: 'Photos travaux', count: 3 },
      ],
      clientFinal: true,
    },
    {
      typeName: 'GC' as const,
      label: 'GC — génie civil',
      description: 'Génie civil, pas de client final',
      steps: [SST_STEP, IDENTIFICATION_STEP, TECHNIQUE_STEP, photosStep(['photoAvant', 'photoPendant', 'photoApres']), MATERIEL_STEP, CLOTURE_STEP],
      requiredPhotos: AVANT_PENDANT_APRES,
      clientFinal: false,
    },
    {
      typeName: 'PLANTATION' as const,
      label: 'Plantation — poteaux',
      description: 'Plantation de poteaux',
      steps: [SST_STEP, IDENTIFICATION_STEP, TECHNIQUE_STEP, photosStep(['photoPoteauPlante']), MATERIEL_STEP, CLOTURE_STEP],
      requiredPhotos: [{ type: 'poteau_plante', label: 'Poteau planté', count: 1 }],
      clientFinal: false,
    },
    {
      typeName: 'DEVOIEMENT' as const,
      label: 'Dévoiement — déviation câble',
      description: 'Déviation de câble, pas de client final',
      steps: [SST_STEP, IDENTIFICATION_STEP, TECHNIQUE_STEP, photosStep(['photoAvant', 'photoPendant', 'photoApres']), MATERIEL_STEP, CLOTURE_STEP],
      requiredPhotos: AVANT_PENDANT_APRES,
      clientFinal: false,
    },
    {
      typeName: 'DEPLOIEMENT' as const,
      label: 'Déploiement — nouvelle zone',
      description: 'Nouvelle cité à installer, pas de client final',
      steps: [SST_STEP, IDENTIFICATION_STEP, TECHNIQUE_STEP, photosStep(['photoAvant', 'photoPendant', 'photoApres']), MATERIEL_STEP, CLOTURE_STEP],
      requiredPhotos: AVANT_PENDANT_APRES,
      clientFinal: false,
    },
  ] as Array<{
    typeName: MissionType;
    label: string;
    description: string;
    steps: TemplateStep[];
    requiredPhotos: RequiredPhoto[];
    clientFinal: boolean;
  }>
).map((t) => {
  const template = new MissionTypeTemplate();
  template.typeName = t.typeName;
  template.label = t.label;
  template.description = t.description;
  template.steps = t.steps;
  template.requiredPhotos = t.requiredPhotos;
  template.checklistTemplate = [];
  template.workflow = STANDARD_WORKFLOW;
  template.isActive = true;
  // Métadonnée consommée par les clients (formulaire dynamique)
  (template as unknown as { clientFinal: boolean }).clientFinal = t.clientFinal;
  (template as unknown as { signatureClient: boolean }).signatureClient = t.clientFinal;
  return template;
});

@Injectable()
export class MissionTemplatesService {
  constructor(
    @InjectRepository(MissionTypeTemplate)
    private readonly templateRepository: Repository<MissionTypeTemplate>,
  ) {}

  /** Template effectif : celui du tenant, sinon le défaut intégré. */
  async getEffective(companyId: string, typeName: MissionType): Promise<MissionTypeTemplate> {
    const own = await this.templateRepository.findOne({
      where: { companyId, typeName, isActive: true },
    });
    if (own) return own;
    const def = DEFAULT_MISSION_TEMPLATES.find((t) => t.typeName === typeName);
    if (!def) throw new NotFoundException(`Type de mission inconnu : ${typeName}`);
    return def;
  }

  listDefaults(): MissionTypeTemplate[] {
    return DEFAULT_MISSION_TEMPLATES;
  }

  /** Liste combinée : défauts + surcharges du tenant (marquées personalised). */
  async listForTenant(companyId: string) {
    const own = await this.templateRepository.find({ where: { companyId } });
    const byType = new Map(own.map((t) => [t.typeName, t]));
    return DEFAULT_MISSION_TEMPLATES.map((def) => {
      const personalised = byType.has(def.typeName);
      return {
        typeName: def.typeName,
        label: byType.get(def.typeName)?.label ?? def.label,
        description: byType.get(def.typeName)?.description ?? def.description,
        steps: byType.get(def.typeName)?.steps ?? def.steps,
        requiredPhotos: byType.get(def.typeName)?.requiredPhotos ?? def.requiredPhotos,
        checklistTemplate: byType.get(def.typeName)?.checklistTemplate ?? def.checklistTemplate,
        workflow: byType.get(def.typeName)?.workflow ?? def.workflow,
        isActive: byType.get(def.typeName)?.isActive ?? true,
        personalised,
      };
    });
  }

  /** Crée ou met à jour la surcharge du tenant pour un type. */
  async upsert(
    companyId: string,
    typeName: MissionType,
    data: Partial<Pick<MissionTypeTemplate, 'label' | 'description' | 'steps' | 'requiredPhotos' | 'checklistTemplate' | 'workflow' | 'isActive'>>,
  ) {
    let own = await this.templateRepository.findOne({ where: { companyId, typeName } });
    if (!own) {
      own = this.templateRepository.create({ companyId, typeName });
    }
    Object.assign(own, data);
    return this.templateRepository.save(own);
  }

  async remove(companyId: string, typeName: MissionType) {
    const own = await this.templateRepository.findOne({ where: { companyId, typeName } });
    if (!own) throw new NotFoundException(`Pas de surcharge pour ${typeName}`);
    await this.templateRepository.remove(own);
    return { deleted: true };
  }
}
