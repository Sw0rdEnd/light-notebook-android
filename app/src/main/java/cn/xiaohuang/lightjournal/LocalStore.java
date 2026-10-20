package cn.xiaohuang.lightjournal;

import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.webkit.JavascriptInterface;
import android.util.Base64;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.util.*;

/** Native durable store. JSON metadata in SQLite; JPEGs in files/photos, never cache or WebView. */
public final class LocalStore extends SQLiteOpenHelper {
    private static final String[] STORES={"sessions","photos","settings","groups","memberships","imports","equipment","kits","catalog"};
    private final File photos;
    private final Map<String, File> writing = new HashMap<>();
    private final Set<String> staged = new HashSet<>();
    private final MainActivity owner;
    public LocalStore(MainActivity context) {
        super(context, "light-journal.db", null, 2);
        owner = context;
        photos = new File(context.getFilesDir(), "photos");
        if (!photos.exists() && !photos.mkdirs()) throw new IllegalStateException("无法创建照片目录，手机空间可能不足。");
        getWritableDatabase().execSQL("PRAGMA synchronous=FULL");
        collectUnused();
    }
    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE records (store TEXT NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(store,id))");
    }
    @Override public void onUpgrade(SQLiteDatabase db,int from,int to) {
        // v2 adds record namespaces, not tables. Existing JPEG references stay untouched.
        if(from==1 && to==2)return;
        throw new IllegalStateException("不支持的数据版本，请先备份。");
    }
    private static String storeName(String name) {
        for(String valid:STORES)if(valid.equals(name))return name;
        throw new IllegalArgumentException("存储类型无效");
    }
    private static String safeId(String value) {
        if (!value.matches("[A-Za-z0-9][A-Za-z0-9_-]{0,99}")) throw new IllegalArgumentException("记录 ID 无效");
        return value;
    }
    private static String safeFile(String value) {
        if (!value.matches("[a-f0-9-]{36}\\.jpg")) throw new IllegalArgumentException("照片文件名无效");
        return value;
    }
    public File photoFile(String filename) { return new File(photos, safeFile(filename)); }
    private JSONArray readAll(String store) throws Exception {
        JSONArray result = new JSONArray();
        try (Cursor c=getReadableDatabase().query("records",new String[]{"body"},"store=?",new String[]{storeName(store)},null,null,"rowid")) {
            while(c.moveToNext()) result.put(new JSONObject(c.getString(0)));
        }
        return result;
    }
    private JSONObject readOne(String store,String id) throws Exception {
        try(Cursor c=getReadableDatabase().query("records",new String[]{"body"},"store=? AND id=?",new String[]{storeName(store),safeId(id)},null,null,null)) {
            return c.moveToFirst()?new JSONObject(c.getString(0)):null;
        }
    }
    private void commit(JSONObject payload) throws Exception {
        // Validate every referenced JPEG before opening the transaction.
        List<String> accepted = new ArrayList<>();
        for(String name: STORES) {
            JSONArray rows=payload.optJSONArray(name); if(rows==null)continue;
            for(int i=0;i<rows.length();i++) {
                JSONObject row=rows.getJSONObject(i);safeId(row.getString("id"));
                if(name.equals("photos")) for(String field:new String[]{"previewFile","thumbFile"}) {
                    String file=row.optString(field,"");
                    if(!file.isEmpty()) { if(!photoFile(file).isFile())throw new IOException("复盘照片文件缺失，请重新导入。");accepted.add(file); }
                }
            }
        }
        SQLiteDatabase db=getWritableDatabase();db.beginTransaction();
        try {
            JSONObject deletions=payload.optJSONObject("deletions");
            if(deletions!=null)for(String name:STORES){JSONArray ids=deletions.optJSONArray(name);if(ids!=null)for(int i=0;i<ids.length();i++)db.delete("records","store=? AND id=?",new String[]{name,safeId(ids.getString(i))});}
            for(String name:STORES) {
                JSONArray rows=payload.optJSONArray(name);if(rows==null)continue;
                for(int i=0;i<rows.length();i++) {
                    JSONObject row=rows.getJSONObject(i);ContentValues v=new ContentValues();v.put("store",name);v.put("id",row.getString("id"));v.put("body",row.toString());
                    if(db.insertWithOnConflict("records",null,v,SQLiteDatabase.CONFLICT_REPLACE)<0)throw new android.database.sqlite.SQLiteException("本地记录写入失败");
                }
            }
            db.setTransactionSuccessful();
        } finally {db.endTransaction();}
        staged.removeAll(accepted);collectUnused();
    }
    private void remove(String store,String id) {
        getWritableDatabase().delete("records","store=? AND id=?",new String[]{storeName(store),safeId(id)});collectUnused();
    }
    private void removeDemo() throws Exception {
        SQLiteDatabase db=getWritableDatabase();db.beginTransaction();
        try {for(String name:new String[]{"sessions","photos"}) {
            JSONArray rows=readAll(name);for(int i=0;i<rows.length();i++) {JSONObject row=rows.getJSONObject(i);if(row.optBoolean("demo",false))db.delete("records","store=? AND id=?",new String[]{name,row.getString("id")});}
        }db.setTransactionSuccessful();}finally{db.endTransaction();}
        collectUnused();
    }
    private synchronized void collectUnused() {
        try {
            Set<String> used=new HashSet<>(staged);
            try(Cursor c=getReadableDatabase().query("records",new String[]{"body"},"store=?",new String[]{"photos"},null,null,null)) {
                while(c.moveToNext()) {JSONObject p=new JSONObject(c.getString(0));used.add(p.optString("previewFile",""));used.add(p.optString("thumbFile",""));}
            }
            File[] files=photos.listFiles();if(files!=null)for(File f:files)if(!used.contains(f.getName())&&!writing.containsValue(f))f.delete();
        }catch(Exception ignored){/* Never discard referenced photos if metadata cannot be read. */}
    }
    private String beginPhoto() throws Exception {
        String token=UUID.randomUUID().toString();File f=new File(photos,token+".part");
        if(!f.createNewFile())throw new IOException("无法创建照片文件");writing.put(token,f);return token;
    }
    private void append(String token,String base64) throws Exception {
        File f=writing.get(token);if(f==null)throw new IOException("照片写入已过期");
        if(base64.length()>300000)throw new IOException("照片块过大");byte[] bytes=Base64.decode(base64,Base64.DEFAULT);
        if(f.length()+bytes.length>20L*1024*1024)throw new IOException("复盘副本超过 20MB");
        try(FileOutputStream out=new FileOutputStream(f,true)){out.write(bytes);}
    }
    private JSONObject finishPhoto(String token) throws Exception {
        File f=writing.get(token);if(f==null)throw new IOException("照片写入已过期");
        try(FileInputStream in=new FileInputStream(f)){if(in.read()!=255||in.read()!=216)throw new IOException("复盘文件不是有效 JPEG");}
        try(FileOutputStream out=new FileOutputStream(f,true)){out.getFD().sync();}
        File done=photoFile(token+".jpg");if(!f.renameTo(done))throw new IOException("无法保存照片，手机空间可能不足。");
        writing.remove(token);staged.add(done.getName());
        return new JSONObject().put("file",done.getName()).put("size",done.length());
    }
    private JSONObject storage() throws Exception {
        long bytes=0;File[] files=photos.listFiles();if(files!=null)for(File f:files)bytes+=f.length();
        File db=owner.getDatabasePath("light-journal.db");bytes+=db.length();
        return new JSONObject().put("usage",bytes).put("quota",bytes+photos.getUsableSpace()).put("native",true);
    }
    @JavascriptInterface public synchronized String request(String action,String input) {
        try {
            JSONObject p=new JSONObject(input==null?"{}":input);Object result=JSONObject.NULL;
            switch(action) {
                case "open":break;
                case "setNavigation":owner.setNavigation(p.getString("tab"),p.optString("theme","dark"));break;
                case "aiEvaluate":result=AiEvaluationService.evaluate(p.getJSONObject("request"));break;
                case "backgroundApp":owner.runOnUiThread(()->owner.moveTaskToBack(true));break;
                case "all":result=readAll(p.getString("store"));break;
                case "get":{JSONObject one=readOne(p.getString("store"),p.getString("id"));result=one==null?JSONObject.NULL:one;break;}
                case "merge":commit(p);break;
                case "remove":remove(p.getString("store"),p.getString("id"));break;
                case "removeDemo":removeDemo();break;
                case "clear":getWritableDatabase().delete("records",null,null);staged.clear();collectUnused();break;
                case "photoBegin":result=beginPhoto();break;
                case "photoAppend":append(p.getString("token"),p.getString("chunk"));break;
                case "photoFinish":result=finishPhoto(p.getString("token"));break;
                case "photoAbort":{String token=p.getString("token");File f=writing.remove(token);if(f!=null)f.delete();break;}
                case "storage":result=storage();break;
                case "exportBegin":result=owner.beginExport(p.getString("name"));break;
                case "exportAppend":owner.appendExport(p.getString("token"),p.getString("chunk"));break;
                case "exportPick":owner.pickExport(p.getString("token"));break;
                default:throw new IllegalArgumentException("不支持的本地操作");
            }
            return new JSONObject().put("ok",true).put("data",result).toString();
        } catch(Exception e) {
            try {String message=e.getMessage()==null?"本地存储操作失败":e.getMessage();String name=(e instanceof android.database.sqlite.SQLiteFullException||message.contains("ENOSPC")||message.contains("No space"))?"QuotaExceededError":"StorageError";
                return new JSONObject().put("ok",false).put("name",name).put("error",message).toString();
            }catch(Exception ignored){return "{\"ok\":false,\"error\":\"本地存储失败\"}";}
        }
    }
}
