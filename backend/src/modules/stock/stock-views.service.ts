import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Warehouse } from './entities/warehouse.entity';

/**
 * Lot P7 — Vues hiérarchiques du stock (document Green-T) :
 * par région → dépôt (CENTRAL/RÉGIONAL/SATELLITE) → véhicules, avec les
 * 4 niveaux d'alerte (OK / Faible ≤ seuil / Critique ≤ seuil÷2 / Rupture = 0).
 */
@Injectable()
export class StockViewsService {
  constructor(
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
  ) {}

  /** Vue par région : dépôts avec articles en alerte et véhicules rattachés. */
  async byRegion(companyId: string) {
    const rows: Array<{
      warehouse_id: string; name: string; type: string; region: string | null; zone: string | null;
      parent_id: string | null; vehicle: string | null;
      items: number; alerts: number; criticals: number; ruptures: number; value: number;
    }> = await this.warehouseRepository.query(
      `SELECT w.id AS warehouse_id, w.name, w.type, w.region, w.zone, w.parent_warehouse_id AS parent_id, v.immatriculation AS vehicle,
              COUNT(DISTINCT l.stock_item_id) AS items,
              COUNT(DISTINCT CASE WHEN l.quantity > 0 AND l.quantity <= COALESCE(l.threshold_alert, i.threshold_alert) THEN l.stock_item_id END) AS alerts,
              COUNT(DISTINCT CASE WHEN l.quantity > 0 AND l.quantity <= COALESCE(l.threshold_alert, i.threshold_alert) / 2.0 THEN l.stock_item_id END) AS criticals,
              COUNT(DISTINCT CASE WHEN l.quantity = 0 THEN l.stock_item_id END) AS ruptures,
              COALESCE(SUM(l.quantity * COALESCE(p.unit_price, 0)), 0) AS value
       FROM warehouses w
       LEFT JOIN stock_levels l ON l.warehouse_id = w.id
       LEFT JOIN stock_items i ON i.id = l.stock_item_id
       LEFT JOIN price_items p ON p.company_id = w.company_id AND p.price_grid = 'BORDEREAU_3STB' AND p.version = '2025' AND p.designation ILIKE '%' || i.designation || '%' AND p.is_active
       LEFT JOIN vehicles v ON v.warehouse_id = w.id
       WHERE w.company_id = $1
       GROUP BY w.id, w.name, w.type, w.region, w.zone, w.parent_warehouse_id, v.immatriculation
       ORDER BY w.region NULLS LAST, w.type, w.name`,
      [companyId],
    );

    const byRegion = new Map<string, any[]>();
    for (const r of rows) {
      const region = r.region ?? '(sans région)';
      byRegion.set(region, [...(byRegion.get(region) ?? []), r]);
    }
    return [...byRegion.entries()].map(([region, deps]) => ({
      region,
      warehouses: deps.map((d) => ({
        id: d.warehouse_id,
        name: d.name,
        type: d.type,
        zone: d.zone,
        vehicle: d.vehicle,
        itemsCount: Number(d.items),
        alerts: Number(d.alerts),
        criticals: Number(d.criticals),
        ruptures: Number(d.ruptures),
        value: Math.round(Number(d.value)),
      })),
    }));
  }

  /** Niveau d'alerte d'un emplacement pour un article (4 niveaux Green-T). */
  static alertLevel(quantity: number, threshold: number | null): 'ok' | 'faible' | 'critique' | 'rupture' {
    if (quantity <= 0) return 'rupture';
    if (threshold !== null && quantity <= threshold / 2) return 'critique';
    if (threshold !== null && quantity <= threshold) return 'faible';
    return 'ok';
  }
}
