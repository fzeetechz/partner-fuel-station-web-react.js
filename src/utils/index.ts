import { format } from 'date-fns';
export const money = (n: number) => new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS', maximumFractionDigits: 2 }).format(n);
export const number = (n: number) => new Intl.NumberFormat('en-GH', { maximumFractionDigits: 1 }).format(n);
export const date = (value: string, pattern = 'dd MMM yyyy, HH:mm') => format(new Date(value), pattern);
export function exportCSV(name: string, rows: Record<string, unknown>[]) { if (!rows.length)
    return; const keys = Object.keys(rows[0]); const cell = (v: unknown) => `"${String(v ?? '').replace(/^[=+@\-]/, "'" + '$&').replaceAll('"', '""')}"`; const blob = new Blob(['\uFEFF' + [keys.map(cell).join(','), ...rows.map(row => keys.map(k => cell(row[k])).join(','))].join('\r\n')], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `neyfuel-${name}.csv`; a.click(); URL.revokeObjectURL(url); }
