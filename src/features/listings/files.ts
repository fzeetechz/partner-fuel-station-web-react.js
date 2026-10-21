import type { Entity } from '../../types';
import { importDefinitions,type ImportRow } from './importSchema';
export type FileFormat='xlsx'|'pdf'|'docx';
export interface ExportTable { title:string; headers:string[]; values:(string|number)[][]; rawRows?:Record<string,unknown>[]; entity?:Entity; station:string; scope:string }
export function saveFile(data:Blob|Uint8Array,name:string,type?:string){const blob=data instanceof Blob?data:new Blob([new Uint8Array(data)],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const filename=(title:string)=>`neyfuel-${title.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${new Date().toISOString().slice(0,10)}`;
function excelValue(value:unknown):string|number {if(typeof value==='number')return value;if(Array.isArray(value))return value.join(' | ');return String(value??'');}
async function logoBytes(){const response=await fetch(`${import.meta.env.BASE_URL}logo/logo.png`);if(!response.ok)throw new Error('Brand logo could not be loaded.');return new Uint8Array(await response.arrayBuffer());}
export async function downloadTable(format:FileFormat,table:ExportTable){
 const name=filename(table.title);const generated=new Date().toLocaleString();
 if(format==='xlsx'){
  const {default:ExcelJS}=await import('exceljs');const book=new ExcelJS.Workbook();book.creator='NeyFuel';book.created=new Date();
  const sheet=book.addWorksheet('Listing');sheet.addRow([table.title]);sheet.addRow([`${table.station} · ${table.scope} · ${generated}`]);sheet.addRow([]);sheet.addRow(table.headers);table.values.forEach(row=>sheet.addRow(row));sheet.views=[{state:'frozen',ySplit:4}];sheet.autoFilter={from:{row:4,column:1},to:{row:4,column:Math.max(1,table.headers.length)}};
  sheet.columns.forEach(c=>{c.width=24;});sheet.getRow(4).eachCell(c=>{c.font={bold:true,color:{argb:'FFFFFFFF'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF062D65'}};});
  if(table.entity&&table.rawRows){const definition=importDefinitions[table.entity];const raw=book.addWorksheet('Data');raw.addRow(definition.fields.map(f=>f.key));table.rawRows.forEach(row=>raw.addRow(definition.fields.map(f=>excelValue(row[f.key]))));raw.columns.forEach(c=>{c.width=25;});raw.views=[{state:'frozen',ySplit:1}];book.addWorksheet('Import notes').addRows([[definition.description],['Use the Data sheet with the matching listing’s bulk upload. Existing Item IDs require update mode. Transaction and audit records cannot be updated.']]);}
  await book.xlsx.writeBuffer().then(buffer=>saveFile(new Uint8Array(buffer),`${name}.xlsx`,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'));return;
 }
 if(format==='pdf'){
  const [{jsPDF},{default:autoTable}]=await Promise.all([import('jspdf'),import('jspdf-autotable')]);const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});const image=await logoBytes();doc.addImage(image,'PNG',14,9,18,18);doc.setFontSize(17);doc.setTextColor('#062D65');doc.text(table.title,38,17);doc.setFontSize(9);doc.setTextColor('#475569');doc.text(`${table.station} | ${table.scope} | ${generated}`,38,24);
  const printable=(v:string|number)=>String(v).replace(/GH[₵¢]/g,'GHS ').replace(/[–—]/g,'-').replace(/·/g,' | ');
  autoTable(doc,{head:[table.headers],body:table.values.map(row=>row.map(printable)),startY:34,styles:{fontSize:8,cellPadding:3,overflow:'linebreak'},headStyles:{fillColor:[6,45,101]},alternateRowStyles:{fillColor:[247,249,252]},margin:{top:15,bottom:18,left:14,right:14},horizontalPageBreak:true,horizontalPageBreakRepeat:0});
  const pages=doc.getNumberOfPages();for(let n=1;n<=pages;n++){doc.setPage(n);doc.setFontSize(8);doc.setTextColor('#475569');doc.text(`NeyFuel demo records | ${table.values.length} rows`,14,doc.internal.pageSize.getHeight()-8);doc.text(`Page ${n} of ${pages}`,doc.internal.pageSize.getWidth()-38,doc.internal.pageSize.getHeight()-8);}saveFile(new Uint8Array(doc.output('arraybuffer')),`${name}.pdf`,'application/pdf');return;
 }
 const {Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,WidthType,ImageRun,PageOrientation}=await import('docx');
 const cell=(value:string|number,heading=false)=>new TableCell({children:[new Paragraph({children:[new TextRun({text:String(value),bold:heading,color:heading?'FFFFFF':'172B4D',size:20})]})],shading:heading?{fill:'062D65'}:undefined});
 const doc=new Document({sections:[{properties:{page:{size:{orientation:PageOrientation.LANDSCAPE}}},children:[new Paragraph({children:[new ImageRun({data:await logoBytes(),type:'png',transformation:{width:72,height:72}})]}),new Paragraph({children:[new TextRun({text:table.title,bold:true,size:32,color:'062D65'})]}),new Paragraph(`${table.station} · ${table.scope} · ${generated}`),new Paragraph(`${table.values.length} demo records`),new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:[new TableRow({tableHeader:true,children:table.headers.map(h=>cell(h,true))}),...table.values.map(row=>new TableRow({children:row.map(v=>cell(v))}))]})]}]});
 saveFile(await Packer.toBlob(doc),`${name}.docx`);
}

export async function downloadTemplate(entity:Entity,stationId:string){const {default:ExcelJS}=await import('exceljs');const book=new ExcelJS.Workbook();const definition=importDefinitions[entity];const sheet=book.addWorksheet('Data');sheet.addRow(definition.fields.map(f=>f.key));sheet.columns.forEach(c=>{c.width=25;});sheet.getRow(1).font={bold:true};sheet.views=[{state:'frozen',ySplit:1}];const notes=book.addWorksheet('Instructions');notes.addRows([[`NeyFuel ${definition.title} import`],[definition.description],[`Selected station: ${stationId}`],['Fill the Data sheet, keep headers unchanged, remove blank rows, and use unique Item IDs. Maximum 1,000 rows. Formulas are not accepted.'],[],['Column','Required','Instructions'],...definition.fields.map(f=>[f.key,f.required?'Yes':'No',f.help])]);notes.columns=[{width:24},{width:16},{width:100}];saveFile(new Uint8Array(await book.xlsx.writeBuffer()),`neyfuel-${entity}-template.xlsx`,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');}

export async function readWorkbook(file:File,entity:Entity):Promise<ImportRow[]>{
 if(!file.name.toLowerCase().endsWith('.xlsx'))throw new Error('Choose an Excel .xlsx workbook.');if(file.size>5*1024*1024)throw new Error('File exceeds the 5 MB limit.');
 const {default:ExcelJS}=await import('exceljs');const book=new ExcelJS.Workbook();try{await book.xlsx.load(await file.arrayBuffer());}catch{throw new Error('This workbook could not be read. Use a valid, unencrypted .xlsx file.');}
 const sheet=book.getWorksheet('Data')||book.worksheets[0];if(!sheet)throw new Error('Workbook contains no worksheet.');if(sheet.actualRowCount>1001||sheet.rowCount>1001||sheet.columnCount>30)throw new Error('Use at most 1,000 data rows and 30 columns.');
 const definition=importDefinitions[entity];const normalize=(v:string)=>v.toLowerCase().replace(/[ _-]/g,'');const aliases=new Map(definition.fields.map(f=>[normalize(f.key),f.key]));aliases.set('itemid','id');
 const headers:string[]=[];sheet.getRow(1).eachCell({includeEmpty:true},(cell,column)=>{if(!cell.text.trim())throw new Error(`Column ${column} has no header.`);const key=aliases.get(normalize(cell.text.trim()));if(!key)throw new Error(`Unknown column: ${cell.text}. Download the matching template.`);if(headers.includes(key))throw new Error(`Repeated column: ${key}`);headers[column-1]=key;});
 for(const f of definition.fields)if(f.required&&!headers.includes(f.key))throw new Error(`Missing required column: ${f.key}`);
 const rows:ImportRow[]=[];
 for(let n=2;n<=sheet.rowCount;n++){const excelRow=sheet.getRow(n);if(!excelRow.hasValues)continue;const row:ImportRow={};headers.forEach((key,index)=>{const cell=excelRow.getCell(index+1);if(cell.type===ExcelJS.ValueType.Formula||cell.type===ExcelJS.ValueType.Error)throw new Error(`Row ${n}, ${key}: formulas and Excel errors are not allowed.`);const value=cell.value;if(value===null||value===undefined||cell.text.trim()==='')return;row[key]=value instanceof Date?(key==='joined'?value.toISOString().slice(0,10):value.toISOString()):typeof value==='number'?value:cell.text.trim();});rows.push(row);}
 if(!rows.length)throw new Error('No data rows found. Fill the Data sheet below the column headers.');return rows;
}
