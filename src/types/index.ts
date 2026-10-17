export type Role = 'FUEL_STATION_OWNER' | 'STATION_OPERATOR';
export type Entity = 'stations' | 'staff' | 'inventory' | 'devices' | 'transactions' | 'authorizations' | 'settlements' | 'notifications' | 'movements';
export interface Station {
    id: string;
    name: string;
    address: string;
    owner: string;
    email: string;
    phone: string;
    registration: string;
    hours: string;
    status: string;
}
export interface Staff {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: Role;
    stationId: string;
    status: string;
    joined: string;
}
export interface Fuel {
    id: string;
    stationId: string;
    name: string;
    quantity: number;
    capacity: number;
    threshold: number;
    price: number;
    color: string;
}
export interface Device {
    id: string;
    stationId: string;
    model: string;
    serial: string;
    operatorId: string;
    status: string;
    lastSync: string;
}
export interface Transaction {
    id: string;
    stationId: string;
    operatorId: string;
    fuelId: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    payment: string;
    status: string;
    date: string;
    vehicle: string;
    company: string;
    driver: string;
    authorizationId?: string;
    mileage?: number;
    deviceId?: string;
}
export interface Authorization {
    id: string;
    stationId: string;
    company: string;
    driver: string;
    vehicle: string;
    fuelId: string;
    quantity: number;
    expires: string;
    status: string;
    method: string;
    reference: string;
}
export interface Settlement {
    id: string;
    stationId: string;
    transactionIds: string[];
    status: string;
    date: string;
    reference: string;
}
export interface Notice {
    id: string;
    stationId: string;
    title: string;
    description: string;
    type: string;
    read: boolean;
    date: string;
}
export interface Movement {
    id: string;
    stationId: string;
    fuelId: string;
    quantity: number;
    reason: string;
    date: string;
}
export interface Database {
    stations: Station[];
    staff: Staff[];
    inventory: Fuel[];
    devices: Device[];
    transactions: Transaction[];
    authorizations: Authorization[];
    settlements: Settlement[];
    notifications: Notice[];
    movements: Movement[];
}
export interface SaleInput {
    stationId: string;
    operatorId: string;
    fuelId: string;
    quantity: number;
    payment: string;
    vehicle: string;
    company?: string;
    driver?: string;
    authorizationId?: string;
    mileage?: number;
    deviceId?: string;
}
export interface Session {
    name: string;
    email: string;
    role: Role;
    expires: number;
    stationIds: string[];
}
