import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { ApiService } from '../services/api';
import { AuditLog, AppConfig } from '../types';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { ErrorBanner } from '../components/ErrorBanner';
import { EmptyState } from '../components/EmptyState';
import { Card } from '../components/Card';
import { formatDateTimeDisplay, getAuditActionLabel } from '../utils/format';

interface AuditLogScreenProps {
  config: AppConfig;
}

export function AuditLogScreen({ config }: AuditLogScreenProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  const LIMIT = 30;
  const api = new ApiService(config);

  const fetchLogs = useCallback(async (reset = false) => {
    if (reset) {
      setLoading(true);
      setOffset(0);
      setLogs([]);
    } else {
      setRefreshing(true);
    }
    setError(null);

    try {
      const currentOffset = reset ? 0 : offset;
      const result = await api.getAuditLogs({
        limit: LIMIT,
        offset: currentOffset,
      });

      if (reset) {
        setLogs(result.rows);
        setOffset(LIMIT);
      } else {
        setLogs((prev) => [...prev, ...result.rows]);
        setOffset(currentOffset + LIMIT);
      }

      setTotal(result.total);
      setHasMore(result.rows.length === LIMIT);
    } catch (e: any) {
      setError(e?.message || 'Gagal mengambil data audit');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [offset]);

  useEffect(() => {
    fetchLogs(true);
  }, [fetchLogs]);

  const handleRefresh = () => {
    fetchLogs(true);
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      fetchLogs(false);
    }
  };

  const renderLog = ({ item }: { item: AuditLog }) => (
    <AuditLogItem log={item} />
  );

  const renderFooter = () => {
    if (hasMore && logs.length > 0) {
      return (
        <TouchableOpacity style={styles.loadMore} onPress={handleLoadMore}>
          <Text style={styles.loadMoreText}>Muat lebih banyak</Text>
        </TouchableOpacity>
      );
    }
    return null;
  };

  if (loading && logs.length === 0) {
    return <LoadingIndicator />;
  }

  return (
    <View style={styles.container}>
      {/* Summary */}
      <View style={styles.summaryRow}>
        <Text style={styles.summaryText}>
          Ditemukan {total} log aktivitas
        </Text>
      </View>

      {/* Error */}
      {error && <ErrorBanner message={error} style={styles.error} />}

      {/* Log List */}
      {logs.length === 0 ? (
        <EmptyState message="Belum ada log aktivitas." />
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderLog}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#6070a4"
            />
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

function AuditLogItem({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const detail = log.detail_json;

  return (
    <TouchableOpacity
      style={styles.logItem}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={styles.logHeader}>
        <View style={styles.logInfo}>
          <Text style={styles.action}>{getAuditActionLabel(log.action)}</Text>
          <Text style={styles.date}>{formatDateTimeDisplay(log.created_at)}</Text>
        </View>
        <View style={styles.logMeta}>
          {log.entity_type && (
            <Text style={styles.entity}>{log.entity_type}</Text>
          )}
          <Text style={styles.expandIcon}>{expanded ? '▼' : '▶'}</Text>
        </View>
      </View>

      {expanded && detail && (
        <View style={styles.detailContainer}>
          {Object.entries(detail).map(([key, value]) => (
            <View key={key} style={styles.detailRow}>
              <Text style={styles.detailKey}>{key}:</Text>
              <Text style={styles.detailValue}>{String(value)}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1020',
  },
  summaryRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  summaryText: {
    color: '#b7c0d6',
    fontSize: 12,
  },
  error: {
    marginHorizontal: 12,
    marginBottom: 8,
  },
  listContent: {
    padding: 12,
    paddingBottom: 80,
  },
  loadMore: {
    padding: 16,
    alignItems: 'center',
  },
  loadMoreText: {
    color: '#6070a4',
    fontSize: 14,
  },
  logItem: {
    backgroundColor: '#111a34',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1d2a52',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logInfo: {
    flex: 1,
  },
  action: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  date: {
    color: '#b7c0d6',
    fontSize: 12,
    marginTop: 2,
  },
  logMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  entity: {
    color: '#6070a4',
    fontSize: 10,
    backgroundColor: '#0b1020',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  expandIcon: {
    color: '#6070a4',
    fontSize: 10,
  },
  detailContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1d2a52',
  },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  detailKey: {
    color: '#b7c0d6',
    fontSize: 12,
    width: 100,
  },
  detailValue: {
    color: '#d8def0',
    fontSize: 12,
    flex: 1,
  },
});
