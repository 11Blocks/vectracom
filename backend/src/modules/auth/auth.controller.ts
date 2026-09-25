import { Body, Controller, ForbiddenException, Get, HttpCode, Ip, Patch, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { AccountRoute } from '../../common/decorators/account-route.decorator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.authService.login(dto, ip);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Post('register')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Get('me')
  @AccountRoute()
  me(@CurrentUser('id') userId: string) {
    return this.authService.me(userId);
  }

  @Patch('me')
  @AccountRoute()
  updateProfile(@CurrentUser() user: JwtPayloadUser, @Body() dto: UpdateProfileDto) {
    this.denyInSupportSession(user);
    return this.authService.updateProfile(user.id, dto);
  }

  @Post('change-password')
  @AccountRoute()
  @HttpCode(200)
  changePassword(@CurrentUser() user: JwtPayloadUser, @Body() dto: ChangePasswordDto, @Ip() ip: string) {
    this.denyInSupportSession(user);
    return this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword, ip);
  }

  private denyInSupportSession(user: JwtPayloadUser) {
    if (user.impersonatedBy) {
      throw new ForbiddenException('Session support : le compte de l’utilisateur ne peut pas être modifié');
    }
  }
}
