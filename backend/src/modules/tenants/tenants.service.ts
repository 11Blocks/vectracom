import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company, CompanySubscriptionStatus } from '../auth/entities/company.entity';
import { AuthService } from '../auth/auth.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

/**
 * Console Green-T : gestion du cycle de vie des tenants.
 * Réservée aux rôles console (super_admin, finance_admin).
 */
@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly authService: AuthService,
  ) {}

  async list() {
    return this.companyRepository.find({
      order: { createdAt: 'DESC' },
      select: {
        id: true,
        name: true,
        active: true,
        sonatelSubcontractorName: true,
        subscriptionStatus: true,
        subscriptionStartDate: true,
        subscriptionEndDate: true,
        trialEndDate: true,
        onboardingPaid: true,
        platformFeePaid: true,
        createdAt: true,
      },
    });
  }

  async findOne(id: string) {
    const company = await this.companyRepository.findOne({ where: { id } });
    if (!company) throw new NotFoundException('Tenant introuvable');
    return company;
  }

  async create(dto: CreateTenantDto) {
    const result = await this.authService.register({
      companyName: dto.companyName,
      sonatelSubcontractorName: dto.sonatelSubcontractorName,
      adminEmail: dto.adminEmail,
      adminPassword: dto.adminPassword,
      adminFullName: dto.adminFullName,
    });

    if (dto.onboardingPaid) {
      await this.companyRepository.update(result.company.id, { onboardingPaid: true });
    }
    return result;
  }

  async setActive(id: string, active: boolean) {
    const company = await this.findOne(id);
    company.active = active;
    await this.companyRepository.save(company);
    return { id: company.id, name: company.name, active: company.active };
  }

  async setSubscriptionStatus(id: string, status: CompanySubscriptionStatus) {
    const company = await this.findOne(id);
    company.subscriptionStatus = status;
    if (status === 'active' && !company.subscriptionStartDate) {
      company.subscriptionStartDate = new Date().toISOString().slice(0, 10);
    }
    await this.companyRepository.save(company);
    return { id: company.id, name: company.name, subscriptionStatus: company.subscriptionStatus };
  }
}
