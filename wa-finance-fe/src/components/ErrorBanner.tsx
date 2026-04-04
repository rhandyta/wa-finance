import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';

interface ErrorBannerProps {
  message: string;
  style?: ViewStyle;
}

export function ErrorBanner({ message, style }: ErrorBannerProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#2d1b1b',
    borderColor: '#5c2d2d',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    fontSize: 18,
  },
  message: {
    color: '#ffb4b4',
    fontSize: 14,
    flex: 1,
  },
});
