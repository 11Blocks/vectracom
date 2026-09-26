import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not, IsNull } from 'typeorm';
import { ItemSerial } from './entities/item-serial.entity';
import { StockItem } from './entities/stock-item.entity';
import { Team } from '../teams/entities/team.entity';

/**
 * Lot P7 — Parc sérialisé de bout en bout (fichier « Suivi End to End
 * livraison modems F6600 Sofatelcom » : Materiel | Num Serie | Numero |
 * Num cartons | Equipe | Date livraison Equipe | Date livraison Sonatel).
 * Cycle : réception SONATEL → carton → équipe → posé chez client (ND) →
 * retour défectueux → retour SONATEL.
 */
@Injectable()
export class SerialLifecycleService {
  constructor(
    @InjectRepository(ItemSerial)
    private readonly serialRepository: Repository<ItemSerial>,
    @InjectRepository(StockItem)
    private readonly itemRepository: Repository<StockItem>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
  ) {}

  /** Réception d'un lot SONATEL : crée les n° de série (import du fichier de suivi). */
  async receiveBatch(
    companyId: string,
    dto: { reference: string; serials: Array<{ serialNumber: string; cartonNumber?: string }> },
  ) {
    const item = await this.itemRepository.findOne({ where: { companyId, reference: dto.reference } });
    if (!item) throw new NotFoundException(`Article ${dto.reference} introuvable`);
    if (item.category !== 'ASSET') throw new BadRequestException('Réception par n° de série réservée aux articles sérialisés (ASSET)');
    let created = 0;
    for (const entry of dto.serials) {
      const serialNumber = String(entry?.serialNumber ?? '').trim();
      if (!serialNumber) continue;
      const existing = await this.serialRepository.findOne({
        where: { companyId, serialNumber },
      });
      if (existing) continue;
      await this.serialRepository.save(
        this.serialRepository.create({
          companyId,
          stockItemId: item.id,
          serialNumber,
          status: 'disponible',
          cartonNumber: entry.cartonNumber ?? null,
        }),
      );
      created++;
    }
    return { created, total: dto.serials.length };
  }

  /** Livraison à une équipe (mise à jour du parc mobile). */
  async deliverToTeam(companyId: string, serialIds: string[], teamId: string) {
    const team = await this.teamRepository.findOne({ where: { companyId, id: teamId } });
    if (!team) throw new NotFoundException('Équipe introuvable');
    const serials = await this.serialRepository.find({ where: { companyId, id: In(serialIds) } });
    let updated = 0;
    for (const s of serials) {
      if (s.status !== 'disponible') continue;
      s.deliveredToTeamId = teamId;
      s.deliveredToTeamAt = new Date().toISOString().slice(0, 10);
      await this.serialRepository.save(s);
      updated++;
    }
    return { updated };
  }

  /** Pose chez le client : lie le n° de série au ND (fin du suivi End-to-End). */
  async installAtClient(companyId: string, serialId: string, nd: string, missionId?: string) {
    const serial = await this.serialRepository.findOne({ where: { companyId, id: serialId } });
    if (!serial) throw new NotFoundException('N° de série introuvable');
    if (['retourne', 'feraillerie', 'perdu'].includes(serial.status)) {
      throw new BadRequestException(`Équipement au statut « ${serial.status} » : pose impossible`);
    }
    if (!nd.trim()) throw new BadRequestException('ND client obligatoire pour la pose');
    if (missionId) {
      const rows = await this.serialRepository.query('SELECT 1 FROM missions WHERE id = $1 AND company_id = $2', [missionId, companyId]);
      if (!rows.length) throw new BadRequestException('Mission introuvable pour ce tenant');
    }
    serial.installedAtClientNd = nd.trim();
    serial.installedAt = new Date().toISOString().slice(0, 10);
    serial.status = 'en_cours';
    return this.serialRepository.save(serial);
  }

  /** Retour : défectueux (reconditionnement) ou bon (réemploi). */
  async returnFromField(companyId: string, serialId: string, defect: boolean) {
    const serial = await this.serialRepository.findOne({ where: { companyId, id: serialId } });
    if (!serial) throw new NotFoundException('N° de série introuvable');
    serial.status = defect ? 'defectueux' : 'disponible';
    serial.installedAtClientNd = null;
    serial.installedAt = null;
    return this.serialRepository.save(serial);
  }

  /** Retour définitif à SONATEL (délai contractuel 7 jours — KPI stock). */
  async returnToSonatel(companyId: string, serialIds: string[]) {
    const serials = await this.serialRepository.find({ where: { companyId, id: In(serialIds) } });
    let updated = 0;
    for (const s of serials) {
      if (s.status !== 'defectueux' && s.status !== 'recupere_defectueux') continue;
      s.status = 'retourne';
      s.returnedToSonatelAt = new Date().toISOString().slice(0, 10);
      await this.serialRepository.save(s);
      updated++;
    }
    return { updated };
  }

  /** Marque une pièce récupérée (bon ou défectueux) après dépose terrain. */
  async markRecovered(companyId: string, serialId: string, defect: boolean) {
    const serial = await this.serialRepository.findOne({ where: { companyId, id: serialId } });
    if (!serial) throw new NotFoundException('N° de série introuvable');
    serial.status = defect ? 'recupere_defectueux' : 'recupere_bon';
    serial.installedAtClientNd = null;
    return this.serialRepository.save(serial);
  }

  /** Sortie feraillerie (vente ferraille / pièces HS) — valeur optionnelle. */
  async scrapSale(companyId: string, serialId: string, amountFcfa?: number) {
    const serial = await this.serialRepository.findOne({ where: { companyId, id: serialId } });
    if (!serial) throw new NotFoundException('N° de série introuvable');
    if (!['defectueux', 'recupere_defectueux', 'perdu'].includes(serial.status)) {
      throw new BadRequestException('Seules les pièces défectueuses / perdues peuvent partir en feraillerie');
    }
    serial.status = 'feraillerie';
    serial.feraillerieAmountFcfa = amountFcfa ?? null;
    serial.feraillerieSoldAt = new Date().toISOString().slice(0, 10);
    return this.serialRepository.save(serial);
  }

  /** Outillage / assets affectés à une équipe (livraisons parc). */
  async toolingByTeam(companyId: string, teamId?: string) {
    const serials = await this.serialRepository.find({
      where: teamId
        ? {
            companyId,
            deliveredToTeamId: teamId,
            status: In(['disponible', 'en_cours', 'recupere_bon']),
          }
        : {
            companyId,
            deliveredToTeamId: Not(IsNull()),
            status: In(['disponible', 'en_cours', 'recupere_bon']),
          },
      relations: ['stockItem'],
      order: { deliveredToTeamAt: 'DESC' },
      take: 500,
    });
    const teams = await this.teamRepository.find({ where: { companyId } });
    const teamName = new Map(teams.map((t) => [t.id, t.name]));
    return serials.map((s) => ({
      id: s.id,
      serialNumber: s.serialNumber,
      status: s.status,
      reference: s.stockItem?.reference ?? null,
      designation: s.stockItem?.designation ?? null,
      family: s.stockItem?.family ?? null,
      teamId: s.deliveredToTeamId,
      teamName: s.deliveredToTeamId ? teamName.get(s.deliveredToTeamId) ?? null : null,
      deliveredAt: s.deliveredToTeamAt,
    }));
  }

  /** État du parc d'un article : disponible / chez équipes / posés / défectueux / retournés. */
  async fleet(companyId: string, reference: string) {
    const item = await this.itemRepository.findOne({ where: { companyId, reference } });
    if (!item) throw new NotFoundException(`Article ${reference} introuvable`);
    const serials = await this.serialRepository.find({ where: { companyId, stockItemId: item.id } });
    const teams = await this.teamRepository.find({ where: { companyId } });
    const teamName = new Map(teams.map((t) => [t.id, t.name]));

    const byStatus: Record<string, number> = {};
    for (const s of serials) byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;

    return {
      reference,
      total: serials.length,
      byStatus,
      serials: serials.slice(0, 500).map((s) => ({
        id: s.id,
        serialNumber: s.serialNumber,
        status: s.status,
        cartonNumber: s.cartonNumber,
        team: s.deliveredToTeamId ? teamName.get(s.deliveredToTeamId) ?? '—' : null,
        deliveredToTeamAt: s.deliveredToTeamAt,
        clientNd: s.installedAtClientNd,
        installedAt: s.installedAt,
        returnedToSonatelAt: s.returnedToSonatelAt,
      })),
    };
  }

  /** Recherche par n° de série ou ND (question terrain n°1). */
  async search(companyId: string, q: string) {
    const serials = await this.serialRepository
      .createQueryBuilder('s')
      .where('s.company_id = :cid', { cid: companyId })
      .andWhere('(s.serial_number ILIKE :q OR s.installed_at_client_nd ILIKE :q)', { q: `%${q}%` })
      .take(50)
      .getMany();
    const itemIds = [...new Set(serials.map((s) => s.stockItemId))];
    const items = itemIds.length > 0 ? await this.itemRepository.find({ where: { companyId, id: In(itemIds) } }) : [];
    const itemById = new Map(items.map((i) => [i.id, i]));
    return serials.map((s) => ({
      id: s.id,
      serialNumber: s.serialNumber,
      status: s.status,
      reference: itemById.get(s.stockItemId)?.reference ?? '—',
      designation: itemById.get(s.stockItemId)?.designation ?? '—',
      clientNd: s.installedAtClientNd,
      installedAt: s.installedAt,
    }));
  }
}
