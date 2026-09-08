import { api } from './api';

export type Vehicle = {
  id: string;
  immatriculation?: string;
  modele?: string | null;
  status?: string;
  teamId?: string | null;
};

export type VehicleCheckPayload = {
  missionId?: string;
  huile: boolean;
  eau: boolean;
  freins: boolean;
  pneus: boolean;
  batterie: boolean;
  eclairage: boolean;
  observations?: string;
  photoUrl?: string;
};

export async function listVehicles() {
  const data = await api.get<Vehicle[]>('/vehicles');
  return Array.isArray(data) ? data : [];
}

export async function createVehicleCheck(vehicleId: string, body: VehicleCheckPayload) {
  return api.post(`/vehicles/${vehicleId}/checks`, body);
}
