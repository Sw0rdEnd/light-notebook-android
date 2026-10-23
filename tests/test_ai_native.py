#!/usr/bin/env python3
"""Real JVM crypto, HTTP/protocol and async-bridge checks; not Android runtime QA.

The HTTP server is loopback-only and uses a synthetic key. Android Keystore,
AtomicFile and Bitmap integration still require device verification.
"""
from pathlib import Path
import argparse, hashlib, subprocess, tempfile, urllib.request, os

root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--ecj',default=str(root/'.tools/ecj.jar'));parser.add_argument('--json-jar',default=str(root/'.tools/json-20250517.jar'));args=parser.parse_args()
jar=Path(args.json_jar)
if not jar.exists():
    jar.parent.mkdir(parents=True,exist_ok=True)
    urllib.request.urlretrieve('https://repo.maven.apache.org/maven2/org/json/json/20250517/json-20250517.jar',jar)
if hashlib.sha256(jar.read_bytes()).hexdigest()!='3ea61b2a06e31edf1c91134fe9106b0ebb16628be169f3db75bc7a2b06b45796':raise RuntimeError('org.json test dependency checksum mismatch')
stubs={
 'android/webkit/JavascriptInterface.java':'package android.webkit; public @interface JavascriptInterface {}',
 'cn/xiaohuang/lightjournal/MainActivity.java':'''package cn.xiaohuang.lightjournal;import org.json.*;import java.util.concurrent.*;class MainActivity{final BlockingQueue<JSONObject> results=new LinkedBlockingQueue<>();void aiReply(String value){try{results.add(new JSONObject(value));}catch(Exception e){throw new AssertionError(e);}}}''',
 'cn/xiaohuang/lightjournal/LocalStore.java':'package cn.xiaohuang.lightjournal;class LocalStore{}',
 'cn/xiaohuang/lightjournal/AiCredentials.java':'''package cn.xiaohuang.lightjournal;import org.json.*;class AiCredentials{AiCredentials(MainActivity owner){}JSONObject status()throws Exception{return new JSONObject().put("configured",false);}void forget()throws AiException{}}''',
 'cn/xiaohuang/lightjournal/AiEvaluationService.java':'''package cn.xiaohuang.lightjournal;import org.json.*;import java.util.concurrent.*;class AiEvaluationService{static final CountDownLatch entered=new CountDownLatch(1);AiEvaluationService(LocalStore store,AiCredentials key){}JSONObject perform(String action,JSONObject payload,AiCall call)throws Exception{if(payload.optBoolean("block")){entered.countDown();while(!call.cancelled())Thread.sleep(5);}return new JSONObject().put("synthetic",true);}}''',
}
with tempfile.TemporaryDirectory(prefix='light-native-ai-') as name:
    base=Path(name);out=base/'classes';out.mkdir()
    for path,value in stubs.items():
        target=base/path;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(value)
    src=root/'app/src/main/java/cn/xiaohuang/lightjournal'
    files=[src/(name+'.java') for name in ['AiException','AiCall','AiSecretCipher','AiProtocol','DeepSeekClient','NativeAiBridge']]
    files += [root/'tests/java/NativeAiTest.java',*[base/path for path in stubs]]
    subprocess.run(['java','-jar',args.ecj,'-17','-encoding','UTF-8','-nowarn','-classpath',str(jar),'-d',str(out),*[str(path) for path in files]],check=True)
    subprocess.run(['java','-Djava.awt.headless=true','--add-modules','jdk.httpserver','-cp',str(out)+os.pathsep+str(jar),'cn.xiaohuang.lightjournal.NativeAiTest'],check=True)
