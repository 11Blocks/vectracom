import { BadRequestException, Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { IsArray, IsIn, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MissionTemplatesService } from './mission-templates.service';
import { MISSION_TYPES, MissionType } from './entities/mission-type-template.entity';

class UpsertTemplateDto {
  @IsIn(MISSION_TYPES as unknown as string[])
  typeName!: MissionType;

  @IsOptional() @IsString() label?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() steps?: unknown[];
  @IsOptional() @IsArray() requiredPhotos?: unknown[];
  @IsOptional() @IsArray() checklistTemplate?: unknown[];
  @IsOptional() @IsObject() workflow?: Record<string, unknown>;
  @IsOptional() isActive?: boolean;
}

@Controller('mission-templates')
@Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.CHEF_EQUIPE)
export class MissionTemplatesController {
  constructor(private readonly templatesService: MissionTemplatesService) {}

  /** Les 11 templates (défauts + surcharges du tenant marquées personalised). */
  @Get()
  list(@CurrentUser('companyId') companyId: string | null) {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
    return this.templatesService.listForTenant(companyId);
  }

  @Get(':typeName')
  async getOne(
    @CurrentUser('companyId') companyId: string | null,
    @Param('typeName') typeName: string,
  ) {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
    if (!(MISSION_TYPES as readonly string[]).includes(typeName)) {
      throw new BadRequestException(`Type inconnu : ${typeName}`);
    }
    return this.templatesService.getEffective(companyId, typeName as MissionType);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  upsert(
    @CurrentUser('companyId') companyId: string | null,
    @Body() dto: UpsertTemplateDto,
  ) {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
    return this.templatesService.upsert(companyId, dto.typeName, {
      label: dto.label,
      description: dto.description,
      steps: dto.steps as never,
      requiredPhotos: dto.requiredPhotos as never,
      checklistTemplate: dto.checklistTemplate as never,
      workflow: dto.workflow as never,
      isActive: dto.isActive,
    });
  }

  @Delete(':typeName')
  @Roles(UserRole.ADMIN)
  remove(
    @CurrentUser('companyId') companyId: string | null,
    @Param('typeName') typeName: string,
  ) {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
    if (!(MISSION_TYPES as readonly string[]).includes(typeName)) {
      throw new BadRequestException(`Type inconnu : ${typeName}`);
    }
    return this.templatesService.remove(companyId, typeName as MissionType);
  }
}
