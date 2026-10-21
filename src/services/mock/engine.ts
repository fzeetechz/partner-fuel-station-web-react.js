import type { Database, SaleInput, Transaction } from '../../types';
export function completeSale(db: Database, input: SaleInput, now = new Date(), requestedId?: string): Transaction {
    if(requestedId && db.transactions.some(t=>t.id===requestedId))throw new Error('Transaction Item ID already exists.');
    const fuel = db.inventory.find(f => f.id === input.fuelId && f.stationId === input.stationId);
    if (!fuel)
        throw new Error('Select a fuel at the current station.');
    if (!Number.isFinite(input.quantity) || input.quantity <= 0)
        throw new Error('Enter a valid quantity greater than zero.');
    if (input.quantity > fuel.quantity)
        throw new Error('Insufficient stock for this transaction.');
    const operator = db.staff.find(s => s.id === input.operatorId && s.stationId === input.stationId && s.status === 'Active');
    if (!operator)
        throw new Error('Choose an active operator at this station.');
    const auth = input.authorizationId ? db.authorizations.find(a => a.id === input.authorizationId && a.stationId === input.stationId) : undefined;
    if (input.authorizationId) {
        if (!auth || auth.status !== 'Unused')
            throw new Error('This authorization has already been used or is unavailable.');
        if (new Date(auth.expires).getTime() <= now.getTime())
            throw new Error('This authorization has expired.');
        if (auth.fuelId !== fuel.id || input.quantity > auth.quantity)
            throw new Error('Fuel type or quantity exceeds this authorization.');
        if (!Number.isFinite(input.mileage) || input.mileage! < 0)
            throw new Error('Enter a valid vehicle mileage.');
    }
    const deviceId = input.deviceId || db.devices.find(d => d.stationId === input.stationId && d.operatorId === input.operatorId && d.status === 'Online')?.id;
    if (input.deviceId && !db.devices.some(d => d.id === input.deviceId && d.stationId === input.stationId && d.status === 'Online'))
        throw new Error('The selected POS device is unavailable.');
    const transaction: Transaction = { ...input, deviceId, id: requestedId || `TXN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, date: now.toISOString(), unitPrice: fuel.price, amount: Math.round(input.quantity * fuel.price * 100) / 100, status: 'Completed', company: auth?.company || input.company || '', driver: auth?.driver || input.driver || 'Walk-in customer', vehicle: auth?.vehicle || input.vehicle, payment: auth ? 'Corporate' : input.payment };
    fuel.quantity = Math.round((fuel.quantity - input.quantity) * 100) / 100;
    if (auth)
        auth.status = 'Used';
    db.transactions.unshift(transaction);
    if (transaction.payment === 'Corporate') {
        let settlement = db.settlements.find(s => s.stationId === input.stationId && s.status === 'Pending' && s.date.slice(0, 10) === now.toISOString().slice(0, 10));
        if (!settlement) {
            settlement = { id: `SET-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, stationId: input.stationId, transactionIds: [], status: 'Pending', date: now.toISOString(), reference: 'DEMO-PENDING' };
            db.settlements.unshift(settlement);
        }
        settlement.transactionIds.push(transaction.id);
    }
    db.movements.unshift({ id: `MOV-${crypto.randomUUID().slice(0, 8)}`, stationId: input.stationId, fuelId: fuel.id, quantity: -input.quantity, reason: `Fuel dispensed · ${transaction.id}`, date: now.toISOString() });
    db.notifications.unshift({ id: crypto.randomUUID(), stationId: input.stationId, title: 'New fuel transaction', description: `${input.quantity} L ${fuel.name} · GH₵ ${transaction.amount.toFixed(2)}`, type: 'Transaction', read: false, date: now.toISOString() });
    if (fuel.quantity <= fuel.threshold)
        db.notifications.unshift({ id: crypto.randomUUID(), stationId: input.stationId, title: `${fuel.name} stock is low`, description: `${fuel.quantity.toLocaleString()} L remaining. Schedule a refill.`, type: 'Low stock', read: false, date: now.toISOString() });
    return transaction;
}
export function changeStock(db: Database, fuelId: string, quantity: number, reason: string, requestedId?:string) {
    if(requestedId && db.movements.some(m=>m.id===requestedId))throw new Error('Stock movement Item ID already exists.');
    const fuel = db.inventory.find(f => f.id === fuelId);
    if (!fuel || !Number.isFinite(quantity) || quantity === 0 || !reason.trim())
        throw new Error('Provide a valid stock change and reason.');
    if (fuel.quantity + quantity < 0 || fuel.quantity + quantity > fuel.capacity)
        throw new Error('Stock must remain between zero and tank capacity.');
    fuel.quantity = Math.round((fuel.quantity + quantity) * 100) / 100;
    db.movements.unshift({ id: requestedId || `MOV-${crypto.randomUUID().slice(0, 8)}`, stationId: fuel.stationId, fuelId, quantity, reason, date: new Date().toISOString() });
    db.notifications.unshift({ id: crypto.randomUUID(), stationId: fuel.stationId, title: 'Inventory updated', description: `${fuel.name}: ${quantity > 0 ? '+' : ''}${quantity} L · ${reason}`, type: 'Inventory refill', read: false, date: new Date().toISOString() });
}
export function summarize(transactions: Transaction[]) { const completed = transactions.filter(t => t.status === 'Completed'); return { revenue: Math.round(completed.reduce((s, t) => s + Math.round(t.amount * 100), 0)) / 100, liters: Math.round(completed.reduce((s, t) => s + t.quantity, 0) * 100) / 100, count: completed.length }; }
