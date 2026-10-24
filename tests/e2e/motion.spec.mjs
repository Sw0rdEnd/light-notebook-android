import {test,expect} from '@playwright/test';
const action=(page,name)=>page.locator(`[data-action="${name}"]`);
async function equipment(page){
  await page.goto('/');
  await page.locator('[data-action="nav"][data-tab="settings"]').click();
  await action(page,'devices-open').click();await action(page,'device-preset').click();
  await expect(page.locator('#modal')).toBeVisible();
}

test('press feedback cancels with scroll/cancel; rapid navigation and keyboard still work',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');const button=action(page,'new');
  const rect=await button.boundingBox();await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();
  await expect(button).toHaveClass(/motion-pressed/);
  await expect.poll(()=>button.evaluate(el=>getComputedStyle(el).transform)).not.toBe('none');
  // A scrolling/cancelled pointer must release the visual state without activation.
  await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height+35);
  await expect(button).not.toHaveClass(/motion-pressed/);await page.mouse.up();
  await expect(page.locator('.home-page')).toBeVisible();
  await button.dispatchEvent('pointerdown',{isPrimary:true,button:0,pointerId:77,clientX:rect.x,clientY:rect.y});
  await button.dispatchEvent('pointercancel',{isPrimary:true,pointerId:77});await expect(button).not.toHaveClass(/motion-pressed/);
  // Real click handlers run immediately even while another transition is active.
  await page.evaluate(async()=>{
    for(const tab of ['photos','growth','settings','practice']){
      document.querySelector(`[data-action="nav"][data-tab="${tab}"]`).click();
      await new Promise(resolve=>setTimeout(resolve,35));
    }
  });
  await expect(page.locator('.home-page')).toBeVisible();
  await expect(page.locator('.nav-glider')).toHaveCount(1);
  await button.focus();await page.keyboard.press('Enter');await expect(page.locator('.wizard')).toBeVisible();
  expect(errors).toEqual([]);
});

test('sheet gestures cancel safely, dismissal returns focus, and nested forms survive',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await equipment(page);
  const trigger=page.locator('[data-picker-for="preset-model"]');await trigger.click();
  const picker=page.locator('#choice-dialog');await expect(picker).toBeVisible();
  const original=await page.locator('#preset-model').inputValue();
  // Scrolling the options is independent from the header drag gesture.
  const list=picker.locator('.choice-list');await list.hover();await page.mouse.wheel(0,350);
  await expect(picker).toBeVisible();await expect(page.locator('#preset-model')).toHaveValue(original);
  if(info.project.name==='mobile'){
    const head=await picker.locator('.choice-head').boundingBox();
    const drag=async distance=>{
      await page.mouse.move(head.x+50,head.y+35);await page.mouse.down();
      await page.mouse.move(head.x+50,head.y+35+distance,{steps:12});await page.mouse.up();
    };
    await drag(45);await expect(picker).toBeVisible();
    await expect(page.locator('#preset-model')).toHaveValue(original);
    await drag(135);await expect(picker).toHaveCount(0);
  }else{await page.keyboard.press('Escape');await expect(picker).toHaveCount(0);}
  await expect(page.locator('#modal')).toBeVisible();await expect(trigger).toBeFocused();
  await trigger.click();await picker.getByRole('option',{name:/α7 IV/}).click();
  await expect(picker).toHaveCount(0);await expect(trigger).toBeFocused();await expect(trigger).toContainText('α7 IV');
  // Reopening while the previous close animation is running must not close the new picker.
  await trigger.click();await page.evaluate(()=>{
    document.querySelector('#choice-dialog .choice-head button').click();
    document.querySelector('[data-picker-for="preset-model"]').click();
  });
  await expect(picker).toBeVisible();await expect(page.locator('.choice-dialog')).toHaveCount(1);
  await page.keyboard.press('Escape');await expect(page.locator('.choice-dialog')).toHaveCount(0);
  await action(page,'preset-continue').click();await expect(page.locator('#device-nickname')).toBeVisible();
  await page.locator('#device-nickname').fill('回弹测试机身');
  await page.locator('[data-picker-for="device-ownership"]').click();
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('android-back')));
  await expect(picker).toHaveCount(0);await expect(page.locator('#device-nickname')).toHaveValue('回弹测试机身');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});

test('reduced motion stops live animations and keeps picker selection and focus accessible',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await equipment(page);
  const trigger=page.locator('[data-picker-for="preset-model"]');await trigger.click();
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect.poll(()=>page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length)).toBe(0);
  await page.locator('#choice-dialog').getByRole('option',{name:/α7 IV/}).click();
  await expect(page.locator('.choice-dialog')).toHaveCount(0);await expect(trigger).toBeFocused();
  await expect(trigger).toContainText('α7 IV');await trigger.focus();await page.keyboard.press('ArrowDown');
  await expect(page.locator('#choice-dialog')).toBeVisible();await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();expect(await page.evaluate(()=>document.getAnimations().length)).toBe(0);
  expect(errors).toEqual([]);
});
