package cn.xiaohuang.lightjournal;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import java.util.LinkedHashSet;

/** ACTION_OPEN_DOCUMENT returns multiple selections in ClipData, often with null data. */
final class FileSelection {
    static Uri[] parse(int resultCode, Intent data) {
        if (resultCode != Activity.RESULT_OK || data == null) return null;
        LinkedHashSet<Uri> files = new LinkedHashSet<>();
        ClipData clip = data.getClipData();
        if (clip != null) for (int i=0; i<clip.getItemCount(); i++) add(files, clip.getItemAt(i).getUri());
        add(files, data.getData());
        if (files.size()>200) throw new IllegalArgumentException("单批最多 200 张，请分批导入。");
        return files.isEmpty() ? null : files.toArray(new Uri[0]);
    }
    private static void add(LinkedHashSet<Uri> files, Uri uri) {
        if (uri == null) return;
        if (!"content".equals(uri.getScheme())) throw new IllegalArgumentException("请选择手机相册或文件应用中的文件。");
        files.add(uri);
    }
}
