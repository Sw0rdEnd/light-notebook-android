#!/usr/bin/env python3
"""Reproducible Android APK build without Gradle. Requires Linux x86_64, Python 3, JRE 17, keytool."""
import argparse,base64,hashlib,os,pathlib,secrets,shutil,subprocess,urllib.request,zipfile,sys,re
P=pathlib.Path(__file__).resolve().parent
TOOLS=[('platform.zip','https://dl.google.com/android/repository/platform-35_r02.zip','0bb560a90a7a2cbd0dd8348224d518b638fe7949'),('build-tools.zip','https://dl.google.com/android/repository/build-tools_r35_linux.zip','2cfaa0bbb2336e9ec18ed3ecea84fa2e2af607bc'),('ecj.jar','https://repo.maven.apache.org/maven2/org/eclipse/jdt/ecj/3.39.0/ecj-3.39.0.jar',None)]
if sys.platform=='win32':TOOLS[1]=('build-tools-windows.zip','https://dl.google.com/android/repository/build-tools_r35_windows.zip',None)
def run(*args,**kw): subprocess.run([str(x) for x in args],check=True,**kw)
def main():
 a=argparse.ArgumentParser();a.add_argument('--cache',default=str(P/'.tools'));a.add_argument('--prepared-sdk');a.add_argument('--ecj');args=a.parse_args();cache=pathlib.Path(args.cache);cache.mkdir(parents=True,exist_ok=True)
 if args.prepared_sdk:sdk=pathlib.Path(args.prepared_sdk);ecj=pathlib.Path(args.ecj)
 else:
  sdk=cache/'sdk'
  for name,url,sha in TOOLS:
   f=cache/name
   if not f.is_file():urllib.request.urlretrieve(url,f)
   if sha and hashlib.sha1(f.read_bytes()).hexdigest()!=sha:raise RuntimeError('SDK checksum failed: '+name)
   if name.endswith('.zip'):
    with zipfile.ZipFile(f) as z:z.extractall(sdk)
  ecj=cache/'ecj.jar'
 bt=sdk/'android-15';jar=sdk/'android-35/android.jar'
 exe='.exe' if sys.platform=='win32' else ''
 if not exe:
  for name in ['aapt2','zipalign','apksigner']:(bt/name).chmod(0o755)
 b=P/'build';b.mkdir(exist_ok=True);(b/'classes').mkdir(exist_ok=True);(b/'dex').mkdir(exist_ok=True)
 src=P/'app/src/main'
 run(bt/('aapt2'+exe),'compile','--dir',src/'res','-o',b/'resources.zip')
 run(bt/('aapt2'+exe),'link','-I',jar,'--manifest',src/'AndroidManifest.xml','--min-sdk-version','28','--target-sdk-version','35','-A',src/'assets','-o',b/'resources.apk',b/'resources.zip')
 java=list((src/'java').rglob('*.java'))
 run('java','-jar',ecj,'-1.8','-encoding','UTF-8','-nowarn','-bootclasspath',str(jar)+os.pathsep+str(bt/'core-lambda-stubs.jar'),'-d',b/'classes',*java)
 run('java','-cp',bt/'lib/d8.jar','com.android.tools.r8.D8','--release','--min-api','28','--lib',jar,'--output',b/'dex',*list((b/'classes').rglob('*.class')))
 unsigned=b/'unsigned.apk';shutil.copy2(b/'resources.apk',unsigned)
 with zipfile.ZipFile(unsigned,'a') as z:z.write(b/'dex/classes.dex','classes.dex',compress_type=zipfile.ZIP_DEFLATED)
 run(bt/('zipalign'+exe),'-p','-f','4',unsigned,b/'aligned.apk')
 sign=P/'signing';sign.mkdir(exist_ok=True);password=sign/'password.txt';key=sign/'light-journal.jks'
 if not key.exists():
  raise RuntimeError('缺少原升级签名 signing/light-journal.jks；请恢复私密备份，不生成替代签名。')
 version=re.search(r'android:versionName="([^"]+)"',(src/'AndroidManifest.xml').read_text(encoding='utf-8')).group(1)
 out=P/'release';out.mkdir(exist_ok=True);apk=out/('光影练习册_Android_v'+version+'.apk')
 signenv=os.environ.copy();signenv['LIGHT_JOURNAL_SIGN_PASS']=password.read_text().strip()
 run('java','-jar',bt/'lib/apksigner.jar','sign','--ks',key,'--ks-key-alias','lightjournal','--ks-pass','env:LIGHT_JOURNAL_SIGN_PASS','--key-pass','env:LIGHT_JOURNAL_SIGN_PASS','--v1-signing-enabled','true','--v2-signing-enabled','true','--v3-signing-enabled','true','--out',apk,b/'aligned.apk',env=signenv)
 run('java','-jar',bt/'lib/apksigner.jar','verify','--verbose','--print-certs',apk)
 run(bt/('zipalign'+exe),'-c','4',apk)
 (out/'SHA256.txt').write_text(hashlib.sha256(apk.read_bytes()).hexdigest()+'  '+apk.name+'\n',encoding='utf-8')
 print('APK:',apk)
if __name__=='__main__':main()
