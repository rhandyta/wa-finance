import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Transaction, TransactionItem } from '../types';
import { toCurrency, formatDateDisplay, getTypeColor } from '../utils/format';

interface TransactionItemProps {
  transaction: Transaction;
  currency: string;
  onPress?: (transaction: Transaction) => void;
  showItems?: boolean;
}

export function TransactionItemCard({ transaction, currency, onPress, showItems = false }: TransactionItemProps) {
  const [expanded, setExpanded] = useState(false);
  const hasItems = transaction.items && transaction.items.length > 0;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => {
        if (hasItems) setExpanded(!expanded);
        if (onPress) onPress(transaction);
      }}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.left}>
          <View style={[styles.typeBadge, { backgroundColor: getTypeColor(transaction.type) }]}>
            <Text style={styles.typeText}>{transaction.type === 'IN' ? 'IN' : 'OUT'}</Text>
          </View>
          <View style={styles.info}>
            <Text style={styles.category} numberOfLines={1}>{transaction.category}</Text>
            {transaction.merchant && (
              <Text style={styles.merchant} numberOfLines={1}>{transaction.merchant}</Text>
            )}
          </View>
        </View>
        <View style={styles.right}>
          <Text style={styles.amount}>{toCurrency(transaction.amount, currency)}</Text>
          <Text style={styles.date}>{formatDateDisplay(transaction.transaction_date)}</Text>
        </View>
      </View>

      {transaction.description && (
        <Text style={styles.description} numberOfLines={2}>{transaction.description}</Text>
      )}

      {showItems && hasItems && expanded && (
        <View style={styles.itemsContainer}>
          {transaction.items!.map((item: TransactionItem, idx: number) => (
            <View key={idx} style={styles.itemRow}>
              <Text style={styles.itemName}>{item.item_name}</Text>
              <Text style={styles.itemDetail}>
                x{item.quantity} {toCurrency(item.price, currency)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {showItems && hasItems && (
        <View style={styles.expandHint}>
          <Text style={styles.expandText}>{expanded ? '▼' : '▶'} Tap untuk {expanded ? 'tutup' : 'lihat'} item</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111a34',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1d2a52',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeText: {
    color: '#0b1020',
    fontSize: 10,
    fontWeight: '700',
  },
  info: {
    flex: 1,
  },
  category: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  merchant: {
    color: '#b7c0d6',
    fontSize: 12,
    marginTop: 2,
  },
  right: {
    alignItems: 'flex-end',
  },
  amount: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  date: {
    color: '#b7c0d6',
    fontSize: 11,
    marginTop: 2,
  },
  description: {
    color: '#b7c0d6',
    fontSize: 12,
    marginTop: 8,
  },
  itemsContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1d2a52',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  itemName: {
    color: '#d8def0',
    fontSize: 12,
    flex: 1,
    paddingRight: 8,
  },
  itemDetail: {
    color: '#b7c0d6',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  expandHint: {
    marginTop: 6,
    alignItems: 'center',
  },
  expandText: {
    color: '#6070a4',
    fontSize: 11,
  },
});
