import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { InvoiceLine } from './entities/invoice-line.entity';
import { InvoicesService } from './invoices.service';

/**
 * Lot P4 — Lignes spéciales de l'attachement réel ONECOMIT :
 * charge magasin, régule pénalités (moteur KPI), régularisation production,
 * TENUS (pantalons) et MACRON (primes vestimentaires).
 * Chaque ajout est tracé dans invoice.corrections (qui, quand, quoi).
 */
@Injectable()
export class InvoiceExtrasService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceLine)
    private readonly lineRepository: Repository<InvoiceLine>,
    private readonly invoices: InvoicesService,
  ) {}

  /** Ajoute une ligne spéciale (catégorie, libellé, quantité, PU). */
  async addExtraLine(
    companyId: string,
    invoiceId: string,
    dto: { label: string; quantity: number; unitPrice: number; category?: string; note?: string },
    userId: string | null,
  ) {
    const invoice = await this.invoiceRepository.findOne({ where: { companyId, id: invoiceId } });
    if (!invoice) throw new NotFoundException('Facture introuvable');
    if (invoice.status === 'finalisee') {
      throw new BadRequestException('Facture finalisée — impossible de la modifier');
    }
    if (dto.quantity <= 0 || dto.unitPrice < 0) {
      throw new BadRequestException('Quantité > 0 et prix ≥ 0 requis');
    }

    await this.lineRepository.insert({
      companyId,
      invoiceId: invoice.id,
      category: (dto.category ?? 'TS') as never,
      itemType: dto.label,
      quantity: dto.quantity,
      unitPrice: String(dto.unitPrice),
      total: String(dto.quantity * dto.unitPrice),
    } as never);

    invoice.corrections = [
      ...(invoice.corrections ?? []),
      {
        at: new Date().toISOString(),
        by: userId,
        changes: [{
          lineId: 'extra',
          itemType: dto.label,
          field: 'quantity',
          from: 0,
          to: dto.quantity,
          reason: `Ajout ligne spéciale ${dto.quantity} × ${dto.unitPrice} F${dto.note ? ' — ' + dto.note : ''}`,
        }],
      },
    ];
    await this.invoiceRepository.save(invoice);
    await this.invoices.recomputeTotals(companyId, invoice.id);
    return this.invoices.findOne(companyId, invoice.id);
  }

  /** Presets du fichier juin : charge magasin 115 000, régule pénalités, TENUS 6 000/u, MACRON 1 200/u. */
  static readonly PRESETS = [
    { key: 'charge_magasin', label: 'CHARGE MAGASIN', defaultQty: 1, defaultPu: 115000, category: 'TS' },
    { key: 'regule_penalites', label: 'REGULE PENALITES', defaultQty: 1, defaultPu: 15000, category: 'TS' },
    { key: 'regularisation_prod', label: 'REGULARISATION PROD', defaultQty: 1, defaultPu: 0, category: 'PRODUCTION' },
    { key: 'tenus', label: 'TENUS (pantalons)', defaultQty: 0, defaultPu: 6000, category: 'TS' },
    { key: 'macron', label: 'MACRON (prime vestimentaire)', defaultQty: 0, defaultPu: 1200, category: 'TS' },
  ] as const;

  async removeLine(companyId: string, invoiceId: string, lineId: string, userId: string | null) {
    const invoice = await this.invoiceRepository.findOne({ where: { companyId, id: invoiceId } });
    if (!invoice) throw new NotFoundException('Facture introuvable');
    if (invoice.status === 'finalisee') {
      throw new BadRequestException('Facture finalisée — modification impossible');
    }
    const line = await this.lineRepository.findOne({ where: { companyId, invoiceId, id: lineId } });
    if (!line) throw new NotFoundException('Ligne introuvable');
    await this.lineRepository.remove(line);
    invoice.corrections = [
      ...(invoice.corrections ?? []),
      {
        at: new Date().toISOString(),
        by: userId,
        changes: [{
          lineId: line.id,
          itemType: line.itemType,
          field: 'quantity',
          from: Number(line.quantity),
          to: 0,
          reason: 'Suppression de la ligne',
        }],
      },
    ];
    await this.invoiceRepository.save(invoice);
    await this.invoices.recomputeTotals(companyId, invoice.id);
    return this.invoices.findOne(companyId, invoice.id);
  }
}
