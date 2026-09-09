import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

async function openChat(page) {
  await page.goto('/login', {waitUntil:'domcontentloaded'});
  await page.getByLabel('Email',{exact:true}).fill('alice@example.test');
  await page.getByLabel('Password',{exact:true}).fill('ci-only-password');
  await page.getByRole('button',{name:'Login',exact:true}).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.getByRole('button',{name:'Open transaction assistant'}).click();
  await page.getByRole('checkbox',{name:/Send my question/}).check();
}

test('permission changes clear history and read-only chat cannot show a write confirmation',async({page})=>{
  const calls=[];
  const runId=randomUUID();
  const proposal={id:randomUUID(),entity:'account',operation:'create',currency:'USD',values:{name:'Preview only',balance:'0',currency:'USD'},references:{},warnings:[]};
  await page.route('**/api/agent/message',route=>{
    calls.push(route.request().postDataJSON());
    return route.fulfill({status:200,contentType:'application/json',headers:{'X-Agent-Run-ID':runId},body:JSON.stringify({answer:'Review the change.',toolsUsed:['propose_account'],proposal})});
  });
  await openChat(page);
  const changes=page.getByRole('checkbox',{name:'Allow change proposals',exact:true});
  const deletes=page.getByRole('checkbox',{name:'Allow delete/archive proposals',exact:true});
  const notes=page.getByRole('checkbox',{name:'Include stored transaction notes',exact:true});
  await expect(changes).not.toBeChecked();
  await expect(deletes).toBeDisabled();
  await expect(notes).not.toBeChecked();
  const ask=async()=>{
    await page.getByLabel('Ask about your finances').fill('Create a wallet');
    await page.getByRole('button',{name:'Ask assistant',exact:true}).click();
  };
  await ask();
  await expect(page.getByRole('alert').filter({hasText:'outside the enabled permissions'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Confirm change',exact:true})).toHaveCount(0);
  expect(calls[0]).toMatchObject({allowChanges:false,allowDeletes:false,includeNotes:false,history:[]});
  await changes.check();
  await ask();
  await expect(page.getByRole('button',{name:'Confirm change',exact:true})).toBeEnabled();
  await expect(page.getByRole('log')).toContainText(runId);
  await notes.check();
  await expect(page.getByRole('log')).toBeEmpty();
  await expect(page.getByRole('button',{name:'Confirm change',exact:true})).toHaveCount(0);
  await ask();
  await expect(page.getByRole('button',{name:'Confirm change',exact:true})).toBeEnabled();
  expect(calls[2]).toMatchObject({allowChanges:true,allowDeletes:false,includeNotes:true,history:[]});
  await changes.uncheck();
  await expect(deletes).not.toBeChecked();
  await expect(deletes).toBeDisabled();
  await expect(page.getByRole('log')).toBeEmpty();
});
