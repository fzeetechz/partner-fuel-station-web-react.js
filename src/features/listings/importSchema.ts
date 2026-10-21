import { z } from 'zod';
import type { Entity } from '../../types';

export type ImportMode = 'create' | 'update';
export interface ImportField { key: string; required: boolean; help: string }
export interface ImportDefinition { title: string; fields: ImportField[]; update: boolean; description: string }
const field = (key: string, help: string, required = true): ImportField => ({ key, help, required });
const id = field('id', 'Unique Item ID, 3–80 letters, numbers, dots, hyphens or underscores.');
const station = field('stationId', 'Must match the selected station. Blank uses the selected station.', false);
export const importDefinitions: Record<Entity, ImportDefinition> = {
  staff: { title: 'Staff', update: true, description: 'Create staff or update existing staff at this station. No login account is created.', fields: [id, station, field('name','Full name'),field('email','Unique valid email'),field('phone','Contact phone'),field('role','STATION_OPERATOR or FUEL_STATION_OWNER'),field('status','Active or Inactive'),field('joined','Joining date: YYYY-MM-DD')] },
  inventory: { title: 'Fuel inventory', update: true, description: 'Create fuel tanks or update configuration and balances. Balance changes create stock movements.', fields: [id, station,field('name','Unique fuel name at this station'),field('quantity','Available liters, zero or greater'),field('capacity','Tank capacity, greater than zero'),field('threshold','Minimum balance, not above capacity'),field('price','Unit price in GHS, greater than zero'),field('color','Hex color, e.g. #f56600',false)] },
  devices: { title: 'POS devices', update: true, description: 'Create or update mock POS devices. Assigned operators must be active at this station.', fields: [id,station,field('model','Device model, e.g. SUNMI V2 Pro'),field('serial','Unique device serial number'),field('operatorId','Existing active staff Item ID'),field('status','Online, Offline or Maintenance')] },
  transactions: { title: 'Fuel transactions', update: false, description: 'Each row creates a completed demo sale now, reduces fuel stock and generates a receipt. Prices and totals are calculated from the tank configuration. Existing sales cannot be overwritten.', fields: [id,station,field('operatorId','Existing active staff Item ID'),field('fuelId','Existing fuel Item ID'),field('quantity','Liters greater than zero'),field('payment','Cash, Card, Mobile Money or Corporate'),field('vehicle','Vehicle registration'),field('authorizationId','Required for Corporate; existing unused authorization Item ID',false),field('mileage','Required for Corporate; zero or greater',false),field('driver','Driver name',false),field('company','Company name',false),field('deviceId','Existing online POS Item ID, optional',false)] },
  authorizations: { title: 'Corporate authorizations', update: true, description: 'Create unused demo authorizations or update unused references. Used references cannot be changed.', fields: [id,station,field('company','Corporate customer'),field('driver','Driver name'),field('vehicle','Vehicle registration'),field('fuelId','Existing fuel Item ID'),field('quantity','Approved liters, greater than zero'),field('expires','Future ISO timestamp, e.g. 2027-12-31T23:59:00Z'),field('method','QR Code or RFID / NFC'),field('reference','Unique corporate reference')] },
  settlements: { title: 'Settlement batches', update: false, description: 'Create pending demo batches from completed, unbatched corporate transactions. This does not move money or mark a payout as completed.', fields: [id,station,field('transactionIds','Unbatched corporate transaction IDs separated by |'),field('reference','Unique reconciliation reference')] },
  movements: { title: 'Stock refills & adjustments', update: false, description: 'Each row changes current stock and creates an audit record. Positive liters refill; negative liters adjust. Existing movements cannot be overwritten.', fields: [id,station,field('fuelId','Existing fuel Item ID'),field('quantity','Signed liters; cannot be zero or exceed available capacity'),field('reason','Supplier or adjustment reason')] },
  stations: { title: 'Station profiles', update: true, description: 'Update the selected station profile by its existing Item ID. New station onboarding is managed separately.', fields: [id,field('name','Station name'),field('address','Full location'),field('owner','Owner name'),field('email','Valid business email'),field('phone','Contact phone'),field('registration','Business registration number'),field('hours','Operating hours'),field('status','Active, Maintenance or Inactive')] },
  notifications: { title: 'Station announcements', update: false, description: 'Create unread local demo announcements. System-generated event history remains unchanged.', fields: [id,station,field('title','Announcement heading'),field('description','Message body')] }
};

const text = z.string().trim().min(1, 'Required').max(500);
const optional = z.string().trim().max(500).optional().default('');
const number = z.coerce.number().finite();
const positive = number.positive('Must be greater than zero');
const base = { id: text.regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,79}$/, 'Use a 3–80 character Item ID'), stationId: optional };
export const importSchemas = {
  staff: z.object({...base,name:text,email:z.email().toLowerCase(),phone:text,role:z.enum(['FUEL_STATION_OWNER','STATION_OPERATOR']),status:z.enum(['Active','Inactive']),joined:z.iso.date()}),
  inventory: z.object({...base,name:text,quantity:number.nonnegative(),capacity:positive,threshold:number.nonnegative(),price:positive,color:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default('#f56600')}),
  devices: z.object({...base,model:text,serial:text,operatorId:text,status:z.enum(['Online','Offline','Maintenance'])}),
  transactions: z.object({...base,operatorId:text,fuelId:text,quantity:positive,payment:z.enum(['Cash','Card','Mobile Money','Corporate']),vehicle:text,authorizationId:optional,mileage:z.union([z.literal(''),number.nonnegative()]).optional(),driver:optional,company:optional,deviceId:optional}),
  authorizations: z.object({...base,company:text,driver:text,vehicle:text,fuelId:text,quantity:positive,expires:z.iso.datetime({offset:true}),method:z.enum(['QR Code','RFID / NFC']),reference:text}),
  settlements: z.object({...base,transactionIds:text,reference:text}),
  movements: z.object({...base,fuelId:text,quantity:number.refine(n=>n!==0,'Cannot be zero'),reason:text}),
  stations: z.object({id:base.id,name:text,address:text,owner:text,email:z.email(),phone:text,registration:text,hours:text,status:z.enum(['Active','Maintenance','Inactive'])}),
  notifications: z.object({...base,title:text,description:text})
};
export type ImportRow = Record<string,string|number>;
export interface ImportResult { row: number; id: string; valid: boolean; errors: string[]; values: ImportRow }
