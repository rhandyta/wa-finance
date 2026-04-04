import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Transaction, TransactionType, TransactionItem, AppConfig } from '../types';
import { ApiService } from '../services/api';
import { Card } from '../components/Card';
import { LoadingIndicator } from '../components/LoadingIndicator';

interface AddEditTransactionScreenProps {
  config: AppConfig;
  transaction?: Transaction | null;
  onSave: () => void;
  onCancel: () => void;
}

export function AddEditTransactionScreen({
  config,
  transaction,
  onSave,
  onCancel,
}: AddEditTransactionScreenProps) {
  const isEdit = !!transaction;
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [merchants, setMerchants] = useState<string[]>([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showMerchantDropdown, setShowMerchantDropdown] = useState(false);

  // Form fields
  const [transactionDate, setTransactionDate] = useState(
    transaction?.transaction_date || new Date().toISOString().split('T')[0],
  );
  const [type, setType] = useState<TransactionType>(transaction?.type || 'OUT');
  const [amount, setAmount] = useState(transaction?.amount?.toString() || '');
  const [category, setCategory] = useState(transaction?.category || '');
  const [merchant, setMerchant] = useState(transaction?.merchant || '');
  const [description, setDescription] = useState(transaction?.description || '');
  const [items, setItems] = useState<TransactionItem[]>(transaction?.items || []);

  const api = new ApiService(config);

  useEffect(() => {
    loadDropdownData();
  }, []);

  const loadDropdownData = async () => {
    setLoading(true);
    try {
      const [catResult, merchResult] = await Promise.all([
        api.getCategories(),
        api.getMerchants(),
      ]);
      setCategories(catResult.categories || []);
      setMerchants(merchResult.merchants || []);
    } catch (e: any) {
      console.error('Failed to load dropdown data:', e);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    if (!transactionDate) return 'Tanggal wajib diisi';
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return 'Jumlah harus lebih dari 0';
    if (!category) return 'Kategori wajib diisi';
    return null;
  };

  const handleSubmit = async () => {
    const error = validateForm();
    if (error) {
      Alert.alert('Validasi', error);
      return;
    }

    setSubmitting(true);
    try {
      const data = {
        transaction_date: transactionDate,
        type,
        amount: Number(amount),
        currency: config.currency,
        category,
        merchant: merchant || null,
        description: description || null,
        items: items.length > 0 ? items : undefined,
      };

      if (isEdit && transaction) {
        await api.updateTransaction(transaction.id, data);
      } else {
        await api.createTransaction(data);
      }
      onSave();
    } catch (e: any) {
      Alert.alert('Gagal', e?.message || 'Gagal menyimpan transaksi');
    } finally {
      setSubmitting(false);
    }
  };

  const addItem = () => {
    setItems([...items, { item_name: '', quantity: 1, price: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof TransactionItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  if (loading) {
    return <LoadingIndicator />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.backIcon}>
          <Text style={styles.backIconText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{isEdit ? 'Edit' : 'Tambah'} Transaksi</Text>
      </View>

      {/* Form */}
      <Card style={styles.card}>
        {/* Date */}
        <View style={styles.field}>
          <Text style={styles.label}>Tanggal</Text>
          <TextInput
            style={styles.input}
            value={transactionDate}
            onChangeText={setTransactionDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#6070a4"
          />
        </View>

        {/* Type */}
        <View style={styles.field}>
          <Text style={styles.label}>Tipe</Text>
          <View style={styles.typeButtons}>
            {(['IN', 'OUT'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.typeButton, type === t && styles.typeButtonActive]}
                onPress={() => setType(t)}
              >
                <Text style={[styles.typeButtonText, type === t && styles.typeButtonTextActive]}>
                  {t === 'IN' ? 'Pemasukan' : 'Pengeluaran'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Amount */}
        <View style={styles.field}>
          <Text style={styles.label}>Jumlah ({config.currency})</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            placeholderTextColor="#6070a4"
            keyboardType="numeric"
          />
        </View>

        {/* Category */}
        <View style={styles.field}>
          <Text style={styles.label}>Kategori</Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
          >
            <Text style={category ? styles.dropdownValue : styles.dropdownPlaceholder}>
              {category || 'Pilih kategori'}
            </Text>
            <Text style={styles.dropdownArrow}>▼</Text>
          </TouchableOpacity>
          {showCategoryDropdown && (
            <View style={styles.dropdownList}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setCategory(cat);
                    setShowCategoryDropdown(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Merchant */}
        <View style={styles.field}>
          <Text style={styles.label}>Merchant (opsional)</Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setShowMerchantDropdown(!showMerchantDropdown)}
          >
            <Text style={merchant ? styles.dropdownValue : styles.dropdownPlaceholder}>
              {merchant || 'Pilih merchant'}
            </Text>
            <Text style={styles.dropdownArrow}>▼</Text>
          </TouchableOpacity>
          {showMerchantDropdown && (
            <View style={styles.dropdownList}>
              {merchants.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setMerchant(m);
                    setShowMerchantDropdown(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>Keterangan (opsional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Tambahkan catatan..."
            placeholderTextColor="#6070a4"
            multiline
            numberOfLines={3}
          />
        </View>
      </Card>

      {/* Items Section */}
      <Card style={styles.card}>
        <View style={styles.itemsHeader}>
          <Text style={styles.sectionTitle}>Item Transaksi</Text>
          <TouchableOpacity style={styles.addButton} onPress={addItem}>
            <Text style={styles.addButtonText}>+ Tambah</Text>
          </TouchableOpacity>
        </View>

        {items.length === 0 ? (
          <Text style={styles.noItems}>Belum ada item</Text>
        ) : (
          items.map((item, index) => (
            <View key={index} style={styles.itemCard}>
              <View style={styles.itemRow}>
                <TextInput
                  style={styles.itemNameInput}
                  value={item.item_name}
                  onChangeText={(text) => updateItem(index, 'item_name', text)}
                  placeholder="Nama item"
                  placeholderTextColor="#6070a4"
                />
                <TouchableOpacity onPress={() => removeItem(index)} style={styles.removeButton}>
                  <Text style={styles.removeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.itemRow}>
                <TextInput
                  style={[styles.itemInput, styles.qtyInput]}
                  value={item.quantity.toString()}
                  onChangeText={(text) => updateItem(index, 'quantity', parseInt(text) || 1)}
                  placeholder="Qty"
                  placeholderTextColor="#6070a4"
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.itemInput, styles.priceInput]}
                  value={item.price.toString()}
                  onChangeText={(text) => updateItem(index, 'price', parseInt(text) || 0)}
                  placeholder="Harga"
                  placeholderTextColor="#6070a4"
                  keyboardType="numeric"
                />
              </View>
            </View>
          ))
        )}
      </Card>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.submitButtonText}>
            {isEdit ? 'Simpan Perubahan' : 'Simpan Transaksi'}
          </Text>
        )}
      </TouchableOpacity>
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
    gap: 16,
  },
  field: {
    gap: 6,
  },
  label: {
    color: '#b7c0d6',
    fontSize: 12,
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
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
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0b1020',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1d2a52',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownValue: {
    color: '#ffffff',
    fontSize: 14,
  },
  dropdownPlaceholder: {
    color: '#6070a4',
    fontSize: 14,
  },
  dropdownArrow: {
    color: '#6070a4',
    fontSize: 10,
  },
  dropdownList: {
    backgroundColor: '#111a34',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1d2a52',
    maxHeight: 200,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1d2a52',
  },
  dropdownItemText: {
    color: '#ffffff',
    fontSize: 14,
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#6070a4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  noItems: {
    color: '#b7c0d6',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },
  itemCard: {
    backgroundColor: '#0b1020',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1d2a52',
  },
  itemRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  itemNameInput: {
    flex: 1,
    backgroundColor: '#111a34',
    color: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1d2a52',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  itemInput: {
    backgroundColor: '#111a34',
    color: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1d2a52',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  qtyInput: {
    width: 60,
  },
  priceInput: {
    flex: 1,
  },
  removeButton: {
    backgroundColor: '#9b1c1c',
    borderRadius: 6,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#ffffff',
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: '#6070a4',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
