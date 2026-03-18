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
  View,
} from 'react-native';

type AppConfig = {
  baseUrl: string;
  apiKey: string;
  accountId: number;
  currency: string;
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

const CONFIG_KEY = 'wa_finance_config_v1';

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
    const apiKey = typeof parsed.apiKey === 'string' ? parsed.apiKey : '';
    const accountId = typeof parsed.accountId === 'number' ? parsed.accountId : NaN;
    const currency = typeof parsed.currency === 'string' ? parsed.currency : 'IDR';
    if (!baseUrl || !apiKey || !Number.isFinite(accountId) || accountId <= 0) return null;
    return { baseUrl, apiKey, accountId, currency };
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

  const res = await fetch(url.toString(), { headers: { 'x-api-key': cfg.apiKey } });
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

async function fetchDashboard(cfg: AppConfig, startDate: string, endDate: string, monthKey: string) {
  const common = {
    accountId: cfg.accountId,
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
      accountId: cfg.accountId,
      month: monthKey,
      currency: cfg.currency,
    }),
  ]);
  return { summary, timeseries, byCategoryOut, byMerchantOut, budgetStatus } satisfies DashboardData;
}

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
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator />
          <Text style={styles.muted}>Memuat…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!config) {
    return (
      <SafeAreaView style={styles.container}>
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
    <SafeAreaView style={styles.container}>
      <DashboardScreen
        config={config}
        onLogout={async () => {
          await clearConfig();
          setConfig(null);
        }}
      />
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  const defaultApiKey = (process.env.EXPO_PUBLIC_API_KEY || '').trim();
  const defaultAccountId = (process.env.EXPO_PUBLIC_ACCOUNT_ID || '1').trim();
  const defaultCurrency = (process.env.EXPO_PUBLIC_CURRENCY || 'IDR').trim().toUpperCase();

  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl);
  const [apiKey, setApiKey] = useState(defaultApiKey);
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [currency, setCurrency] = useState(defaultCurrency);
  const [saving, setSaving] = useState(false);

  return (
    <ScrollView contentContainerStyle={{ padding: 18, gap: 12 }}>
      <Text style={styles.title}>wa-finance-fe</Text>
      <Text style={styles.muted}>Masuk untuk mengambil data dashboard dari wa-finance-be.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Base URL Backend</Text>
        <TextInput
          value={baseUrl}
          onChangeText={setBaseUrl}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="http://localhost:3000"
          placeholderTextColor="#6070a4"
          style={styles.input}
        />

        <View style={{ height: 12 }} />

        <Text style={styles.label}>API Key (header x-api-key)</Text>
        <TextInput
          value={apiKey}
          onChangeText={setApiKey}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          placeholder="change-me"
          placeholderTextColor="#6070a4"
          style={styles.input}
        />

        <View style={{ height: 12 }} />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Account ID</Text>
            <TextInput
              value={accountId}
              onChangeText={setAccountId}
              keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
              placeholder="1"
              placeholderTextColor="#6070a4"
              style={styles.input}
            />
          </View>
          <View style={{ width: 120 }}>
            <Text style={styles.label}>Currency</Text>
            <TextInput
              value={currency}
              onChangeText={(v) => setCurrency(v.toUpperCase())}
              autoCapitalize="characters"
              placeholder="IDR"
              placeholderTextColor="#6070a4"
              style={styles.input}
            />
          </View>
        </View>

        <View style={{ height: 14 }} />

        <Button
          title={saving ? 'Memproses…' : 'Masuk'}
          disabled={saving}
          onPress={async () => {
            const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
            const parsedAccountId = parseInt(accountId, 10);
            if (!normalizedBaseUrl) {
              Alert.alert('Validasi', 'Base URL wajib diisi.');
              return;
            }
            if (!normalizedBaseUrl.startsWith('http://') && !normalizedBaseUrl.startsWith('https://')) {
              Alert.alert('Validasi', 'Base URL harus diawali http:// atau https://');
              return;
            }
            if (!apiKey.trim()) {
              Alert.alert('Validasi', 'API Key wajib diisi.');
              return;
            }
            if (!Number.isFinite(parsedAccountId) || parsedAccountId <= 0) {
              Alert.alert('Validasi', 'Account ID harus angka > 0.');
              return;
            }
            if (!/^[A-Z]{3}$/.test(currency.trim().toUpperCase())) {
              Alert.alert('Validasi', 'Currency harus 3 huruf, misal: IDR, USD.');
              return;
            }

            const cfg: AppConfig = {
              baseUrl: normalizedBaseUrl,
              apiKey: apiKey.trim(),
              accountId: parsedAccountId,
              currency: currency.trim().toUpperCase(),
            };

            setSaving(true);
            try {
              const today = new Date();
              const start = new Date(today.getFullYear(), today.getMonth(), 1);
              await apiGet<DashboardSummary>(cfg, '/api/dashboard/summary', {
                accountId: cfg.accountId,
                start: formatDateYyyyMmDd(start),
                end: formatDateYyyyMmDd(today),
                currency: cfg.currency,
              });
              await onLogin(cfg);
            } catch (e: any) {
              Alert.alert('Gagal login', e?.message || 'Gagal');
            } finally {
              setSaving(false);
            }
          }}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Catatan</Text>
        <Text style={styles.muted}>
          Endpoint /api/* di backend hanya aktif jika env HTTP_API_KEY diset, dan request wajib membawa header x-api-key.
        </Text>
      </View>
    </ScrollView>
  );
}

function DashboardScreen({ config, onLogout }: { config: AppConfig; onLogout: () => Promise<void> }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);

  const computeRange = () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      startDate: formatDateYyyyMmDd(start),
      endDate: formatDateYyyyMmDd(today),
      monthKey: monthKeyFromDate(today),
    };
  };

  const [range, setRange] = useState(computeRange);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const nextRange = computeRange();
    setRange(nextRange);
    try {
      const dashboard = await fetchDashboard(config, nextRange.startDate, nextRange.endDate, nextRange.monthKey);
      setData(dashboard);
    } catch (e: any) {
      setData(null);
      setError(e?.message || 'Gagal mengambil data');
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <ScrollView contentContainerStyle={{ padding: 18, gap: 12 }}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Dashboard</Text>
          <Text style={styles.muted}>
            Account {config.accountId} • {range.startDate} s/d {range.endDate} • {config.currency}
          </Text>
        </View>
        <View style={styles.row}>
          <Button title="Refresh" onPress={refresh} />
          <Button
            title="Keluar"
            color={Platform.OS === 'ios' ? undefined : '#9b1c1c'}
            onPress={async () => {
              await onLogout();
            }}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.card}>
          <View style={styles.row}>
            <ActivityIndicator />
            <Text style={styles.muted}>Mengambil data…</Text>
          </View>
        </View>
      ) : error ? (
        <View style={styles.card}>
          <Text style={[styles.muted, { color: '#ffb4b4' }]}>{error}</Text>
        </View>
      ) : null}

      {data ? (
        <>
          <SummaryCard summary={data.summary} currency={config.currency} />
          <TopListCard
            title="Top Kategori (Pengeluaran)"
            items={data.byCategoryOut.items.map((x) => ({ label: x.category, value: x.total }))}
            currency={config.currency}
          />
          <TopListCard
            title="Top Merchant (Pengeluaran)"
            items={data.byMerchantOut.items.map((x) => ({ label: x.merchant, value: x.total }))}
            currency={config.currency}
          />
          <BudgetCard budget={data.budgetStatus} currency={config.currency} />
        </>
      ) : null}
    </ScrollView>
  );
}

function SummaryCard({ summary, currency }: { summary: DashboardSummary; currency: string }) {
  const savingRateText =
    summary.savingRate === null ? '—' : `${Math.round(summary.savingRate * 100)}%`;

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Ringkasan</Text>
      <View style={{ height: 8 }} />
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.muted}>Pemasukan</Text>
          <Text style={styles.title}>{toCurrency(summary.totalIn, currency)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.muted}>Pengeluaran</Text>
          <Text style={styles.title}>{toCurrency(summary.totalOut, currency)}</Text>
        </View>
      </View>

      <View style={{ height: 12 }} />

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.muted}>Net</Text>
          <Text style={styles.title}>{toCurrency(summary.net, currency)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.muted}>Saving Rate</Text>
          <View style={[styles.chip, { alignSelf: 'flex-start' }]}>
            <Text style={styles.chipText}>{savingRateText}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function TopListCard({
  title,
  items,
  currency,
}: {
  title: string;
  items: Array<{ label: string; value: number }>;
  currency: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{title}</Text>
      <View style={{ height: 6 }} />
      {items.length === 0 ? <Text style={styles.muted}>Tidak ada data.</Text> : null}
      {items.map((it, idx) => (
        <View
          key={`${it.label}-${idx}`}
          style={[
            styles.row,
            { justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: idx ? 1 : 0, borderTopColor: '#1d2a52' },
          ]}
        >
          <Text style={{ color: '#ffffff', flex: 1, paddingRight: 8 }} numberOfLines={1}>
            {it.label}
          </Text>
          <Text style={{ color: '#d8def0', fontVariant: ['tabular-nums'] as any }}>
            {toCurrency(it.value, currency)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function BudgetCard({ budget, currency }: { budget: BudgetStatus; currency: string }) {
  const shown = budget.items
    .filter((x) => x.limit > 0 || x.spent > 0)
    .slice()
    .sort((a, b) => (b.pct || 0) - (a.pct || 0))
    .slice(0, 10);

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Budget ({budget.monthKey})</Text>
      <View style={{ height: 6 }} />
      {shown.length === 0 ? <Text style={styles.muted}>Belum ada budget.</Text> : null}
      {shown.map((it, idx) => {
        const pctText = it.pct === null ? '—' : `${Math.round(it.pct * 100)}%`;
        const color =
          it.status === 'over' ? '#ffb4b4' : it.status === 'warn' ? '#ffe9a3' : '#b7c0d6';
        return (
          <View
            key={`${it.category}-${idx}`}
            style={[
              { paddingVertical: 10, borderTopWidth: idx ? 1 : 0, borderTopColor: '#1d2a52' },
            ]}
          >
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <Text style={{ color: '#ffffff', flex: 1, paddingRight: 8 }} numberOfLines={1}>
                {it.category}
              </Text>
              <View style={[styles.chip, { borderColor: '#1d2a52' }]}>
                <Text style={[styles.chipText, { color }]}>{pctText}</Text>
              </View>
            </View>
            <View style={{ height: 6 }} />
            <Text style={styles.muted}>
              {toCurrency(it.spent, currency)} / {toCurrency(it.limit, currency)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
