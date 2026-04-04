import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';

interface EmptyStateProps {
  message: string;
  style?: ViewStyle;
}

export function EmptyState({ message, style }: EmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.icon}>📭</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 48,
    marginBottom: 12,
  },
  message: {
    color: '#b7c0d6',
    fontSize: 14,
    textAlign: 'center',
  },
});
