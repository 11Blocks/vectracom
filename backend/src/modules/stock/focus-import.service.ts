import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { Warehouse } from './entities/warehouse.entity';
import { StockItem } from './entities/stock-item.entity';
import { StockLevel } from './entities/stock-level.entity';
import { PriceItem } from './entities/price-item.entity';

/**
 * Lot P7 — Import FOCUS multi-dépôts.
 * Colonnes attendues (souples) : Reference | Designation | Depot/Warehouse |
 * Quantite | Famille | Unite | Seuil | Commentaire
 */
@Injectable()
export class FocusImportService {
  constructor(
    @InjectRepository(Warehouse) private readonly warehouseRepo: Repository<Warehouse>,
    @InjectRepository(StockItem) private readonly itemRepo: Repository<StockItem>,
    @InjectRepository(StockLevel) private readonly levelRepo: Repository<StockLevel>,
    @InjectRepository(PriceItem) private readonly priceRepo: Repository<PriceItem>,
  ) {}

  async import(companyId: string, buffer: Buffer) {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheetName =
      wb.SheetNames.find((n) => /FOCUS|STOCK|DEPOT/i.test(n)) ?? wb.SheetNames[0];
    if (!sheetName) throw new BadRequestException('Fichier Excel vide');
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], {
      defval: '',
    });
    if (!rows.length) throw new BadRequestException('Aucune ligne dans la feuille FOCUS');

    const warehouses = await this.warehouseRepo.find({ where: { companyId } });
    const whByName = new Map(warehouses.map((w) => [w.name.toLowerCase().trim(), w]));
    const prices = await this.priceRepo.find({ where: { companyId }, take: 5000 });

    let createdItems = 0;
    let updatedLevels = 0;
    let matchedBordereau = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const ref = str(row, ['Reference', 'REFERENCE', 'Ref', 'Code']);
      const designation = str(row, ['Designation', 'Désignation', 'DESIGNATION', 'Libelle', 'Libellé']);
      const depot = str(row, ['Depot', 'Dépôt', 'Warehouse', 'Entrepot', 'Entrepôt', 'Emplacement']);
      const qty = num(row, ['Quantite', 'Quantité', 'QTE', 'Qty', 'Stock']);
      if (!ref && !designation) continue;
      if (!depot) {
        errors.push(`Ligne ${i + 2}: dépôt manquant`);
        continue;
      }
      let wh = whByName.get(depot.toLowerCase());
      if (!wh) {
        wh = await this.warehouseRepo.save(
          this.warehouseRepo.create({
            companyId,
            name: depot,
            type: 'CENTRAL',
            zone: null,
          }),
        );
        whByName.set(depot.toLowerCase(), wh);
      }

      const familyRaw = str(row, ['Famille', 'Family']);
      const family = /OUTILL|TOOL/i.test(familyRaw)
        ? 'OUTILLAGE'
        : /CUIVRE/i.test(familyRaw)
          ? 'CUIVRE'
          : 'FIBRE';
      const unit = str(row, ['Unite', 'Unité', 'Unit']) || 'U';
      const threshold = num(row, ['Seuil', 'Threshold', 'Alerte']) ?? 5;
      const reference = ref || `FOCUS-${designation.slice(0, 20).replace(/\s+/g, '-').toUpperCase()}`;

      let item = await this.itemRepo.findOne({ where: { companyId, reference } });
      if (!item) {
        item = await this.itemRepo.save(
          this.itemRepo.create({
            companyId,
            reference,
            designation: designation || reference,
            category: 'CONSUMABLE',
            family,
            unit,
            thresholdAlert: threshold,
          }),
        );
        createdItems++;
      }

      const priceHit = prices.find(
        (p) =>
          p.designation?.toLowerCase().includes((designation || reference).toLowerCase().slice(0, 12)) ||
          String(p.itemNumber) === reference,
      );
      if (priceHit) matchedBordereau++;

      if (qty != null && qty >= 0) {
        let level = await this.levelRepo.findOne({
          where: { stockItemId: item.id, warehouseId: wh.id },
        });
        if (!level) {
          level = this.levelRepo.create({
            companyId,
            stockItemId: item.id,
            warehouseId: wh.id,
            quantity: qty,
          });
        } else {
          level.quantity = qty;
        }
        await this.levelRepo.save(level);
        updatedLevels++;
      }
    }

    return {
      sheet: sheetName,
      rows: rows.length,
      createdItems,
      updatedLevels,
      matchedBordereau,
      warehousesTouched: whByName.size,
      errors: errors.slice(0, 20),
    };
  }
}

function str(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    for (const rk of Object.keys(row)) {
      if (rk.trim().toLowerCase() === k.toLowerCase()) {
        const v = String(row[rk] ?? '').trim();
        if (v) return v;
      }
    }
  }
  return '';
}

function num(row: Record<string, unknown>, keys: string[]): number | null {
  const s = str(row, keys);
  if (!s) return null;
  const n = Number(String(s).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
