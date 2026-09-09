import { test, expect } from '@playwright/test';

async function openChat(page) {
  await page.goto('/login', {waitUntil:'domcontentloaded'});
  await page.getByLabel('Email', {exact:true}).fill('alice@example.test');
  await page.getByLabel('Password', {exact:true}).fill('ci-only-password');
  await page.getByRole('button', {name:'Login',exact:true}).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.getByRole('button', {name:'Open transaction assistant'}).click();
  await expect(page.getByRole('tab', {name:'Chat',exact:true})).toHaveAttribute('aria-selected','true');
}

test('agent consent and disabled fallback use the real API', async ({page}) => {
  await openChat(page);
  await page.getByLabel('Ask about your finances').fill('Where did my money go?');
  const ask = page.getByRole('button', {name:'Ask assistant',exact:true});
  await expect(ask).toBeDisabled();
  await page.getByRole('checkbox', {name:/Send my question/}).check();
  const result=page.waitForResponse(response=>response.url().endsWith('/api/agent/message'));
  await ask.click();
  expect((await result).status()).toBe(503);
  await expect(page.getByRole('alert').filter({hasText:'disabled by the administrator'})).toBeVisible();
  await page.getByRole('tab', {name:'Draft transaction',exact:true}).click();
  await expect(page.getByLabel('Describe a transaction')).toBeVisible();
});

test('agent chat supports follow-ups and clears ephemeral history', async ({page}) => {
  const requests=[];
  const answer='<img src=x onerror=alert(1)> Your balance is USD 100.';
  await page.route('**/api/agent/message', async route=>{
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    requests.push(route.request().postDataJSON());
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({answer,toolsUsed:['get_financial_snapshot']})});
  });
  await openChat(page);
  await page.getByRole('checkbox', {name:/Send my question/}).check();
  await page.getByLabel('Ask about your finances').fill('My balance?');
  const ask=page.getByRole('button', {name:'Ask assistant',exact:true});
  await ask.click();
  const log=page.getByRole('log', {name:'Financial conversation'});
  await expect(log.getByText(answer,{exact:true})).toBeVisible();
  await expect(log.locator('img')).toHaveCount(0);
  await expect(log.getByText('Looked up: Account balances')).toBeVisible();
  await expect(ask).toHaveAttribute('aria-busy','false');
  await page.getByLabel('Ask about your finances').fill('What about savings?');
  await expect(ask).toBeEnabled();
  await ask.click();
  await expect(log.getByText(answer,{exact:true})).toHaveCount(2);
  expect(requests[0].history).toEqual([]);
  expect(requests[1].history).toEqual([{role:'user',content:'My balance?'},{role:'assistant',content:answer}]);
  await page.getByRole('button',{name:'Clear chat',exact:true}).click();
  await expect(log).toBeEmpty();
  await page.getByLabel('Ask about your finances').fill('Start over');
  await ask.click();
  await expect(log.getByText(answer,{exact:true})).toBeVisible();
  expect(requests[2].history).toEqual([]);
  await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button', {name:'Open transaction assistant'}).click();
  await expect(page.getByRole('tab', {name:'Chat',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('log', {name:'Financial conversation'})).toBeEmpty();
  await expect(page.getByLabel('Ask about your finances')).toHaveValue('');
  await expect(page.getByRole('checkbox', {name:/Send my question/})).not.toBeChecked();
});
