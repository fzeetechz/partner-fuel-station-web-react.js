import axios from 'axios';
export const apiClient = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || '/api', timeout: 15000, headers: { 'Content-Type': 'application/json' } });
// Real authentication should attach an API-issued access token here, with refresh handled by the backend.
export const dataMode = import.meta.env.VITE_DATA_MODE || 'mock';
