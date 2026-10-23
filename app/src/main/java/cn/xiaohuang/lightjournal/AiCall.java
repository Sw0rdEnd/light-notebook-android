package cn.xiaohuang.lightjournal;

import java.net.HttpURLConnection;

final class AiCall {
    private volatile boolean cancelled,timedOut;
    private HttpURLConnection connection;
    synchronized void attach(HttpURLConnection value) throws AiException {
        check();connection=value;
    }
    void cancel(){HttpURLConnection value;synchronized(this){cancelled=true;value=connection;}if(value!=null){Thread closer=new Thread(value::disconnect,"deepseek-cancel");closer.setDaemon(true);closer.start();}}
    void expire(){timedOut=true;cancel();}
    boolean cancelled(){return cancelled;}
    boolean timedOut(){return timedOut;}
    void check() throws AiException {
        if(timedOut)throw new AiException("AI_TIMEOUT","分析等待超时，请稍后重新发起。");
        if(cancelled||Thread.currentThread().isInterrupted())throw new AiException("AI_CANCELLED","本次分析已取消。");
    }
}
