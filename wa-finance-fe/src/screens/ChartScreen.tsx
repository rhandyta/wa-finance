import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { ApiService } from '../services/api';
import { TimeSeriesPoint, AppConfig } from '../types';
import { Card } from '../components/Card';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { ErrorBanner } from '../components/ErrorBanner';
import { toCurrency, formatDateDisplay } from '../utils/format';

interface ChartScreenProps {
  config: AppConfig;
}

type TimeRange = 'week' | 'month' | 'year' | 'custom';
type BucketType = 'day' | 'week' | 'month';

export function ChartScreen({ config }: ChartScreenProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [series, setSeries] = useState<TimeSeriesPoint[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [bucket, setBucket] = useState<BucketType>('day');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const api = new ApiService(config);

  const getDateRange = useCallback((): { start: string; end: string; bucket: BucketType } => {
    const now = new Date();
    const end = new Date(now);
    let start = new Date(now);

    switch (timeRange) {
      case 'week':
        start.setDate(now.getDate() - 7);
        return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0], bucket: 'day' };
      case 'month':
        start.setMonth(now.getMonth() - 1);
        return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0], bucket: 'day' };
      case 'year':
        start.setFullYear(now.getFullYear() - 1);
        return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0], bucket: 'month' };
      default:
        start.setMonth(now.getMonth() - 1);
        return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0], bucket: 'day' };
    }
  }, [timeRange]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const range = getDateRange();
      setStartDate(range.start);
      setEndDate(range.end);
      setBucket(range.bucket);

      const result = await api.getTimeseries(range.start, range.end, range.bucket);
      setSeries(result.series || []);
    } catch (e: any) {
      setError(e?.message || 'Gagal mengambil data');
    } finally {
      setLoading(false);
    }
  }, [getDateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const chartData = {
    labels: series.map((s) => {
      const d = new Date(s.key);
      return bucket === 'month'
        ? d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })
        : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    }),
    datasets: [
      {
        data: series.map((s) => s.in),
        color: (opacity = 1) => `rgba(74, 222, 128, ${opacity})`,
        strokeWidth: 2,
      },
      {
        data: series.map((s) => s.out),
        color: (opacity = 1) => `rgba(248, 113, 113, ${opacity})`,
        strokeWidth: 2,
      },
    ],
    legend: ['Pemasukan', 'Pengeluaran'],
  };

  const chartConfig = {
    backgroundColor: '#111a34',
    backgroundGradientFrom: '#111a34',
    backgroundGradientTo: '#111a34',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(96, 112, 164, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(183, 192, 214, ${opacity})`,
    style: { borderRadius: 16 },
    propsForDots: { r: '4', strokeWidth: '2', stroke: '#6070a4' },
    fillShadowGradient: '#6070a4',
    fillShadowGradientOpacity: 0.1,
  };

  if (loading) {
    return <LoadingIndicator />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Grafik Keuangan</Text>

      {/* Time Range Selector */}
      <Card style={styles.card}>
        <View style={styles.rangeButtons}>
          {([
            { key: 'week', label: 'Minggu' },
            { key: 'month', label: 'Bulan' },
            { key: 'year', label: 'Tahun' },
          ] as const).map((r) => (
            <TouchableOpacity
              key={r.key}
              style={[styles.rangeButton, timeRange === r.key && styles.rangeButtonActive]}
              onPress={() => setTimeRange(r.key)}
            >
              <Text style={[styles.rangeButtonText, timeRange === r.key && styles.rangeButtonTextActive]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {/* Error */}
      {error && <ErrorBanner message={error} />}

      {/* Chart */}
      {series.length > 0 ? (
        <Card style={styles.chartCard}>
          <LineChart
            data={chartData}
            width={Dimensions.get('window').width - 60}
            height={220}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
            fromZero
            withInnerLines
            withOuterLines
            withVerticalLines={false}
            withHorizontalLines={false}
          />
        </Card>
      ) : (
        <Card style={styles.card}>
          <Text style={styles.noData}>Tidak ada data untuk periode ini.</Text>
        </Card>
      )}

      {/* Summary Stats */}
      {series.length > 0 && (
        <Card style={styles.card}>
          <Text style={styles.statsTitle}>Ringkasan</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Total Pemasukan</Text>
              <Text style={[styles.statValue, { color: '#4ade80' }]}>
                {toCurrency(series.reduce((sum, s) => sum + s.in, 0), config.currency)}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Total Pengeluaran</Text>
              <Text style={[styles.statValue, { color: '#f87171' }]}>
                {toCurrency(series.reduce((sum, s) => sum + s.out, 0), config.currency)}
              </Text>
            </View>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Netto</Text>
            <Text style={[styles.statValue, { color: '#ffffff' }]}>
              {toCurrency(
                series.reduce((sum, s) => sum + s.net, 0),
                config.currency,
              )}
            </Text>
          </View>
        </Card>
      )}

      {/* Data Table */}
      {series.length > 0 && (
        <Card style={styles.card}>
          <Text style={styles.tableTitle}>Data Detail</Text>
          {series.map((s, idx) => (
            <View key={s.key} style={[styles.tableRow, idx > 0 && styles.tableRowBorder]}>
              <Text style={styles.tableDate}>{formatDateDisplay(s.key)}</Text>
              <View style={styles.tableValues}>
                <Text style={[styles.tableValue, { color: '#4ade80' }]}>
                  {toCurrency(s.in, config.currency)}
                </Text>
                <Text style={[styles.tableValue, { color: '#f87171' }]}>
                  {toCurrency(s.out, config.currency)}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1020',
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  card: {
    gap: 12,
  },
  rangeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  rangeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#0b1020',
    borderWidth: 1,
    borderColor: '#1d2a52',
    alignItems: 'center',
  },
  rangeButtonActive: {
    backgroundColor: '#6070a4',
    borderColor: '#6070a4',
  },
  rangeButtonText: {
    color: '#b7c0d6',
    fontSize: 12,
  },
  rangeButtonTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  chartCard: {
    padding: 8,
  },
  chart: {
    borderRadius: 16,
  },
  noData: {
    color: '#b7c0d6',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
  },
  statsTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    color: '#b7c0d6',
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  tableTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  tableRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#1d2a52',
  },
  tableDate: {
    color: '#b7c0d6',
    fontSize: 12,
    flex: 1,
  },
  tableValues: {
    flexDirection: 'row',
    gap: 16,
  },
  tableValue: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
});
