import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RemonteeBridgeService } from './remontee-bridge.service';

class RemonteeIngestBody {
  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  companySlug?: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsString()
  senderName?: string;

  @IsOptional()
  @IsString()
  senderPhone?: string;

  @IsOptional()
  @IsString()
  groupName?: string;

  @IsOptional()
  @IsBoolean()
  runVision?: boolean;
}

class RemonteeSimulateBody {
  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  photoUrl?: string;

  @IsOptional()
  @IsString()
  senderName?: string;

  @IsOptional()
  @IsBoolean()
  runVision?: boolean;
}

/**
 * Pont Remontée WhatsApp.
 * - Public + secret : POST /remontee/ingest (header X-Remontee-Secret)
 * - Admin JWT : POST /remontee/simulate (test sans WhatsApp)
 */
@Controller('remontee')
export class RemonteeController {
  constructor(private readonly bridge: RemonteeBridgeService) {}

  @Public()
  @Get('status')
  status() {
    return this.bridge.status();
  }

  @Public()
  @Post('ingest')
  ingest(
    @Headers('x-remontee-secret') secret: string | undefined,
    @Body() body: RemonteeIngestBody,
  ) {
    this.bridge.assertSecret(secret);
    return this.bridge.ingest(body);
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTION)
  @Post('simulate')
  simulate(
    @CurrentUser('companyId') companyId: string | null,
    @Body() body: RemonteeSimulateBody,
  ) {
    return this.bridge.ingest({
      companyId: companyId || undefined,
      text: body.text,
      photoUrl: body.photoUrl,
      senderName: body.senderName || 'Simulation admin',
      groupName: 'Remontée',
      runVision: body.runVision,
    });
  }
}
