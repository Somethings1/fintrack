import { test, expect } from '@playwright/test';
async function login(page, email) {
  await page.goto('/login');
  await page.getByLabel('Email', {exact:true}).fill(email);
  await page.getByLabel('Password', {exact:true}).fill('ci-only-password');
  const result=page.waitForResponse(r=>r.url().includes('/auth/v1/token') && r.request().method()==='POST');
  await page.getByRole('button',{name:'Login',exact:true}).click();
  const token=(await (await result).json()).access_token;
  await expect(page).toHaveURL(/\/home$/);
  return token;
}
async function records(request, collection, token) {
  const response=await request.get(`/api/${collection}/get-since/1970-01-01T00%3A00%3A00Z`,{headers:{Authorization:`Bearer ${token}`}});
  expect(response.status()).toBe(200);
  return (await response.text()).trim().split('\n').map(line=>JSON.parse(line)).filter(row=>row._id);
}
test('real ledger: exact decimal saves, confirmation, reload and user-switch isolation',async({page,request})=>{
  const exceptions=[]; page.on('pageerror',error=>exceptions.push(error.message));
  const token=await login(page,'alice@example.test');
  await page.getByRole('menuitem',{name:'Accounts',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Alice Wallet'})).toBeVisible();
  await expect(page.getByText('Bob Wallet',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'New Account',exact:true}).click();
  const account=page.getByRole('dialog');
  await account.getByLabel('Name',{exact:true}).fill('Browser Reserve');
  await account.getByLabel('Balance',{exact:true}).fill('0.30');
  await account.getByRole('button',{name:'Create',exact:true}).click();
  await expect(account).toBeHidden();
  await expect(page.getByRole('heading',{name:'Browser Reserve'})).toBeVisible();
  await page.getByRole('menuitem',{name:'Transactions',exact:true}).click();
  for(const amount of ['0.10','0.20']) {
    await page.getByRole('button',{name:'Add new transaction',exact:true}).click();
    const dialog=page.getByRole('dialog');
    const expense=dialog.getByRole('radio',{name:'Expense',exact:true});
    // Ant Design keeps the native radio input visually hidden; click the visible label text.
    await dialog.getByText('Expense',{exact:true}).click();
    await expect(expense).toBeChecked();
    await dialog.getByLabel('Amount',{exact:true}).fill(amount);
    await dialog.getByLabel('Source Account',{exact:true}).click();
    await page.getByText('[A] Browser Reserve',{exact:true}).click();
    await dialog.getByLabel('Category',{exact:true}).click();
    await page.getByText('Food',{exact:true}).last().click();
    await dialog.getByLabel('Note',{exact:true}).fill('Browser decimal '+amount);
    const saved=page.waitForResponse(r=>r.url().endsWith('/api/transactions/add'));
    await dialog.getByRole('button',{name:'Submit',exact:true}).click();
    expect((await saved).status()).toBe(200);
    await expect(dialog).toBeHidden();
  }
  const accounts=await records(request,'accounts',token);
  expect(accounts.find(a=>a.name==='Browser Reserve').balance).toBe(0);
  expect((await records(request,'transactions',token)).length).toBe(2);
  await page.reload();
  await page.getByRole('menuitem',{name:'Accounts',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Browser Reserve'})).toBeVisible();
  await page.getByRole('button',{name:'Open transaction assistant'}).click();
  await page.getByLabel('Describe a transaction').fill('Spend 1 on Food');
  await expect(page.getByRole('button',{name:'Prepare draft'})).toBeDisabled();
  await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
  await page.goto('/profile');
  await expect(page.getByLabel('Ledger currency (no currency conversion)')).toHaveValue('USD');
  await expect(page.getByLabel('Ledger currency (no currency conversion)')).toBeDisabled();
  await page.getByRole('button',{name:'Logout',exact:true}).click();
  await expect(page).toHaveURL(/\/login$/);
  const denied=await request.get('/api/accounts/get-since/1970-01-01T00%3A00%3A00Z',{headers:{Authorization:`Bearer ${token}`}});
  expect(denied.status()).toBe(401);
  await login(page,'bob@example.test');
  await page.getByRole('menuitem',{name:'Accounts',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Bob Wallet'})).toBeVisible();
  await expect(page.getByText('Browser Reserve',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Alice Wallet',{exact:true})).toHaveCount(0);
  expect(exceptions).toEqual([]);
});
test('ledger configuration failure is visible and never guesses a currency',async({page})=>{
  await page.route('**/api/config',route=>route.fulfill({status:503,body:'Unavailable'}));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('ledger configuration could not be loaded');
  await expect(page.getByRole('button',{name:'Retry'})).toBeVisible();
});
