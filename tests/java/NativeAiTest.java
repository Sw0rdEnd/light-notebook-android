package cn.xiaohuang.lightjournal;

import org.json.*;
import javax.crypto.*;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import com.sun.net.httpserver.HttpServer;

public final class NativeAiTest {
    static final String KEY="unit-test-key-not-a-real-secret";
    static int checks;
    interface Throwing {void run() throws Exception;}
    static void check(boolean ok,String name){if(!ok)throw new AssertionError(name);checks++;System.out.println("PASS "+name);}
    static void fails(String code,Throwing run) throws Exception {try{run.run();throw new AssertionError("Expected "+code);}catch(AiException e){if(!code.equals(e.code)||e.getMessage().contains(KEY))throw new AssertionError("Wrong or unsafe error: "+e.code);}}
    static JSONObject request(int count) throws Exception {JSONArray photos=new JSONArray();for(int i=0;i<count;i++)photos.put(new JSONObject().put("id","photo-"+i).put("label",i==0?"A":"B"));return new JSONObject().put("schema",AiProtocol.REQUEST).put("requestId","request-test-123").put("mode",count==1?"single":"compare").put("photos",photos).put("note","背景是否过于杂乱？");}
    static JSONObject model(Object preferred) throws Exception{return new JSONObject().put("summary","画面重点明确").put("observations",new JSONArray().put(new JSONObject().put("aspect","构图").put("basis","observation").put("text","A中主体位于画面右侧"))).put("nextSteps",new JSONArray().put("下次向左移动半步再拍一张")).put("preferred",preferred);}
    static JSONObject response(JSONObject result) throws Exception{return new JSONObject().put("choices",new JSONArray().put(new JSONObject().put("finish_reason","stop").put("message",new JSONObject().put("content",result.toString())))).put("usage",new JSONObject().put("prompt_tokens",42).put("completion_tokens",50).put("total_tokens",92));}
    public static void main(String[] args) throws Exception {
        KeyGenerator generator=KeyGenerator.getInstance("AES");generator.init(256);SecretKey key=generator.generateKey();byte[] encrypted=AiSecretCipher.encrypt(key,KEY);
        check(KEY.equals(AiSecretCipher.decrypt(key,encrypted)),"real AES-GCM credential round trip");
        check(!new String(encrypted,StandardCharsets.ISO_8859_1).contains(KEY)&&!Arrays.equals(encrypted,AiSecretCipher.encrypt(key,KEY)),"ciphertext hides plaintext and randomizes each save");
        byte[] tampered=encrypted.clone();tampered[tampered.length-1]^=1;boolean rejected=false;try{AiSecretCipher.decrypt(key,tampered);}catch(Exception e){rejected=true;}check(rejected,"tampered credential is rejected");
        rejected=false;try{AiSecretCipher.decrypt(generator.generateKey(),encrypted);}catch(Exception e){rejected=true;}check(rejected,"different device encryption key cannot decrypt credentials");
        fails("AI_INVALID_KEY_FORMAT",()->AiProtocol.validateKey(KEY+"\nInjected: header"));check(true,"header injection in API key is rejected");
        fails("AI_CONSENT_REQUIRED",()->AiProtocol.validateRequest(request(1),false));AiProtocol.validateRequest(request(2),true);check(true,"analysis requires explicit consent and accepts one or two selected IDs");
        JSONObject duplicate=request(2);duplicate.getJSONArray("photos").getJSONObject(1).put("id","photo-0");fails("AI_INVALID_REQUEST",()->AiProtocol.validateRequest(duplicate,true));
        JSONObject badOrder=request(2);badOrder.getJSONArray("photos").getJSONObject(0).put("label","B");fails("AI_INVALID_REQUEST",()->AiProtocol.validateRequest(badOrder,true));check(true,"duplicate photos and wrong A/B order are rejected");
        JSONObject row=new JSONObject().put("id","PRIVATE_ID").put("name","PRIVATE_FILENAME").put("previewFile","PRIVATE_PATH").put("apiKey",KEY)
            .put("exif",new JSONObject().put("camera","ILCE-7CM2").put("focal",35).put("iso",-1).put("GPS","PRIVATE_GPS").put("other",KEY))
            .put("corrections",new JSONObject().put("body",new JSONObject().put("model","User corrected body")).put("GPS","PRIVATE_GPS"));
        JSONObject metadata=AiProtocol.photoMetadata(row,"A");check(!metadata.toString().contains("PRIVATE_")&&!metadata.toString().contains(KEY)&&metadata.getJSONObject("exif").getInt("focal")==35&&!metadata.getJSONObject("exif").has("iso")&&metadata.getJSONObject("corrections").getString("camera").equals("User corrected body"),"upload metadata excludes GPS, file names, paths and keys while keeping corrections separate");
        ByteArrayOutputStream image=new ByteArrayOutputStream();ImageIO.write(new BufferedImage(16,12,BufferedImage.TYPE_INT_RGB),"jpg",image);String data="data:image/jpeg;base64,"+Base64.getEncoder().encodeToString(image.toByteArray());
        JSONObject body=AiProtocol.body(request(1),new JSONArray().put(metadata),new JSONArray().put(data));JSONArray content=body.getJSONArray("messages").getJSONObject(1).getJSONArray("content");
        check(content.getJSONObject(2).getJSONObject("image_url").getString("url").equals(data)&&body.getString("model").equals("deepseek-flash")&&body.getInt("max_tokens")==1800&&!body.toString().contains("PRIVATE_"),"real JPEG data blocks reach the official model with bounded output");
        fails("AI_INVALID_IMAGE",()->AiProtocol.body(request(1),new JSONArray().put(metadata),new JSONArray().put("https://evil.invalid/image.jpg")));check(true,"external image URLs cannot become native uploads");
        JSONObject clean=AiProtocol.result(response(model(JSONObject.NULL).put("summary",KEY+" text")),"request-test-123",1,KEY);check(!clean.toString().contains(KEY)&&clean.getJSONObject("usage").getInt("total_tokens")==92,"result is whitelisted, sensitive echo redacted and actual usage retained");
        fails("AI_INVALID_RESPONSE",()->AiProtocol.result(response(model("A")),"request-test-123",1,KEY));
        JSONObject incomplete=response(model(JSONObject.NULL));incomplete.getJSONArray("choices").getJSONObject(0).put("finish_reason","length");fails("AI_INCOMPLETE_RESPONSE",()->AiProtocol.result(incomplete,"request-test-123",1,KEY));check(true,"single-image preferences and truncated model results are rejected");
        JSONObject models=new JSONObject().put("data",new JSONArray().put(new JSONObject().put("id",AiProtocol.MODEL).put("input_modalities",new JSONArray().put("text").put("image"))));AiProtocol.modelStatus(models);
        models.getJSONArray("data").getJSONObject(0).put("input_modalities",new JSONArray().put("text"));fails("AI_VISION_UNAVAILABLE",()->AiProtocol.modelStatus(models));check(true,"connection check verifies model availability and declared image input");

        AtomicInteger status=new AtomicInteger(200),count=new AtomicInteger();AtomicReference<String> output=new AtomicReference<>(response(model(JSONObject.NULL)).toString()),lastBody=new AtomicReference<>(),lastAuthorization=new AtomicReference<>();AtomicBoolean slow=new AtomicBoolean(false);CountDownLatch reading=new CountDownLatch(1);
        ExecutorService handlers=Executors.newCachedThreadPool(),work=Executors.newSingleThreadExecutor();HttpServer server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);server.setExecutor(handlers);
        server.createContext("/",exchange->{
            count.incrementAndGet();lastAuthorization.set(exchange.getRequestHeaders().getFirst("Authorization"));lastBody.set(new String(exchange.getRequestBody().readAllBytes(),StandardCharsets.UTF_8));
            try{
                if(slow.get()){exchange.sendResponseHeaders(200,0);OutputStream out=exchange.getResponseBody();reading.countDown();for(int i=0;i<100;i++){out.write(' ');out.flush();try{Thread.sleep(20);}catch(InterruptedException e){break;}}}
                else{if(status.get()==302)exchange.getResponseHeaders().set("Location","https://evil.invalid/");byte[] bytes=output.get().getBytes(StandardCharsets.UTF_8);exchange.sendResponseHeaders(status.get(),bytes.length);exchange.getResponseBody().write(bytes);}
            }catch(IOException ignored){}finally{exchange.close();}
        });server.start();int port=server.getAddress().getPort();
        DeepSeekClient.Connections factory=url->{if(!url.getProtocol().equals("https")||!url.getHost().equals("api.deepseek.com"))throw new AssertionError("Wrong upstream");return (HttpURLConnection)new URL("http://127.0.0.1:"+port+url.getPath()).openConnection();};
        try{
            DeepSeekClient client=new DeepSeekClient(factory,3000);JSONObject received=client.evaluate(KEY,body,new AiCall());
            check(lastAuthorization.get().equals("Bearer "+KEY)&&new JSONObject(lastBody.get()).getJSONArray("messages").getJSONObject(1).getJSONArray("content").getJSONObject(2).has("image_url")&&received.has("choices"),"native HTTP transport transmits real JSON image blocks and authorization to the fixed official destination");
            for(int code:new int[]{401,402,403,404,413,429,500,302}){status.set(code);output.set(KEY+" provider private error");int before=count.get();fails(DeepSeekClient.statusError(code).code,()->client.models(KEY,new AiCall()));if(count.get()!=before+1)throw new AssertionError("automatic retry");}
            check(true,"HTTP failures redact provider bodies, never retry and never follow redirects");
            status.set(200);output.set("not-json "+KEY);fails("AI_INVALID_RESPONSE",()->client.models(KEY,new AiCall()));check(true,"malformed provider response is a real error");
            output.set(" ".repeat(530000));fails("AI_RESPONSE_TOO_LARGE",()->client.models(KEY,new AiCall()));check(true,"oversized upstream response is bounded");
            slow.set(true);long start=System.nanoTime();fails("AI_TIMEOUT",()->new DeepSeekClient(factory,100).models(KEY,new AiCall()));check(TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-start)<2500,"total deadline also stops whitespace keep-alives");
            AiCall cancelled=new AiCall();Future<String> pending=work.submit(()->{try{client.models(KEY,cancelled);return "unexpected";}catch(AiException e){return e.code;}});if(!reading.await(2,TimeUnit.SECONDS))throw new AssertionError("network did not start");cancelled.cancel();check(pending.get(3,TimeUnit.SECONDS).equals("AI_CANCELLED"),"cancellation interrupts an in-flight native request");
            int before=count.get();AiCall early=new AiCall();early.cancel();fails("AI_CANCELLED",()->client.models(KEY,early));check(count.get()==before,"cancelled request never opens a connection");
        }finally{server.stop(0);handlers.shutdownNow();work.shutdownNow();}

        MainActivity owner=new MainActivity();NativeAiBridge bridge=new NativeAiBridge(owner,new LocalStore());
        try{
            bridge.request("bridge-first","test","{\"block\":true}");if(!AiEvaluationService.entered.await(2,TimeUnit.SECONDS))throw new AssertionError("worker not started");
            bridge.request("bridge-busy","test","{}");JSONObject busy=owner.results.poll(2,TimeUnit.SECONDS);check(busy!=null&&busy.getString("code").equals("AI_BUSY"),"async bridge rejects duplicate concurrent analysis");
            long start=System.nanoTime();bridge.status();check(TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-start)<200,"native status remains responsive while analysis is running");
            bridge.cancel("bridge-first");bridge.request("bridge-next","test","{}");JSONObject next=owner.results.poll(2,TimeUnit.SECONDS);check(next!=null&&next.getString("id").equals("bridge-next")&&next.getBoolean("ok"),"cancelled native job cannot overwrite the next request");
            Thread.sleep(100);check(owner.results.isEmpty(),"late cancelled native result is suppressed");
        }finally{bridge.close();}
        System.out.println("Native AI checks: "+checks);
    }
}
