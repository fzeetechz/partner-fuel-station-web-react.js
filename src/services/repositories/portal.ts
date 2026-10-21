import type { Database, Entity, SaleInput } from '../../types';
import { createSeed } from '../mock/seed';
import { changeStock, completeSale } from '../mock/engine';
import { apiClient, dataMode } from '../api/client';
import { useAppStore } from '../../store';
import { validateImport } from '../../features/listings/importEngine';
import type { ImportMode,ImportRow } from '../../features/listings/importSchema';
const key = 'neyfuel-database-v1';
function read(): Database { const raw = localStorage.getItem(key); if (raw) {
    try {
        return JSON.parse(raw);
    }
    catch {
        throw new Error('Demo data could not be read. Reset the demo from Settings.');
    }
} const db = createSeed(); write(db); return db; }
function write(db: Database) { localStorage.setItem(key, JSON.stringify(db)); }
function guard(owner = false) { const s = useAppStore.getState().session; if (!s || s.expires < Date.now())
    throw new Error('Session expired. Please sign in again.'); if (owner && s.role !== 'FUEL_STATION_OWNER')
    throw new Error('This action requires station owner access.'); return s; }
function checkStation(stationId: string) { const s = guard(); if (!s.stationIds.includes(stationId))
    throw new Error('Station access denied.'); }
export const portalRepository = {
    async previewImport(entity:Entity,rows:ImportRow[],stationId:string,mode:ImportMode){guard(true);checkStation(stationId);if(dataMode!=='mock')return (await apiClient.post('/bulk/preview',{entity,rows,stationId,mode})).data;const preview=validateImport(read(),entity,rows,stationId,mode);return {results:preview.results,valid:preview.valid};},
    async importRows(entity:Entity,rows:ImportRow[],stationId:string,mode:ImportMode){guard(true);checkStation(stationId);if(dataMode!=='mock')return (await apiClient.post('/bulk/import',{entity,rows,stationId,mode})).data;const preview=validateImport(read(),entity,rows,stationId,mode);if(!preview.valid)throw new Error('Import blocked. Some records are invalid or changed since preview. Validate the file again.');write(preview.database);return {count:rows.length};},
    async getSnapshot(): Promise<Database> { const session = guard(); if (dataMode !== 'mock')
        return (await apiClient.get<Database>('/partner/snapshot')).data; await new Promise(r => setTimeout(r, 160)); const db = read(); const allowed = session.stationIds; return Object.fromEntries(Object.entries(db).map(([name, rows]) => [name, rows.filter((r: {
            id: string;
            stationId?: string;
        }) => allowed.includes(name === 'stations' ? r.id : r.stationId || ''))])) as unknown as Database; },
    async save(entity: Entity, record: Record<string, unknown>) { guard(true); const stationId = String(entity === 'stations' ? record.id : record.stationId); checkStation(stationId); if (dataMode !== 'mock')
        return (await apiClient.put(`/${entity}/${record.id || ''}`, record)).data; const db = read(); const rows = db[entity] as unknown as Record<string, unknown>[]; const index = rows.findIndex(r => r.id === record.id); const row = { ...record, id: record.id || `${entity.slice(0, 3).toUpperCase()}-${crypto.randomUUID().slice(0, 8)}` }; if (index >= 0)
        rows[index] = row;
    else
        rows.unshift(row); write(db); return row; },
    async remove(entity: Entity, id: string) { guard(true); if (dataMode !== 'mock')
        return apiClient.delete(`/${entity}/${id}`); const db = read(); const rows = db[entity] as unknown as Record<string, unknown>[]; const row = rows.find(r => r.id === id); if (!row)
        throw new Error('Record not found.'); checkStation(String(row.stationId || row.id)); if (entity === 'staff' && db.devices.some(d => d.operatorId === id))
        throw new Error('Reassign this operator’s POS device before deleting.'); if (entity === 'staff' && db.transactions.some(t => t.operatorId === id))
        throw new Error('This operator has transaction history. Deactivate them to preserve records.'); if (entity === 'inventory' && db.transactions.some(t => t.fuelId === id))
        throw new Error('Fuel with transaction history cannot be deleted.'); rows.splice(rows.findIndex(r => r.id === id), 1); write(db); },
    async sale(input: SaleInput) { checkStation(input.stationId); if (dataMode !== 'mock')
        return (await apiClient.post('/transactions', input)).data; const db = read(); const result = completeSale(db, input); write(db); return result; },
    async stock(fuelId: string, quantity: number, reason: string) { guard(true); if (dataMode !== 'mock')
        return apiClient.post('/inventory/adjustments', { fuelId, quantity, reason }); const db = read(); const fuel = db.inventory.find(f => f.id === fuelId); if (!fuel)
        throw new Error('Fuel not found.'); checkStation(fuel.stationId); changeStock(db, fuelId, quantity, reason); write(db); },
    async markRead(ids: string[]) { guard(); if (dataMode !== 'mock')
        return apiClient.post('/notifications/read', { ids }); const db = read(); const allowed = useAppStore.getState().session!.stationIds; db.notifications.forEach(n => { if (ids.includes(n.id) && allowed.includes(n.stationId))
        n.read = true; }); write(db); },
    async settle(id: string) { guard(true); if (dataMode !== 'mock')
        return apiClient.post(`/settlements/${id}/simulate`); const db = read(); const row = db.settlements.find(s => s.id === id); if (!row || row.status !== 'Pending')
        throw new Error('This settlement is not pending.'); checkStation(row.stationId); row.status = 'Completed'; db.notifications.unshift({ id: crypto.randomUUID(), stationId: row.stationId, title: 'Demo settlement completed', description: `${id} was reconciled in the local simulation. No money was moved.`, type: 'Settlement', read: false, date: new Date().toISOString() }); write(db); },
    async reset() { guard(true); if (dataMode !== 'mock')
        throw new Error('Demo reset is only available in mock mode.'); write(createSeed()); }
};
// Resource boundaries share one mock adapter; production requests are isolated above.
export const stationService = portalRepository, staffService = portalRepository, inventoryService = portalRepository, deviceService = portalRepository, transactionService = portalRepository, authorizationService = portalRepository, settlementService = portalRepository, reportsService = portalRepository, notificationService = portalRepository;
