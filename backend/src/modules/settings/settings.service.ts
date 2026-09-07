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

  /** Lecture des audit_logs plateforme (table existante). */
  async auditLogs(companyId: string, limit = 50) {
    const take = Math.min(200, Math.max(1, limit));
    try {
      const rows = await this.dataSource.query(
        `SELECT id, user_id, action, entity_type, entity_id, payload, ip, created_at
         FROM audit_logs WHERE company_id = $1
         ORDER BY created_at DESC LIMIT $2`,
        [companyId, take],
      );
      return { items: rows };
    } catch {
      return { items: [], note: 'Table audit_logs indisponible' };
    }
  }
}
