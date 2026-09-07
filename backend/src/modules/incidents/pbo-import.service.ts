import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { Incident } from './entities/incident.entity';
import { IncidentExportService } from './incident-export.service';

type RawRow = Record<string, unknown>;

interface PboToChange {
  zone: string | null;
  annee: string | null;
  semaine: string | null;
  plaque: string | null;
  constitutions: string | null;
  longitude: number | null;
  latitude: number | null;
  defaut: string | null;
  equipe: string | null;
}

export interface PboPreviewRow extends PboToChange {
  /** Incident déjà existant pour cette plaque (déduplication). */
  exists: boolean;
}

/**
 * Lot P3 — Import du fichier « PBO À CHANGER » (26 PBO géolocalisés Mbour).
 * Format réel : Zone | Année | Semaine | PBO/Plaque | constitutions | STATUT |
 * Longitude | Latitude | Défaut constaté | Date de signalisation | EQUIPE.
 * Crée des incidents PBO prêts à générer des missions Changement PBO (6 500 F).
 */
@Injectable()
export class PboImportService {
  private readonly logger = new Logger(PboImportService.name);

  constructor(
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
    private readonly exports: IncidentExportService,
  ) {
    void this.exports;
  }

  /** Aperçu : parse le classeur, dédoublonne par plaque. */
  async preview(file: { buffer: Buffer; originalname: string }, companyId: string) {
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(file.buffer, { type: 'buffer', cellDates: true });
    } catch {
      throw new BadRequestException('Fichier illisible : format Excel (.xlsx) attendu');
    }
    const sheetName = workbook.SheetNames.find((n) => n.toUpperCase().includes('PBO'));
    if (!sheetName) throw new BadRequestException('Onglet « PBO A CHANGER » introuvable');
    const rows = XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[sheetName], { defval: null });

    const parsed: PboPreviewRow[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      const plaque = this.str(row['PBO/Plaque'] ?? row['PBO'] ?? row['Plaque']);
      if (!plaque) continue;
      if (seen.has(plaque)) continue;
      seen.add(plaque);
      const existing = await this.incidentRepository.findOne({
        where: { companyId, rubrique: 'PBO', pboPlaque: plaque },
      });
      parsed.push({
        zone: this.str(row['Zone']),
        annee: this.str(row['Année'] ?? row['Annee']),
        semaine: this.str(row['Semaine']),
        plaque,
        constitutions: this.str(row['constitutions']),
        longitude: this.num(row['Longitude']),
        latitude: this.num(row['Latitude']),
        defaut: this.str(row['Défaut constaté'] ?? row['Defaut constate']),
        equipe: this.str(row['EQUIPE'] ?? row['Equipe']),
        exists: !!existing,
      });
    }
    return {
      fileName: file.originalname,
      total: parsed.length,
      nouveaux: parsed.filter((p) => !p.exists).length,
      rows: parsed,
    };
  }

  /** Confirmation : crée les incidents PBO (jamais automatique → missions à générer par un humain). */
  async confirm(
    companyId: string,
    rows: PboPreviewRow[],
    fileName: string,
  ) {
    let created = 0;
    const incidents: Incident[] = [];
    for (const row of rows.filter((r) => !r.exists)) {
      const incident = await this.incidentRepository.save(
        this.incidentRepository.create({
          companyId,
          incidentNumber: `PBO-${Date.now().toString(36).toUpperCase()}-${created}`,
          source: 'WHATSAPP',
          whatsappGroup: 'PBO À CHANGER (import)',
          reportedBy: null,
          rubrique: 'PBO',
          zone: row.zone ?? 'MBOUR',
          gpsLatitude: row.latitude != null ? String(row.latitude) : null,
          gpsLongitude: row.longitude != null ? String(row.longitude) : null,
          pboPlaque: row.plaque,
          pboConstitutions: row.constitutions,
          pboDefaut: this.defautCode(row.defaut),
          pboEquipeAssignee: row.equipe,
          status: 'signalement',
          severity: 'MAJEUR',
          annotationOriginale: `Import ${fileName} — ${row.annee ?? ''} ${row.semaine ?? ''} — défaut: ${row.defaut ?? ''} — équipe: ${row.equipe ?? ''}`,
        }),
      );
      incidents.push(incident);
      created++;
    }
    this.logger.log(`PBO À CHANGER importé : ${created} incident(s) créé(s)`);
    return { created, incidents };
  }

  private defautCode(raw: string | null): 'DESORGANISE' | 'SANS_COUVERCLE' | 'ENDOMAGE' | 'CABLE_DESORDRE' | null {
    const d = (raw ?? '').toUpperCase();
    if (d.includes('DESORGANIS')) return 'DESORGANISE';
    if (d.includes('COUVERCLE')) return 'SANS_COUVERCLE';
    if (d.includes('ENDOMM') || d.includes('ENDOMAG')) return 'ENDOMAGE';
    if (d.includes('CABLE')) return 'CABLE_DESORDRE';
    return 'ENDOMAGE';
  }

  private str(v: unknown): string | null {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
  }

  private num(v: unknown): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(String(v).replace(',', '.'));
    return isFinite(n) ? n : null;
  }
}
