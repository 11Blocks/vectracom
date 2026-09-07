import { api } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3100/api/v1';
const ASSET_ORIGIN = API_URL.replace(/\/api\/v1\/?$/, '');

/** Transforme /uploads/... en URL absolue servie par le backend. */
export function absoluteUploadUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${ASSET_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

export const filesService = {
  upload: (file: File, category: string = 'docs') => {
    const fd = new FormData();
    fd.append('file', file);
    return api.upload<{ url: string; originalName: string; mimeType: string; sizeBytes: number; category: string }>(
      '/files/upload?category=' + encodeURIComponent(category),
      fd,
    );
  },
};

// ═══════════════════════════════════════════════════════════
//  MISSIONS
// ═══════════════════════════════════════════════════════════

export const partnersService = {
  list: () => api.get('/partners'),
  create: (data: { code: string; name: string; priceGrid: string; description?: string; exclusiveZone?: string }) =>
    api.post('/partners', data),
  update: (id: string, data: any) => api.put('/partners/' + id, data),
};

export const missionsService = {
  list: (params?: Record<string, string>) => api.get('/planning/missions?' + new URLSearchParams(params || {})),
  get: (id: string) => api.get('/missions/' + id),
  create: (data: any) => api.post('/missions', data),
  updateStatus: (id: string, status: string, reason?: string) => api.patch('/missions/' + id + '/status', { status, rejectionReason: reason }),
  reassign: (id: string, data: { teamId?: string | null; technicianIds?: string[]; vehicleId?: string | null; dateMission?: string }) => api.put('/missions/' + id, data),
  updateDetails: (id: string, data: Record<string, unknown>) => api.put('/missions/' + id + '/details', data),
  remove: (id: string) => api.delete('/missions/' + id),
  saveStep: (id: string, stepId: number | 'data', body: any) => api.post(`/missions/${id}/field-report/step/${stepId}`, { ['step' + stepId]: body }),
  saveStepData: (id: string, data: Record<string, unknown>, priceItemsUsed?: any[]) =>
    api.post(`/missions/${id}/field-report/step/data`, { data: { data, priceItemsUsed } }),
  validate: (id: string, status: 'validee' | 'rejetee') => api.post(`/missions/${id}/field-report/validate`, { internalValidationStatus: status }),
  sonatelApprove: (id: string, status: 'approuve' | 'rejete') => api.post(`/missions/${id}/field-report/sonatel-approve`, { sonatelApprovalStatus: status }),
  pvRecette: (id: string) => api.getBlob(`/missions/${id}/pv-recette`),
  templates: () => api.get('/mission-templates'),
  template: (typeName: string) => api.get('/mission-templates/' + typeName),
  upsertTemplate: (data: {
    typeName: string;
    label?: string;
    description?: string;
    steps?: unknown[];
    requiredPhotos?: unknown[];
    checklistTemplate?: unknown[];
    workflow?: Record<string, unknown>;
    isActive?: boolean;
  }) => api.post('/mission-templates', data),
  resetTemplate: (typeName: string) => api.delete('/mission-templates/' + typeName),
};

export const siteChecklistService = {
  forMission: (missionId: string) => api.get('/site-checklists/' + missionId),
  saveForMission: (missionId: string, data: Record<string, unknown>, photos?: Array<{ type: string; url: string }>, priceItems?: Array<{ itemNumber: number; quantity: number }>) =>
    api.post('/site-checklists/' + missionId, { data, photos, priceItems }),
};

// ═══════════════════════════════════════════════════════════
//  PLANNING / IMPORT
// ═══════════════════════════════════════════════════════════

export const performanceService = {
  dashboard: (opts?: { from?: string; to?: string; week?: number; year?: number }) => {
    const q = new URLSearchParams();
    if (opts?.week) q.set('week', String(opts.week));
    if (opts?.year) q.set('year', String(opts.year));
    if (opts?.from) q.set('from', opts.from);
    if (opts?.to) q.set('to', opts.to);
    const qs = q.toString();
    return api.get('/performance/dashboard' + (qs ? '?' + qs : ''));
  },
  trend: (weeks?: number) => api.get('/performance/trend' + (weeks ? '?weeks=' + weeks : '')),
  interpret: (opts?: { from?: string; to?: string; week?: number; year?: number }) => {
    const q = new URLSearchParams();
    if (opts?.week) q.set('week', String(opts.week));
    if (opts?.year) q.set('year', String(opts.year));
    if (opts?.from) q.set('from', opts.from);
    if (opts?.to) q.set('to', opts.to);
    const qs = q.toString();
    return api.get('/performance/interpret' + (qs ? '?' + qs : ''));
  },
  exportExcel: (opts?: { from?: string; to?: string; week?: number; year?: number }) => {
    const q = new URLSearchParams();
    if (opts?.week) q.set('week', String(opts.week));
    if (opts?.year) q.set('year', String(opts.year));
    if (opts?.from) q.set('from', opts.from);
    if (opts?.to) q.set('to', opts.to);
    const qs = q.toString();
    return api.getBlob('/performance/export' + (qs ? '?' + qs : ''));
  },
  importDaily: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.upload('/performance/import-daily', fd);
  },
};

export const settingsService = {
  getAll: () => api.get('/settings'),
  getSection: (section: string) => api.get('/settings/' + section),
  updateSection: (section: string, data: Record<string, unknown>, reason?: string) =>
    api.put('/settings/' + section, { data, reason }),
  journal: (limit?: number) => api.get('/settings/journal' + (limit ? '?limit=' + limit : '')),
  auditLogs: (limit?: number) => api.get('/settings/audit-logs' + (limit ? '?limit=' + limit : '')),
  exportConfig: () => api.get('/settings/export'),
  importConfig: (data: Record<string, unknown>) => api.post('/settings/import', { data }),
  restoreDefaults: () => api.post('/settings/restore-defaults', {}),
};

export const cashBoxService = {
  list: (period?: string) => api.get('/cash-box' + (period ? '?period=' + period : '')),
  create: (data: { type: string; rubrique: string; amount: number; period?: string; beneficiary?: string; teamId?: string; vehicleId?: string; note?: string }) =>
    api.post('/cash-box', data),
  repay: (id: string, amount: number) => api.post(`/cash-box/${id}/repay`, { amount }),
  summary: (period: string) => api.get('/cash-box/summary?period=' + period),
  material: (period: string) => api.get('/cash-box/material?period=' + period),
};

export const serialLifecycle = {
  fleet: (reference: string) => api.get('/stock-serials/fleet?reference=' + encodeURIComponent(reference)),
  search: (q: string) => api.get('/stock-serials/search?q=' + encodeURIComponent(q)),
  tooling: (teamId?: string) =>
    api.get('/stock-serials/tooling' + (teamId ? '?teamId=' + encodeURIComponent(teamId) : '')),
  receiveBatch: (reference: string, serials: Array<{ serialNumber: string; cartonNumber?: string }>) =>
    api.post('/stock-serials/receive-batch', { reference, serials }),
  deliver: (id: string, teamId: string) => api.post(`/stock-serials/${id}/deliver`, { serialIds: [id], teamId }),
  install: (id: string, nd: string) => api.post(`/stock-serials/${id}/install`, { nd }),
  returnFromField: (id: string, defect: boolean) => api.post(`/stock-serials/${id}/return`, { defect }),
  recover: (id: string, defect: boolean) => api.post(`/stock-serials/${id}/recover`, { defect }),
  scrapSale: (id: string, amountFcfa?: number) => api.post(`/stock-serials/${id}/scrap-sale`, { amountFcfa }),
  returnToSonatel: (serialIds: string[]) => api.post('/stock-serials/return-to-sonatel', { serialIds }),
  viewsByRegion: () => api.get('/stock-serials/views/by-region'),
};

export const dispositifService = {
  grid: (day?: string) => api.get('/dispositif' + (day ? '?day=' + day : '')),
  upsert: (data: { day: string; zoneName: string; teamName: string; axis?: string; teamId?: string; pilot?: string; instances?: number }) =>
    api.post('/dispositif/entries', data),
  remove: (id: string) => api.delete('/dispositif/entries/' + id),
  propose: (day?: string) => api.post('/dispositif/propose-assignment' + (day ? '?day=' + day : ''), {}),
  apply: (assignments: Array<{ missionId: string; teamId: string }>) =>
    api.post('/dispositif/apply-assignment', { assignments }),
};

export const invoiceExtras = {
  presets: () => api.get('/invoices/extras/presets'),
  addExtra: (invoiceId: string, data: { label: string; quantity: number; unitPrice: number; category?: string; note?: string }) =>
    api.post(`/invoices/${invoiceId}/extras`, data),
  removeLine: (invoiceId: string, lineId: string) => api.post(`/invoices/${invoiceId}/lines/${lineId}/remove`, {}),
  exportAttachement: (invoiceId: string) => api.getBlob(`/invoices/${invoiceId}/export-attachement`),
};

export const planningService = {
  preview: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.upload('/planning/import/preview', fd);
  },
  confirm: (fileId: string, selectedRows?: string[]) => api.post('/planning/import/confirm', { fileId, selectedRows }),
  getMappings: () => api.get('/planning/import/mappings'),
  updateMappings: (mappings: any[]) => api.put('/planning/import/mappings', { mappings }),
};

// ═══════════════════════════════════════════════════════════
//  STOCK
// ═══════════════════════════════════════════════════════════

export const stockService = {
  listItems: (params?: Record<string, string>) => api.get('/stock-items?' + new URLSearchParams(params || {})),
  getItem: (id: string) => api.get('/stock-items/' + id),
  createItem: (data: any) => api.post('/stock-items', data),
  updateItem: (id: string, data: any) => api.put('/stock-items/' + id, data),
  deleteItem: (id: string) => api.delete('/stock-items/' + id),
  lowStock: () => api.get('/stock-items/low-stock'),
  listWarehouses: (params?: Record<string, string>) => api.get('/warehouses?' + new URLSearchParams(params || {})),
  createWarehouse: (data: any) => api.post('/warehouses', data),
  updateWarehouse: (id: string, data: any) => api.put('/warehouses/' + id, data),
  deleteWarehouse: (id: string) => api.delete('/warehouses/' + id),
  createMovement: (data: any) => api.post('/stock-movements', data),
  listMovements: (params?: Record<string, string>) => api.get('/stock-movements?' + new URLSearchParams(params || {})),
  listPriceItems: (params?: Record<string, string>) => api.get('/price-items?' + new URLSearchParams(params || {})),
  searchPriceItems: (q: string) => api.get('/price-items/search?q=' + encodeURIComponent(q)),
  focusImport: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.upload('/stock/focus-import', fd);
  },
};

// ═══════════════════════════════════════════════════════════
//  VEHICULES
// ═══════════════════════════════════════════════════════════

export const vehiclesService = {
  list: (params?: Record<string, string>) => api.get('/vehicles?' + new URLSearchParams(params || {})),
  get: (id: string) => api.get('/vehicles/' + id),
  create: (data: any) => api.post('/vehicles', data),
  update: (id: string, data: any) => api.put('/vehicles/' + id, data),
  delete: (id: string) => api.delete('/vehicles/' + id),
  checkExpiries: (id: string) => api.get('/vehicles/' + id + '/expiry-badges'),
  createCheck: (id: string, data: any) => api.post('/vehicles/' + id + '/checks', data),
  listChecks: (id: string) => api.get('/vehicles/' + id + '/checks'),
  addDocument: (id: string, data: any) => api.post('/vehicles/' + id + '/documents', data),
  listEvents: (id: string, type?: string) => api.get('/vehicles/' + id + '/events' + (type ? '?type=' + type : '')),
  createEvent: (id: string, data: any) => api.post('/vehicles/' + id + '/events', data),
  updateEvent: (id: string, eventId: string, data: any) => api.put('/vehicles/' + id + '/events/' + eventId, data),
  vehicleCosts: (id: string) => api.get('/vehicles/' + id + '/costs'),
  fleetCosts: () => api.get('/vehicles/costs/fleet'),
};

// ═══════════════════════════════════════════════════════════
//  INCIDENTS
// ═══════════════════════════════════════════════════════════

export const incidentsService = {
  list: (params?: Record<string, string>) => api.get('/incidents?' + new URLSearchParams(params || {})),
  get: (id: string) => api.get('/incidents/' + id),
  create: (data: any) => api.post('/incidents', data),
  assign: (id: string, data: any) => api.put('/incidents/' + id + '/assign', data),
  updateStatus: (id: string, status: string) => api.put('/incidents/' + id + '/status', { status }),
  resolve: (id: string, data: any) => api.put('/incidents/' + id + '/resolve', data),
  close: (id: string) => api.put('/incidents/' + id + '/close'),
  exportRubrique: (rubrique: 'pbo' | 'poi' | 'chambre', from?: string, to?: string) =>
    api.getBlob('/incidents/export/' + rubrique + (from ? '?from=' + from : '') + (to ? '&to=' + to : '')),
  pboPreview: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.upload('/incidents/import/pbo-preview', fd);
  },
  pboConfirm: (rows: any[], fileName?: string) =>
    api.post('/incidents/import/pbo-confirm?fileName=' + encodeURIComponent(fileName ?? 'PBO.xlsx'), { rows }),
  generateSav: (id: string, mode: 'groupee' | 'individuelle', teamId?: string, dateMission?: string) =>
    api.post('/incidents/' + id + '/generate-sav', { mode, teamId, dateMission }),
  generateReport: (id: string) => api.postBlob('/incidents/' + id + '/report'),
};

// ═══════════════════════════════════════════════════════════
//  IA VISION
// ═══════════════════════════════════════════════════════════

export const iaVisionService = {
  analyze: (imageUrl: string, annotation?: string) => api.post('/ia-vision/analyze', { imageUrl, annotation }),
  listAnalyses: (params?: Record<string, string>) => api.get('/ia-vision/analyses?' + new URLSearchParams(params || {})),
  validate: (id: string, data: any) => api.put('/ia-vision/validate/' + id, data),
  listFeedback: (params?: Record<string, string>) => api.get('/ia-vision/feedback?' + new URLSearchParams(params || {})),
  processFeedback: () => api.post('/ia-vision/feedback/process'),
  retrain: () => api.post('/ia-vision/retrain'),
  upload: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.upload('/ia-vision/upload', fd);
  },
  listUploads: (verdict?: string) => api.get('/ia-vision/uploads' + (verdict ? '?verdict=' + verdict : '')),
  deleteUpload: (id: string) => api.delete('/ia-vision/uploads/' + id),
};

// ═══════════════════════════════════════════════════════════
//  FACTURATION
// ═══════════════════════════════════════════════════════════

export const invoicesService = {
  list: (params?: Record<string, string>) => api.get('/invoices?' + new URLSearchParams(params || {})),
  get: (id: string) => api.get('/invoices/' + id),
  preview: (id: string) => api.get('/invoices/' + id + '/preview'),
  generate: (periodStart: string, periodEnd: string) => api.post('/invoices/generate', { periodStart, periodEnd }),
  correct: (id: string, lines: any[]) => api.put('/invoices/' + id + '/correct', { lines }),
  finalize: (id: string, notes?: string) => api.post('/invoices/' + id + '/finalize', { notes }),
  exportPdf: (id: string) => api.postBlob("/invoices/" + id + "/export-pdf"),
  exportExcel: (id: string) => api.postBlob("/invoices/" + id + "/export-excel"),
  delete: (id: string) => api.delete('/invoices/' + id),
};

// ═══════════════════════════════════════════════════════════
//  KPI SONATEL
// ═══════════════════════════════════════════════════════════

export const kpiService = {
  dashboard: (period?: string) => api.get('/kpi-sonatel/dashboard' + (period ? '?period=' + period : '')),
  families: () => api.get('/kpi-sonatel/families'),
  tco: (period: string) => api.get('/kpi-sonatel/tco?period=' + period),
  putTco: (period: string, entries: Array<{ segment: string; amount: number; note?: string }>) =>
    api.put('/kpi-sonatel/tco?period=' + period, { entries }),
  masteryPlans: (period: string) => api.get('/kpi-sonatel/mastery-plans?period=' + period),
  putMasteryPlan: (period: string, data: { kpiName: string; analysis?: string; actions?: string; responsible?: string; dueDate?: string; status?: string }) =>
    api.put('/kpi-sonatel/mastery-plans?period=' + period, data),
  alerts: (resolved?: boolean) => api.get('/kpi-sonatel/alerts' + (resolved !== undefined ? '?resolved=' + resolved : '')),
  resolveAlert: (id: string) => api.post('/kpi-sonatel/alerts/' + id + '/resolve'),
  history: (from?: string, to?: string) => api.get('/kpi-sonatel/history' + (from ? '?from=' + from + '&to=' + (to || '') : '')),
  report: (period?: string) => api.get('/kpi-sonatel/report' + (period ? '?period=' + period : '')),
  recalculate: (period?: string) => api.post('/kpi-sonatel/recalculate' + (period ? '?period=' + period : '')),
  penalties: (period?: string) => api.get('/kpi-sonatel/penalties' + (period ? '?period=' + period : '')),
  applyPenalties: (period: string, invoiceId?: string) => api.post('/kpi-sonatel/penalties/apply?period=' + period + (invoiceId ? '&invoiceId=' + invoiceId : '')),
};

// ═══════════════════════════════════════════════════════════
//  RH
// ═══════════════════════════════════════════════════════════

export const dailyWorkersService = {
  list: (teamId?: string) => api.get('/daily-workers' + (teamId ? '?teamId=' + teamId : '')),
  create: (data: { fullName: string; teamId: string; phone?: string; dailyRate?: number }) => api.post('/daily-workers', data),
  update: (id: string, data: { dailyRate?: number; active?: boolean; phone?: string }) => api.put('/daily-workers/' + id, data),
  remove: (id: string) => api.delete('/daily-workers/' + id),
  clockIn: (workerIds: string[], day: string, missionId?: string) => api.post('/daily-attendance/clock-in', { workerIds, day, missionId }),
  timesheet: (from: string, to: string, teamId?: string) => api.get('/daily-attendance/timesheet?from=' + from + '&to=' + to + (teamId ? '&teamId=' + teamId : '')),
};

export const recruitmentService = {
  list: (status?: string) => api.get('/recruitment' + (status ? '?status=' + status : '')),
  create: (data: { fullName: string; position: string; phone?: string; email?: string; source?: string; notes?: string; interviewDate?: string }) =>
    api.post('/recruitment', data),
  update: (id: string, data: { status?: string; notes?: string; interviewDate?: string | null; testScore?: number | null; documentType?: string; documentName?: string; documentUrl?: string }) =>
    api.put('/recruitment/' + id, data),
  remove: (id: string) => api.delete('/recruitment/' + id),
};

export const hrService = {
  listEmployees: (params?: Record<string, string>) => api.get('/employees?' + new URLSearchParams(params || {})),
  createEmployee: (data: any) => api.post('/employees', data),
  updateEmployee: (id: string, data: any) => api.put('/employees/' + id, data),
  deleteEmployee: (id: string) => api.delete('/employees/' + id),
  listLeaves: (params?: Record<string, string>) => api.get('/leave-requests?' + new URLSearchParams(params || {})),
  createLeave: (data: any) => api.post('/leave-requests', data),
  approveLeave: (id: string) => api.put('/leave-requests/' + id + '/approve'),
  refuseLeave: (id: string) => api.put('/leave-requests/' + id + '/refuse'),
  listAttendance: (params?: Record<string, string>) => api.get('/attendance?' + new URLSearchParams(params || {})),
  saveAttendance: (data: any) => api.post('/attendance', data),
  validateAttendance: (id: string) => api.put('/attendance/' + id + '/validate'),
};

// ═══════════════════════════════════════════════════════════
//  COMPTABILITE
// ═══════════════════════════════════════════════════════════

export const accountingService = {
  listExpenses: (params?: Record<string, string>) => api.get('/expenses?' + new URLSearchParams(params || {})),
  createExpense: (data: any) => api.post('/expenses', data),
  updateExpense: (id: string, data: any) => api.put('/expenses/' + id, data),
  deleteExpense: (id: string) => api.delete('/expenses/' + id),
  summary: (month?: string) => api.get('/expenses/summary' + (month ? '?month=' + month : '')),
};

// ═══════════════════════════════════════════════════════════
//  CONFORMITE
// ═══════════════════════════════════════════════════════════

export const complianceService = {
  listChecklists: () => api.get('/compliance/checklists'),
  createChecklist: (data: any) => api.post('/compliance/checklists', data),
  updateChecklist: (id: string, items: any[]) => api.put('/compliance/checklists/' + id, { items }),
  deleteChecklist: (id: string) => api.delete('/compliance/checklists/' + id),
  listRecords: (params?: Record<string, string>) => api.get('/compliance/records?' + new URLSearchParams(params || {})),
  createRecord: (teamId: string) => api.post('/compliance/records', { teamId }),
  updateRecord: (id: string, data: any) => api.put('/compliance/records/' + id, data),
  listDocuments: () => api.get('/compliance/documents'),
  addDocument: (data: any) => api.post('/compliance/documents', data),
  updateDocument: (id: string, data: any) => api.put('/compliance/documents/' + id, data),
  removeDocument: (id: string) => api.delete('/compliance/documents/' + id),
  /** Alias — DELETE /compliance/documents/:id */
  deleteDocument: (id: string) => api.delete('/compliance/documents/' + id),
  updateHabilitation: (recordId: string, data: { habilitationDomains?: string[]; validationStep?: string }) =>
    api.put('/compliance/records/' + recordId + '/habilitation', data),
  contractSummary: () => api.get('/compliance/contract-summary'),
  exportValidation3stb: () => api.getBlob('/compliance/export-validation-3stb'),
};

// ═══════════════════════════════════════════════════════════
//  SAAS
// ═══════════════════════════════════════════════════════════

export const saasService = {
  getPlans: () => api.get('/saas/plans'),
  getAddons: () => api.get('/saas/addons'),
  activateAddon: (type: string) => api.post(`/saas/addons/${type}/activate`),
  deactivateAddon: (type: string) => api.post(`/saas/addons/${type}/deactivate`),
  getLimits: () => api.get('/saas/limits'),
  updateLimits: (data: any) => api.put('/saas/limits', data),
  getUsage: (month?: string) => api.get('/saas/usage' + (month ? '?month=' + month : '')),
  trackUsage: (type: string, amount: number) => api.post('/saas/usage/track', { type, amount }),
  assignLicense: (userId: string, planCode: string) => api.post('/saas/licenses/assign', { userId, planCode }),
  revokeLicense: (userId: string) => api.post('/saas/licenses/revoke', { userId }),
  listLicenses: () => api.get('/saas/licenses'),
  listInvoices: (params?: Record<string, string>) => api.get('/saas/invoices?' + new URLSearchParams(params || {})),
  generateInvoice: (periodStart: string, periodEnd: string) => api.post('/saas/invoices/generate', { periodStart, periodEnd }),
  payInvoice: (id: string, paymentMethod: string, reference?: string) => api.put(`/saas/invoices/${id}/pay`, { paymentMethod, reference }),
  cancelInvoice: (id: string) => api.put(`/saas/invoices/${id}/cancel`),
};

// ═══════════════════════════════════════════════════════════
//  MONITORING
// ═══════════════════════════════════════════════════════════

export const monitoringService = {
  getStatus: () => api.get('/monitoring/status'),
  getMetrics: (params?: Record<string, string>) => api.get('/monitoring/metrics?' + new URLSearchParams(params || {})),
  recordMetric: (metricType: string, value: number) => api.post('/monitoring/metrics', { metricType, value }),
  getAlerts: (resolved?: boolean) => api.get('/monitoring/alerts' + (resolved !== undefined ? '?resolved=' + resolved : '')),
  resolveAlert: (id: string) => api.post('/monitoring/alerts/' + id + '/resolve'),
  collect: () => api.post('/monitoring/collect'),
};

export const businessService = {
  dashboard: () => api.get('/business/dashboard'),
  mrr: (companyId?: string) => api.get('/business/mrr' + (companyId ? '?companyId=' + companyId : '')),
  arr: (companyId?: string) => api.get('/business/arr' + (companyId ? '?companyId=' + companyId : '')),
  churn: () => api.get('/business/churn'),
  nrr: () => api.get('/business/nrr'),
  arpu: () => api.get('/business/arpu'),
  ltv: () => api.get('/business/ltv'),
  cac: () => api.get('/business/cac'),
};

// ═══════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ═══════════════════════════════════════════════════════════

export const notificationsService = {
  list: (params?: Record<string, string>) => api.get('/notifications?' + new URLSearchParams(params || {})),
  unreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id: string) => api.put('/notifications/' + id + '/read'),
  markAllAsRead: () => api.put('/notifications/read-all'),
  getSettings: () => api.get('/notifications/settings'),
  updateSettings: (data: any) => api.put('/notifications/settings', data),
  test: (channel: string, title?: string, body?: string) => api.post('/notifications/test', { channel, title, body }),
};

// ═══════════════════════════════════════════════════════════
//  TENANTS (Console)
// ═══════════════════════════════════════════════════════════

export const tenantsService = {
  list: () => api.get('/tenants'),
  create: (data: any) => api.post('/tenants', data),
  setActive: (id: string, active: boolean) => api.patch(`/tenants/${id}/active`, { active }),
  setSubscriptionStatus: (id: string, status: string) => api.patch(`/tenants/${id}/subscription-status`, { status }),
};

// ═══════════════════════════════════════════════════════════
//  RAG
// ═══════════════════════════════════════════════════════════

export const ragService = {
  ask: (question: string, conversationId?: string) => api.post('/rag/ask', { question, conversationId }),
  listConversations: () => api.get('/rag/conversations'),
  getConversation: (id: string) => api.get('/rag/conversations/' + id),
  deleteConversation: (id: string) => api.delete('/rag/conversations/' + id),
  listDocuments: () => api.get('/rag/documents'),
  ingestDocument: (data: { title: string; category: string; content: string; fileName?: string }) =>
    api.post('/rag/documents', data),
  deleteDocument: (id: string) => api.delete('/rag/documents/' + id),
  search: (q: string) => api.get('/rag/search?q=' + encodeURIComponent(q)),
};

// ═══════════════════════════════════════════════════════════
//  GÉOLOCALISATION (option payante 5 000 FCFA/mois)
// ═══════════════════════════════════════════════════════════

export const geolocationService = {
  status: () => api.get('/geolocation/status'),
  live: () => api.get('/geolocation/live'),
  alerts: () => api.get('/geolocation/alerts'),
  history: (technicianId: string, from?: string, to?: string) =>
    api.get('/geolocation/history?technicianId=' + technicianId + (from ? '&from=' + from : '') + (to ? '&to=' + to : '')),
  record: (data: { technicianId: string; latitude: number; longitude: number; missionId?: string; source?: string; batteryPct?: number; speedKmh?: number }) =>
    api.post('/geolocation/positions', data),
  listZones: () => api.get('/geolocation/zones'),
  createZone: (data: { name: string; type: string; centerLatitude: number; centerLongitude: number; radiusM?: number; note?: string }) =>
    api.post('/geolocation/zones', data),
  updateZone: (id: string, data: { name: string; type: string; centerLatitude: number; centerLongitude: number; radiusM?: number; note?: string }) =>
    api.put('/geolocation/zones/' + id, data),
  deleteZone: (id: string) => api.delete('/geolocation/zones/' + id),
};

// ═══════════════════════════════════════════════════════════
//  AI AGENTS
// ═══════════════════════════════════════════════════════════

export const aiService = {
  transcribe: (audioUrl: string) => api.post('/ai/terrain/transcribe', { audioUrl }),
  report: (transcription: string, missionId?: string) => api.post('/ai/terrain/report', { transcription, missionId }),
  suggestAssignment: (missionId: string) => api.post('/ai/planning/suggest/' + missionId),
  suggestAll: () => api.post('/ai/planning/suggest-all'),
  stockAnomalies: () => api.post('/ai/stock/anomalies'),
  stockRuptures: () => api.post('/ai/stock/ruptures'),
  optimizeTour: (date: string) => api.post('/ai/optimisation/tour?date=' + date),
  photoAudit: (photoUrl: string) => api.post('/ai/photo-audit', { photoUrl }),
  extractReceipt: (photoUrl: string) => api.post('/ai/receipt', { photoUrl }),
  voiceCommand: (command: string) => api.post('/ai/voice-command', { command }),
};

// ═══════════════════════════════════════════════════════════
//  TEAMS / TECHNICIANS
// ═══════════════════════════════════════════════════════════

export const teamsService = {
  list: (params?: Record<string, string>) => api.get('/teams?' + new URLSearchParams(params || {})),
  create: (data: any) => api.post('/teams', data),
  update: (id: string, data: any) => api.put('/teams/' + id, data),
  delete: (id: string) => api.delete('/teams/' + id),
};

export const techniciansService = {
  list: (params?: Record<string, string>) => api.get('/technicians?' + new URLSearchParams(params || {})),
  create: (data: any) => api.post('/technicians', data),
  update: (id: string, data: any) => api.put('/technicians/' + id, data),
  delete: (id: string) => api.delete('/technicians/' + id),
  byTeam: (teamId: string) => api.get('/technicians/by-team/' + teamId),
  leaders: () => api.get('/technicians/leaders'),
};

// ═══════════════════════════════════════════════════════════
//  REPORTS
// ═══════════════════════════════════════════════════════════

export const reportsService = {
  performance: (startDate: string, endDate: string) => api.get(`/reports/performance?startDate=${startDate}&endDate=${endDate}`),
  olt: (startDate: string, endDate: string) => api.get(`/reports/olt?startDate=${startDate}&endDate=${endDate}`),
  stockVehicles: (startDate: string, endDate: string) => api.get(`/reports/stock-vehicles?startDate=${startDate}&endDate=${endDate}`),
  kpi: (month: string) => api.get(`/reports/kpi?month=${month}`),
  incidents: (startDate: string, endDate: string) => api.get(`/reports/incidents?startDate=${startDate}&endDate=${endDate}`),
  exportPdf: (report: string, params: any) => api.postBlob('/reports/export-pdf', { report, ...params }),
  exportExcel: (report: string, params: any) => api.postBlob('/reports/export-excel', { report, ...params }),
};
