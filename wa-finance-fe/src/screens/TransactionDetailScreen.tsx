import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Transaction, AppConfig } from '../types';
import { ApiService } from '../services/api';
import { Card } from '../components/Card';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { ErrorBanner } from '../components/ErrorBanner';
import { toCurrency, formatDateDisplay, getTypeLabel, getTypeColor } from '../utils/format';

interface TransactionDetailScreenProps {
  config: AppConfig;
  transactionId: number;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function TransactionDetailScreen({
  config,
  transactionId,
  onBack,
  onEdit,
  onDelete,
}: TransactionDetailScreenProps) {
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const api = new ApiService(config);

  useEffect(() => {
    fetchTransaction();
  }, [transactionId]);

  const fetchTransaction = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getTransaction(transactionId);
      setTransaction(data);
    } catch (e: any) {
      setError(e?.message || 'Gagal mengambil detail transaksi');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Hapus Transaksi',
      'Apakah kamu yakin ingin menghapus transaksi ini?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await api.deleteTransaction(transactionId);
              onDelete();
            } catch (e: any) {
              Alert.alert('Gagal', e?.message || 'Gagal menghapus transaksi');
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return <LoadingIndicator />;
  }

  if (error) {
    return (
      <View style={styles.container}>
        <ErrorBanner message={error} />
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Kembali</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!transaction) {
    return (
      <View style={styles.container}>
        <Text style={styles.notFound}>Transaksi tidak ditemukan</Text>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Kembali</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backIcon}>
          <Text style={styles.backIconText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Detail Transaksi</Text>
      </View>

      {/* Main Info */}
      <Card style={styles.card}>
        <View style={styles.typeRow}>
          <View style={[styles.typeBadge, { backgroundColor: getTypeColor(transaction.type) }]}>
            <Text style={styles.typeText}>{getTypeLabel(transaction.type)}</Text>
          </View>
          <Text style={styles.amount}>{toCurrency(transaction.amount, config.currency)}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.label}>Tanggal</Text>
          <Text style={styles.value}>{formatDateDisplay(transaction.transaction_date)}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.label}>Kategori</Text>
          <Text style={styles.value}>{transaction.category}</Text>
        </View>

        {transaction.merchant && (
          <View style={styles.detailRow}>
            <Text style={styles.label}>Merchant</Text>
            <Text style={styles.value}>{transaction.merchant}</Text>
          </View>
        )}

        {transaction.description && (
          <View style={styles.detailRow}>
            <Text style={styles.label}>Keterangan</Text>
            <Text style={styles.value}>{transaction.description}</Text>
          </View>
        )}

        <View style={styles.detailRow}>
          <Text style={styles.label}>ID Transaksi</Text>
          <Text style={styles.value}>#{transaction.id}</Text>
        </View>
      </Card>

      {/* Items */}
      {transaction.items && transaction.items.length > 0 && (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Item Transaksi</Text>
          {transaction.items.map((item, idx) => (
            <View key={item.id || idx} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.item_name}</Text>
                <Text style={styles.itemQty}>x{item.quantity}</Text>
              </View>
              <Text style={styles.itemPrice}>
                {toCurrency(item.price * item.quantity, config.currency)}
              </Text>
            </View>
          ))}
        </Card>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.editButton} onPress={onEdit}>
          <Text style={styles.editButtonText}>Edit Transaksi</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.deleteButton, deleting && styles.deleteButtonDisabled]}
          onPress={handleDelete}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.deleteButtonText}>Hapus Transaksi</Text>
          )}
        </TouchableOpacity>
      </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backIcon: {
    padding: 8,
  },
  backIconText: {
    color: '#6070a4',
    fontSize: 24,
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  card: {
    gap: 12,
  },
  typeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  typeText: {
    color: '#0b1020',
    fontSize: 12,
    fontWeight: '700',
  },
  amount: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1d2a52',
  },
  label: {
    color: '#b7c0d6',
    fontSize: 14,
  },
  value: {
    color: '#ffffff',
    fontSize: 14,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1d2a52',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    color: '#ffffff',
    fontSize: 14,
  },
  itemQty: {
    color: '#b7c0d6',
    fontSize: 12,
    marginTop: 2,
  },
  itemPrice: {
    color: '#d8def0',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  actions: {
    gap: 12,
  },
  editButton: {
    backgroundColor: '#6070a4',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#9b1c1c',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  notFound: {
    color: '#b7c0d6',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  backButton: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#6070a4',
    borderRadius: 10,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
