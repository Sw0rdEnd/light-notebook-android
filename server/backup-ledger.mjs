import {readConfig} from './config.mjs';
import {Ledger} from './ledger.mjs';
import path from 'node:path';
const config=readConfig(),filename=process.argv[2];
if(!/^backup-[0-9TZ-]+\.sqlite$/.test(filename||''))throw new Error('需要提供安全的backup-时间.sqlite文件名');
const ledger=new Ledger(config.dataDir);
try{await ledger.snapshot(path.join(config.dataDir,filename));console.log('调用台账快照已完成。');}finally{ledger.close();}
