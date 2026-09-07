import { Column, Entity, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * Lot P6 — DISPOSITIF : la grille quotidienne du fichier SONATEL
 * (feuille DISPOSITIF du Planning global FTTH). Zones × instances ×
 * équipes nommées, axes PL06/PL08/PL29/RJT29/A_MER/P_J, débordement Touba.
 * C'est le « qui travaille où aujourd'hui ».
 */
@Entity('dispositif_entries')
@Unique('uq_dispositif_day_zone_team', ['companyId', 'day', 'zoneName', 'teamName'])
@Index(['companyId', 'day'])
export class DispositifEntry extends BaseEntity {
  /** Jour du dispositif (YYYY-MM-DD). */
  @Column({ type: 'date' })
  day!: string;

  /** Zone / localité (Mbour, Kaolack, Thiaroye, DEBORDEMENT TOUBA…). */
  @Column({ type: 'text' })
  zoneName!: string;

  /** Équipe nominale affectée à la zone (ex. ABDOU AZIZ SANE). */
  @Column({ type: 'text' })
  teamName!: string;

  /** Axe / secteur (PL06, PL08, PL29, RJT29, A_MER, P_J…). */
  @Column({ type: 'text', nullable: true })
  axis: string | null;

  /** Lien vers l'équipe VECTRACOM si résolue. */
  @Column({ type: 'uuid', nullable: true })
  teamId: string | null;

  /** Pilote SONATEL de la zone. */
  @Column({ type: 'text', nullable: true })
  pilot: string | null;

  /** Nombre d'instances ouvertes sur la zone (ex. Kaolack 5/5). */
  @Column({ type: 'integer', default: 1 })
  instances!: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
