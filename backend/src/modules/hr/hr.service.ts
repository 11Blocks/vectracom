import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee, EmployeeStatus, EmployeeDocument } from './entities/employee.entity';
import { LeaveRequest } from './entities/leave-request.entity';
import { Attendance } from './entities/attendance.entity';
import { RecruitmentCandidate } from './entities/recruitment-candidate.entity';
import { DailyWorker } from './entities/daily-worker.entity';
import { DailyAttendance } from './entities/daily-attendance.entity';
import { Technician } from '../technicians/entities/technician.entity';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/create-employee.dto';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { CreateAttendanceDto } from './dto/create-attendance.dto';

/** Normalise une date vers le lundi de sa semaine (UTC). */
function toMonday(dateStr: string): string {
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00Z`);
  const day = d.getUTCDay(); // 0=dimanche … 6=samedi
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class HrService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(LeaveRequest)
    private readonly leaveRepository: Repository<LeaveRequest>,
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,
    @InjectRepository(RecruitmentCandidate)
    private readonly candidateRepository: Repository<RecruitmentCandidate>,
    @InjectRepository(DailyWorker)
    private readonly dailyWorkerRepository: Repository<DailyWorker>,
    @InjectRepository(DailyAttendance)
    private readonly dailyAttendanceRepository: Repository<DailyAttendance>,
    @InjectRepository(Technician)
    private readonly technicianRepository: Repository<Technician>,
  ) {}

  // ------------------- Employés -------------------

  async createEmployee(companyId: string, dto: CreateEmployeeDto) {
    const employee = await this.employeeRepository.save(
      this.employeeRepository.create({
        companyId,
        fullName: dto.fullName.trim(),
        jobTitle: dto.jobTitle?.trim() ?? null,
        teamId: dto.teamId ?? null,
        vehicleId: dto.vehicleId ?? null,
        matricule: dto.matricule?.trim() ?? null,
        status: (dto.status as EmployeeStatus) ?? 'actif',
        habilitationExpiration: dto.habilitationExpiration?.slice(0, 10) ?? null,
        documents: (dto.documents as EmployeeDocument[]) ?? [],
      }),
    );
    // Relecture avec l'équipe chargée (réponse API complète).
    return this.findEmployee(companyId, employee.id);
  }

  listEmployees(companyId: string, filters: { teamId?: string; status?: string }) {
    const qb = this.employeeRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.team', 'team')
      .where('e.company_id = :companyId', { companyId })
      .orderBy('e.fullName', 'ASC');
    if (filters.teamId) qb.andWhere('e.team_id = :teamId', { teamId: filters.teamId });
    if (filters.status) qb.andWhere('e.status = :status', { status: filters.status });
    return qb.getMany();
  }

  async findEmployee(companyId: string, id: string) {
    const employee = await this.employeeRepository.findOne({
      where: { companyId, id },
      relations: ['team'],
    });
    if (!employee) throw new NotFoundException('Employé introuvable');
    return employee;
  }

  async updateEmployee(companyId: string, id: string, dto: UpdateEmployeeDto) {
    const employee = await this.findEmployee(companyId, id);
    Object.assign(employee, {
      ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
      ...(dto.jobTitle !== undefined ? { jobTitle: dto.jobTitle } : {}),
      ...(dto.teamId !== undefined ? { teamId: dto.teamId } : {}),
      ...(dto.vehicleId !== undefined ? { vehicleId: dto.vehicleId } : {}),
      ...(dto.matricule !== undefined ? { matricule: dto.matricule } : {}),
      ...(dto.status !== undefined ? { status: dto.status as EmployeeStatus } : {}),
      ...(dto.habilitationExpiration !== undefined
        ? { habilitationExpiration: dto.habilitationExpiration?.slice(0, 10) ?? null }
        : {}),
      ...(dto.documents !== undefined ? { documents: dto.documents as EmployeeDocument[] } : {}),
    });
    return this.employeeRepository.save(employee);
  }

  async removeEmployee(companyId: string, id: string) {
    const employee = await this.findEmployee(companyId, id);
    await this.employeeRepository.remove(employee);
    return { deleted: true };
  }

  // ------------------- Congés -------------------

  async createLeaveRequest(companyId: string, dto: CreateLeaveRequestDto) {
    const employee = await this.findEmployee(companyId, dto.employeeId);
    if (dto.endDate < dto.startDate) {
      throw new BadRequestException('La date de fin précède la date de début');
    }
    return this.leaveRepository.save(
      this.leaveRepository.create({
        companyId,
        employeeId: employee.id,
        startDate: dto.startDate.slice(0, 10),
        endDate: dto.endDate.slice(0, 10),
        reason: dto.reason?.trim() ?? null,
        status: 'en_attente',
      }),
    );
  }

  async listLeaveRequests(companyId: string, filters: { employeeId?: string; status?: string }) {
    const qb = this.leaveRepository
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.employee', 'employee')
      .where('l.company_id = :companyId', { companyId })
      .orderBy('l.startDate', 'DESC');
    if (filters.employeeId) qb.andWhere('l.employee_id = :employeeId', { employeeId: filters.employeeId });
    if (filters.status) qb.andWhere('l.status = :status', { status: filters.status });
    return qb.getMany();
  }

  async createLeaveRequestForUser(
    companyId: string,
    userFullName: string,
    dto: { startDate: string; endDate: string; reason?: string },
  ) {
    if (dto.endDate < dto.startDate) {
      throw new BadRequestException('La date de fin précède la date de début');
    }
    let employee = await this.employeeRepository
      .createQueryBuilder('e')
      .where('e.companyId = :companyId', { companyId })
      .andWhere('LOWER(e.fullName) = LOWER(:n)', { n: userFullName.trim() })
      .getOne();
    if (!employee) {
      employee = await this.employeeRepository.save(
        this.employeeRepository.create({
          companyId,
          fullName: userFullName.trim() || 'Employé mobile',
          jobTitle: 'Terrain',
          status: 'actif',
          documents: [],
        }),
      );
    }
    return this.leaveRepository.save(
      this.leaveRepository.create({
        companyId,
        employeeId: employee.id,
        startDate: dto.startDate.slice(0, 10),
        endDate: dto.endDate.slice(0, 10),
        reason: dto.reason?.trim() ?? null,
        status: 'en_attente',
      }),
    );
  }

  async listMyLeaveRequests(companyId: string, userFullName: string) {
    const employee = await this.employeeRepository
      .createQueryBuilder('e')
      .where('e.companyId = :companyId', { companyId })
      .andWhere('LOWER(e.fullName) = LOWER(:n)', { n: userFullName.trim() })
      .getOne();
    if (!employee) return [];
    return this.listLeaveRequests(companyId, { employeeId: employee.id });
  }

  /** Validation manager — passe l'employé en congé à l'approbation. */
  async decideLeave(companyId: string, id: string, decision: 'approuve' | 'refuse') {
    const request = await this.leaveRepository.findOne({ where: { companyId, id } });
    if (!request) throw new NotFoundException('Demande de congé introuvable');
    if (request.status !== 'en_attente') {
      throw new BadRequestException(`Demande déjà traitée (${request.status})`);
    }
    request.status = decision;
    await this.leaveRepository.save(request);

    if (decision === 'approuve') {
      await this.employeeRepository.update({ companyId, id: request.employeeId }, { status: 'en_conge' });
    }
    return this.leaveRepository.findOne({ where: { id }, relations: ['employee'] });
  }

  // ------------------- Présence hebdomadaire -------------------

  /** Upsert par (technicien, semaine) : le chef d'équipe peut corriger sa feuille. */
  async saveAttendance(companyId: string, dto: CreateAttendanceDto) {
    const technician = await this.technicianRepository.findOne({
      where: { companyId, id: dto.technicianId },
    });
    if (!technician) throw new BadRequestException('Technicien inconnu pour ce tenant');

    return this.upsertAttendanceSheet(companyId, dto.technicianId, dto);
  }

  /**
   * Présence mobile : résout le technicien depuis le JWT (userId → homonyme → chef).
   */
  async saveAttendanceForUser(
    companyId: string,
    userId: string,
    userFullName: string | null | undefined,
    dto: Omit<CreateAttendanceDto, 'technicianId'>,
  ) {
    const tech = await this.resolveTechnicianForUser(companyId, userId, userFullName);
    return this.upsertAttendanceSheet(companyId, tech.id, dto);
  }

  private async resolveTechnicianForUser(
    companyId: string,
    userId: string,
    userFullName?: string | null,
  ) {
    const linked = await this.technicianRepository.findOne({
      where: { companyId, userId, active: true },
    });
    if (linked) return linked;

    if (userFullName?.trim()) {
      const byName = await this.technicianRepository
        .createQueryBuilder('t')
        .where('t.company_id = :cid AND t.active = true', { cid: companyId })
        .andWhere('LOWER(t.full_name) = LOWER(:name)', { name: userFullName.trim() })
        .orderBy('t.is_team_leader', 'DESC')
        .getOne();
      if (byName) return byName;
    }

    const leader = await this.technicianRepository.findOne({
      where: { companyId, active: true, isTeamLeader: true },
      order: { createdAt: 'ASC' },
    });
    if (leader) return leader;

    throw new BadRequestException(
      'Aucun technicien lié à ce compte — rattachez userId sur la fiche technicien',
    );
  }

  private async upsertAttendanceSheet(
    companyId: string,
    technicianId: string,
    dto: Omit<CreateAttendanceDto, 'technicianId'>,
  ) {
    const weekStart = toMonday(dto.weekStart);
    let sheet = await this.attendanceRepository.findOne({
      where: { companyId, technicianId, weekStart },
    });
    if (!sheet) {
      sheet = this.attendanceRepository.create({
        companyId,
        technicianId,
        weekStart,
      });
    }
    Object.assign(sheet, {
      monday: dto.monday ?? sheet.monday ?? false,
      tuesday: dto.tuesday ?? sheet.tuesday ?? false,
      wednesday: dto.wednesday ?? sheet.wednesday ?? false,
      thursday: dto.thursday ?? sheet.thursday ?? false,
      friday: dto.friday ?? sheet.friday ?? false,
      saturday: dto.saturday ?? sheet.saturday ?? false,
      sunday: dto.sunday ?? sheet.sunday ?? false,
      comments: dto.comments ?? sheet.comments ?? null,
    });
    return this.attendanceRepository.save(sheet);
  }

  async listAttendance(companyId: string, filters: { weekStart?: string; technicianId?: string }) {
    const qb = this.attendanceRepository
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.technician', 'tech')
      .where('a.company_id = :companyId', { companyId })
      .orderBy('a.week_start', 'DESC')
      .addOrderBy('tech.fullName', 'ASC');
    if (filters.weekStart) qb.andWhere('a.week_start = :week', { week: toMonday(filters.weekStart) });
    if (filters.technicianId) qb.andWhere('a.technician_id = :techId', { techId: filters.technicianId });
    return qb.getMany();
  }

  /** Validation manager : fige la feuille (validatedBy/validatedAt). */
  async validateAttendance(companyId: string, id: string, validatedBy: string) {
    const sheet = await this.attendanceRepository.findOne({ where: { companyId, id } });
    if (!sheet) throw new NotFoundException('Feuille de présence introuvable');
    if (sheet.validatedAt) throw new BadRequestException('Feuille déjà validée');
    sheet.validatedBy = validatedBy;
    sheet.validatedAt = new Date();
    return this.attendanceRepository.save(sheet);
  }

  // ------------------- Recrutement -------------------

  listCandidates(companyId: string, status?: string) {
    const where: Record<string, unknown> = { companyId };
    if (status) where.status = status;
    return this.candidateRepository.find({ where, order: { createdAt: 'DESC' } });
  }

  createCandidate(companyId: string, dto: {
    fullName: string; position: string; phone?: string; email?: string; source?: string;
    notes?: string; interviewDate?: string;
  }) {
    return this.candidateRepository.save(
      this.candidateRepository.create({
        companyId,
        fullName: dto.fullName.trim(),
        position: dto.position as RecruitmentCandidate['position'],
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        source: (dto.source as RecruitmentCandidate['source']) ?? 'candidature_spontanee',
        notes: dto.notes ?? null,
        interviewDate: dto.interviewDate?.slice(0, 10) ?? null,
        documents: [],
      }),
    );
  }

  async updateCandidate(companyId: string, id: string, dto: {
    status?: string; notes?: string; interviewDate?: string | null; testScore?: number | null;
    document?: { type: string; name: string; fileUrl: string };
  }) {
    const candidate = await this.candidateRepository.findOne({ where: { companyId, id } });
    if (!candidate) throw new NotFoundException('Candidat introuvable');
    if (dto.status) candidate.status = dto.status as RecruitmentCandidate['status'];
    if (dto.notes !== undefined) candidate.notes = dto.notes;
    if (dto.interviewDate !== undefined) candidate.interviewDate = dto.interviewDate ? dto.interviewDate.slice(0, 10) : null;
    if (dto.testScore !== undefined) candidate.testScore = dto.testScore;
    if (dto.document) {
      candidate.documents = [...candidate.documents, { ...dto.document, addedAt: new Date().toISOString() }];
    }
    return this.candidateRepository.save(candidate);
  }

  async deleteCandidate(companyId: string, id: string) {
    const candidate = await this.candidateRepository.findOne({ where: { companyId, id } });
    if (!candidate) throw new NotFoundException('Candidat introuvable');
    await this.candidateRepository.remove(candidate);
    return { deleted: true };
  }

  // ------------------- Journaliers (équipes déploiement) -------------------

  listDailyWorkers(companyId: string, teamId?: string) {
    const where: Record<string, unknown> = { companyId };
    if (teamId) where.teamId = teamId;
    return this.dailyWorkerRepository.find({ where, order: { fullName: 'ASC' } });
  }

  createDailyWorker(companyId: string, dto: { fullName: string; teamId: string; phone?: string; dailyRate?: number }) {
    return this.dailyWorkerRepository.save(
      this.dailyWorkerRepository.create({
        companyId,
        fullName: dto.fullName.trim(),
        teamId: dto.teamId,
        phone: dto.phone ?? null,
        dailyRate: String(dto.dailyRate ?? 0),
      }),
    );
  }

  async updateDailyWorker(companyId: string, id: string, dto: { dailyRate?: number; active?: boolean; phone?: string }) {
    const worker = await this.dailyWorkerRepository.findOne({ where: { companyId, id } });
    if (!worker) throw new NotFoundException('Journalier introuvable');
    if (dto.dailyRate !== undefined) worker.dailyRate = String(dto.dailyRate);
    if (dto.active !== undefined) worker.active = dto.active;
    if (dto.phone !== undefined) worker.phone = dto.phone;
    return this.dailyWorkerRepository.save(worker);
  }

  async deleteDailyWorker(companyId: string, id: string) {
    const worker = await this.dailyWorkerRepository.findOne({ where: { companyId, id } });
    if (!worker) throw new NotFoundException('Journalier introuvable');
    await this.dailyWorkerRepository.remove(worker);
    return { deleted: true };
  }

  // ------------------- Pointage chantier -------------------

  /** Pointe plusieurs journaliers sur une mission pour un jour donné. */
  async clockIn(companyId: string, dto: { workerIds: string[]; day: string; missionId?: string; note?: string }) {
    let created = 0;
    for (const workerId of dto.workerIds) {
      const worker = await this.dailyWorkerRepository.findOne({ where: { companyId, id: workerId } });
      if (!worker) continue;
      const existing = await this.dailyAttendanceRepository.findOne({
        where: { companyId, dailyWorkerId: workerId, day: dto.day.slice(0, 10) },
      });
      if (existing) continue;
      await this.dailyAttendanceRepository.save(
        this.dailyAttendanceRepository.create({
          companyId,
          dailyWorkerId: workerId,
          missionId: dto.missionId ?? null,
          day: dto.day.slice(0, 10),
          daysWorked: '1',
          note: dto.note ?? null,
        }),
      );
      created++;
    }
    return { created };
  }

  /** Synthèse du pointage d'une période : jours, salaire dû par journalier. */
  async timesheet(companyId: string, from: string, to: string, teamId?: string) {
    const workers = teamId
      ? await this.dailyWorkerRepository.find({ where: { companyId, teamId } })
      : await this.dailyWorkerRepository.find({ where: { companyId } });
    const rows = await this.dailyAttendanceRepository
      .createQueryBuilder('a')
      .where('a.company_id = :cid AND a.day >= :from AND a.day <= :to', {
        cid: companyId,
        from: from.slice(0, 10),
        to: to.slice(0, 10),
      })
      .getMany();
    return workers.map((w) => {
      const own = rows.filter((r) => r.dailyWorkerId === w.id);
      const days = own.reduce((sum, r) => sum + Number(r.daysWorked), 0);
      return {
        dailyWorkerId: w.id,
        fullName: w.fullName,
        teamId: w.teamId,
        days,
        dailyRate: Number(w.dailyRate),
        salaryDue: Math.round(days * Number(w.dailyRate)),
      };
    });
  }
}
