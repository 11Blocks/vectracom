/** Réponse du rapport mensuel KPI (synthèse + détails + pénalités + bonus). */
export class KpiReportDto {
  period!: string;
  summary!: { total: number; atteints: number; nonAtteints: number; penaltiesTotal: number };
  details!: Array<Record<string, unknown>>;
  bonus!: { eligible: boolean; months: string[]; amount: number; plafond: number };
}
