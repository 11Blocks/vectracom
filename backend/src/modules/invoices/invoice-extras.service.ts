import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from './entities/invoice.entity';
import { INVOICE_CATEGORIES, InvoiceLine } from './entities/invoice-line.entity';
import { InvoicesService } from './invoices.service';
import { AuditService } from '../../common/audit/audit.service';

/**
 * Lignes ajoutées à la main sur un brouillon : lignes spéciales de l'attachement
 * (charge magasin, régule pénalités, TENUS, MACRON…) ou lignes libres.
 * Chaque ajout / suppression est tracé dans invoice.corrections et le journal d'audit.
 */
@Injectable()
export class InvoiceExtrasService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceLine)
    private readonly lineRepository: Repository<InvoiceLine>,
    private readonly invoices: InvoicesService,
    private readonly audit: AuditService,
  ) {}

  async addExtraLine(
    companyId: string,
    invoiceId: string,
    dto: { label: string; quantity: number; unitPrice: number; category?: string; unit?: string; note?: string },
    userId: string | null,
  ) {
    const invoice = await this.invoiceRepository.findOne({ where: { companyId, id: invoiceId } });
    if (!invoice) throw new NotFoundException('Facture introuvable');
    this.invoices.assertEditable(invoice);
    if (dto.quantity <= 0 || dto.unitPrice < 0) {
      throw new BadRequestException('Quantité > 0 et prix ≥ 0 requis');
    }
    const category = dto.category && (INVOICE_CATEGORIES as readonly string[]).includes(dto.category) ? dto.category : 'AUTRE';
    const last = await this.lineRepository.findOne({ where: { companyId, invoiceId }, order: { position: 'DESC' } });

    const line = this.invoices.buildLine(
      companyId,
      invoice.id,
      { itemType: dto.label, quantity: dto.quantity, unitPrice: dto.unitPrice, category, unit: dto.unit },
      (last?.position ?? -1) + 1,
    );
    await this.lineRepository.insert(line as never);

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
          reason: `Ajout ligne ${dto.quantity} × ${dto.unitPrice} F${dto.note ? ' — ' + dto.note : ''}`,
        }],
      },
    ];
    await this.invoiceRepository.save(invoice);
    await this.invoices.recomputeTotals(companyId, invoice.id);
    await this.audit.log({
      companyId, actorId: userId, action: 'invoice.line_add', entityType: 'invoice', entityId: invoice.id,
      payload: { label: dto.label, quantity: dto.quantity, unitPrice: dto.unitPrice },
    });
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
    this.invoices.assertEditable(invoice);
    const line = await this.lineRepository.findOne({ where: { companyId, invoiceId, id: lineId } });
    if (!line) throw new NotFoundException('Ligne introuvable');
    await this.lineRepository.remove(line);
    invoice.corrections = [
      ...(invoice.corrections ?? []),
      {
        at: new Date().toISOString(),
        by: userId,
        changes: [{
          lineId,
          itemType: line.itemType,
          field: 'quantity',
          from: Number(line.quantity),
          to: 0,
          reason: 'Suppression de la ligne',
        }],
      },
    ];
    invoice.status = 'en_correction';
    await this.invoiceRepository.save(invoice);
    await this.invoices.recomputeTotals(companyId, invoice.id);
    await this.audit.log({
      companyId, actorId: userId, action: 'invoice.line_remove', entityType: 'invoice', entityId: invoice.id,
      payload: { label: line.itemType, total: Number(line.total) },
    });
    return this.invoices.findOne(companyId, invoice.id);
  }
}
