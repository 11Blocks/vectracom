import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { IsArray, IsInt, IsObject, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DispositifService } from './dispositif.service';

class UpsertEntryDto {
  @IsString() day!: string;

  @IsString() zoneName!: string;

  @IsString() teamName!: string;

  @IsOptional() @IsString() axis?: string;

  @IsOptional() @IsUUID() teamId?: string;

  @IsOptional() @IsString() pilot?: string;

  @IsOptional() @IsInt() @Min(1) instances?: number;
}

class ApplyAssignmentDto {
  @IsArray()
  @IsObject({ each: true })
  assignments!: Array<{ missionId: string; teamId: string }>;
}

@Controller('dispositif')
@Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.CHEF_EQUIPE)
export class DispositifController {
  constructor(private readonly dispositif: DispositifService) {}

  /** Grille du jour : zones × équipes × axes. */
  @Get()
  grid(@CurrentUser('companyId') companyId: string | null, @Query('day') day?: string) {
    this.requireTenant(companyId);
    return this.dispositif.grid(companyId!, day);
  }

  @Post('entries')
  upsert(
    @CurrentUser('companyId') companyId: string | null,
    @Body() dto: UpsertEntryDto,
  ) {
    this.requireTenant(companyId);
    return this.dispositif.upsertEntry(companyId!, dto);
  }

  @Delete('entries/:id')
  remove(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.dispositif.removeEntry(companyId!, id);
  }

  /**
   * Répartition automatique équilibrée — PROPOSITION uniquement
   * (l'IA propose, l'humain valide ; jamais d'application automatique).
   */
  @Post('propose-assignment')
  propose(
    @CurrentUser('companyId') companyId: string | null,
    @Query('day') day?: string,
    @Body() body?: { typeFilter?: string[] },
  ) {
    this.requireTenant(companyId);
    return this.dispositif.proposeAssignment(companyId!, day, body);
  }

  /** Application des propositions cochées par l'humain. */
  @Post('apply-assignment')
  apply(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Body() dto: ApplyAssignmentDto,
  ) {
    this.requireTenant(companyId);
    return this.dispositif.applyAssignment(companyId!, dto.assignments, userId);
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}
