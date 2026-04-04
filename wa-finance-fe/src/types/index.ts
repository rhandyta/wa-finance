export type TransactionType = 'IN' | 'OUT';

export type TransactionItem = {
  id?: number;
  transaction_id?: number;
  item_name: string;
  quantity: number;
  price: number;
};

export type Transaction = {
  id: number;
  transaction_date: string;
  type: TransactionType;
  amount: number;
  currency: string;
  category: string;
  merchant: string | null;
  description: string | null;
  receipt_path: string | null;
  items?: TransactionItem[];
};

export type TransactionListResponse = {
  total: number;
  limit: number;
  offset: number;
  rows: Transaction[];
};

export type AuditLog = {
  id: number;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  detail_json: any;
  created_at: string;
};

export type AuditLogListResponse = {
  total: number;
  limit: number;
  offset: number;
  rows: AuditLog[];
};

export type TransactionQuery = {
  start?: string;
  end?: string;
  type?: TransactionType;
  category?: string;
  merchant?: string;
  q?: string;
  limit?: number;
  offset?: number;
  includeItems?: boolean;
  currency?: string;
};

export type AuditQuery = {
  start?: string;
  end?: string;
  action?: string;
  limit?: number;
  offset?: number;
};

export type DashboardSummary = {
  startDate: string;
  endDate: string;
  currency: string;
  totalIn: number;
  totalOut: number;
  net: number;
  savingRate: number | null;
};

export type TimeSeriesPoint = {
  key: string;
  in: number;
  out: number;
  net: number;
};

export type TimeSeries = {
  startDate: string;
  endDate: string;
  bucket: string;
  currency: string;
  series: TimeSeriesPoint[];
};

export type BreakdownItem = {
  type: 'IN' | 'OUT';
  category?: string;
  merchant?: string;
  total: number;
};

export type BreakdownByCategory = {
  startDate: string;
  endDate: string;
  currency: string;
  items: BreakdownItem[];
};

export type BreakdownByMerchant = {
  startDate: string;
  endDate: string;
  currency: string;
  items: BreakdownItem[];
};

export type BudgetItem = {
  category: string;
  limit: number;
  spent: number;
  pct: number | null;
  status: 'unknown' | 'ok' | 'warn' | 'over';
};

export type BudgetStatus = {
  monthKey: string;
  startDate: string;
  endDate: string;
  currency: string;
  items: BudgetItem[];
};

export type CreateTransactionInput = {
  transaction_date: string;
  type: TransactionType;
  amount: number;
  currency?: string;
  category: string;
  merchant?: string | null;
  description?: string | null;
  items?: TransactionItem[];
};

export type UpdateTransactionInput = Partial<CreateTransactionInput> & {
  items?: TransactionItem[] | null;
};

export type AppConfig = {
  baseUrl: string;
  sessionToken: string;
  currency: string;
  phone: string;
  token: string;
};
