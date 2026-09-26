import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CompanySetting } from './entities/company-setting.entity';
import { SettingsChangeLog } from './entities/settings-change-log.entity';
import {
  SETTINGS_SECTIONS,
  SETTINGS_SECTION_LABELS,
  SettingsSection,
  defaultSettings,
} from './settings.defaults';
import { Company } from '../auth/entities/company.entity';

/** Champs du profil entreprise modifiables par l'admin du tenant (nom et abonnement : console Green-T). */
export const COMPANY_PROFILE_FIELDS = [
  'contactName', 'contactEmail', 'contactPhone', 'address', 'city',
  'ninea', 'rccm', 'bankName', 'bankAccount', 'logoUrl', 'invoiceFooter',
] as const;
export type CompanyProfileField = (typeof COMPANY_PROFILE_FIELDS)[number];

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(CompanySetting)
    private readonly settingsRepo: Repository<CompanySetting>,
    @InjectRepository(SettingsChangeLog)
    private readonly logRepo: Repository<SettingsChangeLog>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    private readonly dataSource: DataSource,
  ) {}

  private assertSection(section: string): SettingsSection {
    if (!SETTINGS_SECTIONS.includes(section as SettingsSection)) {
      throw new BadRequestException(`Section inconnue : ${section}. Attendu : ${SETTINGS_SECTIONS.join(', ')}`);
    }
    return section as SettingsSection;
  }

  private mergeDefaults(data: Record<string, unknown> | null | undefined): Record<string, unknown> {
    const defaults = defaultSettings() as unknown as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of SETTINGS_SECTIONS) {
      out[key] = { ...(defaults[key] as object), ...((data?.[key] as object) ?? {}) };
    }
    return out;
  }

  private async ensureRow(companyId: string): Promise<CompanySetting> {
    let row = await this.settingsRepo.findOne({ where: { companyId } });
    if (!row) {
      const company = await this.companyRepo.findOne({ where: { id: companyId } });
      const base = defaultSettings();
      if (company?.name) (base.general as any).companyName = company.name;
      row = this.settingsRepo.create({ companyId, data: base as unknown as Record<string, unknown> });
      row = await this.settingsRepo.save(row);
    } else {
      row.data = this.mergeDefaults(row.data);
    }
    return row;
  }

  /** Profil entreprise du tenant (coordonnées imprimées sur les factures). */
  async getCompanyProfile(companyId: string) {
    const company = await this.companyRepo.findOne({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Entreprise introuvable');
    return {
      name: company.name,
      sonatelSubcontractorName: company.sonatelSubcontractorName,
      ...Object.fromEntries(COMPANY_PROFILE_FIELDS.map((k) => [k, company[k]])),
    };
  }

  async updateCompanyProfile(
    companyId: string,
    patch: Partial<Record<CompanyProfileField, string | null>>,
    meta: { userId?: string | null; userEmail?: string | null },
  ) {
    const company = await this.companyRepo.findOne({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Entreprise introuvable');
    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};
    for (const key of COMPANY_PROFILE_FIELDS) {
      if (patch[key] === undefined) continue;
      const next = typeof patch[key] === 'string' ? patch[key]!.trim() || null : null;
      if (next === company[key]) continue;
      oldValue[key] = company[key];
      newValue[key] = next;
      company[key] = next;
    }
    if (!Object.keys(newValue).length) return this.getCompanyProfile(companyId);
    await this.companyRepo.save(company);
    await this.logRepo.save(
      this.logRepo.create({
        companyId,
        userId: meta.userId ?? null,
        userEmail: meta.userEmail ?? null,
        section: 'general',
        parameter: 'profil entreprise : ' + Object.keys(newValue).join(', '),
        oldValue,
        newValue,
        reason: null,
      }),
    );
    return this.getCompanyProfile(companyId);
  }

  async getAll(companyId: string) {
    const row = await this.ensureRow(companyId);
    return {
      sections: SETTINGS_SECTIONS.map((s) => ({
        key: s,
        label: SETTINGS_SECTION_LABELS[s],
      })),
      data: this.mergeDefaults(row.data),
      updatedAt: row.updatedAt,
    };
  }

  async getSection(companyId: string, section: string) {
    const key = this.assertSection(section);
    const row = await this.ensureRow(companyId);
    const data = this.mergeDefaults(row.data);
    return { section: key, label: SETTINGS_SECTION_LABELS[key], data: data[key] };
  }

  async updateSection(
    companyId: string,
    section: string,
    patch: Record<string, unknown>,
    meta: { userId?: string | null; userEmail?: string | null; reason?: string },
  ) {
    const key = this.assertSection(section);
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      throw new BadRequestException('Corps JSON objet attendu');
    }
    const row = await this.ensureRow(companyId);
    const data = this.mergeDefaults(row.data);
    const oldValue = { ...(data[key] as object) };
    const newValue = { ...oldValue, ...patch };
    data[key] = newValue;
    row.data = data;
    await this.settingsRepo.save(row);

    await this.logRepo.save(
      this.logRepo.create({
        companyId,
        userId: meta.userId ?? null,
        userEmail: meta.userEmail ?? null,
        section: key,
        parameter: Object.keys(patch).join(', ') || null,
        oldValue,
        newValue,
        reason: meta.reason ?? null,
      }),
    );

    return { section: key, label: SETTINGS_SECTION_LABELS[key], data: newValue };
  }

  async journal(companyId: string, limit = 50) {
    const take = Math.min(200, Math.max(1, limit));
    const rows = await this.logRepo.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
      take,
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        date: r.createdAt,
        user: r.userEmail ?? r.userId ?? '—',
        section: r.section,
        sectionLabel: SETTINGS_SECTION_LABELS[r.section as SettingsSection] ?? r.section,
        parameter: r.parameter,
        oldValue: r.oldValue,
        newValue: r.newValue,
        reason: r.reason,
      })),
    };
  }

  async exportConfig(companyId: string) {
    const row = await this.ensureRow(companyId);
    const company = await this.companyRepo.findOne({ where: { id: companyId } });
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      companyId,
      companyName: company?.name ?? null,
      data: this.mergeDefaults(row.data),
    };
  }

  async importConfig(
    companyId: string,
    payload: { data?: Record<string, unknown> },
    meta: { userId?: string | null; userEmail?: string | null },
  ) {
    if (!payload?.data || typeof payload.data !== 'object') {
      throw new BadRequestException('Fichier invalide : champ « data » manquant');
    }
    const row = await this.ensureRow(companyId);
    const old = this.mergeDefaults(row.data);
    const merged = this.mergeDefaults({ ...old, ...payload.data });
    row.data = merged;
    await this.settingsRepo.save(row);
    await this.logRepo.save(
      this.logRepo.create({
        companyId,
        userId: meta.userId ?? null,
        userEmail: meta.userEmail ?? null,
        section: 'advanced',
        parameter: 'import_configuration',
        oldValue: old,
        newValue: merged,
        reason: 'Import configuration JSON',
      }),
    );
    return { ok: true, data: merged };
  }

  async restoreDefaults(
    companyId: string,
    meta: { userId?: string | null; userEmail?: string | null },
  ) {
    const row = await this.ensureRow(companyId);
    const old = this.mergeDefaults(row.data);
    const company = await this.companyRepo.findOne({ where: { id: companyId } });
    const fresh = defaultSettings();
    if (company?.name) (fresh.general as any).companyName = company.name;
    row.data = fresh as unknown as Record<string, unknown>;
    await this.settingsRepo.save(row);
    await this.logRepo.save(
      this.logRepo.create({
        companyId,
        userId: meta.userId ?? null,
        userEmail: meta.userEmail ?? null,
        section: 'advanced',
        parameter: 'restore_defaults',
        oldValue: old,
        newValue: fresh,
        reason: 'Restauration paramètres par défaut',
      }),
    );
    return { ok: true, data: fresh };
  }

  /** TVA configurable (section billing) — fallback 18 %. */
  async getTvaRate(companyId: string): Promise<number> {
    const row = await this.ensureRow(companyId);
    const billing = (this.mergeDefaults(row.data).billing ?? {}) as { tvaRate?: number };
    const rate = Number(billing.tvaRate);
    return isFinite(rate) && rate >= 0 && rate <= 1 ? rate : 0.18;
  }

  /** Réglages facturation effectifs (valeurs d'usine si absentes ou invalides). */
  async getBilling(companyId: string): Promise<{
    tvaRate: number;
    paymentTermsDays: number;
    invoiceNumberFormat: string;
    billTerminatedMissions: boolean;
  }> {
    const row = await this.ensureRow(companyId);
    const billing = (this.mergeDefaults(row.data).billing ?? {}) as Record<string, unknown>;
    const rate = Number(billing.tvaRate);
    const terms = Number(billing.paymentTermsDays);
    const format = typeof billing.invoiceNumberFormat === 'string' ? billing.invoiceNumberFormat : '';
    return {
      tvaRate: isFinite(rate) && rate >= 0 && rate <= 1 ? rate : 0.18,
      paymentTermsDays: Number.isInteger(terms) && terms >= 0 && terms <= 365 ? terms : 30,
      invoiceNumberFormat: /\{#+\}/.test(format) ? format : 'FACT-{YYYY}-{####}',
      billTerminatedMissions: billing.billTerminatedMissions === true,
    };
  }

  /** Capacité journalière d'une équipe (section missions) — 0 = illimité. */
  async getTeamDailyCapacity(companyId: string): Promise<number> {
    const row = await this.ensureRow(companyId);
    const missions = (this.mergeDefaults(row.data).missions ?? {}) as Record<string, unknown>;
    const cap = Number(missions.maxMissionsPerTeamPerDay);
    return Number.isInteger(cap) && cap >= 0 && cap <= 100 ? cap : 8;
  }

  /** Lecture des audit_logs plateforme (table existante). */
  /** Historique du tenant : actions métier nommées (« invoice.finalize ») et traces HTTP (« POST /… → 200 »). */
  async auditLogs(
    companyId: string,
    limit = 50,
    filters: { kind?: string; userId?: string; from?: string; to?: string; q?: string; offset?: number } = {},
  ) {
    const take = Math.min(200, Math.max(1, limit || 50));
    const where = ['a.company_id = $1'];
    const params: unknown[] = [companyId];
    const add = (sql: string, value: unknown) => { params.push(value); where.push(sql.replace('?', `$${params.length}`)); };
    if (filters.kind === 'metier') where.push("a.action NOT LIKE '% %'");
    if (filters.kind === 'http') where.push("a.action LIKE '% %'");
    if (filters.userId && /^[0-9a-f-]{36}$/i.test(filters.userId)) add('a.user_id = ?', filters.userId);
    if (filters.from && /^\d{4}-\d{2}-\d{2}$/.test(filters.from)) add('a.created_at >= ?::date', filters.from);
    if (filters.to && /^\d{4}-\d{2}-\d{2}$/.test(filters.to)) add("a.created_at < (?::date + interval '1 day')", filters.to);
    if (filters.q?.trim()) add("(a.action ILIKE ? OR a.entity_type ILIKE $X OR a.payload::text ILIKE $X)".replace(/\$X/g, `$${params.length + 1}`), `%${filters.q.trim()}%`);
    try {
      const rows = await this.dataSource.query(
        `SELECT a.id, a.user_id, u.full_name AS user_name, u.email AS user_email, a.action, a.entity_type, a.entity_id,
                a.payload, a.ip, a.created_at
         FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
         WHERE ${where.join(' AND ')}
         ORDER BY a.created_at DESC LIMIT ${take + 1} OFFSET ${Math.max(0, filters.offset ?? 0)}`,
        params,
      );
      const items = rows.slice(0, take).map((r: Record<string, unknown>) => ({
        id: r.id, userId: r.user_id, userName: r.user_name, userEmail: r.user_email, action: r.action,
        entityType: r.entity_type, entityId: r.entity_id, payload: r.payload, ip: r.ip, createdAt: r.created_at,
      }));
      return { items, hasMore: rows.length > take };
    } catch {
      return { items: [], hasMore: false, note: 'Table audit_logs indisponible' };
    }
  }
}
