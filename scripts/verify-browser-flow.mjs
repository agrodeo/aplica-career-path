import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from '../worker/node_modules/playwright/index.mjs';
const root=resolve('dist/client');
const types={'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.html':'text/html'};
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!path.startsWith(root+'/'))throw Error();let file;try{file=await readFile(path);res.setHeader('Content-Type',types[extname(path)]??'application/octet-stream');}catch{file=await readFile(resolve(root,'_shell.html'));res.setHeader('Content-Type','text/html');}res.end(file);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROMIUM_PATH,args:['--no-sandbox']});
const user={id:'00000000-0000-0000-0000-000000000011',aud:'authenticated',role:'authenticated',email:'ana@example.com',app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:new Date().toISOString()};
const token=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:user.id,aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url')+'.fixture';
const session={access_token:token,refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600,user};
let onboarding=null,loginRequests=0;
async function setup(page,acceptLogin){await page.route('https://ctdpjiyxcoytshegnpbc.supabase.co/**',async route=>{const req=route.request(); const url=new URL(req.url());let body=null,status=200;
 if(url.pathname.endsWith('/token')){loginRequests++;body=acceptLogin?session:{msg:'Invalid login credentials',code:'invalid_credentials'};status=acceptLogin?200:400;}
 else if(url.pathname.endsWith('/user'))body=user;
 else if(url.pathname.endsWith('/rpc/save_onboarding_profile')){onboarding=req.postDataJSON()._data;}
 else if(req.headers()['accept']?.includes('vnd.pgrst.object'))body=null;
 else body=[];
 await route.fulfill({status,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Content-Range':'0-0/0'},body:JSON.stringify(body)});
});}
try {
 let page=await browser.newPage();await setup(page,false);await page.goto(origin+'/login');await page.getByLabel('Email',{exact:true}).fill('ana@example.com');await page.getByLabel('Contraseña',{exact:true}).fill('fixture-password');await page.getByRole('button',{name:'Ingresar',exact:true}).click();await page.getByRole('status').filter({hasText:'Invalid login credentials'}).waitFor();assert.ok(page.url().endsWith('/login'));await page.close();
 page=await browser.newPage();await setup(page,true);await page.goto(origin+'/login');await page.getByLabel('Email',{exact:true}).fill('ana@example.com');await page.getByLabel('Contraseña',{exact:true}).fill('fixture-password');await page.getByRole('button',{name:'Ingresar',exact:true}).click();await page.waitForURL('**/jobs');assert.equal(loginRequests,2);
 await page.evaluate(()=>{localStorage.setItem('aplica-user-draft-v1',JSON.stringify({onboardingStep:14,name:'Ana',searchPreferences:{role:'Nurse',location:'Argentina',mode:'Presencial'}}));localStorage.setItem('aplica-profile-draft-v1',JSON.stringify({profile:{firstName:'Ana',lastName:'Perez',email:'ana@example.com',company:'Fixture',role:'Nurse',start:'2020-01-01',end:'2021-01-01'},selected:{roles:['Nurse'],skills:['Nursing'],mode:['Presencial'],employment:['Full-time'],seniority:[],industry:[]},consents:[true,true,false]}));});
 await page.goto(origin+'/onboarding');await page.getByRole('button',{name:'Buscar mis trabajos'}).click();await page.getByRole('heading',{name:'Encontramos 0 trabajos compatibles con Auto Apply.'}).waitFor();assert.equal(onboarding.profile.firstName,'Ana');assert.equal(onboarding.autoApplyAuthorized,false);assert.deepEqual(onboarding.roles,['Nurse']);assert.equal(onboarding.profile.isCurrent,false);await page.close();
 console.log('PASS: rejected login stays on login; authenticated login reaches jobs; onboarding saves the confirmed profile and displays the real match count.');
} finally{await browser.close();await new Promise(r=>server.close(r));}
