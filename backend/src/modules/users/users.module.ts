import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { Company } from '../auth/entities/company.entity';
import { AuthModule } from '../auth/auth.module';
import { UsersService } from './users.service';
import { ConsoleTeamController, TenantUsersController, UsersController } from './users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, Company]), AuthModule],
  controllers: [TenantUsersController, UsersController, ConsoleTeamController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
