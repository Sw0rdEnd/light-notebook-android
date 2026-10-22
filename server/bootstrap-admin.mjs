import {readConfig} from './config.mjs';
import {Ledger} from './ledger.mjs';
import {Accounts} from './accounts.mjs';
import {emitKeypressEvents} from 'node:readline';
const command=process.argv[2]||'create-admin',username=process.argv[3];
if(!['create-admin','reset-password'].includes(command)||!username)throw new Error('用法：node server/bootstrap-admin.mjs create-admin|reset-password 用户名；密码从标准输入读取，不放在命令参数中。');
async function password(){
 if(!process.stdin.isTTY){let input='';for await(const chunk of process.stdin){input+=chunk;if(input.length>1024)throw new Error('密码输入过长。');}return input.replace(/\r?\n$/,'');}
 process.stderr.write('输入密码（至少12位，不回显）：');emitKeypressEvents(process.stdin);process.stdin.setRawMode(true);process.stdin.resume();
 return new Promise((resolve,reject)=>{let value='';const done=()=>{process.stdin.removeListener('keypress',onKey);process.stdin.setRawMode(false);process.stdin.pause();process.stderr.write('\n');};const onKey=(text,key)=>{if(key.ctrl&&key.name==='c'){done();reject(new Error('已取消。'));}else if(key.name==='return'){done();resolve(value);}else if(key.name==='backspace')value=value.slice(0,-1);else if(text&&!key.ctrl&&value.length<129)value+=text;};process.stdin.on('keypress',onKey);});
}
const config=readConfig();if(!config.adminEnabled)throw new Error('请先设置ADMIN_ENABLED=true。');
const ledger=new Ledger(config.dataDir),accounts=new Accounts(ledger.db,config);
try{
 const secret=await password();
 if(command==='create-admin'){await accounts.create({username,password:secret,role:'admin'},{id:null},{bootstrap:true});console.log('管理员已创建。请打开/admin/登录。');}
 else{const row=ledger.db.prepare('SELECT id FROM accounts WHERE username=? COLLATE NOCASE').get(username);if(!row)throw new Error('账户不存在。');await accounts.update(row.id,{password:secret},null);console.log('密码已重置，旧登录会话已失效。');}
}finally{ledger.close();}
