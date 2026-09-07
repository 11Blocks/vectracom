import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import {
  IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, Min, MinLength,
} from 'class-validator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GeolocationService } from './geolocation.service';
import { GEOFENCE_TYPES } from './entities/geofence-zone.entity';
import { GEOPosition_SOURCES } from './entities/geoposition.entity';

class RecordPositionDto {
  @IsUUID()
  technicianId!: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @IsString()
  recordedAt?: string;

  @IsOptional()
  @IsInt()
  accuracyM?: number;

  @IsOptional()
  @IsNumber()
  speedKmh?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  batteryPct?: number;

  @IsOptional()
  @IsUUID()
  missionId?: string;

  @IsOptional()
  @IsIn(GEOPosition_SOURCES as unknown as string[])
  source?: string;
}

/** Pointage mobile : technicianId résolu côté serveur depuis l'utilisateur JWT. */
class RecordMyPositionDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @IsString()
  recordedAt?: string;

  @IsOptional()
  @IsInt()
  accuracyM?: number;

  @IsOptional()
  @IsNumber()
  speedKmh?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  batteryPct?: number;

  @IsOptional()
  @IsUUID()
  missionId?: string;

  @IsOptional()
  @IsIn(GEOPosition_SOURCES as unknown as string[])
  source?: string;
}

class CreateZoneDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsIn(GEOFENCE_TYPES as unknown as string[])
  type!: string;

  @IsNumber()
  centerLatitude!: number;

  @IsNumber()
  centerLongitude!: number;

  @IsOptional()
  @IsInt()
  @Min(50)
  radiusM?: number;

  @IsOptional()
  @IsString()
  note?: string;
}

@Controller('geolocation')
@Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.CHEF_EQUIPE)
export class GeolocationController {
  constructor(private readonly geoService: GeolocationService) {}

  /** Statut de la licence + chiffres clés — accessible même sans licence active. */
  @Get('status')
  status(@CurrentUser('companyId') companyId: string | null) {
    this.requireTenant(companyId);
    return this.geoService.status(companyId!);
  }

  @Get('live')
  live(@CurrentUser('companyId') companyId: string | null) {
    this.requireTenant(companyId);
    return this.geoService.live(companyId!);
  }

  @Get('alerts')
  alerts(@CurrentUser('companyId') companyId: string | null) {
    this.requireTenant(companyId);
    return this.geoService.alerts(companyId!);
  }

  @Get('history')
  history(
    @CurrentUser('companyId') companyId: string | null,
    @Query('technicianId') technicianId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    this.requireTenant(companyId);
    if (!technicianId) throw new BadRequestException('technicianId requis');
    return this.geoService.history(companyId!, technicianId, from, to);
  }

  @Post('positions')
  record(
    @CurrentUser('companyId') companyId: string | null,
    @Body() dto: RecordPositionDto,
  ) {
    this.requireTenant(companyId);
    return this.geoService.record(companyId!, dto);
  }

  /** Mobile terrain : résout le technicien lié au JWT puis enregistre le point. */
  @Post('positions/me')
  recordMe(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @CurrentUser('fullName') fullName: string | undefined,
    @Body() dto: RecordMyPositionDto,
  ) {
    this.requireTenant(companyId);
    return this.geoService.recordForUser(companyId!, userId, fullName, dto);
  }

  @Get('zones')
  zones(@CurrentUser('companyId') companyId: string | null) {
    this.requireTenant(companyId);
    return this.geoService.listZones(companyId!);
  }

  @Post('zones')
  createZone(
    @CurrentUser('companyId') companyId: string | null,
    @Body() dto: CreateZoneDto,
  ) {
    this.requireTenant(companyId);
    return this.geoService.createZone(companyId!, dto);
  }

  @Put('zones/:id')
  updateZone(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Body() dto: CreateZoneDto,
  ) {
    this.requireTenant(companyId);
    return this.geoService.updateZone(companyId!, id, dto);
  }

  @Delete('zones/:id')
  deleteZone(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.geoService.deleteZone(companyId!, id);
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}
