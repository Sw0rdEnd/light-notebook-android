import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const action=(page,name)=>page.locator(`[data-action="${name}"]`);
async function choose(page,id,name,search){
 await page.locator(`[data-picker-for="${id}"]`).click();await expect(page.locator('#choice-dialog')).toBeVisible();
 if(search)await page.locator('#choice-dialog input[type=search]').fill(search);
 await page.locator('#choice-dialog').getByRole('option',{name}).click();await expect(page.locator('#choice-dialog')).toHaveCount(0);
}
async function screenshot(page,name,testInfo){await fs.mkdir('release/qa-ui',{recursive:true});await page.screenshot({path:`release/qa-ui/${testInfo.project.name}-${name}.png`});}

test('preset model picker, Chinese search, mount-aware kit, cancellation and persisted theme',async({page},testInfo)=>{
 const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:5180'))external.push(r.url());});
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-theme','light');await screenshot(page,'home',testInfo);
 await page.locator('[data-action="nav"][data-tab="settings"]').click();await action(page,'devices-open').click();await action(page,'device-catalog').first().click();
 await expect(page.locator('.equipment-card')).toHaveCount(78);await page.locator('#catalog-search').fill('索尼 A7M4');await expect(page.locator('.equipment-card')).toHaveCount(1);await expect(page.locator('.equipment-card')).toContainText('α7 IV');await action(page,'catalog-reset').click();
 await page.locator('[data-action="catalog-brand"][data-value="Sigma"]').click();await expect(page.locator('.equipment-card')).toHaveCount(16);await screenshot(page,'catalog',testInfo);await action(page,'device-mine').click();
 await action(page,'device-preset').click();await page.locator('[data-picker-for="preset-model"]').click();await page.locator('#choice-dialog input[type=search]').fill('A7M4');await expect(page.locator('#choice-dialog [role=option]')).toHaveCount(1);await screenshot(page,'model-picker',testInfo);await page.locator('#choice-dialog').getByRole('option',{name:/α7 IV/}).click();await action(page,'preset-continue').click();await expect(page.locator('#manual-model')).toHaveCount(0);await expect(page.locator('#modal')).toContainText('ILCE-7M4');
 await page.locator('#device-nickname').fill('下班随身机');await page.locator('[data-picker-for="device-ownership"]').click();await page.keyboard.press('ArrowDown');await page.keyboard.press('Escape');await expect(page.locator('#modal')).toBeVisible();await expect(page.locator('#device-ownership')).toHaveValue('owned');await expect(page.locator('#device-nickname')).toHaveValue('下班随身机');await action(page,'device-save').click();
 await action(page,'device-preset').click();await choose(page,'preset-type','镜头');await choose(page,'preset-brand','适马 Sigma');await choose(page,'preset-model',/18–50mm.*Sony E/,'18-50');await action(page,'preset-continue').click();await action(page,'device-save').click();await expect(page.locator('.equipment-card')).toHaveCount(2);
 await action(page,'kit-new').click();await page.locator('#kit-name').fill('轻装下班');await choose(page,'kit-body',/α7 IV/);await choose(page,'kit-lens',/18–50mm/);await expect(page.locator('#kit-check')).toContainText('裁切使用');await action(page,'kit-save').click();await action(page,'kit-default').click();await expect(page.locator('.top-actions')).toContainText('轻装下班');await screenshot(page,'my-equipment',testInfo);
 await action(page,'theme').click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await action(page,'device-catalog').first().click();await screenshot(page,'dark-catalog',testInfo);await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await expect(page.locator('.top-actions')).toContainText('轻装下班');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);expect(external).toEqual([]);
});

test('group multi-select uses checkable sheet, commits only on confirmation and Android back closes just the picker',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await action(page,'demo').click();await page.locator('[data-action="nav"][data-tab="photos"]').click();
 await action(page,'groups').click();for(const name of ['周末散步','夜景观察']){await action(page,'group-new').click();await page.locator('#group-name').fill(name);await action(page,'group-save').click();}
 await page.getByRole('button',{name:'返回照片',exact:true}).click();await page.locator('.photo-open').first().click();await page.locator('[data-picker-for="photo-groups"]').click();
 await page.locator('#choice-dialog').getByRole('option',{name:'周末散步'}).click();await page.locator('#choice-dialog').getByRole('option',{name:'夜景观察'}).click();await screenshot(page,'multi-group-picker',testInfo);await page.getByRole('button',{name:'确认选择',exact:true}).click();
 await expect(page.locator('[data-picker-for="photo-groups"]')).toContainText('周末散步');await expect(page.locator('[data-picker-for="photo-groups"]')).toContainText('夜景观察');await action(page,'photo-organize-save').click();
 await page.locator('[data-picker-for="photo-cull"]').click();await page.evaluate(()=>window.dispatchEvent(new CustomEvent('android-back')));await expect(page.locator('#choice-dialog')).toHaveCount(0);await expect(page.locator('#modal')).toBeVisible();
 await page.locator('[data-picker-for="photo-groups"]').click();await page.locator('#choice-dialog').getByRole('button',{name:'清除选择',exact:true}).click();await page.keyboard.press('Escape');expect(await page.locator('#photo-groups').evaluate(el=>[...el.selectedOptions].map(o=>o.label))).toEqual(expect.arrayContaining(['周末散步','夜景观察']));
 await page.locator('#modal [data-action="close"]').first().click();await page.reload();await page.locator('[data-action="nav"][data-tab="photos"]').click();await page.locator('.photo-open').first().click();expect(await page.locator('#photo-groups').evaluate(el=>[...el.selectedOptions].map(o=>o.label))).toEqual(expect.arrayContaining(['周末散步','夜景观察']));
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
