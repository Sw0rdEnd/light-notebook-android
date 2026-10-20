import {defineConfig} from '@playwright/test';
import {existsSync} from 'node:fs';
const executablePath=process.env.BROWSER_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
export default defineConfig({
 testDir:'tests/e2e',timeout:90000,workers:1,reporter:'list',
 use:{baseURL:'http://127.0.0.1:5180',launchOptions:executablePath?{executablePath}:{},screenshot:'only-on-failure',trace:'retain-on-failure'},
 projects:[{name:'desktop',use:{viewport:{width:1440,height:1000}}},{name:'mobile',use:{viewport:{width:393,height:852},isMobile:true,hasTouch:true}}],
 webServer:{command:'node scripts/dev-server.mjs --port 5180',url:'http://127.0.0.1:5180',reuseExistingServer:false,timeout:20000}
});
