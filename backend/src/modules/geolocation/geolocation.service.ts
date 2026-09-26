import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Geoposition } from './entities/geoposition.entity';
import { GeofenceZone } from './entities/geofence-zone.entity';
import { CompanySubscription } from '../saas/entities/company-subscription.entity';
import { Technician } from '../technicians/entities/technician.entity';
import { Mission } from '../missions/entities/mission.entity';
import { MissionFieldReport } from '../missions/entities/field-report.entity';

/** Rayon par défaut de rattachement à un site de mission (mètres). */
const SITE_RADIUS_M = 500;
/** Au-delà de ce délai sans point, un technicien en mission est « silencieux ». */
const SILENCE_MINUTES = 60;

export interface LiveMarker {
  technicianId: string;
  technicianName: string;
  teamName: string | null;
  latitude: number;
  longitude: number;
  recordedAt: Date;
  minutesAgo: number;
  batteryPct: number | null;
  speedKmh: number | null;
  mission: { id: string; clientSite: string; typeTache: string; status: string; zone: string | null } | null;
  distanceToSiteM: number | null;
  outOfZone: boolean;
  silent: boolean;
  nearestZoneId: string | null;
  nearestZoneName: string | null;
  nearestZoneType: string | null;
  distanceToNearestZoneM: number | null;
}

export type NearestZone = {
  id: string;
  name: string;
  type: string;
  radiusM: number;
  distanceM: number;
  inside: boolean;
};

/** Distance haversine entre deux points (mètres). */
export function distanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/** Zone géofence la plus proche (toutes types actives). */
export function findNearestZone(
  lat: number,
  lon: number,
  zones: GeofenceZone[],
): NearestZone | null {
  if (!zones.length) return null;
  let best: NearestZone | null = null;
  for (const z of zones) {
    const d = distanceM(lat, lon, Number(z.centerLatitude), Number(z.centerLongitude));
    const candidate: NearestZone = {
      id: z.id,
      name: z.name,
      type: z.type,
      radiusM: z.radiusM,
      distanceM: d,
      inside: d <= z.radiusM,
    };
    if (!best || candidate.distanceM < best.distanceM) best = candidate;
  }
  return best;
}

/**
 * Hors zone :
 * - si GPS site mission (étape 2) → distance > SITE_RADIUS_M
 * - sinon si zones zone_travail → hors si hors de TOUTES (aucune inside)
 * - sinon false
 */
export function computeOutOfZone(
  lat: number,
  lon: number,
  zones: GeofenceZone[],
  siteGps: { lat: number; lon: number } | null,
): { outOfZone: boolean; distanceToSiteM: number | null } {
  if (siteGps) {
    const distanceToSiteM = distanceM(lat, lon, siteGps.lat, siteGps.lon);
    return { outOfZone: distanceToSiteM > SITE_RADIUS_M, distanceToSiteM };
  }
  const workZones = zones.filter((z) => z.type === 'zone_travail');
  if (workZones.length === 0) return { outOfZone: false, distanceToSiteM: null };
  const insideAny = workZones.some(
    (z) => distanceM(lat, lon, Number(z.centerLatitude), Number(z.centerLongitude)) <= z.radiusM,
  );
  return { outOfZone: !insideAny, distanceToSiteM: null };
}

@Injectable()
export class GeolocationService {
  constructor(
    @InjectRepository(Geoposition)
    private readonly positionRepository: Repository<Geoposition>,
    @InjectRepository(GeofenceZone)
    private readonly zoneRepository: Repository<GeofenceZone>,
    @InjectRepository(CompanySubscription)
    private readonly subscriptionRepository: Repository<CompanySubscription>,
    @InjectRepository(Technician)
    private readonly technicianRepository: Repository<Technician>,
    @InjectRepository(Mission)
    private readonly missionRepository: Repository<Mission>,
    @InjectRepository(MissionFieldReport)
    private readonly reportRepository: Repository<MissionFieldReport>,
  ) {}

  /** Licence GEOLOCATION (option payante 5 000 FCFA/mois) obligatoire. */
  async assertLicense(companyId: string) {
    const active = await this.subscriptionRepository.findOne({
      where: { companyId, planCode: 'GEOLOCATION', status: 'active' },
    });
    if (!active) {
      throw new ForbiddenException(
        'Géolocalisation : option payante (5 000 FCFA/mois) — aucune licence GEOLOCATION active pour ce tenant',
      );
    }
  }

  /** Enregistre un point GPS (mobile en arrière-plan ou étape 2 mission). */
  async record(companyId: string, dto: {
    technicianId: string; latitude: number; longitude: number; recordedAt?: string;
    accuracyM?: number; speedKmh?: number; batteryPct?: number; missionId?: string; source?: string;
  }): Promise<Geoposition> {
    await this.assertLicense(companyId);
    const tech = await this.technicianRepository.findOne({ where: { companyId, id: dto.technicianId } });
    if (!tech) throw new NotFoundException('Technicien introuvable');
    if (dto.latitude < -90 || dto.latitude > 90 || dto.longitude < -180 || dto.longitude > 180) {
      throw new BadRequestException('Coordonnées GPS invalides');
    }

    // Rate-limit / dédoublonnage (G4) : ignorer un point quasi-identique récent
    const MIN_INTERVAL_MS = 45_000;
    const MIN_MOVE_M = 20;
    const last = await this.positionRepository.findOne({
      where: { companyId, technicianId: dto.technicianId },
      order: { recordedAt: 'DESC' },
    });
    if (last) {
      const ageMs = Date.now() - new Date(last.recordedAt).getTime();
      const moved = distanceM(
        dto.latitude,
        dto.longitude,
        Number(last.latitude),
        Number(last.longitude),
      );
      if (ageMs < MIN_INTERVAL_MS && moved < MIN_MOVE_M) {
        return last; // idempotent : renvoie le dernier point sans insert
      }
    }

    return this.positionRepository.save(
      this.positionRepository.create({
        companyId,
        technicianId: dto.technicianId,
        missionId: dto.missionId ?? null,
        latitude: String(dto.latitude),
        longitude: String(dto.longitude),
        accuracyM: dto.accuracyM ?? null,
        speedKmh: dto.speedKmh != null ? String(dto.speedKmh) : null,
        batteryPct: dto.batteryPct ?? null,
        recordedAt: dto.recordedAt ? new Date(dto.recordedAt) : new Date(),
        source: (dto.source as Geoposition['source']) ?? 'mobile',
      }),
    );
  }

  /**
   * Résout le technicien rattaché au compte user (userId).
   * Fallback : chef d'équipe actif homonyme (fullName) si pas de lien userId.
   */
  async resolveTechnicianForUser(companyId: string, userId: string, userFullName?: string | null) {
    const linked = await this.technicianRepository.findOne({
      where: { companyId, userId, active: true },
    });
    if (linked) return linked;

    if (userFullName?.trim()) {
      const byName = await this.technicianRepository
        .createQueryBuilder('t')
        .where('t.company_id = :cid AND t.active = true', { cid: companyId })
        .andWhere('LOWER(t.full_name) = LOWER(:name)', { name: userFullName.trim() })
        .orderBy('t.is_team_leader', 'DESC')
        .getOne();
      if (byName) return byName;
    }

    throw new NotFoundException(
      'Aucun technicien lié à ce compte — rattachez userId sur la fiche technicien',
    );
  }

  /** Pointage mobile : résout technicianId depuis l'utilisateur connecté. */
  async recordForUser(
    companyId: string,
    userId: string,
    userFullName: string | null | undefined,
    dto: {
      latitude: number; longitude: number; recordedAt?: string;
      accuracyM?: number; speedKmh?: number; batteryPct?: number; missionId?: string; source?: string;
    },
  ) {
    const tech = await this.resolveTechnicianForUser(companyId, userId, userFullName);
    return this.record(companyId, { ...dto, technicianId: tech.id, source: dto.source ?? 'mobile' });
  }

  /** Carte temps réel : dernière position par technicien + mission du jour + écarts. */
  async live(companyId: string): Promise<{ markers: LiveMarker[]; zones: GeofenceZone[]; stats: Record<string, number> }> {
    await this.assertLicense(companyId);

    const latest = await this.positionRepository.query(
      `SELECT DISTINCT ON (technician_id) technician_id, latitude, longitude, recorded_at, battery_pct, speed_kmh, mission_id
       FROM geopositions WHERE company_id = $1
       ORDER BY technician_id, recorded_at DESC`,
      [companyId],
    );

    const zones = await this.zoneRepository.find({ where: { companyId, active: true } });
    if (!Array.isArray(latest) || latest.length === 0) {
      return { markers: [], zones, stats: { enMission: 0, horsZone: 0, silencieux: 0, total: 0 } };
    }

    const [techs, todayMissions, reports] = await Promise.all([
      this.technicianRepository.find({ where: { companyId }, relations: ['team'] }),
      this.missionRepository
        .createQueryBuilder('m')
        .where('m.company_id = :cid', { cid: companyId })
        .andWhere("m.status IN ('planifiee','en_cours','a_completer')")
        .andWhere('m.date_mission::date = CURRENT_DATE')
        .getMany(),
      this.reportRepository.find({ where: { companyId } }),
    ]);
    const techById = new Map(techs.map((t) => [t.id, t]));
    const siteGpsByMission = new Map(
      reports.filter((r) => r.gpsLatitude && r.gpsLongitude).map((r) => [r.missionId, r]),
    );

    const now = Date.now();
    const markers: LiveMarker[] = latest.map((row: Record<string, unknown>) => {
      const technicianId = String(row.technician_id);
      const tech = techById.get(technicianId);
      const lat = Number(row.latitude);
      const lon = Number(row.longitude);
      const recordedAt = new Date(row.recorded_at as string);
      const minutesAgo = Math.round((now - recordedAt.getTime()) / 60000);

      const mission =
        todayMissions.find(
          (m) => m.technicianIds.includes(technicianId) || (tech?.teamId && m.teamId === tech.teamId),
        ) ?? null;

      let siteGps: { lat: number; lon: number } | null = null;
      if (mission) {
        const report = siteGpsByMission.get(mission.id);
        if (report?.gpsLatitude && report?.gpsLongitude) {
          siteGps = { lat: Number(report.gpsLatitude), lon: Number(report.gpsLongitude) };
        }
      }

      const { outOfZone, distanceToSiteM } = computeOutOfZone(lat, lon, zones, siteGps);
      const nearest = findNearestZone(lat, lon, zones);

      return {
        technicianId,
        technicianName: tech?.fullName ?? 'Technicien',
        teamName: tech?.team?.name ?? null,
        latitude: lat,
        longitude: lon,
        recordedAt,
        minutesAgo,
        batteryPct: row.battery_pct != null ? Number(row.battery_pct) : null,
        speedKmh: row.speed_kmh != null ? Number(row.speed_kmh) : null,
        mission: mission
          ? {
              id: mission.id,
              clientSite: mission.clientSite,
              typeTache: mission.typeTache,
              status: mission.status,
              zone: mission.zone ?? null,
            }
          : null,
        distanceToSiteM,
        outOfZone,
        silent: !!mission && minutesAgo > SILENCE_MINUTES,
        nearestZoneId: nearest?.id ?? null,
        nearestZoneName: nearest?.name ?? null,
        nearestZoneType: nearest?.type ?? null,
        distanceToNearestZoneM: nearest?.distanceM ?? null,
      };
    });

    return {
      markers,
      zones,
      stats: {
        total: markers.length,
        enMission: markers.filter((m) => m.mission).length,
        horsZone: markers.filter((m) => m.outOfZone).length,
        silencieux: markers.filter((m) => m.silent).length,
      },
    };
  }

  /** Historique des positions d'un technicien (tracé + distance + zone la plus proche). */
  async history(companyId: string, technicianId: string, from?: string, to?: string) {
    await this.assertLicense(companyId);
    const qb = this.positionRepository
      .createQueryBuilder('p')
      .where('p.company_id = :cid AND p.technician_id = :tid', { cid: companyId, tid: technicianId })
      .orderBy('p.recorded_at', 'DESC')
      .take(500);
    if (from) qb.andWhere('p.recorded_at >= :from', { from: new Date(from) });
    if (to) qb.andWhere('p.recorded_at <= :to', { to: new Date(`${to.slice(0, 10)}T23:59:59Z`) });
    const positions = await qb.getMany();
    const [tech, zones] = await Promise.all([
      this.technicianRepository.findOne({ where: { companyId, id: technicianId } }),
      this.zoneRepository.find({ where: { companyId, active: true } }),
    ]);

    let distanceTotal = 0;
    for (let i = 1; i < positions.length; i++) {
      const a = positions[i - 1];
      const b = positions[i];
      distanceTotal += distanceM(Number(a.latitude), Number(a.longitude), Number(b.latitude), Number(b.longitude));
    }

    const enriched = positions.map((p) => {
      const lat = Number(p.latitude);
      const lon = Number(p.longitude);
      const nearest = findNearestZone(lat, lon, zones);
      return {
        ...p,
        latitude: lat,
        longitude: lon,
        nearestZoneId: nearest?.id ?? null,
        nearestZoneName: nearest?.name ?? null,
        nearestZoneType: nearest?.type ?? null,
        distanceToNearestZoneM: nearest?.distanceM ?? null,
        insideNearestZone: nearest?.inside ?? false,
      };
    });

    return { technician: tech?.fullName ?? 'Technicien', positions: enriched, distanceTotalM: distanceTotal };
  }

  /** Alertes : silencieux en mission + hors zone + batterie faible. */
  async alerts(companyId: string) {
    const { markers } = await this.live(companyId);
    return markers
      .filter((m) => m.silent || m.outOfZone || (m.batteryPct != null && m.batteryPct < 15))
      .map((m) => ({
        technicianId: m.technicianId,
        technicianName: m.technicianName,
        type: m.silent ? 'silence' : m.outOfZone ? 'hors_zone' : 'batterie_faible',
        severity: m.silent || m.outOfZone ? 'critical' : 'warning',
        detail: m.silent
          ? `Aucun point depuis ${m.minutesAgo} min alors qu'une mission est en cours (${m.mission?.clientSite ?? '—'})`
          : m.outOfZone
            ? m.distanceToSiteM != null
              ? `À ${m.distanceToSiteM} m du site de la mission ${m.mission?.clientSite ?? ''} (rayon ${SITE_RADIUS_M} m)`
              : `Hors zone de travail${m.nearestZoneName ? ` (plus proche : ${m.nearestZoneName}, ${m.distanceToNearestZoneM} m)` : ''}`
            : `Batterie ${m.batteryPct}% — risque de perte de suivi`,
        at: m.recordedAt,
      }));
  }

  /** Statut de la licence + chiffres clés (bandeau front, visible sans licence). */
  async status(companyId: string) {
    const sub = await this.subscriptionRepository.findOne({
      where: { companyId, planCode: 'GEOLOCATION', status: 'active' },
    });
    const rows = await this.positionRepository.query(
      'SELECT COUNT(*)::int AS points FROM geopositions WHERE company_id = $1',
      [companyId],
    );
    return {
      licensed: !!sub,
      price: { monthly: 5000, annual: 55000 },
      totalPoints: Number(rows?.[0]?.points ?? 0),
      silenceMinutes: SILENCE_MINUTES,
      siteRadiusM: SITE_RADIUS_M,
    };
  }

  // ------------------- Zones géographiques -------------------
  listZones(companyId: string) {
    return this.zoneRepository.find({ where: { companyId }, order: { name: 'ASC' } });
  }

  async createZone(
    companyId: string,
    dto: { name: string; type: string; centerLatitude: number; centerLongitude: number; radiusM?: number; note?: string },
  ) {
    await this.assertLicense(companyId);
    return this.zoneRepository.save(
      this.zoneRepository.create({
        companyId,
        name: dto.name,
        type: dto.type as GeofenceZone['type'],
        centerLatitude: String(dto.centerLatitude),
        centerLongitude: String(dto.centerLongitude),
        radiusM: dto.radiusM ?? 500,
        note: dto.note ?? null,
      }),
    );
  }

  async updateZone(
    companyId: string,
    id: string,
    dto: { name: string; type: string; centerLatitude: number; centerLongitude: number; radiusM?: number; note?: string },
  ) {
    await this.assertLicense(companyId);
    const zone = await this.zoneRepository.findOne({ where: { companyId, id } });
    if (!zone) throw new NotFoundException('Zone introuvable');
    zone.name = dto.name;
    zone.type = dto.type as GeofenceZone['type'];
    zone.centerLatitude = String(dto.centerLatitude);
    zone.centerLongitude = String(dto.centerLongitude);
    if (dto.radiusM !== undefined) zone.radiusM = dto.radiusM;
    if (dto.note !== undefined) zone.note = dto.note ?? null;
    return this.zoneRepository.save(zone);
  }

  async deleteZone(companyId: string, id: string) {
    const zone = await this.zoneRepository.findOne({ where: { companyId, id } });
    if (!zone) throw new NotFoundException('Zone introuvable');
    await this.zoneRepository.remove(zone);
    return { deleted: true };
  }
}
