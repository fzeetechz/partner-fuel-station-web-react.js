import type { Role, Session } from '../../types';
import { apiClient, dataMode } from './client';
interface DemoAccount {
    name: string;
    email: string;
    password: string;
    station?: string;
    phone?: string;
}
const users = (): DemoAccount[] => JSON.parse(localStorage.getItem('neyfuel-demo-users') || '[]');
export const authenticationService = {
    async login(email: string, password: string): Promise<Session> {
        if (dataMode !== 'mock')
            return (await apiClient.post<Session>('/auth/login', { email, password })).data;
        const stored = users().find(u => u.email === email);
        const builtIn = ['owner@neyfuel.com', 'operator@neyfuel.com'].includes(email);
        if (stored ? stored.password !== password : (!builtIn || password !== 'NeyFuel@2026'))
            throw new Error('Email or password is incorrect.');
        const role: Role = email === 'operator@neyfuel.com' ? 'STATION_OPERATOR' : 'FUEL_STATION_OWNER';
        return { email, name: stored?.name || (role === 'FUEL_STATION_OWNER' ? 'Kwame Mensah' : 'Ama Owusu'), role, expires: Date.now() + 8 * 3600000, stationIds: role === 'STATION_OPERATOR' ? ['ST-001'] : ['ST-001', 'ST-002'] };
    },
    async register(account: DemoAccount) { if (dataMode !== 'mock') {
        await apiClient.post('/auth/register', account);
        return;
    } if (users().some(u => u.email === account.email) || ['owner@neyfuel.com', 'operator@neyfuel.com'].includes(account.email))
        throw new Error('This email is already registered.'); sessionStorage.setItem('neyfuel-registration', JSON.stringify(account)); },
    async verify(code: string) { if (dataMode !== 'mock') {
        await apiClient.post('/auth/verify', { code });
        return;
    } if (code !== '123456')
        throw new Error('Use the demo code: 123456.'); const account = JSON.parse(sessionStorage.getItem('neyfuel-registration') || 'null'); if (!account)
        throw new Error('Please register first.'); const records = users(); if (records.some(u => u.email === account.email))
        throw new Error('Email already registered.'); records.push(account); localStorage.setItem('neyfuel-demo-users', JSON.stringify(records)); sessionStorage.removeItem('neyfuel-registration'); },
    async requestReset(email: string) { if (dataMode !== 'mock') {
        await apiClient.post('/auth/forgot-password', { email });
        return;
    } sessionStorage.setItem('neyfuel-reset-email', email); },
    async resetPassword(password: string) { if (dataMode !== 'mock') {
        await apiClient.post('/auth/reset-password', { password });
        return;
    } const email = sessionStorage.getItem('neyfuel-reset-email'); if (!email)
        throw new Error('Start from Forgot password first.'); const records = users(); const account = records.find(u => u.email === email); if (account)
        account.password = password;
    else if (['owner@neyfuel.com', 'operator@neyfuel.com'].includes(email))
        records.push({ email, password, name: email.startsWith('owner') ? 'Kwame Mensah' : 'Ama Owusu' });
    else
        throw new Error('No demo account exists for that email.'); localStorage.setItem('neyfuel-demo-users', JSON.stringify(records)); sessionStorage.removeItem('neyfuel-reset-email'); }
};
