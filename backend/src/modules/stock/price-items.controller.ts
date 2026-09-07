import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { IsBooleanString, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PriceItemsService } from './price-items.service';
import { CreatePriceItemDto, UpdatePriceItemDto } from './dto/create-price-item.dto';

class ListPriceItemsQueryDto {
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() version?: string;
  @IsOptional() @IsString() priceGrid?: string;
  @IsOptional() @IsBooleanString() isActive?: string;
}

class SearchQueryDto {
  @IsString()
  q!: string;

  @IsOptional() @IsString() version?: string;
}

class ItemNumberParamDto {
  @Type(() => Number) @IsInt() @Min(1) itemNumber!: number;
}

@Controller('price-items')
@Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.CHEF_EQUIPE, UserRole.MAGASINIER)
export class PriceItemsController {
  constructor(private readonly priceItemsService: PriceItemsService) {}

  @Get()
  list(@CurrentUser('companyId') companyId: string | null, @Query() query: ListPriceItemsQueryDto) {
    this.requireTenant(companyId);
    return this.priceItemsService.list(companyId!, {
      category: query.category,
      version: query.version,
      priceGrid: query.priceGrid,
      isActive: query.isActive === undefined ? undefined : query.isActive === 'true',
    });
  }

  @Get('search')
  search(@CurrentUser('companyId') companyId: string | null, @Query() query: SearchQueryDto) {
    this.requireTenant(companyId);
    return this.priceItemsService.search(companyId!, query.q, query.version ?? '2025');
  }

  @Get('categories')
  categories(@CurrentUser('companyId') companyId: string | null) {
    this.requireTenant(companyId);
    return this.priceItemsService.categories(companyId!);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@CurrentUser('companyId') companyId: string | null, @Body() dto: CreatePriceItemDto) {
    this.requireTenant(companyId);
    return this.priceItemsService.create(companyId!, dto);
  }

  @Get(':itemNumber')
  findOne(
    @CurrentUser('companyId') companyId: string | null,
    @Param() param: ItemNumberParamDto,
    @Query('version') version?: string,
  ) {
    this.requireTenant(companyId);
    return this.priceItemsService.findByItemNumber(companyId!, param.itemNumber, version ?? '2025');
  }

  @Put(':itemNumber')
  @Roles(UserRole.ADMIN)
  update(
    @CurrentUser('companyId') companyId: string | null,
    @Param() param: ItemNumberParamDto,
    @Body() dto: UpdatePriceItemDto,
    @Query('version') version?: string,
  ) {
    this.requireTenant(companyId);
    return this.priceItemsService.update(companyId!, param.itemNumber, dto, version ?? '2025');
  }

  @Delete(':itemNumber')
  @Roles(UserRole.ADMIN)
  remove(
    @CurrentUser('companyId') companyId: string | null,
    @Param() param: ItemNumberParamDto,
    @Query('version') version?: string,
  ) {
    this.requireTenant(companyId);
    return this.priceItemsService.remove(companyId!, param.itemNumber, version ?? '2025');
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}
