import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PageQueryDto, withTotal } from '../../common/pagination';
import { InvoicesService } from './invoices.service';
import { GenerateInvoiceDto } from './dto/generate-invoice.dto';
import { CorrectInvoiceDto } from './dto/correct-invoice.dto';
import { FinalizeInvoiceDto } from './dto/finalize-invoice.dto';
import {
  AddPaymentDto,
  CancelInvoiceDto,
  ClientDto,
  CreateManualInvoiceDto,
  UpdateClientDto,
  UpdateInvoiceHeaderDto,
} from './dto/invoice-lifecycle.dto';
import { INVOICE_KINDS, INVOICE_STATUSES } from './entities/invoice.entity';

class ListInvoicesQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  overdue?: string;

  @IsOptional()
  @IsString()
  @IsIn(INVOICE_STATUSES as unknown as string[])
  status?: string;

  @IsOptional()
  @IsIn(INVOICE_KINDS as unknown as string[])
  kind?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsString()
  periodStart?: string;
}

function requireTenant(companyId: string | null): void {
  if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
}

@Controller('invoices')
@Roles(UserRole.ADMIN, UserRole.DIRECTION)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  async list(
    @CurrentUser('companyId') companyId: string | null,
    @Query() query: ListInvoicesQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    requireTenant(companyId);
    return withTotal(res, await this.invoicesService.list(companyId!, query));
  }

  @Get('summary')
  summary(@CurrentUser('companyId') companyId: string | null, @Query('clientId') clientId?: string) {
    requireTenant(companyId);
    return this.invoicesService.summary(companyId!, clientId || undefined);
  }

  /** Génération à partir des missions validées non facturées de la période. */
  @Post('generate')
  @Roles(UserRole.ADMIN)
  generate(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Body() dto: GenerateInvoiceDto,
  ) {
    requireTenant(companyId);
    return this.invoicesService.generate(companyId!, dto, userId);
  }

  /** Facture manuelle à lignes libres. */
  @Post('manual')
  @Roles(UserRole.ADMIN)
  createManual(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateManualInvoiceDto,
  ) {
    requireTenant(companyId);
    return this.invoicesService.createManual(companyId!, dto, userId);
  }

  @Get(':id')
  findOne(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    requireTenant(companyId);
    return this.invoicesService.findOne(companyId!, id);
  }

  @Get(':id/preview')
  preview(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    requireTenant(companyId);
    return this.invoicesService.preview(companyId!, id);
  }

  @Get(':id/missions')
  missions(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    requireTenant(companyId);
    return this.invoicesService.missions(companyId!, id);
  }

  @Put(':id/correct')
  @Roles(UserRole.ADMIN)
  correct(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: CorrectInvoiceDto,
  ) {
    requireTenant(companyId);
    return this.invoicesService.correct(companyId!, id, dto, userId);
  }

  /** Entête du brouillon : client, objet, dates, période, remise, taux TVA, notes. */
  @Put(':id/header')
  @Roles(UserRole.ADMIN)
  updateHeader(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceHeaderDto,
  ) {
    requireTenant(companyId);
    return this.invoicesService.updateHeader(companyId!, id, dto, userId);
  }

  @Post(':id/finalize')
  @Roles(UserRole.ADMIN)
  finalize(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: FinalizeInvoiceDto,
  ) {
    requireTenant(companyId);
    return this.invoicesService.finalize(companyId!, id, dto.notes, userId);
  }

  @Post(':id/send')
  @HttpCode(200)
  @Roles(UserRole.ADMIN)
  send(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    requireTenant(companyId);
    return this.invoicesService.markSent(companyId!, id, userId);
  }

  @Post(':id/payments')
  @Roles(UserRole.ADMIN)
  addPayment(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: AddPaymentDto,
  ) {
    requireTenant(companyId);
    return this.invoicesService.addPayment(companyId!, id, dto, userId);
  }

  @Delete(':id/payments/:paymentId')
  @Roles(UserRole.ADMIN)
  removePayment(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Param('paymentId') paymentId: string,
  ) {
    requireTenant(companyId);
    return this.invoicesService.removePayment(companyId!, id, paymentId, userId);
  }

  /** Annulation d'une facture émise par avoir total. */
  @Post(':id/cancel')
  @HttpCode(200)
  @Roles(UserRole.ADMIN)
  cancel(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: CancelInvoiceDto,
  ) {
    requireTenant(companyId);
    return this.invoicesService.cancelWithCreditNote(companyId!, id, dto.reason.trim(), userId);
  }

  @Post(':id/export-pdf')
  @HttpCode(200)
  async exportPdf(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    requireTenant(companyId);
    const { buffer, fileName } = await this.invoicesService.exportPdf(companyId!, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.send(buffer);
  }

  @Post(':id/export-excel')
  @HttpCode(200)
  async exportExcel(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    requireTenant(companyId);
    const { buffer, fileName } = await this.invoicesService.exportExcel(companyId!, id);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    requireTenant(companyId);
    return this.invoicesService.remove(companyId!, id, userId);
  }
}

@Controller('clients')
@Roles(UserRole.ADMIN, UserRole.DIRECTION)
export class ClientsController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  list(@CurrentUser('companyId') companyId: string | null) {
    requireTenant(companyId);
    return this.invoicesService.listClients(companyId!);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Body() dto: ClientDto,
  ) {
    requireTenant(companyId);
    return this.invoicesService.createClient(companyId!, dto, userId);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  update(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ) {
    requireTenant(companyId);
    return this.invoicesService.updateClient(companyId!, id, dto as never, userId);
  }
}
