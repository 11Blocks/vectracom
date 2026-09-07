import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HrController } from './hr.controller';
import { HrService } from './hr.service';
import { Employee } from './entities/employee.entity';
import { LeaveRequest } from './entities/leave-request.entity';
import { Attendance } from './entities/attendance.entity';
import { RecruitmentCandidate } from './entities/recruitment-candidate.entity';
import { DailyWorker } from './entities/daily-worker.entity';
import { DailyAttendance } from './entities/daily-attendance.entity';
import { Technician } from '../technicians/entities/technician.entity';
import { Team } from '../teams/entities/team.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { User } from '../auth/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Employee, LeaveRequest, Attendance, RecruitmentCandidate, DailyWorker, DailyAttendance, Technician, Team, Vehicle, User]),
  ],
  controllers: [HrController],
  providers: [HrService],
  exports: [HrService],
})
export class HrModule {}
