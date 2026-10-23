package cn.xiaohuang.lightjournal;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

/** Versioned authenticated envelope. The AES key is supplied by Android Keystore. */
final class AiSecretCipher {
    private static final byte[] AAD="light-journal.deepseek-key.v1".getBytes(StandardCharsets.UTF_8);
    static byte[] encrypt(SecretKey key,String value) throws Exception {
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key);cipher.updateAAD(AAD);
        byte[] encrypted=cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)),iv=cipher.getIV();
        if(iv.length!=12)throw new IllegalStateException("Unexpected GCM IV");
        byte[] result=new byte[13+encrypted.length];result[0]=1;System.arraycopy(iv,0,result,1,12);System.arraycopy(encrypted,0,result,13,encrypted.length);return result;
    }
    static String decrypt(SecretKey key,byte[] value) throws Exception {
        if(value.length<30||value.length>4096||value[0]!=1)throw new IllegalArgumentException("Invalid credential envelope");
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key,new GCMParameterSpec(128,Arrays.copyOfRange(value,1,13)));cipher.updateAAD(AAD);
        return new String(cipher.doFinal(Arrays.copyOfRange(value,13,value.length)),StandardCharsets.UTF_8);
    }
}
