package cn.xiaohuang.lightjournal;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.util.Base64;

final class AiEvaluationService {
    private final LocalStore storage;
    private final AiCredentials credentials;
    private final DeepSeekClient client=new DeepSeekClient();
    AiEvaluationService(LocalStore storage,AiCredentials credentials){this.storage=storage;this.credentials=credentials;}
    JSONObject perform(String action,JSONObject payload,AiCall call) throws Exception {
        call.check();
        if("configure".equals(action)){credentials.save(AiProtocol.text(payload.opt("apiKey"),513).trim(),call);return credentials.status();}
        if("forget".equals(action)){credentials.forget(call);return credentials.status();}
        if("test".equals(action))return AiProtocol.modelStatus(client.models(credentials.read(),call));
        if(!"evaluate".equals(action))throw new AiException("AI_INVALID_ACTION","不支持的AI操作。");
        JSONObject request=payload.optJSONObject("request");if(request==null)throw new AiException("AI_INVALID_REQUEST","AI请求不完整，请重新选择照片。");
        JSONArray photos=AiProtocol.validateRequest(request,payload.optBoolean("consent",false));String key=credentials.read();
        JSONArray metadata=new JSONArray(),images=new JSONArray();
        for(int i=0;i<photos.length();i++){
            call.check();JSONObject record=storage.aiPhoto(photos.getJSONObject(i).getString("id"));
            if(record==null)throw new AiException("AI_PHOTO_MISSING","所选照片副本缺失，请重新导入后再分析。");
            String filename=record.optString("previewFile","");if(filename.isEmpty())throw new AiException("AI_PHOTO_MISSING","所选照片没有可分析的副本。");
            images.put(encode(storage.photoFile(filename),call));metadata.put(AiProtocol.photoMetadata(record,i==0?"A":"B"));
        }
        call.check();JSONObject response=client.evaluate(key,AiProtocol.body(request,metadata,images),call);call.check();
        return AiProtocol.result(response,request.getString("requestId"),photos.length(),key);
    }
    private static String encode(File file,AiCall call) throws Exception {
        if(!file.isFile()||file.length()>20L*1024*1024)throw new AiException("AI_PHOTO_MISSING","照片副本缺失或过大，请重新导入。");
        BitmapFactory.Options options=new BitmapFactory.Options();options.inJustDecodeBounds=true;BitmapFactory.decodeFile(file.getPath(),options);
        if(options.outWidth<=0||options.outHeight<=0||(long)options.outWidth*options.outHeight>100000000L)throw new AiException("AI_INVALID_IMAGE","照片副本无法解码，请重新导入。");
        options.inJustDecodeBounds=false;options.inPreferredConfig=Bitmap.Config.ARGB_8888;options.inSampleSize=1;
        while(Math.max(options.outWidth,options.outHeight)/(options.inSampleSize*2)>=1600)options.inSampleSize*=2;
        call.check();Bitmap bitmap=BitmapFactory.decodeFile(file.getPath(),options);if(bitmap==null)throw new AiException("AI_INVALID_IMAGE","照片副本无法解码，请重新导入。");
        try{
            float scale=Math.min(1f,1600f/Math.max(bitmap.getWidth(),bitmap.getHeight()));
            if(scale<1f){Bitmap resized=Bitmap.createScaledBitmap(bitmap,Math.max(1,Math.round(bitmap.getWidth()*scale)),Math.max(1,Math.round(bitmap.getHeight()*scale)),true);if(resized!=bitmap){bitmap.recycle();bitmap=resized;}}
            ByteArrayOutputStream out=new ByteArrayOutputStream();call.check();if(!bitmap.compress(Bitmap.CompressFormat.JPEG,82,out))throw new AiException("AI_INVALID_IMAGE","照片压缩失败，请重试。");
            if(out.size()>2*1024*1024){out.reset();bitmap.compress(Bitmap.CompressFormat.JPEG,65,out);}
            if(out.size()>2*1024*1024)throw new AiException("AI_IMAGE_TOO_LARGE","照片无法压缩到分析限制内，请缩小后重新导入。");
            call.check();return "data:image/jpeg;base64,"+Base64.getEncoder().encodeToString(out.toByteArray());
        }finally{bitmap.recycle();}
    }
}
