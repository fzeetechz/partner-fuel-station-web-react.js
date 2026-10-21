import type { Database,Entity,SaleInput,Transaction,Fuel,Staff,Device,Authorization,Station } from '../../types';
import { changeStock,completeSale } from '../../services/mock/engine';
import { importSchemas,type ImportMode,type ImportResult,type ImportRow } from './importSchema';

function applyRow(db:Database,entity:Entity,row:ImportRow,stationId:string,mode:ImportMode) {
  const parsed=importSchemas[entity].safeParse(row);
  if(!parsed.success)throw new Error(parsed.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; '));
  const value=parsed.data as Record<string,unknown>;
  const id=String(value.id);
  if(value.stationId&&value.stationId!==stationId)throw new Error('stationId: row belongs to another station');
  const list=db[entity] as unknown as Record<string,unknown>[];
  const current=list.find(r=>r.id===id);
  if(entity==='stations'&&id!==stationId)throw new Error('id: use the selected station Item ID');
  if(current&&String(current.stationId||current.id)!==stationId)throw new Error('id: this Item ID belongs to another station');
  if(mode==='create'&&current)throw new Error('id: duplicate Item ID; use update mode for editable records');
  if(mode==='update'&&!current)throw new Error('id: no existing record to update');
  if(mode==='update'&&['transactions','movements','settlements','notifications'].includes(entity))throw new Error('This audit record cannot be overwritten');
  const atStation=<T extends {id:string;stationId:string}>(rows:T[],target:unknown)=>rows.find(r=>r.id===target&&r.stationId===stationId);
  const upsert=(record:object)=>{if(current)Object.assign(current,record);else list.unshift(record as Record<string,unknown>);};
  const timestamp=new Date().toISOString();
  if(entity==='staff') {
    if(db.staff.some(s=>s.email.toLowerCase()===String(value.email).toLowerCase()&&s.id!==id))throw new Error('email: already assigned to another staff member');
    if(value.joined>timestamp.slice(0,10))throw new Error('joined: cannot be in the future');
    upsert({...value,stationId} as unknown as Staff);
  } else if(entity==='inventory') {
    if(Number(value.quantity)>Number(value.capacity)||Number(value.threshold)>Number(value.capacity))throw new Error('quantity / threshold: cannot exceed tank capacity');
    if(db.inventory.some(f=>f.stationId===stationId&&f.id!==id&&f.name.toLowerCase()===String(value.name).toLowerCase()))throw new Error('name: a fuel tank with this name already exists');
    const previous=current?Number(current.quantity):0;
    const fuel={...value,stationId,quantity:previous} as unknown as Fuel;
    upsert(fuel);
    const difference=Math.round((Number(value.quantity)-previous)*100)/100;
    if(difference)changeStock(db,id,difference,`Excel ${mode==='create'?'opening stock':'balance adjustment'}`);
  } else if(entity==='devices') {
    const operator=atStation(db.staff,value.operatorId);
    if(!operator||operator.status!=='Active')throw new Error('operatorId: choose an active operator at this station');
    if(db.devices.some(d=>d.id!==id&&d.serial.toLowerCase()===String(value.serial).toLowerCase()))throw new Error('serial: already registered');
    upsert({...value,stationId,lastSync:current?.lastSync||timestamp} as unknown as Device);
  } else if(entity==='transactions') {
    if(value.payment==='Corporate'&&!value.authorizationId)throw new Error('authorizationId: corporate transactions require an authorization');
    if(value.authorizationId&&value.payment!=='Corporate')throw new Error('payment: authorization requires Corporate payment');
    const input:SaleInput={...value,stationId,quantity:Number(value.quantity),mileage:value.mileage===''||value.mileage===undefined?undefined:Number(value.mileage),authorizationId:value.authorizationId?String(value.authorizationId):undefined,deviceId:value.deviceId?String(value.deviceId):undefined} as unknown as SaleInput;
    completeSale(db,input,new Date(),id);
  } else if(entity==='authorizations') {
    if(current?.status==='Used')throw new Error('id: used authorizations cannot be edited');
    if(!atStation(db.inventory,value.fuelId))throw new Error('fuelId: no matching fuel at this station');
    if(new Date(String(value.expires)).getTime()<=Date.now())throw new Error('expires: must be in the future');
    if(db.authorizations.some(a=>a.id!==id&&a.reference===value.reference))throw new Error('reference: already exists');
    upsert({...value,stationId,status:'Unused'} as unknown as Authorization);
  } else if(entity==='movements') {
    if(!atStation(db.inventory,value.fuelId))throw new Error('fuelId: no matching fuel at this station');
    changeStock(db,String(value.fuelId),Number(value.quantity),String(value.reason),id);
  } else if(entity==='settlements') {
    const ids=String(value.transactionIds).split('|').map(v=>v.trim()).filter(Boolean);
    if(!ids.length||new Set(ids).size!==ids.length)throw new Error('transactionIds: provide unique transaction IDs separated by |');
    for(const transactionId of ids){const t=atStation(db.transactions,transactionId) as Transaction|undefined;if(!t||t.payment!=='Corporate'||t.status!=='Completed')throw new Error(`transactionIds: ${transactionId} must be a completed corporate sale at this station`);if(db.settlements.some(s=>s.transactionIds.includes(transactionId)))throw new Error(`transactionIds: ${transactionId} is already in a settlement`);}
    if(db.settlements.some(s=>s.reference===value.reference))throw new Error('reference: already exists');
    upsert({id,stationId,transactionIds:ids,status:'Pending',date:timestamp,reference:String(value.reference)});
  } else if(entity==='stations') {
    if(mode!=='update')throw new Error('Station profiles support update mode only');
    upsert(value as unknown as Station);
  } else {
    upsert({...value,stationId,read:false,type:'Announcement',date:timestamp});
  }
}

/** Dry-run each row on an isolated candidate. Nothing reaches storage unless every row passes. */
export function validateImport(database:Database,entity:Entity,rows:ImportRow[],stationId:string,mode:ImportMode) {
  if(!rows.length||rows.length>1000)throw new Error('Upload between 1 and 1,000 records.');
  let databaseCopy=structuredClone(database);
  const seen=new Set<string>();
  const results:ImportResult[]=rows.map((values,index)=>{
    const id=String(values.id||'');
    try {
      if(seen.has(id))throw new Error('id: repeated Item ID inside this file');
      seen.add(id);
      const candidate=structuredClone(databaseCopy);
      applyRow(candidate,entity,values,stationId,mode);
      databaseCopy=candidate;
      return {row:index+2,id,valid:true,errors:[],values};
    }catch(error){return {row:index+2,id,valid:false,errors:[error instanceof Error?error.message:'Invalid record'],values};}
  });
  return {results,database:databaseCopy,valid:results.every(r=>r.valid)};
}
