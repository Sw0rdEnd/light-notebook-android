import {test,expect} from '@playwright/test';
test('opt-in A/B AI upload, escaped result, local persistence and reopening without a second paid call',async({page})=>{
 let uploads=0;const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/ai/status',route=>route.fulfill({json:{enabled:true,message:'测试AI已配置'}}));
 await page.route('**/api/ai/evaluate',async route=>{
  uploads++;const input=route.request().postDataJSON();expect(input.photos).toHaveLength(2);expect(input.photos.map(p=>p.label)).toEqual(['A','B']);
  expect(input.photos.every(p=>p.image.startsWith('data:image/jpeg;base64,'))).toBe(true);expect(JSON.stringify(input)).not.toContain('localPreview');
  await route.fulfill({json:{schema:'light-journal.ai-result.v1',requestId:input.requestId,status:'ok',summary:'测试：A的主体更集中 <img src=x onerror=alert(1)>',observations:[{aspect:'构图',basis:'observation',text:'A的背景更简洁'}],nextSteps:['下次在同一位置比较两个焦段'],preferred:'A'}});
 });
 await page.goto('/');await page.locator('[data-action=demo]').click();await expect(page.locator('.review-main')).toBeVisible();await page.locator('[data-action=nav][data-tab=photos]').click();
 const ids=await page.locator('.photo-open').evaluateAll(nodes=>nodes.slice(0,2).map(n=>n.dataset.id));
 const compare=async()=>{await page.locator('[data-action=toggle-select]').click();for(const id of ids)await page.locator(`.photo-open[data-id="${id}"]`).click();await page.locator('[data-action=compare]').click();};
 await compare();await page.locator('#modal .ai-question').fill('哪张背景更干净？');await page.locator('#modal [data-action=ai-review]').click();
 await expect(page.locator('#ai-consent')).not.toBeChecked();await page.locator('#ai-access-code').fill('browser-test-access-code');
 await page.locator('[data-action=ai-submit]').click();expect(uploads).toBe(0);await expect(page.locator('#toast')).toContainText('同意');
 await page.locator('#ai-consent').check();await page.locator('[data-action=ai-submit]').click();
 await expect(page.locator('#modal')).toContainText('测试：A的主体更集中');await expect(page.locator('#modal')).toContainText('已保存');await expect(page.locator('#modal img')).toHaveCount(0);expect(uploads).toBe(1);
 await page.reload();await page.locator('[data-action=nav][data-tab=photos]').click();await compare();await page.locator('[data-action=ai-last]').click();
 await expect(page.locator('#modal')).toContainText('A的背景更简洁');expect(uploads).toBe(1);expect(errors).toEqual([]);
});
