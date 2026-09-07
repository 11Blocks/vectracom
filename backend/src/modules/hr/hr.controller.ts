import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { HrService } from './hr.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/create-employee.dto';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { EMPLOYEE_STATUSES } from './entities/employee.entity';
import { LEAVE_STATUSES } from './entities/leave-request.entity';
import { CANDIDATE_STATUSES, CANDIDATE_POSITIONS, CANDIDATE_SOURCES } from './entities/recruitment-candidate.entity';

class ListEmployeesQueryDto {
  @IsOptional() @IsString() teamId?: string;
  @IsOptional() @IsString() @IsIn(EMPLOYEE_STATUSES as unknown as string[]) status?: string;
}

class ListLeaveQueryDto {
  @IsOptional() @IsString() employeeId?: string;
  @IsOptional() @IsString() @IsIn(LEAVE_STATUSES as unknown as string[]) status?: string;
}

class ListAttendanceQueryDto {
  @IsOptional() @IsString() weekStart?: string;
  @IsOptional() @IsString() technicianId?: string;
}

class CreateCandidateDto {
  @IsString() @MinLength(3) fullName!: string;

  @IsIn(CANDIDATE_POSITIONS as unknown as string[])
  position!: string;

  @IsOptional() @IsString() phone?: string;

  @IsOptional() @IsString() email?: string;

  @IsOptional()
  @IsIn(CANDIDATE_SOURCES as unknown as string[])
  source?: string;

  @IsOptional() @IsString() notes?: string;

  @IsOptional() @IsString() interviewDate?: string;
}

class UpdateCandidateDto {
  @IsOptional()
  @IsIn(CANDIDATE_STATUSES as unknown as string[])
  status?: string;

  @IsOptional() @IsString() notes?: string;

  @IsOptional() @IsString() interviewDate?: string | null;

  @IsOptional() @IsInt() testScore?: number | null;

  @IsOptional() @IsString() documentType?: string;

  @IsOptional() @IsString() documentName?: string;

  @IsOptional() @IsString() documentUrl?: string;
}

class ListCandidatesQueryDto {
  @IsOptional()
  @IsString() @IsIn(CANDIDATE_STATUSES as unknown as string[]) status?: string;
}

class CreateDailyWorkerDto {
  @IsString() @MinLength(3) fullName!: string;

  @IsUUID() teamId!: string;

  @IsOptional() @IsString() phone?: string;

  @IsOptional() @IsNumber() dailyRate?: number;
}

class ClockInDto {
  @IsArray() @IsUUID(undefined, { each: true }) workerIds!: string[];

  @IsString() day!: string;

  @IsOptional() @IsUUID() missionId?: string;

  @IsOptional() @IsString() note?: string;
}

@Controller()
@Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.CHEF_EQUIPE)
export class HrController {
  constructor(private readonly hrService: HrService) {}

  // ------------------- Journaliers & pointage chantier -------------------

  @Get('daily-workers')
  dailyWorkers(@CurrentUser('companyId') companyId: string | null, @Query('teamId') teamId?: string) {
    this.requireTenant(companyId);
    return this.hrService.listDailyWorkers(companyId!, teamId);
  }

  @Post('daily-workers')
  createDailyWorker(
    @CurrentUser('companyId') companyId: string | null,
    @Body() dto: CreateDailyWorkerDto,
  ) {
    this.requireTenant(companyId);
    return this.hrService.createDailyWorker(companyId!, dto);
  }

  @Put('daily-workers/:id')
  updateDailyWorker(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Body() dto: { dailyRate?: number; active?: boolean; phone?: string },
  ) {
    this.requireTenant(companyId);
    return this.hrService.updateDailyWorker(companyId!, id, dto);
  }

  @Delete('daily-workers/:id')
  deleteDailyWorker(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.hrService.deleteDailyWorker(companyId!, id);
  }

  @Post('daily-attendance/clock-in')
  clockIn(
    @CurrentUser('companyId') companyId: string | null,
    @Body() dto: ClockInDto,
  ) {
    this.requireTenant(companyId);
    return this.hrService.clockIn(companyId!, dto);
  }

  @Get('daily-attendance/timesheet')
  timesheet(
    @CurrentUser('companyId') companyId: string | null,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('teamId') teamId?: string,
  ) {
    this.requireTenant(companyId);
    if (!from || !to) throw new BadRequestException('from et to requis (YYYY-MM-DD)');
    return this.hrService.timesheet(companyId!, from, to, teamId);
  }

  // ------------------- Recrutement -------------------

  @Get('recruitment')
  listCandidates(@CurrentUser('companyId') companyId: string | null, @Query() query: ListCandidatesQueryDto) {
    this.requireTenant(companyId);
    return this.hrService.listCandidates(companyId!, query.status);
  }

  @Post('recruitment')
  createCandidate(
    @CurrentUser('companyId') companyId: string | null,
    @Body() dto: CreateCandidateDto,
  ) {
    this.requireTenant(companyId);
    return this.hrService.createCandidate(companyId!, dto);
  }

  @Put('recruitment/:id')
  updateCandidate(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Body() dto: UpdateCandidateDto,
  ) {
    this.requireTenant(companyId);
    return this.hrService.updateCandidate(companyId!, id, {
      status: dto.status,
      notes: dto.notes,
      interviewDate: dto.interviewDate,
      testScore: dto.testScore,
      document:
        dto.documentType && dto.documentName && dto.documentUrl
          ? { type: dto.documentType, name: dto.documentName, fileUrl: dto.documentUrl }
          : undefined,
    });
  }

  @Delete('recruitment/:id')
  deleteCandidate(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.hrService.deleteCandidate(companyId!, id);
  }

  // ------------------- Employés -------------------

  @Get('employees')
  employees(@CurrentUser('companyId') companyId: string | null, @Query() query: ListEmployeesQueryDto) {
    this.requireTenant(companyId);
    return this.hrService.listEmployees(companyId!, { teamId: query.teamId, status: query.status });
  }

  @Post('employees')
  @Roles(UserRole.ADMIN)
  createEmployee(@CurrentUser('companyId') companyId: string | null, @Body() dto: CreateEmployeeDto) {
    this.requireTenant(companyId);
    return this.hrService.createEmployee(companyId!, dto);
  }

  @Get('employees/:id')
  employee(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.hrService.findEmployee(companyId!, id);
  }

  @Put('employees/:id')
  @Roles(UserRole.ADMIN)
  updateEmployee(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    this.requireTenant(companyId);
    return this.hrService.updateEmployee(companyId!, id, dto);
  }

  @Delete('employees/:id')
  @Roles(UserRole.ADMIN)
  removeEmployee(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.hrService.removeEmployee(companyId!, id);
  }

  // ------------------- Congés -------------------

  @Get('leave-requests')
  leaveRequests(@CurrentUser('companyId') companyId: string | null, @Query() query: ListLeaveQueryDto) {
    this.requireTenant(companyId);
    return this.hrService.listLeaveRequests(companyId!, {
      employeeId: query.employeeId,
      status: query.status,
    });
  }

  /** Demande en 2 clics — ouverte au chef d'équipe. */
  @Post('leave-requests')
  createLeave(@CurrentUser('companyId') companyId: string | null, @Body() dto: CreateLeaveRequestDto) {
    this.requireTenant(companyId);
    return this.hrService.createLeaveRequest(companyId!, dto);
  }

  @Put('leave-requests/:id/approve')
  @Roles(UserRole.ADMIN, UserRole.DIRECTION)
  approveLeave(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.hrService.decideLeave(companyId!, id, 'approuve');
  }

  @Put('leave-requests/:id/refuse')
  @Roles(UserRole.ADMIN, UserRole.DIRECTION)
  refuseLeave(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.hrService.decideLeave(companyId!, id, 'refuse');
  }

  // ------------------- Présence hebdomadaire -------------------

  @Get('attendance')
  attendance(@CurrentUser('companyId') companyId: string | null, @Query() query: ListAttendanceQueryDto) {
    this.requireTenant(companyId);
    return this.hrService.listAttendance(companyId!, {
      weekStart: query.weekStart,
      technicianId: query.technicianId,
    });
  }

  @Post('attendance')
  @Roles(UserRole.ADMIN, UserRole.CHEF_EQUIPE)
  saveAttendance(@CurrentUser('companyId') companyId: string | null, @Body() dto: CreateAttendanceDto) {
    this.requireTenant(companyId);
    return this.hrService.saveAttendance(companyId!, dto);
  }

  @Put('attendance/:id/validate')
  @Roles(UserRole.ADMIN, UserRole.DIRECTION)
  validateAttendance(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    this.requireTenant(companyId);
    return this.hrService.validateAttendance(companyId!, id, userId);
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}
