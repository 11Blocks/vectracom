import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockMovement } from '../stock/entities/stock-movement.entity';
import { StockItem } from '../stock/entities/stock-item.entity';
import { StockLevel } from '../stock/entities/stock-level.entity';

/**
 * Agent Stock : ruptures probables et consommations anormales — propositions
 * de réapprovisionnement soumises au magasinier.
 */
@Injectable()
export class AgentStockService {
  constructor(
    @InjectRepository(StockMovement)
    private readonly movementRepository: Repository<StockMovement>,
    @InjectRepository(StockItem)
    private readonly stockItemRepository: Repository<StockItem>,
    @InjectRepository(StockLevel)
    private readonly stockLevelRepository: Repository<StockLevel>,
  ) {}

  /** Consommation du mois en cours > 2× la moyenne des 2 mois précédents. */
  async detectAnomalies(companyId: string) {
    const rows = await this.movementRepository.query(
      `SELECT sm.stock_item_id,
              SUM(CASE WHEN to_char(sm.created_at, 'YYYY-MM') = to_char(now(), 'YYYY-MM') THEN sm.quantity ELSE 0 END) AS ce_mois,
              SUM(CASE WHEN to_char(sm.created_at, 'YYYY-MM') < to_char(now(), 'YYYY-MM') THEN sm.quantity ELSE 0 END) / 2.0 AS moyenne_mensuelle
       FROM stock_movements sm
       WHERE sm.company_id = $1 AND sm.type = 'consommation'
       GROUP BY sm.stock_item_id`,
      [companyId],
    );
    const items = await this.stockItemRepository.find({ where: { companyId } });
    const itemById = new Map(items.map((i) => [i.id, i]));

    const anomalies = rows
      .filter((r: { ce_mois: string; moyenne_mensuelle: string }) => Number(r.moyenne_mensuelle) > 0 && Number(r.ce_mois) > 2 * Number(r.moyenne_mensuelle))
      .map((r: { stock_item_id: string; ce_mois: string; moyenne_mensuelle: string }) => ({
        stockItemId: r.stock_item_id,
        reference: itemById.get(r.stock_item_id)?.reference ?? r.stock_item_id,
        designation: itemById.get(r.stock_item_id)?.designation ?? '-',
        consommeCeMois: Number(r.ce_mois),
        moyenneMensuelle: Math.round(Number(r.moyenne_mensuelle) * 100) / 100,
        ratio: Math.round((Number(r.ce_mois) / Number(r.moyenne_mensuelle)) * 100) / 100,
        suggestion: 'Vérifier la saisie terrain et les gaspillages — réapprovisionnement à ajuster',
      }));
    return { anomalies, autoExecute: false };
  }

  /** Rupture probable : stock actuel < seuil, avec rythme de consommation. */
  async detectRuptures(companyId: string) {
    const rows = await this.stockLevelRepository.query(
      `SELECT i.id, i.reference, i.designation, i.threshold_alert, COALESCE(SUM(l.quantity), 0) AS total
       FROM stock_items i LEFT JOIN stock_levels l ON l.stock_item_id = i.id
       WHERE i.company_id = $1
       GROUP BY i.id, i.reference, i.designation, i.threshold_alert
       HAVING COALESCE(SUM(l.quantity), 0) < i.threshold_alert`,
      [companyId],
    );
    const ruptures = rows.map((r: { id: string; reference: string; designation: string; total: string; threshold_alert: string }) => ({
      stockItemId: r.id,
      reference: r.reference,
      designation: r.designation,
      stockActuel: Number(r.total),
      seuil: Number(r.threshold_alert),
      proposal: `Commander ${Math.max(Number(r.threshold_alert) * 2 - Number(r.total), Number(r.threshold_alert))} unité(s)`,
    }));
    return { ruptures, autoExecute: false };
  }
}
