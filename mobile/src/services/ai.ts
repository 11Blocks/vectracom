import { api } from './api';

export type PhotoAuditResult = {
  photoUrl: string;
  verdict: 'accepte' | 'a_reprendre';
  score: number;
  flags: string[];
  requiresHumanValidation: boolean;
};

export type VoiceCommandResult = {
  command: string;
  missionId: string | null;
  intent: string;
  entities: Record<string, string>;
  proposedActions: string[];
  autoExecute: boolean;
  note?: string;
};

export type ReceiptExtraction = {
  photoUrl: string;
  amount: number | null;
  currency: string;
  date: string | null;
  category: string;
  confidence: number;
  requiresHumanValidation: boolean;
};

export async function photoAudit(photoUrl: string) {
  return api.post<PhotoAuditResult>('/ai/photo-audit', { photoUrl });
}

export async function voiceCommand(command: string, missionId?: string) {
  return api.post<VoiceCommandResult>('/ai/voice-command', { command, missionId });
}

export async function extractReceipt(photoUrl: string) {
  return api.post<ReceiptExtraction>('/ai/receipt', { photoUrl });
}

/** Pipeline IA Vision complet (crée un incident signalement — proposition). */
export async function analyzeVision(payload: {
  imageUrl: string;
  annotation?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  incidentId?: string;
}) {
  return api.post<{
    incident: { id: string; incidentNumber: string; rubrique: string; zone: string; status: string };
    analysis: {
      id: string;
      rubriqueDetected?: string | null;
      confidenceRubrique?: string | null;
      suggestedMissionType?: string | null;
    };
  }>('/ia-vision/analyze', payload);
}
