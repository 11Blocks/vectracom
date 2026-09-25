import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Not, Repository } from 'typeorm';
import { Company, CompanySubscriptionStatus } from '../auth/entities/company.entity';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../../common/audit/audit.service';
import { ActorContext } from '../users/users.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

const EDITABLE_FIELDS: (keyof UpdateTenantDto)[] = [
  'name', 'sonatelSubcontractorName', 'contactName', 'contactEmail', 'contactPhone', 'address', 'city',
  'ninea', 'rccm', 'notes', 'maxUsers', 'onboardingPaid', 'platformFeePaid',
  'subscriptionStartDate', 'subscriptionEndDate', 'trialEndDate',
];

/**
 * Console Green-T : gestion du cycle de vie des tenants.
 * Réservée aux rôles console (super_admin, finance_admin ; support_admin en lecture).
 */
@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly authService: AuthService,
    private readonly audit: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  async list(includeArchived = false) {
    const companies = await this.companyRepository.find({ order: { createdAt: 'DESC' } });
    const counts: { companyId: string; total: string; active: string; lastLogin: Date | null }[] =
      await this.dataSource.query(
        `SELECT company_id AS "companyId", COUNT(*) AS total, COUNT(*) FILTER (WHERE active) AS active,
                MAX(last_login_at) AS "lastLogin"
           FROM users WHERE company_id IS NOT NULL GROUP BY company_id`,
      );
    const byCompany = new Map(counts.map((c) => [c.companyId, c]));
    return companies
      .filter((c) => includeArchived || !c.archivedAt)
      .map((c) => {
        const stat = byCompany.get(c.id);
        return {
          ...c,
          userCount: Number(stat?.total ?? 0),
          activeUserCount: Number(stat?.active ?? 0),
          lastLoginAt: stat?.lastLogin ?? null,
        };
      });
  }

  async findOne(id: string) {
    const company = await this.companyRepository.findOne({ where: { id } });
    if (!company) throw new NotFoundException('Tenant introuvable');
    return company;
  }

  /** Fiche tenant : informations + indicateurs d'usage. */
  async detail(id: string) {
    const company = await this.findOne(id);
    const [stats] = await this.dataSource.query(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE company_id = $1) AS "users",
         (SELECT COUNT(*) FROM users WHERE company_id = $1 AND active) AS "activeUsers",
         (SELECT COUNT(*) FROM users WHERE company_id = $1 AND role = 'admin' AND active) AS "admins",
         (SELECT MAX(last_login_at) FROM users WHERE company_id = $1) AS "lastLoginAt",
         (SELECT COUNT(*) FROM technicians WHERE company_id = $1) AS "technicians",
         (SELECT COUNT(*) FROM teams WHERE company_id = $1) AS "teams",
         (SELECT COUNT(*) FROM missions WHERE company_id = $1) AS "missions",
         (SELECT COUNT(*) FROM invoices_saas WHERE company_id = $1 AND status IN ('pending','overdue')) AS "openSaasInvoices",
         (SELECT COALESCE(SUM(total_ttc),0) FROM invoices_saas WHERE company_id = $1 AND status IN ('pending','overdue')) AS "openSaasAmount"`,
      [id],
    ).catch(() => [{}]);
    const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
    return {
      ...company,
      stats: {
        users: num(stats.users),
        activeUsers: num(stats.activeUsers),
        admins: num(stats.admins),
        lastLoginAt: stats.lastLoginAt ?? null,
        technicians: num(stats.technicians),
        teams: num(stats.teams),
        missions: num(stats.missions),
        openSaasInvoices: num(stats.openSaasInvoices),
        openSaasAmount: num(stats.openSaasAmount),
      },
    };
  }

  async create(dto: CreateTenantDto, actor: ActorContext) {
    const result = await this.authService.register({
      companyName: dto.companyName,
      sonatelSubcontractorName: dto.sonatelSubcontractorName,
      adminEmail: dto.adminEmail,
      adminPassword: dto.adminPassword,
      adminFullName: dto.adminFullName,
      mustChangePassword: dto.mustChangePassword,
    });

    await this.companyRepository.update(result.company.id, {
      onboardingPaid: dto.onboardingPaid ?? false,
      contactName: dto.adminFullName.trim(),
      contactEmail: dto.adminEmail.toLowerCase().trim(),
      contactPhone: dto.contactPhone?.trim() || null,
    });
    await this.audit.log({
      companyId: result.company.id,
      actorId: actor.user.id,
      action: 'tenant.create',
      entityType: 'company',
      entityId: result.company.id,
      payload: { name: result.company.name, adminEmail: result.admin.email },
      ip: actor.ip,
    });
    return result;
  }

  async update(id: string, dto: UpdateTenantDto, actor: ActorContext) {
    const company = await this.findOne(id);
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      const clash = await this.companyRepository.findOne({ where: { name, id: Not(id) } });
      if (clash) throw new ConflictException(`L'entreprise « ${name} » existe déjà`);
      dto.name = name;
    }
    if (dto.contactEmail) dto.contactEmail = dto.contactEmail.toLowerCase().trim();
    if (dto.contactEmail === '') dto.contactEmail = null;

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    const target = company as unknown as Record<string, unknown>;
    for (const field of EDITABLE_FIELDS) {
      const value = dto[field];
      if (value === undefined) continue;
      const normalized = typeof value === 'string' ? value.trim() || null : value;
      if (target[field] !== normalized) {
        changes[field] = { from: target[field], to: normalized };
        target[field] = normalized;
      }
    }
    if (company.name === null) throw new BadRequestException('Le nom est obligatoire');
    if (Object.keys(changes).length === 0) return this.detail(id);

    await this.companyRepository.save(company);
    await this.audit.log({
      companyId: id,
      actorId: actor.user.id,
      action: 'tenant.update',
      entityType: 'company',
      entityId: id,
      payload: { changes },
      ip: actor.ip,
    });
    return this.detail(id);
  }

  async setActive(id: string, active: boolean, actor: ActorContext) {
    const company = await this.findOne(id);
    if (active && company.archivedAt) throw new BadRequestException('Tenant archivé : restaurez-le d’abord');
    company.active = active;
    await this.companyRepository.save(company);
    await this.audit.log({
      companyId: id,
      actorId: actor.user.id,
      action: active ? 'tenant.activate' : 'tenant.deactivate',
      entityType: 'company',
      entityId: id,
      ip: actor.ip,
    });
    return { id: company.id, name: company.name, active: company.active };
  }

  async setSubscriptionStatus(id: string, status: CompanySubscriptionStatus, actor: ActorContext) {
    const company = await this.findOne(id);
    const previous = company.subscriptionStatus;
    company.subscriptionStatus = status;
    if (status === 'active' && !company.subscriptionStartDate) {
      company.subscriptionStartDate = new Date().toISOString().slice(0, 10);
    }
    await this.companyRepository.save(company);
    await this.audit.log({
      companyId: id,
      actorId: actor.user.id,
      action: 'tenant.subscription_status',
      entityType: 'company',
      entityId: id,
      payload: { from: previous, to: status },
      ip: actor.ip,
    });
    return { id: company.id, name: company.name, subscriptionStatus: company.subscriptionStatus };
  }

  /** Archivage (pas de suppression : l'historique de facturation et d'audit est conservé). */
  async archive(id: string, actor: ActorContext) {
    const company = await this.findOne(id);
    if (company.archivedAt) return company;
    company.archivedAt = new Date();
    company.active = false;
    await this.companyRepository.save(company);
    await this.audit.log({
      companyId: id,
      actorId: actor.user.id,
      action: 'tenant.archive',
      entityType: 'company',
      entityId: id,
      ip: actor.ip,
    });
    return company;
  }

  async restore(id: string, actor: ActorContext) {
    const company = await this.findOne(id);
    if (!company.archivedAt) return company;
    company.archivedAt = null;
    await this.companyRepository.save(company);
    await this.audit.log({
      companyId: id,
      actorId: actor.user.id,
      action: 'tenant.restore',
      entityType: 'company',
      entityId: id,
      ip: actor.ip,
    });
    return company;
  }

  impersonate(id: string, userId: string | undefined, actor: ActorContext) {
    return this.authService.impersonate(id, userId, actor.user, actor.ip);
  }

  auditLogs(id: string, opts: { limit?: number; offset?: number; all?: boolean }) {
    return this.audit.list({ companyId: id, onlyNamed: !opts.all, limit: opts.limit, offset: opts.offset });
  }
}
