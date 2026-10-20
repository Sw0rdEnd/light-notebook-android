package cn.xiaohuang.lightjournal;

import android.app.Activity;
import android.content.*;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.webkit.*;
import android.view.*;
import android.widget.*;
import android.util.Base64;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;

public final class MainActivity extends Activity {
    private static final String ORIGIN="https://appassets.androidplatform.net";
    private static final int PICK_FILES=11,SAVE_BACKUP=12;
    private WebView web;
    private LocalStore storage;
    private LinearLayout navigation;
    private final Map<String, TextView> navLabels=new HashMap<>();
    private final Map<String, NavIcon> navIcons=new HashMap<>();
    private String currentTab="practice";
    private ValueCallback<Uri[]> fileCallback;
    private String exportToken;
    private final Map<String,String> exportNames=new HashMap<>();
    private final ExecutorService io=Executors.newSingleThreadExecutor();
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        if(Build.VERSION.SDK_INT>=30)getWindow().setDecorFitsSystemWindows(false);
        getWindow().setStatusBarColor(Color.WHITE);getWindow().setNavigationBarColor(Color.WHITE);
        getWindow().getDecorView().setSystemUiVisibility(0);
        LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Color.WHITE);
        // Android 15+ enforces edge-to-edge: apply system bar and keyboard insets outside the web content.
        if(Build.VERSION.SDK_INT>=30)root.setOnApplyWindowInsetsListener((v,insets)->{android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout()|WindowInsets.Type.ime());v.setPadding(bars.left,bars.top,bars.right,bars.bottom);if(navigation!=null)navigation.setVisibility(insets.isVisible(WindowInsets.Type.ime())?View.GONE:View.VISIBLE);return WindowInsets.CONSUMED;});
        else root.setFitsSystemWindows(true);
        web=new WebView(this);web.setBackgroundColor(Color.rgb(247,248,250));root.addView(web,new LinearLayout.LayoutParams(-1,0,1f));
        navigation=new LinearLayout(this);navigation.setOrientation(LinearLayout.HORIZONTAL);navigation.setGravity(Gravity.CENTER);
        String[][] tabs={{"practice","练习"},{"photos","照片"},{"growth","成长"},{"settings","设置"}};
        for(String[] tab:tabs){
            final String key=tab[0];LinearLayout item=new LinearLayout(this);item.setOrientation(LinearLayout.VERTICAL);item.setGravity(Gravity.CENTER);item.setPadding(0,dp(5),0,dp(3));
            NavIcon mark=new NavIcon(this,key);item.addView(mark,new LinearLayout.LayoutParams(dp(24),dp(24)));navIcons.put(key,mark);
            TextView label=new TextView(this);label.setText(tab[1]);label.setTextSize(12);label.setGravity(Gravity.CENTER);label.setSingleLine(true);label.setIncludeFontPadding(false);item.addView(label,new LinearLayout.LayoutParams(-1,dp(22)));navLabels.put(key,label);
            item.setContentDescription(tab[1]);item.setFocusable(true);item.setClickable(true);item.setOnClickListener(v->{if(web!=null)web.evaluateJavascript("window.dispatchEvent(new CustomEvent('android-navigation',{detail:"+JSONObject.quote(key)+"}));",null);});
            navigation.addView(item,new LinearLayout.LayoutParams(0,-1,1f));
        }
        root.addView(navigation,new LinearLayout.LayoutParams(-1,dp(64)));setContentView(root);setNavigation("practice","light");
        WebSettings s=web.getSettings();s.setUseWideViewPort(true);s.setLoadWithOverviewMode(true);s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(true);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setJavaScriptCanOpenWindowsAutomatically(false);s.setSupportMultipleWindows(false);s.setMediaPlaybackRequiresUserGesture(true);s.setTextZoom(100);s.setUserAgentString(s.getUserAgentString()+" LightJournalAndroid/0.2.1");
        WebView.setWebContentsDebuggingEnabled(false);storage=new LocalStore(this);web.addJavascriptInterface(storage,"AndroidStorage");
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest req) {
                if(allowed(req.getUrl()))return false;
                // Open user-activated HTTPS sources in the system browser, never inside the trusted bridge.
                if(req.isForMainFrame() && req.hasGesture() && "https".equals(req.getUrl().getScheme())) {
                    try{startActivity(new Intent(Intent.ACTION_VIEW,req.getUrl()));}catch(ActivityNotFoundException e){Toast.makeText(MainActivity.this,"没有可用浏览器，请在电脑查看官方链接。",Toast.LENGTH_LONG).show();}
                }
                return true;
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest req) {return localResponse(req.getUrl());}
            @Override public void onReceivedError(WebView view,WebResourceRequest req,WebResourceError error){if(req.isForMainFrame())runOnUiThread(()->Toast.makeText(MainActivity.this,"应用页面加载失败，请关闭后重新打开。",Toast.LENGTH_LONG).show());}
        });
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
                if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=callback;
                Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);
                String[] types=params.getAcceptTypes();boolean photo=false;for(String type:types)if(type.contains("image/jpeg"))photo=true;
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                intent.setType(photo?"image/jpeg":"*/*");intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,params.getMode()==FileChooserParams.MODE_OPEN_MULTIPLE);
                try{startActivityForResult(intent,PICK_FILES);}catch(ActivityNotFoundException e){fileCallback.onReceiveValue(null);fileCallback=null;Toast.makeText(MainActivity.this,"系统文件选择器不可用，请检查系统文件应用。",Toast.LENGTH_LONG).show();}
                return true;
            }
            @Override public boolean onJsBeforeUnload(WebView view,String url,String message,JsResult result){result.confirm();return true;}
        });
        web.setDownloadListener((url,ua,disposition,mime,length)->Toast.makeText(this,"请使用设置中的备份导出，保存到手机文件夹。",Toast.LENGTH_LONG).show());
        if(saved!=null){exportToken=saved.getString("exportToken");String exportName=saved.getString("exportName");if(exportToken!=null&&exportName!=null)exportNames.put(exportToken,exportName);}
        if(saved!=null&&saved.getBoolean("pickerOpen",false))Toast.makeText(this,"选图期间应用被系统重新加载，请再次点击导入。已有照片保留。",Toast.LENGTH_LONG).show();
        web.loadUrl(ORIGIN+"/assets/index.html");
    }
    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
    public void setNavigation(String tab,String theme){
        if(!navLabels.containsKey(tab))return;
        runOnUiThread(()->{
            currentTab=tab;boolean light="light".equals(theme);int bg=light?Color.rgb(255,255,255):Color.rgb(20,20,23),muted=light?Color.rgb(102,105,117):Color.rgb(192,190,199),accent=light?Color.rgb(237,63,89):Color.rgb(255,82,105);
            navigation.setBackgroundColor(bg);getWindow().setStatusBarColor(bg);getWindow().setNavigationBarColor(bg);
            ((View)navigation.getParent()).setBackgroundColor(bg);web.setBackgroundColor(light?Color.rgb(247,248,250):Color.rgb(20,20,23));
            getWindow().getDecorView().setSystemUiVisibility(light?View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR:0);
            for(String key:navLabels.keySet()){boolean selected=key.equals(currentTab);navLabels.get(key).setTextColor(selected?accent:muted);navLabels.get(key).setSelected(selected);NavIcon icon=navIcons.get(key);icon.tint=selected?accent:muted;icon.invalidate();View item=(View)navLabels.get(key).getParent();item.setSelected(selected);item.setContentDescription(navLabels.get(key).getText()+(selected?"，当前页面":""));}
        });
    }
    private static final class NavIcon extends View{
        final String kind;int tint=Color.LTGRAY;final android.graphics.Paint paint=new android.graphics.Paint(3);
        NavIcon(android.content.Context context,String kind){super(context);this.kind=kind;setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);}
        @Override protected void onDraw(android.graphics.Canvas c){super.onDraw(c);c.save();c.scale(getWidth()/24f,getHeight()/24f);paint.setColor(tint);paint.setStyle(android.graphics.Paint.Style.STROKE);paint.setStrokeWidth(1.6f);paint.setStrokeCap(android.graphics.Paint.Cap.ROUND);paint.setStrokeJoin(android.graphics.Paint.Join.ROUND);
            android.graphics.Path path=new android.graphics.Path();
            if(kind.equals("practice")){c.drawRoundRect(5,3,19,21,2,2,paint);c.drawLine(3,7,7,7,paint);c.drawLine(3,12,7,12,paint);c.drawLine(3,17,7,17,paint);c.drawLine(10,9,16,9,paint);c.drawLine(10,14,15,14,paint);}
            else if(kind.equals("photos")){c.drawRoundRect(3,3,21,21,2,2,paint);c.drawCircle(9,8,1.5f,paint);path.moveTo(4,18);path.lineTo(10,12);path.lineTo(14,16);path.lineTo(18,11);path.lineTo(21,15);c.drawPath(path,paint);}
            else if(kind.equals("growth")){c.drawLine(4,3,4,21,paint);c.drawLine(4,21,22,21,paint);c.drawLine(9,16,9,11,paint);c.drawLine(14,16,14,7,paint);c.drawLine(19,16,19,3,paint);}
            else{for(int n=0;n<3;n++){float y=5+n*7,x=n==1?9:16;c.drawLine(3,y,x-3,y,paint);c.drawCircle(x,y,2.5f,paint);c.drawLine(x+3,y,21,y,paint);}}
            c.restore();
        }
    }
    private static boolean allowed(Uri uri){return "https".equals(uri.getScheme())&&"appassets.androidplatform.net".equals(uri.getHost())&&(uri.getPort()==-1||uri.getPort()==443);}
    private WebResourceResponse localResponse(Uri uri) {
        try {
            if(!allowed(uri))return denied();String path=uri.getPath();InputStream stream;String mime;
            if(path.startsWith("/assets/")) {
                String relative=path.substring(8);if(relative.isEmpty()||relative.contains("..")||relative.contains("\\")||relative.startsWith("/"))return denied();
                stream=getAssets().open("www/"+relative);mime=mime(relative);
            }else if(path.startsWith("/data/")) {File f=storage.photoFile(path.substring(6));stream=new FileInputStream(f);mime="image/jpeg";}
            else return denied();
            Map<String,String> headers=new HashMap<>();headers.put("Cache-Control","no-store");headers.put("X-Content-Type-Options","nosniff");headers.put("Content-Security-Policy","default-src 'self' blob: data:; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'");
            return new WebResourceResponse(mime,mime.startsWith("text/")||mime.contains("javascript")||mime.contains("json")?"UTF-8":null,200,"OK",headers,stream);
        }catch(Exception e){return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",null,new ByteArrayInputStream("本地文件不存在".getBytes(StandardCharsets.UTF_8)));}
    }
    private static WebResourceResponse denied(){return new WebResourceResponse("text/plain","UTF-8",403,"Forbidden",null,new ByteArrayInputStream(new byte[0]));}
    private static String mime(String path){if(path.endsWith(".html"))return "text/html";if(path.endsWith(".js"))return "application/javascript";if(path.endsWith(".css"))return "text/css";if(path.endsWith(".svg"))return "image/svg+xml";if(path.endsWith(".png"))return "image/png";if(path.endsWith(".jpg"))return "image/jpeg";if(path.endsWith(".json")||path.endsWith(".webmanifest"))return "application/json";return "application/octet-stream";}
    private File exportFile(String token){if(!token.matches("[a-f0-9-]{36}"))throw new IllegalArgumentException("备份 ID 无效");return new File(getCacheDir(),"export-"+token+".json");}
    public synchronized String beginExport(String name)throws Exception {
        if(name.length()>150||!name.endsWith(".json")||name.contains("/")||name.contains("\\"))throw new IOException("备份文件名无效");
        if(exportToken!=null)throw new IOException("请先完成当前备份保存");String token=UUID.randomUUID().toString();File f=exportFile(token);if(!f.createNewFile())throw new IOException("无法准备备份文件");exportNames.put(token,name);return token;
    }
    public synchronized void appendExport(String token,String chunk)throws Exception {if(!exportNames.containsKey(token)||chunk.length()>300000)throw new IOException("备份写入无效");File f=exportFile(token);byte[] bytes=Base64.decode(chunk,Base64.DEFAULT);if(f.length()+bytes.length>160L*1024*1024)throw new IOException("备份超过 160MB");try(FileOutputStream out=new FileOutputStream(f,true)){out.write(bytes);}}
    public void pickExport(String token)throws Exception {
        final String name; synchronized(this){name=exportNames.get(token);if(name==null||exportToken!=null)throw new IOException("备份状态无效");exportToken=token;}
        runOnUiThread(()->{Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("application/json");i.putExtra(Intent.EXTRA_TITLE,name);try{startActivityForResult(i,SAVE_BACKUP);}catch(Exception e){finishExport(token,false,false,"无法打开系统保存窗口");}});
    }
    private void finishExport(String token,boolean success,boolean cancelled,String error){
        synchronized(this){exportFile(token).delete();exportNames.remove(token);exportToken=null;}
        runOnUiThread(()->{if(web==null)return;try{JSONObject detail=new JSONObject().put("token",token).put("success",success).put("cancelled",cancelled).put("error",error);String script="window.dispatchEvent(new CustomEvent('android-save-finished',{detail:JSON.parse("+JSONObject.quote(detail.toString())+")}));";web.evaluateJavascript(script,null);Toast.makeText(this,success?"备份已保存到你选择的手机位置。":cancelled?"已取消保存，应用数据未改变。":"保存失败："+error,Toast.LENGTH_LONG).show();}catch(Exception ignored){}});
    }
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(request==PICK_FILES){
            ValueCallback<Uri[]> callback=fileCallback;fileCallback=null;
            if(callback==null){Toast.makeText(this,"选图窗口已重新加载，请再次点击导入。",Toast.LENGTH_LONG).show();return;}
            Uri[] files=null;String error="";
            try{files=FileSelection.parse(result,data);if(result==RESULT_OK&&files==null)error="没有收到可读取的文件，请重新选择。";}catch(Exception e){error=e.getMessage()==null?"读取所选文件失败，请重试。":e.getMessage();}
            callback.onReceiveValue(files);
            if(files!=null)Toast.makeText(this,"已选择 "+files.length+" 个文件，开始导入。",Toast.LENGTH_SHORT).show();
            else {final String message=!error.isEmpty()?error:"已取消选择，照片未改变。";Toast.makeText(this,message,Toast.LENGTH_LONG).show();web.evaluateJavascript("window.dispatchEvent(new CustomEvent('android-picker-message',{detail:"+JSONObject.quote(message)+"}));",null);}
            return;
        }
        if(request==SAVE_BACKUP&&exportToken!=null){final String token=exportToken;if(result!=RESULT_OK||data==null||data.getData()==null){finishExport(token,false,true,"");return;}final Uri uri=data.getData();io.execute(()->{try(InputStream in=new FileInputStream(exportFile(token));OutputStream out=getContentResolver().openOutputStream(uri,"wt")){if(out==null)throw new IOException("无法写入所选位置");byte[] buffer=new byte[64*1024];int n;while((n=in.read(buffer))!=-1)out.write(buffer,0,n);out.flush();finishExport(token,true,false,"");}catch(Exception e){finishExport(token,false,false,e.getMessage()==null?"无法写入文件":e.getMessage());}});}
    }
    @Override public void onBackPressed(){if(web!=null)web.evaluateJavascript("window.dispatchEvent(new Event('android-back'));",null);}
    @Override protected void onPause(){super.onPause();if(web!=null)web.evaluateJavascript("window.dispatchEvent(new Event('android-background'));",null);}
    @Override protected void onSaveInstanceState(Bundle out){super.onSaveInstanceState(out);out.putBoolean("pickerOpen",fileCallback!=null);if(exportToken!=null){out.putString("exportToken",exportToken);out.putString("exportName",exportNames.get(exportToken));}}
    @Override protected void onDestroy(){if(fileCallback!=null)fileCallback.onReceiveValue(null);if(web!=null){web.removeJavascriptInterface("AndroidStorage");web.destroy();web=null;}io.shutdown();super.onDestroy();}
}
