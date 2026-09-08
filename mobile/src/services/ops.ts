import { api } from './api';

export async function createIncident(payload: {
  rubrique: string;
  zone: string;
  source?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  address?: string;
  annotationOriginale?: string;
  relatedMissionIds?: string[];
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
  return api.post('/attendance/me', payload);
}

export type StockItem = {
  id: string;
  reference: string;
  designation: string;
  category: string;
  family: string;
  unit?: string | null;
  thresholdAlert?: number;
};

export type StockLevel = {
  id: string;
  quantity: number;
  warehouse?: { id: string; name?: string; code?: string } | null;
};

export type StockSerial = {
  id: string;
  serialNumber: string;
  status?: string;
};

export async function listMyStock() {
  return api.get<StockItem[]>('/stock-items');
}

export async function getLowStock() {
  return api.get<Array<{ stockItemId: string; reference: string; designation: string; thresholdAlert: number; totalQuantity: number }>>(
    '/stock-items/low-stock',
  );
}

export async function getStockItem(id: string) {
  return api.get<StockItem>(`/stock-items/${id}`);
}

export async function getStockLevels(id: string) {
  return api.get<StockLevel[]>(`/stock-items/${id}/levels`);
}

export async function getStockSerials(id: string) {
  return api.get<StockSerial[]>(`/stock-items/${id}/serials`);
}

export type SerialSearchHit = {
  id: string;
  serialNumber: string;
  status: string;
  reference: string;
  designation: string;
  clientNd?: string | null;
  installedAt?: string | null;
};

export async function searchSerials(q: string) {
  return api.get<SerialSearchHit[]>(`/stock-serials/search?q=${encodeURIComponent(q)}`);
}

export async function deliverSerial(id: string, teamId: string) {
  return api.post(`/stock-serials/${id}/deliver`, { teamId, serialIds: [id] });
}

export async function installSerial(id: string, nd: string, missionId?: string) {
  return api.post(`/stock-serials/${id}/install`, { nd, missionId });
}

export async function returnSerial(id: string, defect: boolean) {
  return api.post(`/stock-serials/${id}/return`, { defect });
}

export type Warehouse = { id: string; name: string; code?: string | null; type?: string };

export async function listWarehouses() {
  return api.get<Warehouse[]>('/warehouses');
}

export async function createStockMovement(payload: {
  stockItemId: string;
  type: string;
  quantity: number;
  fromWarehouseId?: string | null;
  toWarehouseId?: string | null;
  itemSerialId?: string | null;
  note?: string;
}) {
  return api.post('/stock-movements', payload);
}

export type Team = { id: string; name: string };

export async function listTeams() {
  return api.get<Team[]>('/teams');
}
