package cn.xiaohuang.lightjournal;

import android.webkit.JavascriptInterface;
import org.json.JSONObject;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicReference;

/** Async bridge isolated from the synchronous database bridge and its lock. */
public final class NativeAiBridge {
    private final MainActivity owner;
    private final AiCredentials credentials;
    private final AiEvaluationService service;
    private final ExecutorService worker=Executors.newFixedThreadPool(2);
    private final AtomicReference<Job> active=new AtomicReference<>();
    private volatile boolean closed;
    private static final class Job{final String id;final AiCall call=new AiCall();Job(String id){this.id=id;}}
    NativeAiBridge(MainActivity owner,LocalStore storage){this.owner=owner;credentials=new AiCredentials(owner);service=new AiEvaluationService(storage,credentials);}
    @JavascriptInterface public String status(){try{return credentials.status().toString();}catch(Exception e){return "{\"configured\":false,\"unreadable\":true,\"model\":\"deepseek-flash\"}";}}
    @JavascriptInterface public void request(String id,String action,String input){
        if(closed||id==null||!id.matches("[A-Za-z0-9_-]{8,100}"))return;
        if(input==null||input.length()>32768){reply(id,false,null,"AI_INVALID_REQUEST","AI请求过大或不完整。");return;}
        if(!"configure".equals(action)&&!"forget".equals(action)&&!"test".equals(action)&&!"evaluate".equals(action)){reply(id,false,null,"AI_INVALID_ACTION","不支持的AI操作。");return;}
        final JSONObject payload;try{payload=new JSONObject(input);}catch(Exception e){reply(id,false,null,"AI_INVALID_REQUEST","AI请求格式无效。");return;}
        Job job=new Job(id);if(!active.compareAndSet(null,job)){reply(id,false,null,"AI_BUSY","已有AI请求正在处理，请先完成或取消。");return;}
        worker.execute(()->{
            Object result=null;AiException failure=null;
            try{result=service.perform(action,payload,job.call);}
            catch(AiException e){failure=e;}
            catch(OutOfMemoryError e){failure=new AiException("AI_IMAGE_MEMORY","手机暂时无法处理这些图片，请缩小照片后重试。");}
            catch(Exception e){failure=new AiException("AI_INTERNAL_ERROR","本次AI操作未完成，请重试。");}
            finally{active.compareAndSet(job,null);}
            if(!job.call.cancelled()||job.call.timedOut())reply(job.id,failure==null,result,failure==null?null:failure.code,failure==null?null:failure.getMessage());
        });
    }
    @JavascriptInterface public void cancel(String id){Job job=active.get();if(job!=null&&job.id.equals(id)&&active.compareAndSet(job,null))job.call.cancel();}
    void forgetForClear() throws AiException {Job job=active.getAndSet(null);if(job!=null)job.call.cancel();credentials.forget();}
    void close(){closed=true;Job job=active.getAndSet(null);if(job!=null)job.call.cancel();worker.shutdownNow();}
    private void reply(String id,boolean ok,Object result,String code,String message){
        if(closed)return;
        try{JSONObject detail=new JSONObject().put("id",id).put("ok",ok);if(ok)detail.put("data",result==null?JSONObject.NULL:result);else detail.put("code",code).put("error",message);owner.aiReply(detail.toString());}catch(Exception ignored){/* Never log request payloads or credential material. */}
    }
}
