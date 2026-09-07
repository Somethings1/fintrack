import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

async function login(page) {
  await page.goto('/login', {waitUntil:'domcontentloaded'});
  await page.getByLabel('Email',{exact:true}).fill('bob@example.test');
  await page.getByLabel('Password',{exact:true}).fill('ci-only-password');
  const signedIn=page.waitForResponse(r=>r.url().includes('/auth/v1/token')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Login',exact:true}).click();
  const token=(await (await signedIn).json()).access_token;
  await expect(page).toHaveURL(/\/home$/);
  await page.getByRole('button',{name:'Open transaction assistant'}).click();
  await expect(page.getByRole('tab',{name:'Chat',exact:true})).toHaveAttribute('aria-selected','true');
  await page.getByRole('checkbox',{name:/Send my question/}).check();
  return token;
}
const collections={account:'accounts',saving:'savings',category:'categories',transaction:'transactions',subscription:'subscriptions'};
function proposal(entity,operation,values={},recordId,before) {
  return {id:randomUUID(),entity,operation,recordId,currency:'USD',values:operation==='delete'?{}:{...values,currency:'USD'},before,references:{},warnings:[]};
}
async function records(request,entity,token) {
  const response=await request.get(`/api/${collections[entity]}/get-since/1970-01-01T00%3A00%3A00Z`,{headers:{Authorization:`Bearer ${token}`}});
  expect(response.status()).toBe(200);
  return (await response.text()).trim().split('\n').map(line=>JSON.parse(line)).filter(row=>row._id&&!row.isDeleted);
}

test('chat confirms real CRUD through existing API; discard and double click never double-post',async({page,request})=>{
  let next; const messages=[]; let writes=0;
  page.on('request',r=>{if (/\/api\/(accounts|savings|categories|transactions|subscriptions)\/(add|update|delete)/.test(r.url())&&r.method()!=='GET') writes++;});
  await page.route('**/api/agent/message',route=>{
    messages.push(route.request().postDataJSON());
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({answer:'Review this proposed change. Nothing is saved.',toolsUsed:[`propose_${next.entity}`],proposal:next})});
  });
  const token=await login(page);
  const prepare=async p=>{
    next=p;
    await page.getByLabel('Ask about your finances').fill(`${p.operation} ${p.entity} ${p.id}`);
    await page.getByRole('button',{name:'Ask assistant',exact:true}).click();
    const card=page.getByRole('region',{name:'Proposed record change'}).last();
    await expect(card.getByRole('button',{name:'Confirm change',exact:true})).toBeEnabled();
    return card;
  };
  const confirm=async p=>{
    const oldWrites=writes;
    const card=await prepare(p);
    expect(writes).toBe(oldWrites);
    const collection=collections[p.entity];
    const response=page.waitForResponse(r=>r.url().includes(`/api/${collection}/${p.operation==='create'?'add':p.operation}`)&&r.request().method()!=='GET');
    // Two DOM clicks in the same turn exercise the synchronous submit lock.
    await card.getByRole('button',{name:'Confirm change',exact:true}).evaluate(button=>{button.click();button.click();});
    const saved=await response;
    expect(saved.status(),await saved.text()).toBe(200);
    await expect(card.getByRole('status')).toContainText('Saved in FinTrack.');
    expect(writes).toBe(oldWrites+1);
    return p.operation==='create'?(await saved.json()).id:p.recordId;
  };
  const before=(await records(request,'account',token)).length;
  const discarded=await prepare(proposal('account','create',{name:'Never saved',balance:'0'}));
  await discarded.getByRole('button',{name:'Discard change',exact:true}).click();
  expect((await records(request,'account',token)).length).toBe(before);
  expect(writes).toBe(0);
  const accountValues={name:'Chat CRUD Wallet',icon:'',balance:'10'};
  const account=await confirm(proposal('account','create',accountValues));
  const catValues={name:'Chat CRUD Food',icon:'',type:'expense',budget:'0'};
  const category=await confirm(proposal('category','create',catValues));
  const savingValues={name:'Chat CRUD Goal',icon:'',balance:'0',goal:'20',createdDate:'2026-09-07T00:00:00Z',goalDate:'2027-01-01T00:00:00Z'};
  const saving=await confirm(proposal('saving','create',savingValues));
  const txValues={amount:'0.30',type:'expense',sourceAccount:account,destinationAccount:'',category,note:'Chat CRUD lunch',dateTime:'2026-09-07T12:00:00Z'};
  const transaction=await confirm(proposal('transaction','create',txValues));
  expect((await records(request,'account',token)).find(r=>r._id===account).balance).toBe(9.7);
  await confirm(proposal('transaction','update',{...txValues,amount:'0.20'},transaction,txValues));
  expect((await records(request,'account',token)).find(r=>r._id===account).balance).toBe(9.8);
  await confirm(proposal('transaction','delete',{},transaction,{...txValues,amount:'0.20'}));
  expect((await records(request,'account',token)).find(r=>r._id===account).balance).toBe(10);
  await confirm(proposal('category','update',{...catValues,budget:'100'},category,catValues));
  expect((await records(request,'category',token)).find(r=>r._id===category).budget).toBe(100);
  await confirm(proposal('category','update',catValues,category,{...catValues,budget:'100'}));
  expect((await records(request,'category',token)).find(r=>r._id===category).budget??0).toBe(0);
  const subValues={name:'Chat CRUD Music',icon:'',amount:'1',sourceAccount:account,category,startDate:'2027-01-01T00:00:00Z',interval:'month',maxInterval:0,remindBefore:0};
  const sub=await confirm(proposal('subscription','create',subValues));
  await confirm(proposal('subscription','update',{...subValues,amount:'2'},sub,subValues));
  await confirm(proposal('subscription','delete',{},sub,{...subValues,amount:'2'}));
  const updatedSaving={...savingValues,goal:'30'}; delete updatedSaving.balance;
  await confirm(proposal('saving','update',updatedSaving,saving,savingValues));
  await confirm(proposal('account','update',{name:'Renamed chat wallet',icon:''},account,accountValues));
  await confirm(proposal('saving','delete',{},saving,{...savingValues,goal:'30'}));
  await confirm(proposal('category','delete',{},category,catValues));
  await confirm(proposal('account','delete',{},account,{...accountValues,name:'Renamed chat wallet'}));
  expect((await records(request,'account',token)).some(r=>r._id===account)).toBe(false);
  expect(messages.some(m=>m.history.some(item=>item.content.includes('Application status: saved')))).toBe(true);
});

test('new questions supersede unconfirmed proposals and unknown save outcomes are not retried',async({page})=>{
  const p=proposal('account','create',{name:'Ambiguous save',balance:'0'});
  await page.route('**/api/agent/message',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({answer:'Review before saving.',toolsUsed:['propose_account'],proposal:{...p,id:randomUUID()}})}));
  await login(page);
  const send=async()=>{await page.getByLabel('Ask about your finances').fill('Create an account');await page.getByRole('button',{name:'Ask assistant',exact:true}).click();};
  await send();
  await expect(page.getByRole('button',{name:'Confirm change',exact:true})).toHaveCount(1);
  await send();
  await expect(page.getByRole('region',{name:'Proposed record change'}).first()).toContainText('Replaced by a newer message');
  await expect(page.getByRole('button',{name:'Confirm change',exact:true})).toHaveCount(1);
  let attempts=0;
  await page.route('**/api/accounts/add',route=>{attempts++;return route.abort('failed');});
  await page.getByRole('button',{name:'Confirm change',exact:true}).click();
  await expect(page.getByRole('region',{name:'Proposed record change'}).last()).toContainText('outcome is unknown');
  await expect(page.getByRole('button',{name:'Confirm change',exact:true})).toHaveCount(0);
  expect(attempts).toBe(1);
});
