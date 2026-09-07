import { api } from './api';

export async function createIncident(payload: {
  rubrique: string;
  zone: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  address?: string;
  annotationOriginale?: string;
}) {
  return api.post('/incidents', payload);
}

export async function createExpense(payload: {
  category: string;
  amount: number;
  description?: string;
  receiptPhotoUrl?: string;
  missionId?: string;
}) {
  return api.post('/expenses', payload);
}

export async function saveAttendance(payload: {
  technicianId: string;
  weekStart: string;
  monday?: boolean;
  tuesday?: boolean;
  wednesday?: boolean;
  thursday?: boolean;
  friday?: boolean;
  saturday?: boolean;
  sunday?: boolean;
  comments?: string;
}) {
  return api.post('/attendance', payload);
}

export async function listMyStock() {
  return api.get('/stock-items');
}
