package cn.xiaohuang.lightjournal;

/** Only these deliberately written messages may cross the WebView bridge. */
final class AiException extends Exception {
    final String code;
    AiException(String code,String message){super(message);this.code=code;}
}
