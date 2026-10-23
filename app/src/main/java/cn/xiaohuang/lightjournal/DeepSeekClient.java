package cn.xiaohuang.lightjournal;

import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.Timer;
import java.util.TimerTask;
import javax.net.ssl.SSLException;

/** Fixed official HTTPS destination, bounded responses, no redirects and no retries. */
final class DeepSeekClient {
    interface Connections { HttpURLConnection open(URL url) throws IOException; }
    private final Connections connections;
    private final long timeoutMs;
    DeepSeekClient(){this(url->(HttpURLConnection)url.openConnection(),65000);}
    // Package-private transport injection is used only by the local JVM HTTP tests.
    DeepSeekClient(Connections connections,long timeoutMs){this.connections=connections;this.timeoutMs=timeoutMs;}
    JSONObject models(String key,AiCall call) throws AiException{return execute("GET","/models",key,null,call);}
    JSONObject evaluate(String key,JSONObject body,AiCall call) throws AiException{return execute("POST","/chat/completions",key,body,call);}
    private JSONObject execute(String method,String path,String key,JSONObject body,AiCall call) throws AiException {
        AiProtocol.validateKey(key);call.check();HttpURLConnection connection=null;Timer timer=new Timer("deepseek-timeout",true);
        timer.schedule(new TimerTask(){@Override public void run(){call.expire();}},timeoutMs);
        try{
            connection=connections.open(new URL("https://api.deepseek.com"+path));call.attach(connection);
            connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(15000);connection.setReadTimeout(45000);
            connection.setRequestMethod(method);connection.setRequestProperty("Authorization","Bearer "+key);
            connection.setRequestProperty("Accept","application/json");connection.setUseCaches(false);
            if(body!=null){byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8);if(bytes.length>7*1024*1024)throw new AiException("AI_IMAGE_TOO_LARGE","分析图片过大，请缩小照片后重新导入。");
                connection.setRequestProperty("Content-Type","application/json; charset=utf-8");connection.setDoOutput(true);connection.setFixedLengthStreamingMode(bytes.length);
                try(OutputStream out=connection.getOutputStream()){call.check();out.write(bytes);}
            }
            call.check();int status=connection.getResponseCode();call.check();
            if(status!=200)throw statusError(status);
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();
            try(InputStream input=connection.getInputStream()){byte[] buffer=new byte[8192];int n;
                while((n=input.read(buffer))!=-1){call.check();if(bytes.size()+n>512*1024)throw new AiException("AI_RESPONSE_TOO_LARGE","DeepSeek返回内容过大，本次结果未保存。");bytes.write(buffer,0,n);}
            }
            call.check();try{return new JSONObject(new String(bytes.toByteArray(),StandardCharsets.UTF_8));}
            catch(Exception e){throw new AiException("AI_INVALID_RESPONSE","DeepSeek未返回有效结果，请稍后重新发起。");}
        }catch(AiException e){throw e;}
        catch(SocketTimeoutException e){call.check();throw new AiException("AI_TIMEOUT","连接或分析等待超时，请稍后重新发起。");}
        catch(SSLException e){call.check();throw new AiException("AI_TLS_ERROR","无法建立安全连接，请检查系统时间和网络。");}
        catch(Exception e){call.check();throw new AiException("AI_NETWORK_ERROR","无法连接DeepSeek，请检查网络后重试。");}
        finally{timer.cancel();if(connection!=null)connection.disconnect();}
    }
    static AiException statusError(int status){
        if(status==401)return new AiException("AI_INVALID_KEY","DeepSeek密钥无效或已失效，请在AI设置中更新。");
        if(status==402)return new AiException("AI_BALANCE","DeepSeek余额不足，请在官方平台检查余额。");
        if(status==403)return new AiException("AI_ACCESS_DENIED","当前密钥无法访问该模型，请检查DeepSeek账户权限。");
        if(status==400||status==422)return new AiException("AI_REQUEST_REJECTED","DeepSeek未接受本次图片或参数，请检查模型是否支持读图后重试。");
        if(status==404)return new AiException("AI_MODEL_UNAVAILABLE","DeepSeek模型暂不可用，请先在AI设置测试连接。");
        if(status==413)return new AiException("AI_IMAGE_TOO_LARGE","分析图片过大，请缩小照片后重新导入。");
        if(status==429)return new AiException("AI_RATE_LIMIT","DeepSeek请求过于频繁或达到限额，请稍后再试。");
        if(status>=300&&status<400)return new AiException("AI_REDIRECT","DeepSeek返回了未预期的跳转，本次连接已停止。");
        return new AiException("AI_PROVIDER_ERROR","DeepSeek服务暂不可用，请稍后重新发起。");
    }
}
