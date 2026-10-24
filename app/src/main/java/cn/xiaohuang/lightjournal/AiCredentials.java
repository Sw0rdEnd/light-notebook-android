package cn.xiaohuang.lightjournal;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FileNotFoundException;
import java.security.KeyStore;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;

/** Never uses the records database, WebView storage, backup JSON or exported files. */
final class AiCredentials {
    private static final String ALIAS="light-journal-deepseek-v1";
    private final AtomicFile file;
    AiCredentials(Context context){file=new AtomicFile(new File(context.getNoBackupFilesDir(),"deepseek-key.bin"));}
    private SecretKey key(boolean create) throws Exception {
        KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
        if(store.containsAlias(ALIAS))return (SecretKey)store.getKey(ALIAS,null);
        if(!create)throw new IllegalStateException("Credential key unavailable");
        KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256).setRandomizedEncryptionRequired(true).build());
        return generator.generateKey();
    }
    synchronized String read() throws AiException {
        final byte[] bytes;
        try{bytes=file.readFully();}catch(FileNotFoundException e){throw new AiException("AI_NOT_CONFIGURED","请先在AI设置中保存你的DeepSeek API Key。");}
        catch(Exception e){throw new AiException("AI_KEY_UNREADABLE","本机密钥无法读取，请在AI设置重新保存。");}
        try{return AiProtocol.validateKey(AiSecretCipher.decrypt(key(false),bytes));}
        catch(Exception e){throw new AiException("AI_KEY_UNREADABLE","本机密钥无法读取，请在AI设置重新保存。");}
    }
    synchronized JSONObject status() throws Exception {
        boolean configured=false,unreadable=false;
        try{read();configured=true;}catch(AiException e){unreadable=!"AI_NOT_CONFIGURED".equals(e.code);}
        return new JSONObject().put("configured",configured).put("unreadable",unreadable).put("model",AiProtocol.MODEL).put("provider","DeepSeek");
    }
    synchronized void save(String value,AiCall call) throws AiException {
        call.check();value=AiProtocol.validateKey(value);FileOutputStream out=null;
        try{byte[] encrypted=AiSecretCipher.encrypt(key(true),value);call.check();out=file.startWrite();out.write(encrypted);file.finishWrite(out);}
        catch(AiException e){throw e;}
        catch(Exception e){if(out!=null)file.failWrite(out);throw new AiException("AI_KEY_SAVE_FAILED","密钥未能保存，请检查设备存储后重试。");}
    }
    synchronized void forget() throws AiException {forget(null);}
    synchronized void forget(AiCall call) throws AiException {
        if(call!=null)call.check();
        try{
            file.delete();if(file.getBaseFile().exists())throw new IllegalStateException("Credential file remains");
            KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);if(store.containsAlias(ALIAS))store.deleteEntry(ALIAS);
        }catch(Exception e){throw new AiException("AI_KEY_DELETE_FAILED","密钥未能完全移除，请重试。");}
    }
}
