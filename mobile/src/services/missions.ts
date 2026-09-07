import { api } from './api';
import { resolveTemplateKey, TemplateKey } from './templateKey';

export type Mission = {
  id: string;
  clientSite?: string;
  typeTache?: string;
  zone?: string;
  status?: string;
  dateMission?: string;
  sonatelDossierNumber?: string;
  importMeta?: { teamLabel?: string; heureDebut?: string; heureFin?: string };
  syncState?: string;
};

export type TemplateStepField = {
  id: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'date' | 'select' | 'photos' | 'signature' | 'checklist';
  required?: boolean;
  options?: string[];
};

export type TemplateStep = {
  id: string;
  label: string;
  icon?: string;
  blocking?: boolean;
  fields: TemplateStepField[];
};

export type MissionTemplate = {
  typeName: TemplateKey | string;
  label: string;
  description?: string | null;
  steps: TemplateStep[];
};

export async function listMissions(params?: { status?: string }) {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  const qs = q.toString();
  const data = await api.get<Mission[]>(`/planning/missions${qs ? '?' + qs : ''}`);
  return Array.isArray(data) ? data : [];
}

export async function getMission(id: string) {
  return api.get<Mission>(`/missions/${id}`);
}

export async function getTemplateForMission(mission: Mission) {
  const key = resolveTemplateKey(mission.typeTache);
  return api.get<MissionTemplate>(`/mission-templates/${key}`);
}

export async function saveFieldReportData(missionId: string, data: Record<string, unknown>) {
  return api.post(`/missions/${missionId}/field-report/step/data`, { data: { data } });
}

export { resolveTemplateKey };
