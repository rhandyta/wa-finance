export function toCurrency(n: number, currency: string) {
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

export function formatDateYyyyMmDd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatDateDisplay(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTimeDisplay(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function monthKeyFromDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

export function getTypeLabel(type: 'IN' | 'OUT') {
  return type === 'IN' ? 'Pemasukan' : 'Pengeluaran';
}

export function getTypeColor(type: 'IN' | 'OUT') {
  return type === 'IN' ? '#4ade80' : '#f87171';
}

export function getAuditActionLabel(action: string) {
  const labels: Record<string, string> = {
    transaction_create_api: 'Membuat transaksi',
    transaction_update_api: 'Mengubah transaksi',
    transaction_delete_api: 'Menghapus transaksi',
    transaction_delete_last: 'Menghapus transaksi terakhir',
    transaction_restore_last: 'Memulihkan transaksi',
    category_add: 'Menambah kategori',
    merchant_rule_upsert: 'Mengubah aturan merchant',
  };
  return labels[action] || action;
}
