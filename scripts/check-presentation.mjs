import { readFile,writeFile,unlink } from 'node:fs/promises';
// Reuse the isolated browser harness, replacing workflow checks with visual QA.
const script=await readFile('scripts/browser-check.mjs','utf8');
const start=script.indexOf(" await evaluate(`localStorage.clear();sessionStorage.clear()`)");
const end=script.indexOf(" if(errors.length)",start);
if(start<0||end<0)throw new Error('Browser harness markers not found');
const checks=`
 await evaluate(\`localStorage.clear();sessionStorage.clear()\`);await send('Page.reload');await wait(\`document.querySelector('input[name="email"]')\`);await pause(400);
 await assert(\`parseFloat(getComputedStyle(document.querySelector('.auth-form input')).fontSize)>=16\`,'Login inputs have readable 16px text');
 await assert(\`parseFloat(getComputedStyle(document.querySelector('.auth-form .field')).fontSize)>=14\`,'Login field labels are readable');
 await assert(\`(()=>{const lum=color=>{const rgb=color.match(/[0-9.]+/g).slice(0,3).map(Number).map(n=>n/255).map(n=>n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4);return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;};const button=getComputedStyle(document.querySelector('.auth-form .btn.primary'));return (lum(button.color)+0.05)/(lum(button.backgroundColor)+0.05)>=4.5;})()\`,'Sign-in button text meets 4.5:1 contrast');
 await writeFile('test-results/login-desktop.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await pause(300);
 await assert(\`document.documentElement.scrollWidth<=390\`,'Mobile login fits the viewport');
 await writeFile('test-results/login-mobile.png',Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'));
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});await click('Sign in to your account');await wait(\`document.querySelector('.revenue-chart')\`);await pause(400);
 await assert(\`parseFloat(getComputedStyle(document.querySelector('.nav-item')).fontSize)>=14\`,'Sidebar navigation uses readable text');
 await assert(\`[...document.querySelectorAll('.sidebar-brand .brand-logo,.sidebar-brand .brand-name')].every(e=>e.getBoundingClientRect().right<=document.querySelector('.sidebar').getBoundingClientRect().right)\`,'Sidebar logo and wordmark fit');
 await writeFile('test-results/dashboard-desktop.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await click('Collapse sidebar');await pause(300);await assert(\`document.querySelector('.sidebar-brand .brand-logo').getBoundingClientRect().width===44\`,'Collapsed sidebar logo stays contained');
 await writeFile('test-results/sidebar-collapsed.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));await evaluate(\`document.querySelector('.collapse-btn').click()\`);await pause(300);
 await send('Emulation.setDeviceMetricsOverride',{width:900,height:1000,deviceScaleFactor:1,mobile:false});await pause(250);await assert(\`[...document.querySelectorAll('.sidebar-brand .brand-logo,.sidebar-brand .brand-name')].every(e=>e.getBoundingClientRect().right<=document.querySelector('.sidebar').getBoundingClientRect().right)\`,'Sidebar branding fits tablet layout');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:base+'/transactions'});await wait(\`document.querySelector('table td')\`);await assert(\`parseFloat(getComputedStyle(document.querySelector('table td')).fontSize)>=13\`,'Table text uses readable 13px type');
 await send('Page.navigate',{url:base+'/dashboard'});await wait(\`document.querySelector('.revenue-chart')\`);await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await pause(300);await assert(\`document.documentElement.scrollWidth<=390\`,'Mobile dashboard has no horizontal overflow');
 await writeFile('test-results/dashboard-mobile.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});await evaluate(\`document.querySelector('[aria-label="Switch to dark mode"]').click()\`);await pause(200);await writeFile('test-results/dashboard-dark.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
`;
const output=script.slice(0,start)+checks+script.slice(end);
await writeFile('scripts/.presentation-run.mjs',output);
try { await import('./.presentation-run.mjs'); }
finally { await unlink('scripts/.presentation-run.mjs'); }
