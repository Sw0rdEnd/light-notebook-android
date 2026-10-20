#!/usr/bin/env python3
"""Runs the real FileSelection Java logic against small Android data-shape stand-ins.
No emulator: verifies result parsing, not Activity/WebView/provider integration.
Usage: python3 tests/test_picker.py /path/to/ecj.jar
"""
from pathlib import Path
import subprocess, tempfile, sys
root=Path(__file__).resolve().parents[1]
sources={
'android/app/Activity.java':'''package android.app; public class Activity {public static final int RESULT_OK=-1,RESULT_CANCELED=0;}''',
'android/net/Uri.java':'''package android.net; public final class Uri {private final String s;private Uri(String s){this.s=s;} public static Uri parse(String s){return new Uri(s);}public String getScheme(){return s.split(":")[0];}public boolean equals(Object o){return o instanceof Uri&&s.equals(((Uri)o).s);}public int hashCode(){return s.hashCode();}public String toString(){return s;}}''',
'android/content/ClipData.java':'''package android.content; import android.net.Uri; public class ClipData {private final Uri[] uris;public ClipData(Uri... uris){this.uris=uris;}public int getItemCount(){return uris.length;}public Item getItemAt(int i){return new Item(uris[i]);}public static class Item{private Uri uri;Item(Uri u){uri=u;}public Uri getUri(){return uri;}}}''',
'android/content/Intent.java':'''package android.content;import android.net.Uri; public class Intent {private Uri data;private ClipData clip;public Intent setData(Uri u){data=u;return this;}public Intent setClipData(ClipData c){clip=c;return this;}public Uri getData(){return data;}public ClipData getClipData(){return clip;}}''',
'cn/xiaohuang/lightjournal/PickerTest.java':'''package cn.xiaohuang.lightjournal;
import android.content.*;import android.net.Uri;
public class PickerTest {
 static void check(boolean b,String label){if(!b)throw new AssertionError(label);System.out.println("PASS "+label);}
 public static void main(String[] args){
 Uri a=Uri.parse("content://photos/a"),b=Uri.parse("content://photos/b"),c=Uri.parse("content://photos/c");
 check(FileSelection.parse(-1,new Intent().setData(a))[0].equals(a),"single data");
 Uri[] multi=FileSelection.parse(-1,new Intent().setClipData(new ClipData(a,b,c)));
 check(multi.length==3&&multi[0].equals(a)&&multi[2].equals(c),"three ClipData items with null data (original bug)");
 check(FileSelection.parse(-1,new Intent().setClipData(new ClipData(b)))[0].equals(b),"single in ClipData only");
 Uri[] dedup=FileSelection.parse(-1,new Intent().setData(a).setClipData(new ClipData(a,b,a)));
 check(dedup.length==2&&dedup[1].equals(b),"mixed data and ClipData deduplicated in order");
 check(FileSelection.parse(0,new Intent().setData(a))==null,"cancel ignores result payload");
 check(FileSelection.parse(-1,null)==null&&FileSelection.parse(-1,new Intent())==null,"null and empty results");
 check(FileSelection.parse(-1,new Intent().setClipData(new ClipData(null,a))).length==1,"null clip item skipped");
 boolean invalid=false;try{FileSelection.parse(-1,new Intent().setData(Uri.parse("file:///private/file")));}catch(IllegalArgumentException e){invalid=true;}check(invalid,"reject unexpected file scheme");
 Uri[] many=new Uri[201];for(int i=0;i<many.length;i++)many[i]=Uri.parse("content://photos/"+i);
 boolean tooMany=false;try{FileSelection.parse(-1,new Intent().setClipData(new ClipData(many)));}catch(IllegalArgumentException e){tooMany=true;}check(tooMany,"batch limit not silently truncated");
 }
}'''}
with tempfile.TemporaryDirectory(prefix='light-picker-test-') as d:
 base=Path(d)
 for name,text in sources.items():
  f=base/name;f.parent.mkdir(parents=True,exist_ok=True);f.write_text(text)
 src=root/'app/src/main/java/cn/xiaohuang/lightjournal/FileSelection.java'
 out=base/'classes';out.mkdir()
 subprocess.run(['java','-jar',sys.argv[1],'-17','-nowarn','-d',str(out),str(src),*[str(base/n) for n in sources]],check=True)
 subprocess.run(['java','-cp',str(out),'cn.xiaohuang.lightjournal.PickerTest'],check=True)
 activity=(src.parent/'MainActivity.java').read_text()
 assert 'FileSelection.parse(result,data)' in activity
 assert 'FileChooserParams.parseResult(result,data)' not in activity
 print('PASS MainActivity uses tested parser')
