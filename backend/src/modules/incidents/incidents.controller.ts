import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { IsISO8601, IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PageQueryDto, withTotal } from '../../common/pagination';
import { IncidentsService } from './incidents.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { AssignIncidentDto } from './dto/assign-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { UpdateIncidentStatusDto } from './dto/update-incident-status.dto';
import { ResolveIncidentDto } from './dto/resolve-incident.dto';
import {
  INCIDENT_RUBRIQUES,
  INCIDENT_SEVERITIES,
  INCIDENT_SOURCES,
  INCIDENT_STATUSES,
} from './entities/incident.entity';

class ListIncidentsQueryDto extends PageQueryDto {
  @IsOptional() @IsString() @IsIn(INCIDENT_RUBRIQUES as unknown as string[]) rubrique?: string;
  @IsOptional() @IsString() @IsIn(INCIDENT_STATUSES as unknown as string[]) status?: string;
  @IsOptional() @IsString() @IsIn(INCIDENT_SEVERITIES as unknown as string[]) severity?: string;
  @IsOptional() @IsString() zone?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() to?: string;
}

class ReopenIncidentDto {
  @IsString() @MinLength(3) reason!: string;
}

class GenerateSavDto {
  @IsIn(['groupee', 'individuelle'])
  mode!: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsISO8601()
  dateMission?: string;
}

@Controller('incidents')
@Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.CHEF_EQUIPE)
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  async list(
    @CurrentUser('companyId') companyId: string | null,
    @Query() query: ListIncidentsQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.requireTenant(companyId);
    return withTotal(res, await this.incidentsService.list(companyId!, query));
  }

  /** Signalement terrain (chef d'équipe) ou remontée WhatsApp. */
  @Post()
  create(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateIncidentDto,
  ) {
    this.requireTenant(companyId);
    return this.incidentsService.create(companyId!, dto, userId);
  }

  /** Compteurs globaux (cartes de la liste) : statut, sévérité, rubrique. */
  @Get('stats')
  stats(@CurrentUser('companyId') companyId: string | null) {
    this.requireTenant(companyId);
    return this.incidentsService.stats(companyId!);
  }

  @Get(':id')
  findOne(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.incidentsService.findOne(companyId!, id);
  }

  /** Génération de missions SAV pour les ND impactés — validation humaine explicite. */
  @Post(':id/generate-sav')
  generateSav(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Body() dto: GenerateSavDto,
  ) {
    this.requireTenant(companyId);
    return this.incidentsService.generateSavMissions(companyId!, id, {
      mode: dto.mode as 'groupee' | 'individuelle',
      teamId: dto.teamId,
      dateMission: dto.dateMission,
    });
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.CHEF_EQUIPE)
  update(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Body() dto: UpdateIncidentDto,
  ) {
    this.requireTenant(companyId);
    return this.incidentsService.update(companyId!, id, dto);
  }

  @Post(':id/reopen')
  @HttpCode(200)
  @Roles(UserRole.ADMIN, UserRole.DIRECTION)
  reopen(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Body() dto: ReopenIncidentDto,
  ) {
    this.requireTenant(companyId);
    return this.incidentsService.reopen(companyId!, id, dto.reason.trim());
  }

  @Put(':id/assign')
  @Roles(UserRole.ADMIN)
  assign(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Body() dto: AssignIncidentDto,
  ) {
    this.requireTenant(companyId);
    return this.incidentsService.assignTeam(companyId!, id, dto);
  }

  @Put(':id/status')
  @Roles(UserRole.ADMIN, UserRole.DIRECTION)
  updateStatus(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Body() dto: UpdateIncidentStatusDto,
  ) {
    this.requireTenant(companyId);
    return this.incidentsService.updateStatus(companyId!, id, dto);
  }

  @Put(':id/resolve')
  @Roles(UserRole.ADMIN, UserRole.CHEF_EQUIPE)
  resolve(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: ResolveIncidentDto,
  ) {
    this.requireTenant(companyId);
    return this.incidentsService.resolve(companyId!, id, { ...dto, resolvedBy: dto.resolvedBy ?? userId });
  }

  @Post(':id/report')
  @HttpCode(200)
  async report(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    this.requireTenant(companyId);
    const { buffer, fileName } = await this.incidentsService.generateReport(companyId!, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.send(buffer);
  }

  @Put(':id/close')
  @Roles(UserRole.ADMIN, UserRole.DIRECTION)
  close(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.incidentsService.close(companyId!, id);
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}
