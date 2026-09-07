import { PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, Column } from 'typeorm';

/**
 * Base de toute entité métier : porte le companyId d'isolation multi-tenant.
 * Le TenantGuard force cette valeur à partir du JWT — jamais depuis le client.
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  companyId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
