import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ComplianceService } from './compliance.service';
import {
  CreateChecklistTemplateDto,
  CreateComplianceRecordDto,
  UpdateChecklistTemplateDto,
  UpdateComplianceRecordDto,
} from './dto/create-checklist-template.dto';
import {
  CreateComplianceDocumentDto,
  UpdateComplianceDocumentDto,
} from './dto/create-compliance-document.dto';
import { COMPLIANCE_STATUSES } from './entities/compliance-record.entity';

class ListRecordsQueryDto {
  @IsOptional() @IsString() teamId?: string;
  @IsOptional() @IsString() @IsIn(COMPLIANCE_STATUSES as unknown as string[]) status?: string;
}

@Controller('compliance')
@Roles(UserRole.ADMIN, UserRole.DIRECTION)
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  // ----- Checklists opérationnelles (paramétrables par type de mission) -----

  @Get('checklists')
  checklists(@CurrentUser('companyId') companyId: string | null) {
    this.requireTenant(companyId);
    return this.complianceService.listChecklists(companyId!);
  }

  @Post('checklists')
  @Roles(UserRole.ADMIN)
  createChecklist(@CurrentUser('companyId') companyId: string | null, @Body() dto: CreateChecklistTemplateDto) {
    this.requireTenant(companyId);
    return this.complianceService.createChecklist(companyId!, dto);
  }

  @Get('checklists/:id')
  checklist(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.complianceService.findChecklist(companyId!, id);
  }

  @Put('checklists/:id')
  @Roles(UserRole.ADMIN)
  updateChecklist(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Body() dto: UpdateChecklistTemplateDto,
  ) {
    this.requireTenant(companyId);
    return this.complianceService.updateChecklist(companyId!, id, dto.items ?? []);
  }

  @Delete('checklists/:id')
  @Roles(UserRole.ADMIN)
  removeChecklist(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.complianceService.removeChecklist(companyId!, id);
  }

  // ----- Records de conformité par équipe -----

  @Get('records')
  records(@CurrentUser('companyId') companyId: string | null, @Query() query: ListRecordsQueryDto) {
    this.requireTenant(companyId);
    return this.complianceService.listRecords(companyId!, { teamId: query.teamId, status: query.status });
  }

  @Post('records')
  @Roles(UserRole.ADMIN)
  createRecord(@CurrentUser('companyId') companyId: string | null, @Body() dto: CreateComplianceRecordDto) {
    this.requireTenant(companyId);
    return this.complianceService.createRecord(companyId!, dto.teamId);
  }

  @Put('records/:id')
  @Roles(UserRole.ADMIN)
  updateRecord(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Body() dto: UpdateComplianceRecordDto,
  ) {
    this.requireTenant(companyId);
    return this.complianceService.updateRecord(companyId!, id, dto);
  }

  // ----- Documents contractuels (Code de Conduite, SST, D3E) -----

  @Get('documents')
  documents(@CurrentUser('companyId') companyId: string | null) {
    this.requireTenant(companyId);
    return this.complianceService.listDocuments(companyId!);
  }

  @Post('documents')
  @Roles(UserRole.ADMIN)
  addDocument(@CurrentUser('companyId') companyId: string | null, @Body() dto: CreateComplianceDocumentDto) {
    this.requireTenant(companyId);
    return this.complianceService.addDocument(companyId!, dto);
  }

  @Put('documents/:id')
  @Roles(UserRole.ADMIN)
  updateDocument(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Body() dto: UpdateComplianceDocumentDto,
  ) {
    this.requireTenant(companyId);
    return this.complianceService.updateDocument(companyId!, id, dto);
  }

  @Delete('documents/:id')
  @Roles(UserRole.ADMIN)
  removeDocument(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.complianceService.removeDocument(companyId!, id);
  }

  @Get('contract-summary')
  contractSummary(@CurrentUser('companyId') companyId: string | null) {
    this.requireTenant(companyId);
    return this.complianceService.contractSummary(companyId!);
  }

  @Get('export-validation-3stb')
  @Roles(UserRole.ADMIN, UserRole.DIRECTION)
  async exportValidation3stb(
    @CurrentUser('companyId') companyId: string | null,
    @Res() res: Response,
  ) {
    this.requireTenant(companyId);
    const buffer = await this.complianceService.exportValidation3stb(companyId!);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="VALIDATION_EQUIPES_3STB.xlsx"');
    res.send(buffer);
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }

  @Put('records/:id/habilitation')
  updateHabilitation(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Body() dto: { habilitationDomains?: string[]; validationStep?: string },
  ) {
    this.requireTenant(companyId);
    return this.complianceService.updateHabilitation(companyId!, id, dto);
  }
}
