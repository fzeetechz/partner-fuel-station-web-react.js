import { describe, it, expect } from 'vitest';
import { createSeed } from './seed';
import { changeStock, completeSale, summarize } from './engine';
import type { SaleInput } from '../../types';
function setup() { const db = createSeed(); const input: SaleInput = { stationId: 'ST-001', operatorId: 'ST-001-OP-2', fuelId: 'ST-001-F1', quantity: 25, payment: 'Cash', vehicle: 'GR 1001-26' }; return { db, input }; }
describe('fuel transaction integrity', () => {
    it('uses the configured unit price and updates shared stock, ledger, and metrics', () => { const { db, input } = setup(); const before = db.inventory[0].quantity; const initial = summarize(db.transactions); const sale = completeSale(db, input); expect(sale.amount).toBe(374.75); expect(db.inventory[0].quantity).toBe(before - 25); expect(db.movements[0].quantity).toBe(-25); expect(db.transactions[0].id).toBe(sale.id); const after = summarize(db.transactions); expect(after.revenue - initial.revenue).toBeCloseTo(374.75); expect(after.liters - initial.liters).toBeCloseTo(25); expect(after.count).toBe(initial.count + 1); });
    it.each([0, -1, NaN, Infinity, 999999])('rejects invalid or unavailable quantities (%s) atomically', quantity => { const { db, input } = setup(); const before = JSON.stringify(db); expect(() => completeSale(db, { ...input, quantity })).toThrow(); expect(JSON.stringify(db)).toBe(before); });
    it('consumes an authorization once and prevents duplicate dispensing', () => { const { db, input } = setup(); const auth = db.authorizations[0]; const sale = completeSale(db, { ...input, authorizationId: auth.id, mileage: 12000 }); expect(sale.payment).toBe('Corporate'); expect(auth.status).toBe('Used'); const after = JSON.stringify(db); expect(() => completeSale(db, { ...input, authorizationId: auth.id, mileage: 12000 })).toThrow('already been used'); expect(JSON.stringify(db)).toBe(after); });
    it('rejects expired, mismatched, and over-limit authorizations', () => { for (const override of [{ expires: '2020-01-01T00:00:00Z' }, { fuelId: 'ST-001-F2' }, { quantity: 5 }]) {
        const { db, input } = setup();
        Object.assign(db.authorizations[0], override);
        const before = JSON.stringify(db);
        expect(() => completeSale(db, { ...input, authorizationId: db.authorizations[0].id, mileage: 100 })).toThrow();
        expect(JSON.stringify(db)).toBe(before);
    } });
    it('rejects inactive operators and cross-station fuel', () => { const { db, input } = setup(); db.staff[1].status = 'Inactive'; expect(() => completeSale(db, input)).toThrow('active operator'); expect(() => completeSale(db, { ...input, fuelId: 'ST-002-F1' })).toThrow('current station'); });
    it('requires nonnegative mileage for corporate dispensing', () => { const { db, input } = setup(); expect(() => completeSale(db, { ...input, authorizationId: db.authorizations[0].id })).toThrow('mileage'); expect(() => completeSale(db, { ...input, authorizationId: db.authorizations[0].id, mileage: -1 })).toThrow('mileage'); });
    it('does not count failed transactions toward reports', () => { const { db } = setup(); expect(summarize(db.transactions.filter(t => t.status === 'Failed'))).toEqual({ revenue: 0, liters: 0, count: 0 }); });
});
describe('inventory adjustments', () => {
    it('records refills with reasons and consistent stock', () => { const { db } = setup(); const initial = db.inventory[0].quantity; changeStock(db, 'ST-001-F1', 1000, 'Supplier delivery'); expect(db.inventory[0].quantity).toBe(initial + 1000); expect(db.movements[0].reason).toBe('Supplier delivery'); });
    it('prevents negative stock and exceeding capacity', () => { const { db } = setup(); const before = JSON.stringify(db); expect(() => changeStock(db, 'ST-001-F1', -999999, 'Correction')).toThrow(); expect(() => changeStock(db, 'ST-001-F1', 999999, 'Refill')).toThrow(); expect(JSON.stringify(db)).toBe(before); });
});
describe('corporate reconciliation', () => {
    it('adds a corporate sale to one pending settlement batch', () => {
        const { db, input } = setup();
        const sale = completeSale(db, { ...input, authorizationId: db.authorizations[0].id, mileage: 1000 });
        const matching = db.settlements.filter(s => s.transactionIds.includes(sale.id));
        expect(matching).toHaveLength(1);
        expect(matching[0].status).toBe('Pending');
        expect(matching[0].stationId).toBe(input.stationId);
    });
});
