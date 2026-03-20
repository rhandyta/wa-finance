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

async function fetchDashboard(cfg: AppConfig, startDate: string, endDate: string, monthKey: string) {
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
  const baseUrl = normalizeBaseUrl(defaultBaseUrl);
  const [phone, setPhone] = useState('');
  const [token, setToken] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const canSendOtp = !sendingOtp && !verifying && !!phone.trim() && !!token.trim();
  const canVerify =
    !sendingOtp && !verifying && !!phone.trim() && !!token.trim() && /^\d{6}$/.test(otp.trim());

  return (
    <ScrollView contentContainerStyle={{ padding: 18, gap: 12 }}>
      <Text style={styles.title}>wa-finance-fe</Text>
      <Text style={styles.muted}>Masuk untuk mengambil data dashboard dari wa-finance-be.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Nomor HP WhatsApp</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={Platform.OS === 'ios' ? 'phone-pad' : 'phone-pad'}
          placeholder="contoh: 081234567890"
          placeholderTextColor="#6070a4"
          style={styles.input}
        />

        <View style={{ height: 12 }} />

        <Text style={styles.label}>Token Akun</Text>
        <TextInput
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          placeholder="token dari WhatsApp bot"
          placeholderTextColor="#6070a4"
          style={styles.input}
        />

        <View style={{ height: 14 }} />

        <Button
          title={sendingOtp ? 'Mengirim…' : 'Kirim OTP WhatsApp'}
          disabled={!canSendOtp}
          onPress={async () => {
            if (!baseUrl) {
              Alert.alert('Konfigurasi', 'Base URL belum tersedia.');
              return;
            }
            if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
              Alert.alert('Konfigurasi', 'Base URL tidak valid.');
              return;
            }
            if (!phone.trim()) {
              Alert.alert('Validasi', 'Nomor HP wajib diisi.');
              return;
            }
            if (!token.trim()) {
              Alert.alert('Validasi', 'Token wajib diisi.');
              return;
            }
            setSendingOtp(true);
            try {
              await apiPostPublic<{ sent: true }>(baseUrl, '/api/auth/request-otp', {
                phone: phone.trim(),
                token: token.trim(),
              });
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

        <Text style={styles.label}>Kode OTP</Text>
        <TextInput
          value={otp}
          onChangeText={setOtp}
          keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
          placeholder="6 digit"
          placeholderTextColor="#6070a4"
          style={styles.input}
        />

        <View style={{ height: 14 }} />

        <Button
          title={verifying ? 'Memproses…' : 'Verifikasi & Masuk'}
          disabled={!canVerify}
          onPress={async () => {
            if (!baseUrl) {
              Alert.alert('Konfigurasi', 'Base URL belum tersedia.');
              return;
            }
            if (!phone.trim()) {
              Alert.alert('Validasi', 'Nomor HP wajib diisi.');
              return;
            }
            if (!token.trim()) {
              Alert.alert('Validasi', 'Token wajib diisi.');
              return;
            }
            if (!/^\d{6}$/.test(otp.trim())) {
              Alert.alert('Validasi', 'OTP harus 6 digit.');
              return;
            }
            if (!otpSent) {
              Alert.alert('Validasi', 'Klik "Kirim OTP WhatsApp" dulu.');
              return;
            }

            setVerifying(true);
            try {
              const result = await apiPostPublic<{ sessionToken: string; currency: string }>(
                baseUrl,
                '/api/auth/verify-otp',
                {
                  phone: phone.trim(),
                  token: token.trim(),
                  otp: otp.trim(),
                },
              );

              const cfg: AppConfig = {
                baseUrl,
                sessionToken: result.sessionToken,
                currency: (result.currency || 'IDR').toUpperCase(),
                phone: phone.trim(),
                token: token.trim(),
              };

              const today = new Date();
              const start = new Date(today.getFullYear(), today.getMonth(), 1);
              await apiGet<DashboardSummary>(cfg, '/api/dashboard/summary', {
                start: formatDateYyyyMmDd(start),
                end: formatDateYyyyMmDd(today),
                currency: cfg.currency,
              });
              await onLogin(cfg);
            } catch (e: any) {
              Alert.alert('Gagal login', e?.message || 'Gagal');
            } finally {
              setVerifying(false);
            }
          }}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Catatan</Text>
        <Text style={styles.muted}>
          OTP dikirim lewat WhatsApp dari bot. Pastikan bot sudah login (QR sudah discan) di server.
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
            {config.phone} • {range.startDate} s/d {range.endDate} • {config.currency}
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
