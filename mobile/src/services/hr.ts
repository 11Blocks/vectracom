import { api } from './api';

export type LeaveRequest = {
  id: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
  status: string;
};

export async function createLeaveMe(body: {
  startDate: string;
  endDate: string;
  reason?: string;
}) {
  return api.post<LeaveRequest>('/leave-requests/me', body);
}

export async function listMyLeaves() {
  const data = await api.get<LeaveRequest[]>('/leave-requests/me');
  return Array.isArray(data) ? data : [];
}
