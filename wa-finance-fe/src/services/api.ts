import {
  AppConfig,
  TransactionQuery,
  AuditQuery,
  Transaction,
  TransactionListResponse,
  AuditLog,
  AuditLogListResponse,
  DashboardSummary,
  TimeSeries,
  BreakdownByCategory,
  BreakdownByMerchant,
  BudgetStatus,
  CreateTransactionInput,
  UpdateTransactionInput,
} from '../types';

async function apiGet<T>(cfg: AppConfig, path: string, params: Record<string, string | number | boolean | undefined | null> = {}): Promise<T> {
  const url = new URL(`${cfg.baseUrl}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    url.searchParams.set(k, String(v));
  });

  const res = await fetch(url.toString(), {
    headers: { authorization: `Bearer ${cfg.sessionToken}` },
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const message = json?.error || json?.message || `HTTP ${res.status}`;
    throw new Error(message);
  }
  if (json && typeof json === 'object' && 'ok' in json) {
    if (!json.ok) throw new Error(json.error || 'error');
    return json.data as T;
  }
  return json as T;
}

async function apiPost<T>(cfg: AppConfig, path: string, body: any): Promise<T> {
  const url = new URL(`${cfg.baseUrl}${path}`);
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${cfg.sessionToken}`,
    },
    body: JSON.stringify(body || {}),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const message = json?.error || json?.message || `HTTP ${res.status}`;
    throw new Error(message);
  }
  if (json && typeof json === 'object' && 'ok' in json) {
    if (!json.ok) throw new Error(json.error || 'error');
    return json.data as T;
  }
  return json as T;
}

async function apiPut<T>(cfg: AppConfig, path: string, body: any): Promise<T> {
  const url = new URL(`${cfg.baseUrl}${path}`);
  const res = await fetch(url.toString(), {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${cfg.sessionToken}`,
    },
    body: JSON.stringify(body || {}),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const message = json?.error || json?.message || `HTTP ${res.status}`;
    throw new Error(message);
  }
  if (json && typeof json === 'object' && 'ok' in json) {
    if (!json.ok) throw new Error(json.error || 'error');
    return json.data as T;
  }
  return json as T;
}

async function apiDelete<T>(cfg: AppConfig, path: string): Promise<T> {
  const url = new URL(`${cfg.baseUrl}${path}`);
  const res = await fetch(url.toString(), {
    method: 'DELETE',
    headers: {
      authorization: `Bearer ${cfg.sessionToken}`,
    },
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const message = json?.error || json?.message || `HTTP ${res.status}`;
    throw new Error(message);
  }
  if (json && typeof json === 'object' && 'ok' in json) {
    if (!json.ok) throw new Error(json.error || 'error');
    return json.data as T;
  }
  return json as T;
}

export class ApiService {
  constructor(private cfg: AppConfig) {}

  // Dashboard
  async getSummary(start: string, end: string) {
    return apiGet<DashboardSummary>(this.cfg, '/api/dashboard/summary', {
      start,
      end,
      currency: this.cfg.currency,
    });
  }

  async getTimeseries(start: string, end: string, bucket: string = 'day') {
    return apiGet<TimeSeries>(this.cfg, '/api/dashboard/timeseries', {
      start,
      end,
      bucket,
      currency: this.cfg.currency,
    });
  }

  async getByCategory(start: string, end: string, type: string = 'OUT', limit: number = 10) {
    return apiGet<BreakdownByCategory>(this.cfg, '/api/dashboard/by-category', {
      start,
      end,
      type,
      limit,
      currency: this.cfg.currency,
    });
  }

  async getByMerchant(start: string, end: string, type: string = 'OUT', limit: number = 10) {
    return apiGet<BreakdownByMerchant>(this.cfg, '/api/dashboard/by-merchant', {
      start,
      end,
      type,
      limit,
      currency: this.cfg.currency,
    });
  }

  async getBudgetStatus(month: string) {
    return apiGet<BudgetStatus>(this.cfg, '/api/dashboard/budget-status', {
      month,
      currency: this.cfg.currency,
    });
  }

  async getCategories() {
    return apiGet<{ categories: string[] }>(this.cfg, '/api/dashboard/categories');
  }

  async getMerchants() {
    return apiGet<{ merchants: string[] }>(this.cfg, '/api/dashboard/merchants');
  }

  // Transactions
  async getTransactions(params: TransactionQuery = {}) {
    const queryParams: Record<string, string | number | boolean | undefined | null> = {
      currency: this.cfg.currency,
    };
    if (params.start) queryParams.start = params.start;
    if (params.end) queryParams.end = params.end;
    if (params.type) queryParams.type = params.type;
    if (params.category) queryParams.category = params.category;
    if (params.merchant) queryParams.merchant = params.merchant;
    if (params.q) queryParams.q = params.q;
    if (params.limit) queryParams.limit = params.limit;
    if (params.offset) queryParams.offset = params.offset;
    if (params.includeItems) queryParams.includeItems = params.includeItems;

    return apiGet<TransactionListResponse>(this.cfg, '/api/transactions', queryParams);
  }

  async getTransaction(id: number) {
    return apiGet<Transaction>(this.cfg, `/api/transactions/${id}`, {
      currency: this.cfg.currency,
    });
  }

  async createTransaction(data: CreateTransactionInput) {
    return apiPost<{ id: number }>(this.cfg, '/api/transactions', data);
  }

  async updateTransaction(id: number, data: UpdateTransactionInput) {
    return apiPut<{ id: number }>(this.cfg, `/api/transactions/${id}`, data);
  }

  async deleteTransaction(id: number) {
    return apiDelete<{ deleted: boolean; originalId: number }>(this.cfg, `/api/transactions/${id}`);
  }

  // Audit
  async getAuditLogs(params: AuditQuery = {}) {
    const queryParams: Record<string, string | number | undefined | null> = {};
    if (params.start) queryParams.start = params.start;
    if (params.end) queryParams.end = params.end;
    if (params.action) queryParams.action = params.action;
    if (params.limit) queryParams.limit = params.limit;
    if (params.offset) queryParams.offset = params.offset;

    return apiGet<AuditLogListResponse>(this.cfg, '/api/audit', queryParams);
  }
}
