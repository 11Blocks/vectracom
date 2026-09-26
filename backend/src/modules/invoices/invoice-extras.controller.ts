import { BadRequestException, Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import type { Response } from 'express';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { InvoiceExtrasService } from './invoice-extras.service';
import * as XLSX from 'xlsx';
import { INVOICE_CATEGORIES } from './entities/invoice-line.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceLine } from './entities/invoice-line.entity';
import { Invoice } from './entities/invoice.entity';
import { Company } from '../auth/entities/company.entity';

class AddExtraDto {
  @IsString() @MinLength(2) @MaxLength(300) label!: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice!: number;

  @IsOptional() @IsIn(INVOICE_CATEGORIES as unknown as string[]) category?: string;

  @IsOptional() @IsString() @MaxLength(20) unit?: string;

  @IsOptional() @IsString() note?: string;
}

@Controller('invoices')
@Roles(UserRole.ADMIN, UserRole.DIRECTION)
export class InvoiceExtrasController {
  constructor(
    private readonly extras: InvoiceExtrasService,
    @InjectRepository(InvoiceLine)
    private readonly lineRepository: Repository<InvoiceLine>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

  /** Presets des lignes spéciales du fichier juin. */
  @Get('extras/presets')
  presets() {
    return { presets: InvoiceExtrasService.PRESETS };
  }

  @Post(':id/extras')
  @Roles(UserRole.ADMIN)
  addExtra(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: AddExtraDto,
  ) {
    this.requireTenant(companyId);
    return this.extras.addExtraLine(companyId!, id, dto, userId);
  }

  @Post(':id/lines/:lineId/remove')
  @Roles(UserRole.ADMIN)
  removeLine(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
  ) {
    this.requireTenant(companyId);
    return this.extras.removeLine(companyId!, id, lineId, userId);
  }

  /**
   * Export Excel format ONECOMIT — 9 feuilles :
   * Synthese + PRODUCTION + SAV + TS + POI + INFRA + GC + TENUS_MACRON + REGULES.
   */
  @Get(':id/export-attachement')
  async exportAttachement(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    this.requireTenant(companyId);
    const invoice = await this.invoiceRepository.findOne({ where: { companyId: companyId!, id } });
    if (!invoice) {
      res.status(404).json({ message: 'Facture introuvable' });
      return;
    }
    const company = await this.companyRepository.findOne({ where: { id: companyId! } });
    const lines = await this.lineRepository.find({ where: { companyId: companyId!, invoiceId: invoice.id } });

    const SHEETS = ['PRODUCTION', 'SAV', 'TS', 'POI', 'INFRA', 'GC'] as const;
    const byCategory = new Map<string, typeof lines>();
    for (const line of lines) {
      const cat = (SHEETS as readonly string[]).includes(line.category) ? line.category : 'TS';
      byCategory.set(cat, [...(byCategory.get(cat) ?? []), line]);
    }

    const lineRows = (catLines: typeof lines) =>
      catLines.map((line) => ({
        Prestation: line.itemType,
        QTT: Number(line.quantity),
        PRIX: Number(line.unitPrice),
        MONTANT: Number(line.total),
      }));

    const wb = XLSX.utils.book_new();
    const periodLabel = new Date(invoice.periodStart).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const totalHt = Number(invoice.totalHt);
    const tva = Number(invoice.totalTva);
    const net = Number(invoice.totalTtc);
    const tvaPct = totalHt ? Math.round((tva / totalHt) * 1000) / 10 : 18;

    const synthRows = [
      { Rubrique: (company?.name ?? 'ONECOMIT').toUpperCase(), Montant: '' },
      { Rubrique: `Facture ${periodLabel} — ${invoice.invoiceNumber}`, Montant: '' },
      { Rubrique: '', Montant: '' },
      ...SHEETS.map((cat) => ({
        Rubrique: cat,
        Montant: (byCategory.get(cat) ?? []).reduce((s, l) => s + Number(l.total), 0),
      })),
      ...(Number(invoice.discountAmount) ? [{ Rubrique: 'REMISE', Montant: -Number(invoice.discountAmount) }] : []),
      { Rubrique: 'TOTAL HT', Montant: totalHt },
      { Rubrique: `TVA ${tvaPct}%`, Montant: tva },
      ...(Number(invoice.penaltiesTotal) ? [{ Rubrique: 'PENALITES KPI', Montant: -Number(invoice.penaltiesTotal) }] : []),
      { Rubrique: 'NET A PAYER', Montant: net },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(synthRows), 'Synthese');

    for (const cat of SHEETS) {
      const catLines = byCategory.get(cat) ?? [];
      const rows = catLines.length
        ? lineRows(catLines)
        : [{ Prestation: '(aucune ligne)', QTT: 0, PRIX: 0, MONTANT: 0 }];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), cat);
    }

    const tenusMacron = lines.filter((l) => /TENUS|MACRON/i.test(l.itemType));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        tenusMacron.length
          ? lineRows(tenusMacron)
          : [{ Prestation: '(aucun TENUS/MACRON)', QTT: 0, PRIX: 0, MONTANT: 0 }],
      ),
      'TENUS_MACRON',
    );

    const regules = lines.filter((l) => /REGULE|REGULARISATION|CHARGE MAGASIN/i.test(l.itemType));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        regules.length
          ? lineRows(regules)
          : [{ Prestation: '(aucune régule)', QTT: 0, PRIX: 0, MONTANT: 0 }],
      ),
      'REGULES',
    );

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}-attachement-9feuilles.xlsx"`);
    res.send(buffer);
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}
