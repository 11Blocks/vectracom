import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SiteChecklistService } from './site-checklist.service';
import {
  CreateSiteChecklistTemplateDto,
  UpdateSiteChecklistTemplateDto,
} from './dto/create-site-checklist-template.dto';
import { SaveSiteChecklistDto } from './dto/save-site-checklist.dto';
import { SITE_SHEET_TYPES, SiteSheetType } from './entities/site-checklist-template.entity';

@Controller('site-checklists')
@Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.CHEF_EQUIPE)
export class SiteChecklistController {
  constructor(private readonly siteChecklistService: SiteChecklistService) {}

  @Get('templates')
  templates(@CurrentUser('companyId') companyId: string | null) {
    this.requireTenant(companyId);
    return this.siteChecklistService.listTemplates(companyId!);
  }

  @Post('templates')
  @Roles(UserRole.ADMIN)
  createTemplate(
    @CurrentUser('companyId') companyId: string | null,
    @Body() dto: CreateSiteChecklistTemplateDto,
  ) {
    this.requireTenant(companyId);
    return this.siteChecklistService.createTemplate(companyId!, dto);
  }

  @Get('templates/:templateType')
  template(
    @CurrentUser('companyId') companyId: string | null,
    @Param('templateType') templateType: string,
  ) {
    this.requireTenant(companyId);
    this.assertType(templateType);
    return this.siteChecklistService.findTemplate(companyId!, templateType as SiteSheetType);
  }

  @Put('templates/:templateType')
  @Roles(UserRole.ADMIN)
  updateTemplate(
    @CurrentUser('companyId') companyId: string | null,
    @Param('templateType') templateType: string,
    @Body() dto: UpdateSiteChecklistTemplateDto,
  ) {
    this.requireTenant(companyId);
    this.assertType(templateType);
    return this.siteChecklistService.updateTemplate(companyId!, templateType as SiteSheetType, dto);
  }

  @Delete('templates/:templateType')
  @Roles(UserRole.ADMIN)
  removeTemplate(
    @CurrentUser('companyId') companyId: string | null,
    @Param('templateType') templateType: string,
  ) {
    this.requireTenant(companyId);
    this.assertType(templateType);
    return this.siteChecklistService.removeTemplate(companyId!, templateType as SiteSheetType);
  }

  /** Fiche de chantier d'une mission : template applicable + données saisies. */
  @Get(':missionId')
  forMission(@CurrentUser('companyId') companyId: string | null, @Param('missionId') missionId: string) {
    this.requireTenant(companyId);
    return this.siteChecklistService.getForMission(companyId!, missionId);
  }

  @Post(':missionId')
  @Roles(UserRole.ADMIN, UserRole.CHEF_EQUIPE)
  saveForMission(
    @CurrentUser('companyId') companyId: string | null,
    @Param('missionId') missionId: string,
    @Body() dto: SaveSiteChecklistDto,
  ) {
    this.requireTenant(companyId);
    return this.siteChecklistService.saveForMission(companyId!, missionId, dto);
  }

  private assertType(templateType: string): void {
    if (!(SITE_SHEET_TYPES as readonly string[]).includes(templateType)) {
      throw new BadRequestException(`Type de fiche inconnu : ${templateType}`);
    }
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}
