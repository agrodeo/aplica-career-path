import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from '../worker/node_modules/playwright/index.mjs';
const root=resolve('dist/client');
const fallback=process.env.TEST_STATIC_PAGES==='true'?'index.html':'_shell.html';
const types={'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.html':'text/html'};
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(path!==root&&!path.startsWith(root+'/'))throw Error();let file;try{file=await readFile(path);res.setHeader('Content-Type',types[extname(path)]??'application/octet-stream');}catch{file=await readFile(resolve(root,fallback));res.setHeader('Content-Type','text/html');}res.end(file);}catch{res.writeHead(404).end();}});
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
 await page.goto(origin+'/onboarding');await page.getByRole('button',{name:'Buscar mis trabajos'}).click();await page.getByRole('heading',{name:'Encontramos 0 trabajos compatibles con Auto Apply.'}).waitFor();assert.equal(onboarding.profile.firstName,'Ana');assert.equal(onboarding.autoApplyAuthorized,false);assert.deepEqual(onboarding.roles,['Nurse']);assert.equal(onboarding.profile.isCurrent,false);
 // Complete a controlled application flow without sending applicant data to an employer.
 const fixtureJob = { id:'00000000-0000-0000-0000-000000000021', title:'Nurse', description:'Nursing role.', location:'Argentina', country:'ar', remote_type:'onsite', employment_type:'full-time', seniority:null, company_id:'company', is_active:true, auto_apply_eligible:true, application_schema_id:'schema', application_url:'https://example.com/apply', auto_apply_adapter:'greenhouse_public', discovered_at:new Date().toISOString(), published_at:null, companies:{name:'Beta Fixture',logo_url:null,last_scanned_at:new Date().toISOString()} };
 const prefs = { target_roles:['Nurse'], target_locations:['Argentina'], remote_allowed:false, hybrid_allowed:false, onsite_allowed:true, employment_types:['full_time'], seniority_levels:[], minimum_match_score:70 };
 let attemptStatus='queued', enqueued=false, failHistory=false, activePlan=true, sentJobIds=null, writtenMatches=null;
 const application = () => ({id:'attempt-fixture',job_id:fixtureJob.id,status:attemptStatus,queued_at:new Date().toISOString(),verified_at:attemptStatus==='verified'?new Date().toISOString():null,adapter:'greenhouse_public',error_code:null,resume_variant_id:null,submission_reference:attemptStatus==='verified'?'CONFIRMED-FIXTURE':null,jobs:{title:fixtureJob.title,companies:{name:'Beta Fixture'},application_url:fixtureJob.application_url}});
 await page.route('https://ctdpjiyxcoytshegnpbc.supabase.co/rest/v1/**', async route => {
   const req=route.request(),url=new URL(req.url()),table=url.pathname.split('/').pop(); let body=[]; let status=200;
   if(table==='profiles') body={first_name:'Ana',last_name:'Perez',email:user.email,current_title:'Nurse',country:'Argentina'};
   else if(table==='experiences') body=[{title:'Nurse',company:'Fixture',achievements:[]}];
   else if(table==='skills') body=[{name:'Nursing'}];
   else if(table==='job_preferences') body=prefs;
   else if(table==='jobs') body=[fixtureJob];
   else if(table==='job_matches') { if(req.method()==='POST'){writtenMatches=req.postDataJSON();body=null;}else body=writtenMatches??[]; }
   else if(table==='application_schemas') body=[{id:'schema',job_id:fixtureJob.id,valid:true,fields:[{canonicalKey:'email',answerKey:'email',type:'email',required:true}]}];
   else if(table==='subscriptions') body=activePlan?{plan_code:'beta',status:'active',plans:{name:'Beta',weekly_application_limit:25}}:null;
   else if(table==='auto_apply_consents') body={authorized:true,revoked_at:null};
   else if(table==='plans') body=[{code:'starter',name:'Starter real',price_amount:6.99,price_currency:'USD',billing_period:'weekly',weekly_application_limit:25,sort_order:0}];
   else if(table==='application_batches') body={id:'batch-fixture',total_selected:1,status:attemptStatus==='verified'?'completed':'open'};
   else if(table==='application_attempts') { if(failHistory && !url.searchParams.has('batch_id')){body={message:'Fixture database unavailable'};status=400;}else body=enqueued?[application()]:[]; }
   await route.fulfill({status,headers:{'Content-Type':'application/json','Content-Range':'0-0/0'},body:JSON.stringify(body)});
 });
 await page.route('https://ctdpjiyxcoytshegnpbc.supabase.co/functions/v1/start-auto-apply-batch', async route => {
   sentJobIds=route.request().postDataJSON().jobIds;enqueued=true;
   await route.fulfill({json:{status:'queued',batchId:'batch-fixture',results:{queued:1}}});
 });
 await page.goto(origin+'/jobs');
 await page.getByRole('button',{name:'Aplicar a 1',exact:true}).click();
 await page.waitForURL('**/applying?batch=batch-fixture');
 await page.getByText('En cola',{exact:true}).last().waitFor();
 assert.deepEqual(sentJobIds,[fixtureJob.id]);assert.equal(writtenMatches[0].hard_requirements_met,true);
 assert.equal(await page.getByText('Enviada',{exact:true}).count(),0);
 attemptStatus='verified';await page.reload();await page.getByText('Enviada',{exact:true}).waitFor();
 await page.goto(origin+'/applications');await page.getByRole('heading',{name:'Nurse',exact:true}).waitFor();
 await page.getByText('Referencia: CONFIRMED-FIXTURE',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Necesitan atención',exact:true}).click();await page.getByText('No hay postulaciones con este estado.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Enviadas',exact:true}).click();await page.getByRole('heading',{name:'Nurse',exact:true}).waitFor();
 await page.screenshot({path:'/tmp/aplica-applications-desktop.png',fullPage:true});
 failHistory=true;await page.reload();await page.getByRole('alert').filter({hasText:'No pudimos cargar tus postulaciones'}).waitFor();
 failHistory=false;enqueued=false;await page.reload();await page.getByText('Todavía no enviaste postulaciones con Aplica.',{exact:true}).waitFor();
 activePlan=false;
 await page.evaluate(()=>localStorage.setItem('aplica-user-draft-v1',JSON.stringify({subscribed:true})));
 await page.goto(origin+'/upgrade');await page.getByRole('heading',{name:'Starter real',exact:true}).waitFor();
 await page.getByText('Aplica está en beta. La contratación y los cobros todavía no están habilitados.',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Contratación próximamente',exact:true}).isDisabled(),true);
 assert.equal(await page.getByText('Simular error de pago',{exact:true}).count(),0);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/aplica-plans-mobile.png',fullPage:true});
 await page.close();
 console.log('PASS: controlled matching → enqueue → batch confirmation → real history; verified-only filtering; database errors; empty history; real plan catalog and no simulated subscription.');
 console.log('PASS: rejected login stays on login; authenticated login reaches jobs; onboarding saves the confirmed profile and displays the real match count.');
} finally{await browser.close();await new Promise(r=>server.close(r));}
