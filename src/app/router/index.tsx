import { useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store';
import { Layout } from '../layouts/Layout';
import { Auth } from '../../features/auth/Auth';
import { Dashboard } from '../../features/dashboard/Dashboard';
import { Stations, StaffPage, Inventory, Devices } from '../../features/stations/Management';
import { Transactions, Authorizations, Settlements } from '../../features/transactions/Transactions';
import { Reports } from '../../features/reports/Reports';
import { Notifications, Settings } from '../../features/settings/Settings';
import { Link } from 'react-router-dom';
function Protected() { const session = useAppStore(s => s.session), setSession = useAppStore(s => s.setSession); const location = useLocation(); useEffect(() => { if (!session)
    return; const timer = setTimeout(() => setSession(null), Math.max(0, session.expires - Date.now())); return () => clearTimeout(timer); }, [session, setSession]); return session && session.expires > Date.now() ? <Outlet /> : <Navigate to="/auth/login" replace state={{ from: location.pathname }}/>; }
function Owner() { return useAppStore(s => s.session?.role) === 'FUEL_STATION_OWNER' ? <Outlet /> : <div className="error-view"><h1>Owner access required</h1><p>This page is reserved for station management.</p><Link to="/dashboard">Return to overview</Link></div>; }
export function Router() { const theme = useAppStore(s => s.theme); useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]); return <Routes><Route path="/auth/:mode" element={<Auth />}/><Route element={<Protected />}><Route element={<Layout />}><Route index element={<Navigate to="/dashboard" replace/>}/><Route path="dashboard" element={<Dashboard />}/><Route path="stations" element={<Stations />}/><Route path="inventory" element={<Inventory />}/><Route path="pos-devices" element={<Devices />}/><Route path="transactions" element={<Transactions />}/><Route path="authorizations" element={<Authorizations />}/><Route path="invoices" element={<Transactions invoices/>}/><Route path="notifications" element={<Notifications />}/><Route element={<Owner />}><Route path="staff" element={<StaffPage />}/><Route path="settlements" element={<Settlements />}/><Route path="reports" element={<Reports />}/><Route path="settings" element={<Settings />}/></Route><Route path="*" element={<div className="error-view"><h1>That page took a detour.</h1><p>The page you’re looking for doesn’t exist.</p><Link to="/dashboard">Back to your station</Link></div>}/></Route></Route></Routes>; }
