import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/** Client facturé par le tenant (SONATEL, partenaire, client direct…). */
@Entity('clients')
export class Client extends BaseEntity {
  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  code: string | null;

  @Column({ type: 'text', nullable: true })
  ninea: string | null;

  @Column({ type: 'text', nullable: true })
  rccm: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'text', nullable: true })
  city: string | null;

  @Column({ type: 'text', nullable: true })
  contactName: string | null;

  @Column({ type: 'text', nullable: true })
  email: string | null;

  @Column({ type: 'text', nullable: true })
  phone: string | null;

  /** Délai de paiement propre au client (sinon Paramètres → Facturation). */
  @Column({ type: 'integer', nullable: true })
  paymentTermsDays: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ default: true })
  active!: boolean;
}
