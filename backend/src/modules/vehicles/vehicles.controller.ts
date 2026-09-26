import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { VehiclesService, Badge } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { CreateVehicleCheckDto } from './dto/create-vehicle-check.dto';
import { CreateVehicleDocumentDto } from './dto/create-vehicle-document.dto';
import { CreateVehicleEventDto, UpdateVehicleEventDto } from './dto/create-vehicle-event.dto';
import { VEHICLE_EVENT_TYPES } from './entities/vehicle-event.entity';
import { VEHICLE_STATUSES } from './entities/vehicle.entity';

class ListVehiclesQueryDto {
  @IsOptional() @IsString() teamId?: string;
  @IsOptional() @IsString() @IsIn(VEHICLE_STATUSES as unknown as string[]) status?: string;
  @IsOptional() @IsString() @IsIn(['rouge', 'orange', 'vert']) echeance?: string;
}

@Controller('vehicles')
@Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.CHEF_EQUIPE, UserRole.MAGASINIER)
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  list(@CurrentUser('companyId') companyId: string | null, @Query() query: ListVehiclesQueryDto) {
    this.requireTenant(companyId);
    return this.vehiclesService.list(companyId!, {
      teamId: query.teamId,
      status: query.status,
      echeance: query.echeance as Badge | undefined,
    });
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@CurrentUser('companyId') companyId: string | null, @Body() dto: CreateVehicleDto) {
    this.requireTenant(companyId);
    return this.vehiclesService.create(companyId!, dto);
  }


  // ─────────────────────────────────────────────
  //  Événements : pannes / réparations / pièces / carburant
  // ─────────────────────────────────────────────
  @Get('costs/fleet')
  fleetCosts(@CurrentUser('companyId') companyId: string | null) {
    this.requireTenant(companyId);
    return this.vehiclesService.fleetCosts(companyId!);
  }

  @Get(':id/events')
  listEvents(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Query('type') type?: string,
  ) {
    this.requireTenant(companyId);
    return this.vehiclesService.listEvents(companyId!, id, type);
  }

  @Post(':id/events')
  @Roles(UserRole.ADMIN, UserRole.CHEF_EQUIPE, UserRole.MAGASINIER)
  createEvent(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Body() dto: CreateVehicleEventDto,
  ) {
    this.requireTenant(companyId);
    return this.vehiclesService.createEvent(companyId!, id, dto);
  }

  @Put(':id/events/:eventId')
  @Roles(UserRole.ADMIN, UserRole.CHEF_EQUIPE, UserRole.MAGASINIER)
  updateEvent(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @Body() dto: UpdateVehicleEventDto,
  ) {
    this.requireTenant(companyId);
    return this.vehiclesService.updateEventStatus(companyId!, id, eventId, dto);
  }

  @Get(':id/costs')
  vehicleCosts(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.vehiclesService.vehicleCosts(companyId!, id);
  }

  @Get(':id')
  detail(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.vehiclesService.detail(companyId!, id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  update(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    this.requireTenant(companyId);
    return this.vehiclesService.update(companyId!, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.vehiclesService.remove(companyId!, id);
  }

  @Get(':id/checks')
  checks(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.vehiclesService.listChecks(companyId!, id);
  }

  /** Checklist 15 secondes — le geste quotidien du chef d'équipe. */
  @Post(':id/checks')
  @Roles(UserRole.ADMIN, UserRole.CHEF_EQUIPE)
  createCheck(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Body() dto: CreateVehicleCheckDto,
  ) {
    this.requireTenant(companyId);
    return this.vehiclesService.createCheck(companyId!, id, dto);
  }

  @Get(':id/documents')
  documents(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.vehiclesService.listDocuments(companyId!, id);
  }

  @Post(':id/documents')
  @Roles(UserRole.ADMIN, UserRole.MAGASINIER)
  addDocument(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Body() dto: CreateVehicleDocumentDto,
  ) {
    this.requireTenant(companyId);
    return this.vehiclesService.addDocument(companyId!, id, dto);
  }

  @Delete(':id/documents/:docId')
  @Roles(UserRole.ADMIN, UserRole.MAGASINIER)
  removeDocument(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Param('docId') docId: string,
  ) {
    this.requireTenant(companyId);
    return this.vehiclesService.removeDocument(companyId!, id, docId);
  }

  /** Badges d'échéance calculés (rouge ≤ 7 j, orange ≤ 30 j, vert sinon). */
  @Get(':id/expiry-badges')
  expiryBadges(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.vehiclesService.detail(companyId!, id).then((v) => v.badges);
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}
