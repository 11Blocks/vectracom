import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MissionsService } from './missions.service';
import { FieldReportService } from './field-report.service';
import { PvRecetteService } from './pv-recette.service';
import { CreateMissionDto } from './dto/create-mission.dto';
import { BulkMissionStatusDto, UpdateMissionStatusDto } from './dto/update-mission-status.dto';
import { ReassignMissionDto } from './dto/reassign-mission.dto';
import { UpdateMissionDetailsDto } from './dto/update-mission-details.dto';
import { ValidateMissionDto } from './dto/validate-mission.dto';
import { SonatelApproveDto } from './dto/sonatel-approve.dto';
import { Step1SstDto } from './dto/field-report-step1-sst.dto';
import { Step2IdentificationDto } from './dto/field-report-step2-identification.dto';
import { Step3TechniqueDto } from './dto/field-report-step3-technique.dto';
import { Step4PhotosDto } from './dto/field-report-step4-photos.dto';
import { Step5MaterielDto } from './dto/field-report-step5-materiel.dto';
import { Step5EchangeSavDto } from './dto/field-report-step5-echange-sav.dto';
import { Step6ClotureDto } from './dto/field-report-step6-cloture.dto';
import { FieldReportDataDto } from './dto/field-report-data.dto';
import { MISSION_STATUSES } from './entities/mission.entity';

class StepBodyDto {
  // Chaque clé porte un décorateur de validation : sans lui, le whitelist
  // du ValidationPipe rejette la propriété (« should not exist »).
  @IsOptional() @ValidateNested() @Type(() => Step1SstDto)
  step1?: Step1SstDto;

  @IsOptional() @ValidateNested() @Type(() => Step2IdentificationDto)
  step2?: Step2IdentificationDto;

  @IsOptional() @ValidateNested() @Type(() => Step3TechniqueDto)
  step3?: Step3TechniqueDto;

  @IsOptional() @ValidateNested() @Type(() => Step4PhotosDto)
  step4?: Step4PhotosDto;

  @IsOptional() @ValidateNested() @Type(() => Step5MaterielDto)
  step5?: Step5MaterielDto & Step5EchangeSavDto;

  @IsOptional() @ValidateNested() @Type(() => Step6ClotureDto)
  step6?: Step6ClotureDto;

  @IsOptional() @ValidateNested() @Type(() => FieldReportDataDto)
  data?: FieldReportDataDto;
}

class ListMissionsQueryDto {
  @IsOptional() @IsString() teamId?: string;
  @IsOptional() @IsString() technicianId?: string;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
  @IsOptional() @IsString() @IsIn(MISSION_STATUSES as unknown as string[]) status?: string;
  @IsOptional() @IsString() typeTache?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsIn(['true', 'false']) invoiced?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5000) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
}

@Controller('missions')
@Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.CHEF_EQUIPE, UserRole.MAGASINIER)
export class MissionsController {
  constructor(
    private readonly missionsService: MissionsService,
    private readonly fieldReportService: FieldReportService,
    private readonly pvRecetteService: PvRecetteService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.CHEF_EQUIPE)
  create(
    @CurrentUser('companyId') companyId: string | null,
    @Body() dto: CreateMissionDto,
  ) {
    this.requireTenant(companyId);
    return this.missionsService.create(companyId!, dto);
  }

  @Get()
  list(
    @CurrentUser('companyId') companyId: string | null,
    @Query() query: ListMissionsQueryDto,
  ) {
    this.requireTenant(companyId);
    return this.missionsService.list(companyId!, query);
  }

  @Get(':id')
  findOne(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.missionsService.findOne(companyId!, id);
  }

  /** Réaffectation : équipe, binôme, véhicule, créneau (règles anti double affectation). */
  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.CHEF_EQUIPE)
  reassign(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Body() dto: ReassignMissionDto,
  ) {
    this.requireTenant(companyId);
    return this.missionsService.reassign(companyId!, id, dto);
  }

  /** Édition métadonnées / champs SONATEL (client, zone, coper, VA CAP…). */
  @Put(':id/details')
  @Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.CHEF_EQUIPE)
  updateDetails(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Body() dto: UpdateMissionDetailsDto,
  ) {
    this.requireTenant(companyId);
    return this.missionsService.updateDetails(companyId!, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@CurrentUser('companyId') companyId: string | null, @CurrentUser('id') userId: string, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.missionsService.remove(companyId!, id, userId);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.CHEF_EQUIPE)
  setStatus(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('role') role: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMissionStatusDto,
  ) {
    this.requireTenant(companyId);
    return this.missionsService.setStatus(companyId!, id, dto, role, userId);
  }

  /** Validation / rejet / annulation en masse (refus renvoyés mission par mission). */
  @Post('bulk-status')
  @HttpCode(200)
  @Roles(UserRole.ADMIN, UserRole.DIRECTION)
  bulkStatus(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('role') role: string,
    @CurrentUser('id') userId: string,
    @Body() dto: BulkMissionStatusDto,
  ) {
    this.requireTenant(companyId);
    if (dto.status !== 'validee' && !dto.reason) throw new BadRequestException('Motif obligatoire pour un rejet ou une annulation');
    return this.missionsService.bulkStatus(companyId!, dto.ids, (id) =>
      dto.status === 'annulee'
        ? this.missionsService.setStatus(companyId!, id, { status: 'annulee', rejectionReason: dto.reason }, role, userId)
        : this.fieldReportService.validateInternal(companyId!, id, dto.status as 'validee' | 'rejetee', dto.reason, userId),
    );
  }

  @Post(':id/field-report/step/:stepId')
  @HttpCode(200)
  @Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.CHEF_EQUIPE)
  saveStep(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Param('stepId') stepId: string,
    @Body() body: StepBodyDto,
  ) {
    this.requireTenant(companyId);
    const map: Record<string, unknown> = {
      '1': body.step1,
      '2': body.step2,
      '3': body.step3,
      '4': body.step4,
      '5': body.step5,
      '6': body.step6,
      data: body.data,
    };
    const dto = map[stepId];
    if (!dto) {
      throw new BadRequestException(`Corps de l'étape ${stepId} manquant (clé step${stepId} ou data)`);
    }
    return this.fieldReportService.saveStep(companyId!, id, stepId, dto);
  }

  @Post(':id/field-report/validate')
  @HttpCode(200)
  @Roles(UserRole.ADMIN, UserRole.DIRECTION)
  validate(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: ValidateMissionDto,
  ) {
    this.requireTenant(companyId);
    return this.fieldReportService.validateInternal(companyId!, id, dto.internalValidationStatus, dto.rejectionReason, userId);
  }

  @Post(':id/field-report/sonatel-approve')
  @HttpCode(200)
  @Roles(UserRole.ADMIN, UserRole.DIRECTION)
  sonatelApprove(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Body() dto: SonatelApproveDto,
  ) {
    this.requireTenant(companyId);
    return this.fieldReportService.sonatelApprove(companyId!, id, dto.sonatelApprovalStatus);
  }

  @Get(':id/pv-recette')
  @Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.CHEF_EQUIPE)
  async pvRecette(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    this.requireTenant(companyId);
    const { buffer, fileName } = await this.pvRecetteService.generate(companyId!, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.send(buffer);
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}
