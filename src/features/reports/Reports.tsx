import { useState } from 'react';
import { format, startOfWeek, startOfMonth } from 'date-fns';
import { Download, Printer, Wallet, Fuel, Activity, TrendingUp } from 'lucide-react';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { PageTitle, Panel, Metric, Button, DataTable } from '../../components/ui';
import { usePortal } from '../../hooks/usePortal';
import { useAppStore } from '../../store';
import { summarize } from '../../services/mock/engine';
import { money, number, exportCSV } from '../../utils';
export function Reports() {
    const { data } = usePortal();
    const stationId = useAppStore(s => s.stationId);
    const [kind, setKind] = useState('Fuel sales');
    const [group, setGroup] = useState('Daily');
    const [fuel, setFuel] = useState('All');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    if (!data)
        return null;
    const fuels = data.inventory.filter(f => f.stationId === stationId);
    const tx = data.transactions.filter(t => t.stationId === stationId && (fuel === 'All' || t.fuelId === fuel) && (!from || t.date.slice(0, 10) >= from) && (!to || t.date.slice(0, 10) <= to));
    const totals = summarize(tx);
    const inventory = fuels.filter(f => fuel === 'All' || f.id === fuel);
    const dayGroups = Object.entries(Object.groupBy(tx, t => format(group === 'Weekly' ? startOfWeek(new Date(t.date), { weekStartsOn: 1 }) : group === 'Monthly' ? startOfMonth(new Date(t.date)) : new Date(t.date), 'yyyy-MM-dd'))).map(([id, rows]) => ({ id, ...summarize(rows || []) })).sort((a, b) => a.id.localeCompare(b.id));
    const fuelRows = inventory.map(f => ({ id: f.id, name: f.name, ...summarize(tx.filter(t => t.fuelId === f.id)), stock: f.quantity, capacity: f.capacity }));
    const staffRows = data.staff.filter(s => s.stationId === stationId).map(s => ({ id: s.id, name: s.name, ...summarize(tx.filter(t => t.operatorId === s.id)) }));
    const settlementRows = data.settlements.filter(s => s.stationId === stationId && (!from || s.date.slice(0, 10) >= from) && (!to || s.date.slice(0, 10) <= to)).map(s => ({ id: s.id, date: s.date.slice(0, 10), status: s.status, count: s.transactionIds.filter(id => tx.some(t => t.id === id)).length, revenue: tx.filter(t => s.transactionIds.includes(t.id) && t.status === 'Completed').reduce((n, t) => n + t.amount, 0) }));
    const reportRows: Record<string, unknown>[] = kind === 'Operator performance' ? staffRows : kind === 'Inventory' ? fuelRows.map(f => ({ id: f.id, name: f.name, stock: f.stock, capacity: f.capacity, liters: f.liters })) : kind === 'Transactions' ? tx.map(t => ({ ...t })) : kind === 'Settlements' ? settlementRows : kind === 'Daily / weekly / monthly' ? dayGroups : fuelRows;
    const columns = kind === 'Transactions' ? [{ key: 'id', label: 'Transaction ID' }, { key: 'date', label: 'Date' }, { key: 'quantity', label: 'Liters' }, { key: 'amount', label: 'Amount (GHS)' }, { key: 'status', label: 'Status' }] : kind === 'Inventory' ? [{ key: 'name', label: 'Fuel type' }, { key: 'stock', label: 'Available (L)' }, { key: 'capacity', label: 'Capacity (L)' }, { key: 'liters', label: 'Dispensed in period (L)' }] : kind === 'Settlements' ? [{ key: 'id', label: 'Settlement ID' }, { key: 'date', label: 'Date' }, { key: 'status', label: 'Status' }, { key: 'count', label: 'Matched transactions' }, { key: 'revenue', label: 'Matched value (GHS)' }] : [{ key: kind === 'Daily / weekly / monthly' ? 'id' : 'name', label: kind === 'Operator performance' ? 'Operator' : kind === 'Daily / weekly / monthly' ? 'Date' : 'Fuel type' }, { key: 'count', label: 'Transactions' }, { key: 'liters', label: 'Volume (L)' }, { key: 'revenue', label: 'Revenue (GHS)' }];
    return <div className="printable-report"><PageTitle eyebrow="REPORTS & ANALYTICS" title="Turn insights into your next move." description="Understand your performance with reports built from your station’s shared records." actions={<><Button variant="secondary" onClick={() => window.print()}><Printer size={16}/>Print report / PDF</Button><Button onClick={() => exportCSV(`${kind.toLowerCase().replaceAll(' ', '-')}-report`, reportRows)}><Download size={16}/>Export CSV</Button></>}/><Panel><div className="filter-strip"><label>Report type<select value={kind} onChange={e => setKind(e.target.value)}>{['Fuel sales', 'Inventory', 'Transactions', 'Settlements', 'Operator performance', 'Daily / weekly / monthly'].map(v => <option key={v}>{v}</option>)}</select></label><label>Group by<select value={group} onChange={e => setGroup(e.target.value)}>{['Daily', 'Weekly', 'Monthly'].map(v => <option key={v}>{v}</option>)}</select></label><label>From<input type="date" value={from} onChange={e => setFrom(e.target.value)}/></label><label>To<input type="date" value={to} min={from} onChange={e => setTo(e.target.value)}/></label><label>Fuel type<select value={fuel} onChange={e => setFuel(e.target.value)}><option value="All">All fuel types</option>{fuels.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label><div className="report-station">Station: <strong>{data.stations.find(s => s.id === stationId)?.name}</strong></div></div></Panel><div className="metrics-grid"><Metric label="Completed revenue" value={money(totals.revenue)} icon={<Wallet size={20}/>}/><Metric label="Fuel dispensed" value={`${number(totals.liters)} L`} icon={<Fuel size={20}/>} tone="orange"/><Metric label="Completed transactions" value={number(totals.count)} icon={<Activity size={20}/>}/><Metric label="Average transaction" value={money(totals.revenue / (totals.count || 1))} icon={<TrendingUp size={20}/>}/></div><Panel title={`${group} sales performance`} subtitle="Completed revenue for your selected date range"><div className="report-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={dayGroups}><CartesianGrid vertical={false} stroke="var(--border)"/><XAxis dataKey="id" tickFormatter={v => v.slice(5)} tick={{ fontSize: 11 }} axisLine={false} tickLine={false}/><YAxis tickFormatter={v => `${v / 1000}k`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false}/><Tooltip formatter={v => money(Number(v))}/><Bar isAnimationActive={false} dataKey="revenue" fill="#062d65" radius={[5, 5, 0, 0]}/></BarChart></ResponsiveContainer></div></Panel><Panel title={`${kind} report`} subtitle="Values include completed transactions only; inventory shows the current tank balance."><DataTable key={kind} rows={reportRows as ({
        id: string;
    } & Record<string, unknown>)[]} columns={columns}/></Panel></div>;
}
