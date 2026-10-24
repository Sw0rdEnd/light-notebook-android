import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'tests/admin-e2e',timeout:120000,workers:1,reporter:'list',
 use:{baseURL:'http://127.0.0.1:5191',actionTimeout:10000,launchOptions:process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{},screenshot:'only-on-failure',trace:'retain-on-failure'},
 projects:[{name:'desktop',use:{viewport:{width:1440,height:1000}}},{name:'mobile',use:{viewport:{width:393,height:852},isMobile:true,hasTouch:true}}],
 webServer:{command:'node tests/helpers/admin-preview.mjs',url:'http://127.0.0.1:5191/api/health',reuseExistingServer:false,timeout:20000}
});
