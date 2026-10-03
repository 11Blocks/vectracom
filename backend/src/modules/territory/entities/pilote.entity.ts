import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export const PILOTE_TYPES = ['SONATEL', 'SOUS_TRAITANT'] as const;
export type PiloteType = (typeof PILOTE_TYPES)[number];

/**
 * Pilote : superviseur qui gère un groupe d'équipes dans une zone.
 * Pilote SONATEL (valide/active, souvent hors terrain) vs pilote
 * sous-traitant (encadre les équipes du prestataire).
 */
@Entity('pilotes')
@Index(['companyId', 'active'])
export class Pilote extends BaseEntity {
  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', default: 'SONATEL' })
  type!: PiloteType;

  @Column({ type: 'uuid', nullable: true })
  partnerId: string | null;

  @Column({ default: true })
  active!: boolean;
}
