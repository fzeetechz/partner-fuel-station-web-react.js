import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search, X, Inbox, LoaderCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
export function Badge({ children, tone }: {
    children: ReactNode;
    tone?: string;
}) { const str = String(children); const color = tone || (['Completed', 'Active', 'Online', 'Unused', 'Paid'].includes(str) ? 'green' : ['Pending', 'Low stock', 'Offline', 'Expired'].includes(str) ? 'amber' : ['Failed', 'Inactive'].includes(str) ? 'red' : 'blue'); return <span className={`badge ${color}`}><i />{children}</span>; }
export function Button({ children, onClick, variant = 'primary', disabled = false, type = 'button' }: {
    children: ReactNode;
    onClick?: () => void;
    variant?: string;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
}) { return <button type={type} className={`btn ${variant}`} onClick={onClick} disabled={disabled}>{children}</button>; }
export function Modal({ title, children, onClose, wide = false }: {
    title: string;
    children: ReactNode;
    onClose: () => void;
    wide?: boolean;
}) { useEffect(() => { const prev = document.activeElement as HTMLElement; const handle = (e: KeyboardEvent) => { if (e.key === 'Escape')
    onClose(); if (e.key === 'Tab') {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('.modal button,.modal input,.modal select,.modal textarea,.modal a')).filter(e => !e.hasAttribute('disabled'));
    const first = elements[0], last = elements.at(-1);
    if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
    }
    else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
    }
} }; document.addEventListener('keydown', handle); document.body.style.overflow = 'hidden'; const focusTimer = setTimeout(() => document.querySelector<HTMLElement>('.modal input,.modal button')?.focus(), 0); return () => { clearTimeout(focusTimer); document.removeEventListener('keydown', handle); document.body.style.overflow = ''; prev?.focus(); }; }, [onClose]); return createPortal(<div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget)
    onClose(); }}><section className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><h2>{title}</h2><button className="icon-btn" aria-label="Close dialog" onClick={onClose}><X size={20}/></button></div>{children}</section></div>, document.body); }
export interface Field {
    name: string;
    label: string;
    type?: string;
    required?: boolean;
    min?: number;
    max?: number;
    options?: {
        value: string;
        label: string;
    }[];
    defaultValue?: string | number;
}
export function DataForm({ fields, initial = {}, onSubmit, label = 'Save changes', children }: {
    fields: Field[];
    initial?: Record<string, unknown>;
    onSubmit: (values: Record<string, string | number>) => Promise<unknown>;
    label?: string;
    children?: ReactNode;
}) {
    const shape: Record<string, z.ZodType> = {};
    fields.forEach(f => { if (f.type === 'number')
        shape[f.name] = z.coerce.number().min(f.min ?? 0, f.min ? `Minimum value is ${f.min}` : 'Cannot be negative').max(f.max ?? Number.MAX_SAFE_INTEGER);
    else {
        let rule = z.string().trim();
        if (f.required !== false)
            rule = rule.min(1, 'This field is required');
        if (f.type === 'email')
            rule = rule.email('Enter a valid email');
        if (f.type === 'password')
            rule = rule.min(8, 'Use at least 8 characters');
        shape[f.name] = rule;
    } });
    const defaults = Object.fromEntries(fields.map(f => [f.name, initial[f.name] ?? f.defaultValue ?? (f.options?.[0]?.value || '')]));
    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(z.object(shape)), defaultValues: defaults });
    const [error, setError] = useState('');
    return <form onReset={e => { e.preventDefault(); reset(defaults); setError(''); }} onSubmit={handleSubmit(async (values) => { setError(''); try {
        await onSubmit(values as Record<string, string | number>);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to save');
    } })}><div className="form-grid">{fields.map(f => <label className="field" key={f.name}><span>{f.label}{f.required !== false && <em> *</em>}</span>{f.options ? <select {...register(f.name)}>{f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select> : <input {...register(f.name)} type={f.type || 'text'} step={f.type === 'number' ? '0.01' : undefined} autoComplete={f.type === 'password' ? 'new-password' : undefined}/>}{errors[f.name] && <small className="error">{String(errors[f.name]?.message)}</small>}</label>)}</div>{children}{error && <p className="error" role="alert">{error}</p>}<div className="form-footer"><Button type="reset" variant="secondary">Reset</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? <LoaderCircle size={16} className="spin"/> : null}{label}</Button></div></form>;
}
export interface Column<T> {
    key: string;
    label: string;
    render?: (row: T) => ReactNode;
    value?: (row: T) => string | number;
}
export function DataTable<T extends {
    id: string;
}>({ rows, columns, searchPlaceholder = 'Search records…', onRow, pageSize = 8, toolbar }: {
    rows: T[];
    columns: Column<T>[];
    searchPlaceholder?: string;
    onRow?: (row: T) => void;
    pageSize?: number;
    toolbar?: ReactNode;
}) { const [search, setSearch] = useState(''); const [page, setPage] = useState(1); const [sort, setSort] = useState<{
    key: string;
    asc: boolean;
} | null>(null); const filtered = rows.filter(r => JSON.stringify(r).toLowerCase().includes(search.toLowerCase())); if (sort) {
    const col = columns.find(c => c.key === sort.key);
    filtered.sort((a, b) => { const av = col?.value ? col.value(a) : String((a as Record<string, unknown>)[sort.key] ?? ''); const bv = col?.value ? col.value(b) : String((b as Record<string, unknown>)[sort.key] ?? ''); return (typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))) * (sort.asc ? 1 : -1); });
} const pages = Math.max(1, Math.ceil(filtered.length / pageSize)); const safePage = Math.min(page, pages); return <><div className="table-toolbar"><div className="search-box"><Search size={16}/><input aria-label={searchPlaceholder} placeholder={searchPlaceholder} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}/></div><div className="table-filters">{toolbar}</div></div><div className="table-scroll"><table><thead><tr>{columns.map(c => <th key={c.key}><button onClick={() => setSort({ key: c.key, asc: sort?.key === c.key ? !sort.asc : true })}>{c.label}{sort?.key === c.key ? (sort.asc ? <ArrowUp size={12}/> : <ArrowDown size={12}/>) : null}</button></th>)}</tr></thead><tbody>{filtered.slice((safePage - 1) * pageSize, safePage * pageSize).map(row => <tr key={row.id} className={onRow ? 'clickable' : ''} tabIndex={onRow ? 0 : undefined} onKeyDown={e => { if (onRow && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    onRow(row);
} }} onClick={() => onRow?.(row)}>{columns.map(c => <td key={c.key}>{c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '—')}</td>)}</tr>)}</tbody></table></div>{!filtered.length && <div className="empty"><Inbox /><h3>No records found</h3><p>Try another search or adjust your filters.</p></div>}<div className="pagination"><span>Showing {filtered.length ? (safePage - 1) * pageSize + 1 : 0}–{Math.min(safePage * pageSize, filtered.length)} of {filtered.length} records</span><div><button className="icon-btn" aria-label="Previous page" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}><ChevronLeft size={16}/></button><span>{safePage} / {pages}</span><button className="icon-btn" aria-label="Next page" disabled={safePage === pages} onClick={() => setPage(safePage + 1)}><ChevronRight size={16}/></button></div></div></>; }
export function PageTitle({ eyebrow, title, description, actions }: {
    eyebrow?: string;
    title: string;
    description: string;
    actions?: ReactNode;
}) { return <div className="page-title"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1><p>{description}</p></div><div className="page-actions">{actions}</div></div>; }
export function Panel({ title, subtitle, action, children, className = '' }: {
    title?: string;
    subtitle?: string;
    action?: ReactNode;
    children: ReactNode;
    className?: string;
}) { return <section className={`panel ${className}`}>{title && <div className="panel-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>}{children}</section>; }
export function Metric({ label, value, icon, detail, tone = 'blue' }: {
    label: string;
    value: string;
    icon: ReactNode;
    detail?: ReactNode;
    tone?: string;
}) { return <div className={`metric ${tone}`}><div className="metric-top"><span>{label}</span><div className="metric-icon">{icon}</div></div><strong>{value}</strong><div className="metric-detail">{detail || 'Across your selected station'}</div></div>; }
