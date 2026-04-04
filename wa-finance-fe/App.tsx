import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// Types
type AppConfig = {
  baseUrl: string;
  sessionToken: string;
  currency: string;
  phone: string;
  token: string;
};

type DashboardSummary = {
  startDate: string;
  endDate: string;
  currency: string;
  totalIn: number;
  totalOut: number;
  net: number;
  savingRate: number | null;
};

type TimeSeries = {
  startDate: string;
  endDate: string;
  bucket: string;
  currency: string;
  series: Array<{ key: string; in: number; out: number; net: number }>;
};

type BreakdownByCategory = {
  startDate: string;
  endDate: string;
  currency: string;
  items: Array<{ type: 'IN' | 'OUT'; category: string; total: number }>;
};

type BreakdownByMerchant = {
  startDate: string;
  endDate: string;
  currency: string;
  items: Array<{ type: 'IN' | 'OUT'; merchant: string; total: number }>;
};

type BudgetStatus = {
  monthKey: string;
  startDate: string;
  endDate: string;
  currency: string;
  items: Array<{
    category: string;
    limit: number;
    spent: number;
    pct: number | null;
    status: 'unknown' | 'ok' | 'warn' | 'over';
  }>;
};

type DashboardData = {
  summary: DashboardSummary;
  timeseries: TimeSeries;
  byCategoryOut: BreakdownByCategory;
  byMerchantOut: BreakdownByMerchant;
  budgetStatus: BudgetStatus;
};

type Transaction = {
  id: number;
  transaction_date: string;
  type: 'IN' | 'OUT';
  amount: number;
  currency: string;
  category: string;
  merchant: string | null;
  description: string | null;
  receipt_path: string | null;
  items?: Array<{ item_name: string; quantity: number; price: number }>;
};

type AuditLog = {
  id: number;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  detail_json: any;
  created_at: string;
};

// Navigation types
type ScreenName =
  | 'login'
  | 'dashboard'
  | 'transactions'
  | 'transactionDetail'
  | 'addTransaction'
  | 'editTransaction'
  | 'charts'
  | 'audit';

type NavigationState = {
  screen: ScreenName;
  params?: Record<string, any>;
};

const CONFIG_KEY = 'wa_finance_config_v2';

function normalizeBaseUrl(input: string) {
  const trimmed = input.trim().replace(/\/+$/, '');
  return trimmed;
}

function formatDateYyyyMmDd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function monthKeyFromDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

function toCurrency(n: number, currency: string) {
  try {
    const formatter = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    });
    return formatter.format(n);
  } catch {
    return `${currency} ${Math.round(n).toLocaleString('id-ID')}`;
  }
}

function formatDateDisplay(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTimeDisplay(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTypeColor(type: 'IN' | 'OUT') {
  return type === 'IN' ? '#4ade80' : '#f87171';
}

function getTypeLabel(type: 'IN' | 'OUT') {
  return type === 'IN' ? 'Pemasukan' : 'Pengeluaran';
}

function getAuditActionLabel(action: string) {
  const labels: Record<string, string> = {
    transaction_create_api: 'Membuat transaksi',
    transaction_update_api: 'Mengubah transaksi',
    transaction_delete_api: 'Menghapus transaksi',
    transaction_delete_last: 'Menghapus transaksi terakhir',
    transaction_restore_last: 'Memulihkan transaksi',
    category_add: 'Menambah kategori',
    merchant_rule_upsert: 'Mengubah aturan merchant',
  };
  return labels[action] || action;
}

async function getStoredString(key: string) {
  if (Platform.OS === 'web') {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

async function setStoredString(key: string, value: string) {
  if (Platform.OS === 'web') {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteStoredString(key: string) {
  if (Platform.OS === 'web') {
    try {
      window.localStorage.removeItem(key);
    } catch {}
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

async function loadConfig(): Promise<AppConfig | null> {
  const raw = await getStoredString(CONFIG_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    const baseUrl = typeof parsed.baseUrl === 'string' ? normalizeBaseUrl(parsed.baseUrl) : '';
    const sessionToken = typeof parsed.sessionToken === 'string' ? parsed.sessionToken : '';
    const currency = typeof parsed.currency === 'string' ? parsed.currency : 'IDR';
    const phone = typeof parsed.phone === 'string' ? parsed.phone : '';
    const token = typeof parsed.token === 'string' ? parsed.token : '';
    if (!baseUrl || !sessionToken) return null;
    return { baseUrl, sessionToken, currency, phone, token };
  } catch {
    return null;
  }
}

async function saveConfig(cfg: AppConfig) {
  await setStoredString(CONFIG_KEY, JSON.stringify(cfg));
}

async function clearConfig() {
  await deleteStoredString(CONFIG_KEY);
}

async function apiGet<T>(
  cfg: AppConfig,
  path: string,
  params: Record<string, string | number | boolean | undefined | null> = {},
) {
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

async function apiPost<T>(cfg: AppConfig, path: string, body: any) {
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

async function apiPut<T>(cfg: AppConfig, path: string, body: any) {
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

async function apiDelete<T>(cfg: AppConfig, path: string) {
  const url = new URL(`${cfg.baseUrl}${path}`);
  const res = await fetch(url.toString(), {
    method: 'DELETE',
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

async function apiPostPublic<T>(baseUrl: string, path: string, body: any) {
  const url = new URL(`${normalizeBaseUrl(baseUrl)}${path}`);
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
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

async function fetchDashboard(cfg: AppConfig, startDate: string, endDate: string, budgetMonthKey: string) {
  const common = {
    start: startDate,
    end: endDate,
    currency: cfg.currency,
  };
  const [summary, timeseries, byCategoryOut, byMerchantOut, budgetStatus] = await Promise.all([
    apiGet<DashboardSummary>(cfg, '/api/dashboard/summary', common),
    apiGet<TimeSeries>(cfg, '/api/dashboard/timeseries', { ...common, bucket: 'day' }),
    apiGet<BreakdownByCategory>(cfg, '/api/dashboard/by-category', { ...common, type: 'OUT', limit: 10 }),
    apiGet<BreakdownByMerchant>(cfg, '/api/dashboard/by-merchant', { ...common, type: 'OUT', limit: 10 }),
    apiGet<BudgetStatus>(cfg, '/api/dashboard/budget-status', {
      month: budgetMonthKey,
      currency: cfg.currency,
    }),
  ]);
  return { summary, timeseries, byCategoryOut, byMerchantOut, budgetStatus } satisfies DashboardData;
}

// Shared styles
const sharedStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1020',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
  },
  muted: {
    color: '#b7c0d6',
  },
  card: {
    backgroundColor: '#111a34',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1d2a52',
  },
  label: {
    color: '#b7c0d6',
    fontSize: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0b1020',
    color: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1d2a52',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#0b1020',
    borderWidth: 1,
    borderColor: '#1d2a52',
  },
  chipText: {
    color: '#d8def0',
    fontSize: 12,
  },
});

export default function App() {
  const [booting, setBooting] = useState(true);
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await loadConfig();
      if (cancelled) return;
      setConfig(loaded);
      setBooting(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (booting) {
    return (
      <SafeAreaView style={sharedStyles.container}>
        <View style={sharedStyles.centered}>
          <ActivityIndicator />
          <Text style={sharedStyles.muted}>Memuat…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!config) {
    return (
      <SafeAreaView style={sharedStyles.container}>
        <LoginScreen
          onLogin={async (cfg) => {
            await saveConfig(cfg);
            setConfig(cfg);
          }}
        />
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={sharedStyles.container}>
      <MainApp config={config} onLogout={async () => { await clearConfig(); setConfig(null); }} />
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

function MainApp({ config, onLogout }: { config: AppConfig; onLogout: () => Promise<void> }) {
  const [navigation, setNavigation] = useState<NavigationState>({ screen: 'dashboard' });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'charts' | 'audit'>('dashboard');

  const navigate = (screen: ScreenName, params?: Record<string, any>) => {
    setNavigation({ screen, params });
    if (['dashboard', 'transactions', 'charts', 'audit'].includes(screen as any)) {
      setActiveTab(screen as any);
    }
  };

  const goBack = () => {
    setNavigation({ screen: activeTab === 'dashboard' ? 'dashboard' : activeTab });
  };

  const renderScreen = () => {
    switch (navigation.screen) {
      case 'dashboard':
        return <DashboardScreen config={config} onLogout={onLogout} onNavigate={navigate} />;
      case 'transactions':
        return <TransactionListScreen config={config} onTransactionPress={(tx: Transaction) => navigate('transactionDetail', { id: tx.id })} />;
      case 'transactionDetail':
        return (
          <TransactionDetailScreen
            config={config}
            transactionId={navigation.params?.id}
            onBack={goBack}
            onEdit={() => navigate('editTransaction', { id: navigation.params?.id })}
            onDelete={goBack}
          />
        );
      case 'addTransaction':
        return (
          <AddEditTransactionScreen
            config={config}
            onSave={goBack}
            onCancel={goBack}
          />
        );
      case 'editTransaction':
        return (
          <EditTransactionScreen
            config={config}
            transactionId={navigation.params?.id}
            onSave={goBack}
            onCancel={goBack}
          />
        );
      case 'charts':
        return <ChartScreen config={config} />;
      case 'audit':
        return <AuditLogScreen config={config} />;
      default:
        return <DashboardScreen config={config} onLogout={onLogout} onNavigate={navigate} />;
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {renderScreen()}
      <BottomTabs activeTab={activeTab} onTabPress={(tab) => { setActiveTab(tab); navigate(tab); }} onAddPress={() => navigate('addTransaction')} />
    </View>
  );
}

function BottomTabs({ activeTab, onTabPress, onAddPress }: { activeTab: string; onTabPress: (tab: 'dashboard' | 'transactions' | 'charts' | 'audit') => void; onAddPress: () => void }) {
  const tabs = [
    { key: 'dashboard', icon: '📊', label: 'Dash' },
    { key: 'transactions', icon: '💳', label: 'Trans' },
    { key: 'add', icon: '➕', label: '' },
    { key: 'charts', icon: '📈', label: 'Chart' },
    { key: 'audit', icon: '📋', label: 'Audit' },
  ];

  return (
    <View style={bottomTabStyles.container}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[
            bottomTabStyles.tab,
            tab.key === 'add' && bottomTabStyles.addTab,
            activeTab === tab.key && bottomTabStyles.tabActive,
          ]}
          onPress={() => {
            if (tab.key === 'add') onAddPress();
            else onTabPress(tab.key as any);
          }}
        >
          <Text style={bottomTabStyles.icon}>{tab.icon}</Text>
          {tab.label && <Text style={bottomTabStyles.label}>{tab.label}</Text>}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const bottomTabStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#111a34',
    borderTopWidth: 1,
    borderTopColor: '#1d2a52',
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  tabActive: {
    backgroundColor: '#1d2a52',
  },
  addTab: {
    backgroundColor: '#6070a4',
    borderRadius: 24,
    marginVertical: -12,
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignSelf: 'center',
  },
  icon: {
    fontSize: 20,
  },
  label: {
    color: '#b7c0d6',
    fontSize: 10,
    marginTop: 2,
  },
});

// Login Screen
function LoginScreen({ onLogin }: { onLogin: (cfg: AppConfig) => Promise<void> }) {
  const defaultBaseUrl = (() => {
    const fromEnv = process.env.EXPO_PUBLIC_BASE_URL;
    if (fromEnv && fromEnv.trim()) return fromEnv.trim();
    if (Platform.OS === 'web') {
      try {
        return window.location.origin;
      } catch {
        return 'http://localhost:3000';
      }
    }
    return 'http://localhost:3000';
  })();
  const baseUrl = normalizeBaseUrl(defaultBaseUrl);
  const [phone, setPhone] = useState('');
  const [token, setToken] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const canSendOtp = !sendingOtp && !verifying && !!phone.trim() && !!token.trim();
  const canVerify = !sendingOtp && !verifying && !!phone.trim() && !!token.trim() && /^\d{6}$/.test(otp.trim());

  return (
    <ScrollView contentContainerStyle={{ padding: 18, gap: 12 }}>
      <Text style={sharedStyles.title}>wa-finance-fe</Text>
      <Text style={sharedStyles.muted}>Masuk untuk mengambil data dashboard dari wa-finance-be.</Text>

      <View style={sharedStyles.card}>
        <Text style={sharedStyles.label}>Nomor HP WhatsApp</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={Platform.OS === 'ios' ? 'phone-pad' : 'phone-pad'}
          placeholder="contoh: 081234567890"
          placeholderTextColor="#6070a4"
          style={sharedStyles.input}
        />

        <View style={{ height: 12 }} />

        <Text style={sharedStyles.label}>Token Akun</Text>
        <TextInput
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          placeholder="token dari WhatsApp bot"
          placeholderTextColor="#6070a4"
          style={sharedStyles.input}
        />

        <View style={{ height: 14 }} />

        <Button
          title={sendingOtp ? 'Mengirim…' : 'Kirim OTP WhatsApp'}
          disabled={!canSendOtp}
          onPress={async () => {
            if (!baseUrl) { Alert.alert('Konfigurasi', 'Base URL belum tersedia.'); return; }
            if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) { Alert.alert('Konfigurasi', 'Base URL tidak valid.'); return; }
            if (!phone.trim()) { Alert.alert('Validasi', 'Nomor HP wajib diisi.'); return; }
            if (!token.trim()) { Alert.alert('Validasi', 'Token wajib diisi.'); return; }
            setSendingOtp(true);
            try {
              await apiPostPublic<{ sent: true }>(baseUrl, '/api/auth/request-otp', { phone: phone.trim(), token: token.trim() });
              setOtpSent(true);
              Alert.alert('OTP terkirim', 'Cek WhatsApp kamu untuk kode OTP.');
            } catch (e: any) {
              Alert.alert('Gagal kirim OTP', e?.message || 'Gagal');
            } finally {
              setSendingOtp(false);
            }
          }}
        />

        <View style={{ height: 12 }} />

        <Text style={sharedStyles.label}>Kode OTP</Text>
        <TextInput
          value={otp}
          onChangeText={setOtp}
          keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
          placeholder="6 digit"
          placeholderTextColor="#6070a4"
          style={sharedStyles.input}
        />

        <View style={{ height: 14 }} />

        <Button
          title={verifying ? 'Memproses…' : 'Verifikasi & Masuk'}
          disabled={!canVerify}
          onPress={async () => {
            if (!baseUrl) { Alert.alert('Konfigurasi', 'Base URL belum tersedia.'); return; }
            if (!phone.trim()) { Alert.alert('Validasi', 'Nomor HP wajib diisi.'); return; }
            if (!token.trim()) { Alert.alert('Validasi', 'Token wajib diisi.'); return; }
            if (!/^\d{6}$/.test(otp.trim())) { Alert.alert('Validasi', 'OTP harus 6 digit.'); return; }
            if (!otpSent) { Alert.alert('Validasi', 'Klik "Kirim OTP WhatsApp" dulu.'); return; }

            setVerifying(true);
            try {
              const result = await apiPostPublic<{ sessionToken: string; currency: string }>(baseUrl, '/api/auth/verify-otp', { phone: phone.trim(), token: token.trim(), otp: otp.trim() });
              const cfg: AppConfig = { baseUrl, sessionToken: result.sessionToken, currency: (result.currency || 'IDR').toUpperCase(), phone: phone.trim(), token: token.trim() };
              const today = new Date();
              const start = new Date(today.getFullYear(), today.getMonth(), 1);
              await apiGet<DashboardSummary>(cfg, '/api/dashboard/summary', { start: formatDateYyyyMmDd(start), end: formatDateYyyyMmDd(today), currency: cfg.currency });
              await onLogin(cfg);
            } catch (e: any) {
              Alert.alert('Gagal login', e?.message || 'Gagal');
            } finally {
              setVerifying(false);
            }
          }}
        />
      </View>

      <View style={sharedStyles.card}>
        <Text style={sharedStyles.label}>Catatan</Text>
        <Text style={sharedStyles.muted}>OTP dikirim lewat WhatsApp dari bot. Pastikan bot sudah login (QR sudah discan) di server.</Text>
      </View>
    </ScrollView>
  );
}

// Dashboard Screen
function DashboardScreen({ config, onLogout, onNavigate }: { config: AppConfig; onLogout: () => Promise<void>; onNavigate: (screen: ScreenName, params?: Record<string, any>) => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);

  const computeRange = () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { startDate: formatDateYyyyMmDd(start), endDate: formatDateYyyyMmDd(today), monthKey: monthKeyFromDate(today) };
  };

  const [range, setRange] = useState(computeRange);
  const [budgetMonthOffset, setBudgetMonthOffset] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const nextRange = computeRange();
    setRange(nextRange);
    const bDate = new Date();
    const targetMonth = bDate.getMonth() + budgetMonthOffset;
    const bMonthKey = monthKeyFromDate(new Date(bDate.getFullYear(), targetMonth, 1));

    try {
      const dashboard = await fetchDashboard(config, nextRange.startDate, nextRange.endDate, bMonthKey);
      setData(dashboard);
    } catch (e: any) {
      setData(null);
      setError(e?.message || 'Gagal mengambil data');
    } finally {
      setLoading(false);
    }
  }, [config, budgetMonthOffset]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <ScrollView contentContainerStyle={{ padding: 18, gap: 12 }}>
      <View style={sharedStyles.row}>
        <View style={{ flex: 1 }}>
          <Text style={sharedStyles.title}>Dashboard</Text>
          <Text style={sharedStyles.muted}>{config.phone} • {range.startDate} s/d {range.endDate} • {config.currency}</Text>
        </View>
        <View style={sharedStyles.row}>
          <Button title="Refresh" onPress={() => refresh()} />
          <Button title="Keluar" color={Platform.OS === 'ios' ? undefined : '#9b1c1c'} onPress={onLogout} />
        </View>
      </View>

      {loading ? (
        <View style={sharedStyles.card}>
          <View style={sharedStyles.row}>
            <ActivityIndicator />
            <Text style={sharedStyles.muted}>Mengambil data…</Text>
          </View>
        </View>
      ) : error ? (
        <View style={sharedStyles.card}>
          <Text style={[sharedStyles.muted, { color: '#ffb4b4' }]}>{error}</Text>
        </View>
      ) : null}

      {data ? (
        <>
          <SummaryCard summary={data.summary} currency={config.currency} />
          <TopListCard title="Top Kategori (Pengeluaran)" items={data.byCategoryOut.items.map((x) => ({ label: x.category, value: x.total }))} currency={config.currency} />
          <TopListCard title="Top Merchant (Pengeluaran)" items={data.byMerchantOut.items.map((x) => ({ label: x.merchant, value: x.total }))} currency={config.currency} />
          <BudgetCard budget={data.budgetStatus} currency={config.currency} onPrevMonth={() => setBudgetMonthOffset((p) => p - 1)} onNextMonth={() => setBudgetMonthOffset((p) => p + 1)} />
        </>
      ) : null}
    </ScrollView>
  );
}

function SummaryCard({ summary, currency }: { summary: DashboardSummary; currency: string }) {
  const savingRateText = summary.savingRate === null ? '—' : `${Math.round(summary.savingRate * 100)}%`;
  return (
    <View style={sharedStyles.card}>
      <Text style={sharedStyles.label}>Ringkasan</Text>
      <View style={{ height: 8 }} />
      <View style={sharedStyles.row}>
        <View style={{ flex: 1 }}>
          <Text style={sharedStyles.muted}>Pemasukan</Text>
          <Text style={sharedStyles.title}>{toCurrency(summary.totalIn, currency)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={sharedStyles.muted}>Pengeluaran</Text>
          <Text style={sharedStyles.title}>{toCurrency(summary.totalOut, currency)}</Text>
        </View>
      </View>
      <View style={{ height: 12 }} />
      <View style={sharedStyles.row}>
        <View style={{ flex: 1 }}>
          <Text style={sharedStyles.muted}>Net</Text>
          <Text style={sharedStyles.title}>{toCurrency(summary.net, currency)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={sharedStyles.muted}>Saving Rate</Text>
          <View style={[sharedStyles.chip, { alignSelf: 'flex-start' }]}>
            <Text style={sharedStyles.chipText}>{savingRateText}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function TopListCard({ title, items, currency }: { title: string; items: Array<{ label: string; value: number }>; currency: string }) {
  return (
    <View style={sharedStyles.card}>
      <Text style={sharedStyles.label}>{title}</Text>
      <View style={{ height: 6 }} />
      {items.length === 0 ? <Text style={sharedStyles.muted}>Tidak ada data.</Text> : null}
      {items.map((it, idx) => (
        <View key={`${it.label}-${idx}`} style={[sharedStyles.row, { justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: idx ? 1 : 0, borderTopColor: '#1d2a52' }]}>
          <Text style={{ color: '#ffffff', flex: 1, paddingRight: 8 }} numberOfLines={1}>{it.label}</Text>
          <Text style={{ color: '#d8def0', fontVariant: ['tabular-nums'] as any }}>{toCurrency(it.value, currency)}</Text>
        </View>
      ))}
    </View>
  );
}

function BudgetCard({ budget, currency, onPrevMonth, onNextMonth }: { budget: BudgetStatus; currency: string; onPrevMonth: () => void; onNextMonth: () => void }) {
  const shown = budget.items.filter((x) => x.limit > 0 || x.spent > 0).slice().sort((a, b) => (b.pct || 0) - (a.pct || 0)).slice(0, 10);
  return (
    <View style={sharedStyles.card}>
      <View style={[sharedStyles.row, { justifyContent: 'space-between', marginBottom: 8 }]}>
        <Text style={sharedStyles.label}>Budget ({budget.monthKey})</Text>
        <View style={sharedStyles.row}>
          <View style={{ width: 80 }}><Button title="< Prev" onPress={onPrevMonth} color="#6070a4" /></View>
          <View style={{ width: 80 }}><Button title="Next >" onPress={onNextMonth} color="#6070a4" /></View>
        </View>
      </View>
      {shown.length === 0 ? <Text style={[sharedStyles.muted, { marginTop: 8 }]}>Belum ada budget untuk bulan ini.</Text> : null}
      {shown.map((it, idx) => {
        const pctText = it.pct === null ? '—' : `${Math.round(it.pct * 100)}%`;
        const color = it.status === 'over' ? '#ffb4b4' : it.status === 'warn' ? '#ffe9a3' : '#b7c0d6';
        return (
          <View key={`${it.category}-${idx}`} style={[{ paddingVertical: 10, borderTopWidth: idx ? 1 : 0, borderTopColor: '#1d2a52' }]}>
            <View style={[sharedStyles.row, { justifyContent: 'space-between' }]}>
              <Text style={{ color: '#ffffff', flex: 1, paddingRight: 8 }} numberOfLines={1}>{it.category}</Text>
              <View style={[sharedStyles.chip, { borderColor: '#1d2a52' }]}>
                <Text style={[sharedStyles.chipText, { color }]}>{pctText}</Text>
              </View>
            </View>
            <View style={{ height: 6 }} />
            <Text style={sharedStyles.muted}>{toCurrency(it.spent, currency)} / {toCurrency(it.limit, currency)}</Text>
          </View>
        );
      })}
    </View>
  );
}

// Transaction List Screen
function TransactionListScreen({ config, onTransactionPress }: { config: AppConfig; onTransactionPress?: (tx: Transaction) => void }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'IN' | 'OUT' | 'ALL'>('ALL');
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return formatDateYyyyMmDd(d); });
  const [endDate, setEndDate] = useState(() => formatDateYyyyMmDd(new Date()));

  const LIMIT = 20;

  const fetchTransactions = useCallback(async (reset = false) => {
    if (reset) { setLoading(true); setOffset(0); setTransactions([]); } else { setRefreshing(true); }
    setError(null);
    try {
      const currentOffset = reset ? 0 : offset;
      const result = await apiGet<{ total: number; limit: number; offset: number; rows: Transaction[] }>(config, '/api/transactions', {
        start: startDate, end: endDate, type: typeFilter === 'ALL' ? undefined : typeFilter, q: searchQuery || undefined, limit: LIMIT, offset: currentOffset, includeItems: true, currency: config.currency,
      });
      if (reset) { setTransactions(result.rows); setOffset(LIMIT); } else { setTransactions((prev) => [...prev, ...result.rows]); setOffset(currentOffset + LIMIT); }
      setTotal(result.total);
      setHasMore(result.rows.length === LIMIT);
    } catch (e: any) { setError(e?.message || 'Gagal mengambil data'); } finally { setLoading(false); setRefreshing(false); }
  }, [startDate, endDate, typeFilter, searchQuery, offset, config]);

  useEffect(() => { fetchTransactions(true); }, [fetchTransactions]);

  const handleApplyFilters = () => { fetchTransactions(true); setShowFilters(false); };
  const handleResetFilters = () => { const d = new Date(); d.setMonth(d.getMonth() - 1); setStartDate(formatDateYyyyMmDd(d)); setEndDate(formatDateYyyyMmDd(new Date())); setTypeFilter('ALL'); setSearchQuery(''); };

  if (loading && transactions.length === 0) {
    return <View style={sharedStyles.centered}><ActivityIndicator /><Text style={sharedStyles.muted}>Memuat...</Text></View>;
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', padding: 12, gap: 10 }}>
        <TextInput style={[sharedStyles.input, { flex: 1 }]} placeholder="Cari transaksi..." placeholderTextColor="#6070a4" value={searchQuery} onChangeText={setSearchQuery} onSubmitEditing={handleApplyFilters} />
        <TouchableOpacity style={[sharedStyles.chip, { justifyContent: 'center' }]} onPress={() => setShowFilters(true)}>
          <Text style={sharedStyles.chipText}>Filter</Text>
        </TouchableOpacity>
      </View>
      <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}><Text style={sharedStyles.muted}>Ditemukan {total} transaksi</Text></View>
      {error && <View style={{ marginHorizontal: 12, marginBottom: 8, backgroundColor: '#2d1b1b', borderColor: '#5c2d2d', borderWidth: 1, borderRadius: 10, padding: 12 }}><Text style={{ color: '#ffb4b4' }}>{error}</Text></View>}
      {transactions.length === 0 ? (
        <View style={{ padding: 32, alignItems: 'center' }}><Text style={{ fontSize: 48 }}>📭</Text><Text style={[sharedStyles.muted, { marginTop: 12 }]}>Tidak ada transaksi ditemukan.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 80 }}>
          {transactions.map((tx) => (
            <TouchableOpacity key={tx.id} style={[sharedStyles.card, { marginBottom: 8 }]} onPress={() => onTransactionPress?.(tx)} activeOpacity={0.7}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                  <View style={{ backgroundColor: getTypeColor(tx.type), paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}><Text style={{ color: '#0b1020', fontSize: 10, fontWeight: '700' }}>{tx.type}</Text></View>
                  <View style={{ flex: 1 }}><Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{tx.category}</Text>{tx.merchant && <Text style={sharedStyles.muted} numberOfLines={1}>{tx.merchant}</Text>}</View>
                </View>
                <View style={{ alignItems: 'flex-end' }}><Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '700' }}>{toCurrency(tx.amount, config.currency)}</Text><Text style={[sharedStyles.muted, { fontSize: 11, marginTop: 2 }]}>{formatDateDisplay(tx.transaction_date)}</Text></View>
              </View>
              {tx.description && <Text style={[sharedStyles.muted, { marginTop: 8 }]} numberOfLines={2}>{tx.description}</Text>}
            </TouchableOpacity>
          ))}
          {hasMore && <TouchableOpacity style={{ padding: 16, alignItems: 'center' }} onPress={() => fetchTransactions(false)}><Text style={{ color: '#6070a4' }}>Muat lebih banyak</Text></TouchableOpacity>}
        </ScrollView>
      )}

      {/* Filter Modal */}
      {showFilters && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20, zIndex: 100 }}>
          <View style={sharedStyles.card}>
            <Text style={[sharedStyles.title, { fontSize: 18, marginBottom: 16 }]}>Filter Transaksi</Text>
            <View style={{ marginBottom: 16 }}>
              <Text style={sharedStyles.label}>Tipe</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['ALL', 'IN', 'OUT'] as const).map((t) => (
                  <TouchableOpacity key={t} style={[{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#0b1020', borderWidth: 1, borderColor: '#1d2a52', alignItems: 'center' }, typeFilter === t && { backgroundColor: '#6070a4', borderColor: '#6070a4' }]} onPress={() => setTypeFilter(t)}>
                    <Text style={{ color: typeFilter === t ? '#ffffff' : '#b7c0d6', fontSize: 12 }}>{t === 'ALL' ? 'Semua' : t === 'IN' ? 'Pemasukan' : 'Pengeluaran'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={{ marginBottom: 16 }}><Text style={sharedStyles.label}>Tanggal Mulai</Text><TextInput style={sharedStyles.input} value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor="#6070a4" /></View>
            <View style={{ marginBottom: 16 }}><Text style={sharedStyles.label}>Tanggal Akhir</Text><TextInput style={sharedStyles.input} value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" placeholderTextColor="#6070a4" /></View>
            <View style={{ flexDirection: 'row', gap: 12 }}><Button title="Reset" onPress={handleResetFilters} color="#6070a4" /><Button title="Terapkan" onPress={handleApplyFilters} /></View>
            <TouchableOpacity style={{ marginTop: 12, alignItems: 'center' }} onPress={() => setShowFilters(false)}><Text style={{ color: '#6070a4' }}>Tutup</Text></TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// Transaction Detail Screen
function TransactionDetailScreen({ config, transactionId, onBack, onEdit, onDelete }: { config: AppConfig; transactionId: number; onBack: () => void; onEdit: () => void; onDelete: () => void }) {
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await apiGet<Transaction>(config, `/api/transactions/${transactionId}`, { currency: config.currency });
        setTransaction(data);
      } catch (e: any) { setError(e?.message || 'Gagal mengambil detail'); } finally { setLoading(false); }
    })();
  }, [transactionId]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await apiDelete<{ deleted: boolean }>(config, `/api/transactions/${transactionId}`);
      onDelete();
    } catch (e: any) { Alert.alert('Gagal', e?.message || 'Gagal menghapus'); } finally { setDeleting(false); }
  };

  if (loading) return <View style={sharedStyles.centered}><ActivityIndicator /><Text style={sharedStyles.muted}>Memuat...</Text></View>;
  if (error) return <View style={{ padding: 16 }}><Text style={{ color: '#ffb4b4' }}>{error}</Text><Button title="Kembali" onPress={onBack} /></View>;
  if (!transaction) return <View style={{ padding: 16 }}><Text style={sharedStyles.muted}>Transaksi tidak ditemukan</Text><Button title="Kembali" onPress={onBack} /></View>;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#0b1020' }} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TouchableOpacity onPress={onBack}><Text style={{ color: '#6070a4', fontSize: 24 }}>←</Text></TouchableOpacity>
        <Text style={sharedStyles.title}>Detail Transaksi</Text>
      </View>
      <View style={sharedStyles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <View style={{ backgroundColor: getTypeColor(transaction.type), paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}><Text style={{ color: '#0b1020', fontSize: 12, fontWeight: '700' }}>{getTypeLabel(transaction.type)}</Text></View>
          <Text style={[sharedStyles.title, { fontSize: 22 }]}>{toCurrency(transaction.amount, config.currency)}</Text>
        </View>
        {[{ label: 'Tanggal', value: formatDateDisplay(transaction.transaction_date) }, { label: 'Kategori', value: transaction.category }, ...(transaction.merchant ? [{ label: 'Merchant', value: transaction.merchant }] : []), ...(transaction.description ? [{ label: 'Keterangan', value: transaction.description }] : [])].map((item, idx) => (
          <View key={item.label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: idx ? 1 : 0, borderTopColor: '#1d2a52' }}>
            <Text style={sharedStyles.muted}>{item.label}</Text><Text style={{ color: '#ffffff' }}>{item.value}</Text>
          </View>
        ))}
      </View>
      {transaction.items && transaction.items.length > 0 && (
        <View style={sharedStyles.card}>
          <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Item Transaksi</Text>
          {transaction.items.map((item, idx) => (
            <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: idx ? 1 : 0, borderTopColor: '#1d2a52' }}>
              <View><Text style={{ color: '#ffffff' }}>{item.item_name}</Text><Text style={sharedStyles.muted}>x{item.quantity}</Text></View>
              <Text style={{ color: '#d8def0' }}>{toCurrency(item.price * item.quantity, config.currency)}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={{ gap: 12 }}>
        <TouchableOpacity style={{ backgroundColor: '#6070a4', borderRadius: 10, paddingVertical: 14, alignItems: 'center' }} onPress={onEdit}><Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>Edit Transaksi</Text></TouchableOpacity>
        <TouchableOpacity style={{ backgroundColor: '#9b1c1c', borderRadius: 10, paddingVertical: 14, alignItems: 'center', opacity: deleting ? 0.6 : 1 }} onPress={handleDelete} disabled={deleting}>
          {deleting ? <ActivityIndicator color="#ffffff" /> : <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>Hapus Transaksi</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// Add/Edit Transaction Screen
function EditTransactionScreen({ config, transactionId, onSave, onCancel }: { config: AppConfig; transactionId: number; onSave: () => void; onCancel: () => void }) {
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<Transaction>(config, `/api/transactions/${transactionId}`);
        setTransaction(data);
      } catch (e: any) { Alert.alert('Gagal', e?.message); } finally { setLoading(false); }
    })();
  }, [transactionId]);

  if (loading) return <View style={sharedStyles.centered}><ActivityIndicator /><Text style={sharedStyles.muted}>Memuat...</Text></View>;
  if (!transaction) return <View style={{ padding: 16 }}><Text style={sharedStyles.muted}>Transaksi tidak ditemukan</Text><Button title="Kembali" onPress={onCancel} /></View>;

  return <AddEditTransactionForm config={config} transaction={transaction} onSave={onSave} onCancel={onCancel} />;
}

function AddEditTransactionScreen({ config, onSave, onCancel }: { config: AppConfig; onSave: () => void; onCancel: () => void }) {
  return <AddEditTransactionForm config={config} transaction={null} onSave={onSave} onCancel={onCancel} />;
}

function AddEditTransactionForm({ config, transaction, onSave, onCancel }: { config: AppConfig; transaction: Transaction | null; onSave: () => void; onCancel: () => void }) {
  const isEdit = !!transaction;
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [merchants, setMerchants] = useState<string[]>([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showMerchantDropdown, setShowMerchantDropdown] = useState(false);

  const [transactionDate, setTransactionDate] = useState(transaction?.transaction_date || formatDateYyyyMmDd(new Date()));
  const [type, setType] = useState<'IN' | 'OUT'>(transaction?.type || 'OUT');
  const [amount, setAmount] = useState(transaction?.amount?.toString() || '');
  const [category, setCategory] = useState(transaction?.category || '');
  const [merchant, setMerchant] = useState(transaction?.merchant || '');
  const [description, setDescription] = useState(transaction?.description || '');

  useEffect(() => {
    (async () => {
      try {
        const [catResult, merchResult] = await Promise.all([
          apiGet<{ categories: string[] }>(config, '/api/dashboard/categories'),
          apiGet<{ merchants: string[] }>(config, '/api/dashboard/merchants'),
        ]);
        setCategories(catResult.categories || []);
        setMerchants(merchResult.merchants || []);
      } catch (e: any) { console.error('Failed to load dropdown:', e); }
    })();
  }, []);

  const handleSubmit = async () => {
    if (!transactionDate) { Alert.alert('Validasi', 'Tanggal wajib diisi'); return; }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { Alert.alert('Validasi', 'Jumlah harus lebih dari 0'); return; }
    if (!category) { Alert.alert('Validasi', 'Kategori wajib diisi'); return; }

    setSubmitting(true);
    try {
      const data = { transaction_date: transactionDate, type, amount: Number(amount), currency: config.currency, category, merchant: merchant || null, description: description || null };
      if (isEdit && transaction) {
        await apiPut(config, `/api/transactions/${transaction.id}`, data);
      } else {
        await apiPost(config, '/api/transactions', data);
      }
      onSave();
    } catch (e: any) { Alert.alert('Gagal', e?.message || 'Gagal menyimpan'); } finally { setSubmitting(false); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#0b1020' }} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TouchableOpacity onPress={onCancel}><Text style={{ color: '#6070a4', fontSize: 24 }}>←</Text></TouchableOpacity>
        <Text style={sharedStyles.title}>{isEdit ? 'Edit' : 'Tambah'} Transaksi</Text>
      </View>
      <View style={sharedStyles.card}>
        <View style={{ gap: 16 }}>
          <View><Text style={sharedStyles.label}>Tanggal</Text><TextInput style={sharedStyles.input} value={transactionDate} onChangeText={setTransactionDate} placeholder="YYYY-MM-DD" placeholderTextColor="#6070a4" /></View>
          <View><Text style={sharedStyles.label}>Tipe</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['IN', 'OUT'] as const).map((t) => (
                <TouchableOpacity key={t} style={[{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#0b1020', borderWidth: 1, borderColor: '#1d2a52', alignItems: 'center' }, type === t && { backgroundColor: '#6070a4', borderColor: '#6070a4' }]} onPress={() => setType(t)}>
                  <Text style={{ color: type === t ? '#ffffff' : '#b7c0d6', fontSize: 12 }}>{t === 'IN' ? 'Pemasukan' : 'Pengeluaran'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View><Text style={sharedStyles.label}>Jumlah ({config.currency})</Text><TextInput style={sharedStyles.input} value={amount} onChangeText={setAmount} placeholder="0" placeholderTextColor="#6070a4" keyboardType="numeric" /></View>
          <View>
            <Text style={sharedStyles.label}>Kategori</Text>
            <TouchableOpacity style={[sharedStyles.input, { flexDirection: 'row', justifyContent: 'space-between' }]} onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}>
              <Text style={category ? { color: '#ffffff' } : { color: '#6070a4' }}>{category || 'Pilih kategori'}</Text><Text style={{ color: '#6070a4' }}>▼</Text>
            </TouchableOpacity>
            {showCategoryDropdown && (
              <View style={{ backgroundColor: '#111a34', borderRadius: 10, borderWidth: 1, borderColor: '#1d2a52', maxHeight: 200 }}>
                {categories.map((cat) => (
                  <TouchableOpacity key={cat} style={{ paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#1d2a52' }} onPress={() => { setCategory(cat); setShowCategoryDropdown(false); }}>
                    <Text style={{ color: '#ffffff' }}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          <View>
            <Text style={sharedStyles.label}>Merchant (opsional)</Text>
            <TouchableOpacity style={[sharedStyles.input, { flexDirection: 'row', justifyContent: 'space-between' }]} onPress={() => setShowMerchantDropdown(!showMerchantDropdown)}>
              <Text style={merchant ? { color: '#ffffff' } : { color: '#6070a4' }}>{merchant || 'Pilih merchant'}</Text><Text style={{ color: '#6070a4' }}>▼</Text>
            </TouchableOpacity>
            {showMerchantDropdown && (
              <View style={{ backgroundColor: '#111a34', borderRadius: 10, borderWidth: 1, borderColor: '#1d2a52', maxHeight: 200 }}>
                {merchants.map((m) => (
                  <TouchableOpacity key={m} style={{ paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#1d2a52' }} onPress={() => { setMerchant(m); setShowMerchantDropdown(false); }}>
                    <Text style={{ color: '#ffffff' }}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          <View><Text style={sharedStyles.label}>Keterangan (opsional)</Text><TextInput style={[sharedStyles.input, { height: 80, textAlignVertical: 'top' }]} value={description} onChangeText={setDescription} placeholder="Tambahkan catatan..." placeholderTextColor="#6070a4" multiline numberOfLines={3} /></View>
        </View>
      </View>
      <TouchableOpacity style={[{ backgroundColor: '#6070a4', borderRadius: 10, paddingVertical: 14, alignItems: 'center' }, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>{isEdit ? 'Simpan Perubahan' : 'Simpan Transaksi'}</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

// Chart Screen
function ChartScreen({ config }: { config: AppConfig }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [series, setSeries] = useState<Array<{ key: string; in: number; out: number; net: number }>>([]);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const now = new Date();
        const end = new Date(now);
        let start = new Date(now);
        if (timeRange === 'week') start.setDate(now.getDate() - 7);
        else if (timeRange === 'month') start.setMonth(now.getMonth() - 1);
        else start.setFullYear(now.getFullYear() - 1);

        const bucket = timeRange === 'year' ? 'month' : 'day';
        const result = await apiGet<{ series: typeof series }>(config, '/api/dashboard/timeseries', { start: formatDateYyyyMmDd(start), end: formatDateYyyyMmDd(end), bucket, currency: config.currency });
        setSeries(result.series || []);
      } catch (e: any) { setError(e?.message || 'Gagal mengambil data'); } finally { setLoading(false); }
    })();
  }, [timeRange]);

  if (loading) return <View style={sharedStyles.centered}><ActivityIndicator /><Text style={sharedStyles.muted}>Memuat...</Text></View>;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#0b1020' }} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text style={sharedStyles.title}>Grafik Keuangan</Text>
      <View style={sharedStyles.card}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {([
            { key: 'week', label: 'Minggu' },
            { key: 'month', label: 'Bulan' },
            { key: 'year', label: 'Tahun' },
          ] as const).map((r) => (
            <TouchableOpacity key={r.key} style={[{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#0b1020', borderWidth: 1, borderColor: '#1d2a52', alignItems: 'center' }, timeRange === r.key && { backgroundColor: '#6070a4', borderColor: '#6070a4' }]} onPress={() => setTimeRange(r.key)}>
              <Text style={{ color: timeRange === r.key ? '#ffffff' : '#b7c0d6', fontSize: 12 }}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {error && <View style={{ backgroundColor: '#2d1b1b', borderColor: '#5c2d2d', borderWidth: 1, borderRadius: 10, padding: 12 }}><Text style={{ color: '#ffb4b4' }}>{error}</Text></View>}
      {series.length > 0 ? (
        <>
          <View style={sharedStyles.card}>
            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Ringkasan</Text>
            <View style={{ flexDirection: 'row', gap: 16, marginBottom: 12 }}>
              <View style={{ flex: 1 }}><Text style={sharedStyles.muted}>Total Pemasukan</Text><Text style={{ color: '#4ade80', fontSize: 16, fontWeight: '700' }}>{toCurrency(series.reduce((sum, s) => sum + s.in, 0), config.currency)}</Text></View>
              <View style={{ flex: 1 }}><Text style={sharedStyles.muted}>Total Pengeluaran</Text><Text style={{ color: '#f87171', fontSize: 16, fontWeight: '700' }}>{toCurrency(series.reduce((sum, s) => sum + s.out, 0), config.currency)}</Text></View>
            </View>
            <View><Text style={sharedStyles.muted}>Netto</Text><Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>{toCurrency(series.reduce((sum, s) => sum + s.net, 0), config.currency)}</Text></View>
          </View>
          <View style={sharedStyles.card}>
            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Data Detail</Text>
            {series.map((s, idx) => (
              <View key={s.key} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: idx ? 1 : 0, borderTopColor: '#1d2a52' }}>
                <Text style={sharedStyles.muted}>{formatDateDisplay(s.key)}</Text>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <Text style={{ color: '#4ade80' }}>{toCurrency(s.in, config.currency)}</Text>
                  <Text style={{ color: '#f87171' }}>{toCurrency(s.out, config.currency)}</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : (
        <View style={sharedStyles.card}><Text style={[sharedStyles.muted, { textAlign: 'center', paddingVertical: 24 }]}>Tidak ada data untuk periode ini.</Text></View>
      )}
    </ScrollView>
  );
}

// Audit Log Screen
function AuditLogScreen({ config }: { config: AppConfig }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const LIMIT = 30;

  const fetchLogs = useCallback(async (reset = false) => {
    if (reset) { setLoading(true); setOffset(0); setLogs([]); } else { setRefreshing(true); }
    setError(null);
    try {
      const currentOffset = reset ? 0 : offset;
      const result = await apiGet<{ total: number; limit: number; offset: number; rows: AuditLog[] }>(config, '/api/audit', { limit: LIMIT, offset: currentOffset });
      if (reset) { setLogs(result.rows); setOffset(LIMIT); } else { setLogs((prev) => [...prev, ...result.rows]); setOffset(currentOffset + LIMIT); }
      setTotal(result.total);
      setHasMore(result.rows.length === LIMIT);
    } catch (e: any) { setError(e?.message || 'Gagal mengambil data audit'); } finally { setLoading(false); setRefreshing(false); }
  }, [offset]);

  useEffect(() => { fetchLogs(true); }, [fetchLogs]);

  if (loading && logs.length === 0) return <View style={sharedStyles.centered}><ActivityIndicator /><Text style={sharedStyles.muted}>Memuat...</Text></View>;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}><Text style={sharedStyles.muted}>Ditemukan {total} log aktivitas</Text></View>
      {error && <View style={{ marginHorizontal: 12, marginBottom: 8, backgroundColor: '#2d1b1b', borderColor: '#5c2d2d', borderWidth: 1, borderRadius: 10, padding: 12 }}><Text style={{ color: '#ffb4b4' }}>{error}</Text></View>}
      {logs.length === 0 ? (
        <View style={{ padding: 32, alignItems: 'center' }}><Text style={{ fontSize: 48 }}>📋</Text><Text style={[sharedStyles.muted, { marginTop: 12 }]}>Belum ada log aktivitas.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 80 }}>
          {logs.map((log) => (
            <AuditLogItem key={log.id} log={log} />
          ))}
          {hasMore && <TouchableOpacity style={{ padding: 16, alignItems: 'center' }} onPress={() => fetchLogs(false)}><Text style={{ color: '#6070a4' }}>Muat lebih banyak</Text></TouchableOpacity>}
        </ScrollView>
      )}
    </View>
  );
}

function AuditLogItem({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const detail = log.detail_json;

  return (
    <TouchableOpacity style={[sharedStyles.card, { marginBottom: 8 }]} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600' }}>{getAuditActionLabel(log.action)}</Text>
          <Text style={[sharedStyles.muted, { fontSize: 12, marginTop: 2 }]}>{formatDateTimeDisplay(log.created_at)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {log.entity_type && <Text style={{ color: '#6070a4', fontSize: 10, backgroundColor: '#0b1020', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>{log.entity_type}</Text>}
          <Text style={{ color: '#6070a4', fontSize: 10 }}>{expanded ? '▼' : '▶'}</Text>
        </View>
      </View>
      {expanded && detail && (
        <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#1d2a52' }}>
          {Object.entries(detail).map(([key, value]) => (
            <View key={key} style={{ flexDirection: 'row', paddingVertical: 4 }}>
              <Text style={[sharedStyles.muted, { width: 100 }]}>{key}:</Text>
              <Text style={{ color: '#d8def0', flex: 1 }}>{String(value)}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}
