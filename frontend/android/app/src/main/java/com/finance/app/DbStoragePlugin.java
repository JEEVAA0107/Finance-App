package com.finance.app;

import android.os.Environment;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.channels.FileChannel;

@CapacitorPlugin(name = "DbStorage")
public class DbStoragePlugin extends Plugin {

    private static final String TAG = "DbStorage";
    private static final String FOLDER = "LoanFlowPro";
    private static final String DB_FILENAME = "loanflow_data.db";

    // Returns the persistent external path (Downloads/LoanFlowPro/loanflow_data.db)
    private File getExternalDbFile() {
        File dir = new File(
            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
            FOLDER
        );
        dir.mkdirs();
        return new File(dir, DB_FILENAME);
    }

    // Returns the internal app DB file
    private File getInternalDbFile() {
        String[] paths = {
            getContext().getDatabasePath("loanflow").getAbsolutePath(),
            getContext().getDatabasePath("loanflow.db").getAbsolutePath(),
            getContext().getFilesDir() + "/databases/loanflow",
            getContext().getFilesDir() + "/loanflow",
        };
        for (String p : paths) {
            File f = new File(p);
            if (f.exists()) return f;
        }
        return getContext().getDatabasePath("loanflow");
    }

    private void copyFile(File src, File dst) throws Exception {
        if (!src.exists()) throw new Exception("Source not found: " + src.getAbsolutePath());
        dst.getParentFile().mkdirs();
        try (FileChannel in = new FileInputStream(src).getChannel();
             FileChannel out = new FileOutputStream(dst).getChannel()) {
            out.transferFrom(in, 0, in.size());
        }
    }

    /** Copy internal DB → external Downloads (call after every write) */
    @PluginMethod
    public void syncToExternal(PluginCall call) {
        try {
            File internal = getInternalDbFile();
            File external = getExternalDbFile();
            copyFile(internal, external);
            JSObject r = new JSObject();
            r.put("success", true);
            r.put("path", external.getAbsolutePath());
            call.resolve(r);
        } catch (Exception e) {
            Log.e(TAG, "syncToExternal failed: " + e.getMessage());
            call.reject(e.getMessage());
        }
    }

    /** Copy external Downloads → internal DB (call on first launch if internal is empty) */
    @PluginMethod
    public void restoreFromExternal(PluginCall call) {
        try {
            File external = getExternalDbFile();
            if (!external.exists()) {
                JSObject r = new JSObject();
                r.put("success", false);
                r.put("reason", "No external backup found");
                call.resolve(r);
                return;
            }
            File internal = getInternalDbFile();
            copyFile(external, internal);
            JSObject r = new JSObject();
            r.put("success", true);
            r.put("restoredFrom", external.getAbsolutePath());
            call.resolve(r);
        } catch (Exception e) {
            Log.e(TAG, "restoreFromExternal failed: " + e.getMessage());
            call.reject(e.getMessage());
        }
    }

    /** Check if external backup exists */
    @PluginMethod
    public void hasExternalBackup(PluginCall call) {
        File external = getExternalDbFile();
        JSObject r = new JSObject();
        r.put("exists", external.exists());
        r.put("path", external.getAbsolutePath());
        if (external.exists()) {
            r.put("size", external.length());
            r.put("lastModified", external.lastModified());
        }
        call.resolve(r);
    }
}
