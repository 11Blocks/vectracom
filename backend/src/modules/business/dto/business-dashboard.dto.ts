/** Vue consolidée du business SaaS (Green-T). */
export class BusinessDashboardDto {
  mrr!: number;
  arr!: number;
  churn!: { rate: number; actifs: number; resilie: number };
  nrr!: { rate: number | null; currentMrr: number; previousRevenue: number };
  arpu!: { value: number; activeUsers: number; totalRevenue: number };
  ltv!: { value: number; averageLifetimeMonths: number };
  cac!: { value: number | null; acquisitionCost: number; newCustomers: number };
  tenants!: { actifs: number; resilie: number; essai: number };
  licenses!: Array<{ planCode: string; count: number; monthly: number }>;
  addons!: Array<{ addonType: string; count: number; monthly: number }>;
}
