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
import { IsIn, IsOptional, IsString } from 'class-validator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { InvoicesService } from './invoices.service';
import { GenerateInvoiceDto } from './dto/generate-invoice.dto';
import { CorrectInvoiceDto } from './dto/correct-invoice.dto';
import { FinalizeInvoiceDto } from './dto/finalize-invoice.dto';
import { INVOICE_STATUSES } from './entities/invoice.entity';

class ListInvoicesQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(INVOICE_STATUSES as unknown as string[])
  status?: string;

  @IsOptional()
  @IsString()
  periodStart?: string;
}

@Controller('invoices')
@Roles(UserRole.ADMIN, UserRole.DIRECTION)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  list(@CurrentUser('companyId') companyId: string | null, @Query() query: ListInvoicesQueryDto) {
    this.requireTenant(companyId);
    return this.invoicesService.list(companyId!, {
      status: query.status,
      periodStart: query.periodStart,
    });
  }

  /** Génération à partir des missions clôturées de la période. */
  @Post('generate')
  @Roles(UserRole.ADMIN)
  generate(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Body() dto: GenerateInvoiceDto,
  ) {
    this.requireTenant(companyId);
    return this.invoicesService.generate(companyId!, dto, userId);
  }

  @Get(':id')
  findOne(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.invoicesService.findOne(companyId!, id);
  }

  @Get(':id/preview')
  preview(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.invoicesService.preview(companyId!, id);
  }

  @Put(':id/correct')
  @Roles(UserRole.ADMIN, UserRole.DIRECTION)
  correct(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: CorrectInvoiceDto,
  ) {
    this.requireTenant(companyId);
    return this.invoicesService.correct(companyId!, id, dto, userId);
  }

  @Post(':id/finalize')
  @Roles(UserRole.ADMIN, UserRole.DIRECTION)
  finalize(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: FinalizeInvoiceDto,
  ) {
    this.requireTenant(companyId);
    return this.invoicesService.finalize(companyId!, id, dto.notes, userId);
  }

  @Post(':id/export-pdf')
  @HttpCode(200)
  async exportPdf(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    this.requireTenant(companyId);
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
    this.requireTenant(companyId);
    const { buffer, fileName } = await this.invoicesService.exportExcel(companyId!, id);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.invoicesService.remove(companyId!, id);
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}
