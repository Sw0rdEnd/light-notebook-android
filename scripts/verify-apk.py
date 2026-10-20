"""Inspect APK assets, package/version, signing certificate and optional upgrade baseline."""
import argparse,hashlib,pathlib,re,subprocess,sys,zipfile
root=pathlib.Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('apk');parser.add_argument('--baseline');parser.add_argument('--build-tools',default=str(root/'.tools/sdk/android-15'));args=parser.parse_args()
apk=pathlib.Path(args.apk);tools=pathlib.Path(args.build_tools)
with zipfile.ZipFile(apk) as archive:
    assets=list((root/'app/src/main/assets').rglob('*'))
    for source in assets:
        if source.is_file():
            name='assets/'+source.relative_to(root/'app/src/main/assets').as_posix()
            if archive.read(name)!=source.read_bytes():raise RuntimeError('APK asset mismatch: '+name)
    if not archive.read('classes.dex').startswith(b'dex\n'):raise RuntimeError('Missing valid dex')
print('PASS all packaged web assets match the current working tree')
badging=subprocess.check_output([str(tools/('aapt2.exe' if sys.platform=='win32' else 'aapt2')),'dump','badging',str(apk)],encoding='utf-8')
manifest=(root/'app/src/main/AndroidManifest.xml').read_text(encoding='utf-8')
for key in ['versionCode','versionName']:
    expected=re.search(r'android:'+key+r'="([^"]+)"',manifest).group(1)
    if key+"='"+expected+"'" not in badging:raise RuntimeError('Package version mismatch: '+key)
if "name='cn.xiaohuang.lightjournal'" not in badging:raise RuntimeError('Package name changed')
if 'android.permission.INTERNET' in badging:raise RuntimeError('Unexpected network permission')
print('PASS package, version and offline permissions')
def certificate(path):
    output=subprocess.check_output(['java','-jar',str(tools/'lib/apksigner.jar'),'verify','--print-certs',str(path)],encoding='utf-8')
    return re.search(r'Signer #1 certificate SHA-256 digest: ([a-f0-9]+)',output).group(1)
digest=certificate(apk)
if args.baseline and certificate(pathlib.Path(args.baseline))!=digest:raise RuntimeError('Upgrade certificate differs')
print('PASS APK signature'+(' matches the previous release' if args.baseline else ''))
print('APK SHA256: '+hashlib.sha256(apk.read_bytes()).hexdigest())
