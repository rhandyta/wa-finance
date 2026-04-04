import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Modal,
  Button,
  Platform,
} from 'react-native';
import { ApiService } from '../services/api';
import { Transaction, TransactionType, AppConfig } from '../types';
import { TransactionItemCard } from '../components/TransactionItemCard';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { ErrorBanner } from '../components/ErrorBanner';
import { EmptyState } from '../components/EmptyState';
import { Card } from '../components/Card';
import { formatDateYyyyMmDd } from '../utils/format';

interface TransactionListScreenProps {
  config: AppConfig;
  onTransactionPress?: (transaction: Transaction) => void;
}

export function TransactionListScreen({ config, onTransactionPress }: TransactionListScreenProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'ALL'>('ALL');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return formatDateYyyyMmDd(d);
  });
  const [endDate, setEndDate] = useState(() => formatDateYyyyMmDd(new Date()));

  const LIMIT = 20;
  const api = new ApiService(config);

  const fetchTransactions = useCallback(async (reset = false) => {
    if (reset) {
      setLoading(true);
      setOffset(0);
      setTransactions([]);
    } else {
      setRefreshing(true);
    }
    setError(null);

    try {
      const currentOffset = reset ? 0 : offset;
      const result = await api.getTransactions({
        start: startDate,
        end: endDate,
        type: typeFilter === 'ALL' ? undefined : typeFilter,
        q: searchQuery || undefined,
        limit: LIMIT,
        offset: currentOffset,
        includeItems: true,
      });

      if (reset) {
        setTransactions(result.rows);
        setOffset(LIMIT);
      } else {
        setTransactions((prev) => [...prev, ...result.rows]);
        setOffset(currentOffset + LIMIT);
      }

      setTotal(result.total);
      setHasMore(result.rows.length === LIMIT);
    } catch (e: any) {
      setError(e?.message || 'Gagal mengambil data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [startDate, endDate, typeFilter, searchQuery, offset]);

  useEffect(() => {
    fetchTransactions(true);
  }, [fetchTransactions]);

  const handleRefresh = () => {
    fetchTransactions(true);
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      fetchTransactions(false);
    }
  };

  const handleApplyFilters = () => {
    fetchTransactions(true);
    setShowFilters(false);
  };

  const handleResetFilters = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    setStartDate(formatDateYyyyMmDd(d));
    setEndDate(formatDateYyyyMmDd(new Date()));
    setTypeFilter('ALL');
    setSearchQuery('');
  };

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <TransactionItemCard
      transaction={item}
      currency={config.currency}
      onPress={onTransactionPress}
      showItems
    />
  );

  const renderFooter = () => {
    if (hasMore && transactions.length > 0) {
      return (
        <TouchableOpacity style={styles.loadMore} onPress={handleLoadMore}>
          <Text style={styles.loadMoreText}>Muat lebih banyak</Text>
        </TouchableOpacity>
      );
    }
    return null;
  };

  if (loading && transactions.length === 0) {
    return <LoadingIndicator />;
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Cari transaksi..."
          placeholderTextColor="#6070a4"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleApplyFilters}
        />
        <TouchableOpacity style={styles.filterButton} onPress={() => setShowFilters(true)}>
          <Text style={styles.filterButtonText}>Filter</Text>
        </TouchableOpacity>
      </View>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <Text style={styles.summaryText}>
          Ditemukan {total} transaksi
        </Text>
      </View>

      {/* Error */}
      {error && <ErrorBanner message={error} style={styles.error} />}

      {/* Transaction List */}
      {transactions.length === 0 ? (
        <EmptyState message="Tidak ada transaksi ditemukan." />
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderTransaction}
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

      {/* Filter Modal */}
      <Modal visible={showFilters} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <Card style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filter Transaksi</Text>

            <View style={styles.filterSection}>
              <Text style={styles.label}>Tipe</Text>
              <View style={styles.typeButtons}>
                {(['ALL', 'IN', 'OUT'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.typeButton,
                      typeFilter === t && styles.typeButtonActive,
                    ]}
                    onPress={() => setTypeFilter(t)}
                  >
                    <Text
                      style={[
                        styles.typeButtonText,
                        typeFilter === t && styles.typeButtonTextActive,
                      ]}
                    >
                      {t === 'ALL' ? 'Semua' : t === 'IN' ? 'Pemasukan' : 'Pengeluaran'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.label}>Tanggal Mulai</Text>
              <TextInput
                style={styles.input}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#6070a4"
              />
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.label}>Tanggal Akhir</Text>
              <TextInput
                style={styles.input}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#6070a4"
              />
            </View>

            <View style={styles.modalButtons}>
              <Button title="Reset" onPress={handleResetFilters} color="#6070a4" />
              <Button title="Terapkan" onPress={handleApplyFilters} />
            </View>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowFilters(false)}
            >
              <Text style={styles.closeButtonText}>Tutup</Text>
            </TouchableOpacity>
          </Card>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1020',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#111a34',
    color: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1d2a52',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filterButton: {
    backgroundColor: '#111a34',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1d2a52',
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  filterButtonText: {
    color: '#d8def0',
    fontSize: 14,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    maxHeight: '80%',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  filterSection: {
    marginBottom: 16,
  },
  label: {
    color: '#b7c0d6',
    fontSize: 12,
    marginBottom: 6,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#0b1020',
    borderWidth: 1,
    borderColor: '#1d2a52',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#6070a4',
    borderColor: '#6070a4',
  },
  typeButtonText: {
    color: '#b7c0d6',
    fontSize: 12,
  },
  typeButtonTextActive: {
    color: '#ffffff',
    fontWeight: '600',
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
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  closeButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#6070a4',
    fontSize: 14,
  },
});
