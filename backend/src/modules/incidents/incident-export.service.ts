import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { Incident } from './entities/incident.entity';
import { Mission } from '../missions/entities/mission.entity';

/**
 * Lot P3 — Exports au format des fichiers réels envoyés à SONATEL.
 * Trois rubriques = trois classeurs distincts, reproduisant les formats
 * des feuilles PIO / CHANGEMENT PBO de l'attachement ONECOMIT.
 */
@Injectable()
export class IncidentExportService {
  private readonly logger = new Logger(IncidentExportService.name);

  constructor(
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
    @InjectRepository(Mission)
    private readonly missionRepository: Repository<Mission>,
  ) {}

  /**
   * Export PBO — format « CHANGEMENT PBO » de l'attachement :
   * ZONE | PBO | ACTION | DATE RELEVE | STATUT | EQUIPE RELEVE | REMONTEE PAR | QUANTITE | PRIX UNIT | TOTAL
   * Prix unitaire contractuel : 6 500 F par changement.
   */
  async exportPbo(companyId: string, from?: string, to?: string) {
    const incidents = await this.period(companyId, 'PBO', from, to);
    const rows = incidents.map((i) => {
      const changed = (i.actionTaken ?? '').match(/chang/i) || i.pboDefaut === 'ENDOMAGE';
      return {
        ZONE: `${i.zone ?? ''}${i.olt ? ` OLT_${String(i.olt).toUpperCase().replace(/[^A-Z]/g, '')}` : ''}`.trim() || 'N/A',
        PBO: i.pboReference ?? i.pboPlaque ?? 'N/A',
        ACTION: i.actionTaken ?? (changed ? 'CHANGEMENT PBO DEFECTUEUX' : 'AUCUN DEFAUT CONSTATE SUR LE PBO'),
        'DATE RELEVE': i.resolvedAt ? new Date(i.resolvedAt).toISOString().slice(0, 10) : '',
        STATUT: i.status === 'cloture' || i.status === 'corrige' ? 'SOLDE' : 'EN COURS',
        'EQUIPE RELEVE': i.pboEquipeAssignee ?? '',
        'REMONTEE PAR': i.reportedBy ?? 'VECTRACOM',
        QUANTITE: 1,
        'PRIX UNIT': 6500,
        TOTAL: 6500,
      };
    });
    const total = rows.length * 6500;
    rows.push({ ZONE: '', PBO: '', ACTION: '', 'DATE RELEVE': '', STATUT: '', 'EQUIPE RELEVE': '', 'REMONTEE PAR': '', QUANTITE: NaN, 'PRIX UNIT': NaN, TOTAL: total } as never);
    return { buffer: this.toXlsx(rows, 'CHANGEMENT PBO'), fileName: `PBO-${this.periodLabel(from, to)}.xlsx`, count: rows.length - 1, total };
  }

  /**
   * Export PIO — format « POI » de l'attachement :
   * ADRESSE ANOMALIE | NATURE REMONTEE | DATE RELEVE | EQUIPE D'INTERVENTION | DESIGNATION | Quantité | PRIX U | Total
   * Valorisation indicative au bordereau (implantation poteau 6 500, normalisation câble 130 F/m…).
   */
  async exportPoi(companyId: string, from?: string, to?: string) {
    const incidents = await this.period(companyId, 'PIO', from, to);
    const rows: Array<Record<string, unknown>> = [];
    for (const i of incidents) {
      const designation = this.poiDesignation(i);
      const qty = this.poiQuantity(i);
      const dateReleve = i.resolvedAt ? new Date(i.resolvedAt).toISOString().slice(0, 10) : new Date(i.reportedAt).toISOString().slice(0, 10);
      for (const d of designation) {
        rows.push({
          'ADRESSE ANOMALIE': i.address ?? i.zone ?? '',
          'NATURE REMONTEE': this.poiNature(i),
          'DATE RELEVE': dateReleve,
          "EQUIPE D'INTERVENTION": i.pboEquipeAssignee ?? i.assignedTechnicianIds?.length ? i.pboEquipeAssignee ?? '' : '',
          DESIGNATION: d.label,
          Quantité: d.qty,
          'PRIX U': d.pu,
          Total: d.qty * d.pu,
        });
      }
      void qty;
    }
    const total = rows.reduce((s, r) => s + Number(r.Total ?? 0), 0);
    rows.push({ 'ADRESSE ANOMALIE': '', 'NATURE REMONTEE': '', 'DATE RELEVE': '', "EQUIPE D'INTERVENTION": '', DESIGNATION: '', 'Quantité': NaN, 'PRIX U': NaN, Total: total } as never);
    return { buffer: this.toXlsx(rows, 'POI'), fileName: `PIO-${this.periodLabel(from, to)}.xlsx`, count: incidents.length, total };
  }

  /** Export CHAMBRE — caniveaux / BPE. */
  async exportChambre(companyId: string, from?: string, to?: string) {
    const incidents = await this.period(companyId, 'CHAMBRE', from, to);
    const rows = incidents.map((i) => ({
      ZONE: i.zone ?? 'N/A',
      CHAMBRE: `${i.chambreType ?? ''}${i.chambreEtat ? ` (${String(i.chambreEtat).replace(/_/g, ' ')})` : ''}`.trim() || 'N/A',
      'NATURE REMONTEE': this.chambreNature(i),
      'DATE RELEVE': (i.resolvedAt ? new Date(i.resolvedAt) : new Date(i.reportedAt)).toISOString().slice(0, 10),
      STATUT: i.status === 'cloture' || i.status === 'corrige' ? 'SOLDE' : 'EN COURS',
      EQUIPE: i.pboEquipeAssignee ?? '',
      OBSERVATIONS: i.validationNotes ?? '',
    }));
    return { buffer: this.toXlsx(rows, 'CHAMBRE'), fileName: `CHAMBRE-${this.periodLabel(from, to)}.xlsx`, count: incidents.length, total: 0 };
  }

  // ------------------------------------------------------------------
  // Internes
  // ------------------------------------------------------------------
  private async period(companyId: string, rubrique: string, from?: string, to?: string): Promise<Incident[]> {
    const qb = this.incidentRepository
      .createQueryBuilder('i')
      .where('i.company_id = :cid AND i.rubrique = :r', { cid: companyId, r: rubrique });
    if (from) qb.andWhere('i.reported_at >= :from', { from: new Date(from) });
    if (to) qb.andWhere('i.reported_at <= :to', { to: new Date(`${to.slice(0, 10)}T23:59:59Z`) });
    return qb.orderBy('i.reported_at', 'ASC').getMany();
  }

  private toXlsx(rows: Array<Record<string, unknown>>, sheetName: string): Buffer {
    const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{}]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  private periodLabel(from?: string, to?: string): string {
    if (from && to) return `${from.slice(0, 10)}_${to.slice(0, 10)}`;
    return new Date().toISOString().slice(0, 7);
  }

  /** Lignes bordereau indicatives pour une anomalie PIO (attachement POI juin). */
  private poiDesignation(i: Incident): Array<{ label: string; qty: number; pu: number }> {
    const out: Array<{ label: string; qty: number; pu: number }> = [];
    const etat = String(i.pioEtat ?? '').toUpperCase();
    if (['CASSE', 'A_TERRE'].includes(etat)) {
      out.push({ label: 'Implantation de Poteau en bois entre 7 et 10 m', qty: 1, pu: 6500 });
      // Normalisation indicative des câbles raccrochés (moyenne terrain : 40 m).
      out.push({ label: 'Normalisation câbles clients', qty: 40, pu: 130 });
      out.push({ label: "Dépose d'un appui Sonatel (y compris dépose armement)", qty: 1, pu: 5792.8 });
    } else if (etat === 'INCLINE') {
      out.push({ label: 'Redressement Appui moise', qty: 1, pu: 6500 });
    } else {
      out.push({ label: 'Normalisation câble distribution/branchement', qty: 20, pu: 130 });
      out.push({ label: 'Reconditionnement PBO', qty: 1, pu: 1541.8 });
    }
    return out;
  }

  private poiQuantity(i: Incident): number {
    return i.pioNbCables ?? 0;
  }

  private poiNature(i: Incident): string {
    const etat = String(i.pioEtat ?? 'DEFAUT').replace(/_/g, ' ');
    const type = String(i.pioType ?? '').replace(/_/g, ' ');
    return `POTEAU ${type} ${etat}`.trim().toUpperCase();
  }

  private chambreNature(i: Incident): string {
    const etat = String(i.chambreEtat ?? 'DEFAUT').replace(/_/g, ' ');
    const type = i.chambreType ?? '';
    return `CHAMBRE ${type} ${etat}`.trim().toUpperCase();
  }
}
