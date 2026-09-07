import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Vehicle } from '../../vehicles/entities/vehicle.entity';
import { Technician } from '../../technicians/entities/technician.entity';
import { Mission } from '../../missions/entities/mission.entity';

export const EXPENSE_CATEGORIES = [
  'main_oeuvre', 'materiel', 'transport', 'divers',
  // Rubriques de l'appro caisse (document ERP fondateur, P8)
  'carburant', 'outils_rechange', 'depannage_vehicule', 'salaire_journalier', 'pret_equipe',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/**
 * Dépense opérationnelle — saisie en 5 secondes : photo du reçu puis
 * proposition IA (montant/catégorie, Phase 9), jamais imposée.
 */
@Entity('expenses')
@Index(['companyId', 'createdAt'])
export class Expense extends BaseEntity {
  @Column({ type: 'text' })
  category!: ExpenseCategory;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount!: string;

  @Column({ type: 'text', nullable: true })
  receiptPhotoUrl: string | null;

  @Column({ type: 'uuid', nullable: true })
  vehicleId: string | null;

  @ManyToOne(() => Vehicle, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle | null;

  @Column({ type: 'uuid', nullable: true })
  technicianId: string | null;

  @ManyToOne(() => Technician, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'technician_id' })
  technician: Technician | null;

  @Column({ type: 'uuid', nullable: true })
  missionId: string | null;

  @ManyToOne(() => Mission, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'mission_id' })
  mission: Mission | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** true si montant/catégorie proposés par l'IA puis validés par l'utilisateur. */
  @Column({ default: false })
  aiExtracted!: boolean;
}
