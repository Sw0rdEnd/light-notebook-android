import {readConfig} from './config.mjs';
import {createApp} from './app.mjs';
const config=readConfig(),app=createApp(config,{logger:entry=>console.log(JSON.stringify(entry))});
app.server.listen(config.port,config.host,()=>console.log(JSON.stringify({status:'ready',port:config.port,aiEnabled:config.enabled})));
let stopping=false;for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{if(stopping)return;stopping=true;const timeout=setTimeout(()=>process.exit(1),70000);timeout.unref();app.close().then(()=>{clearTimeout(timeout);process.exit(0);});});
