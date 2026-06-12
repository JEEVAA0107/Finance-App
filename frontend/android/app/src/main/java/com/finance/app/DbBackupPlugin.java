package com.finance.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Environment;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.channels.FileChannel;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

@CapacitorPlugin(
    name = "DbBackup",
    permissions = {
        @Permission(strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE }, alias = "storage")
    }
)
public class DbBackupPlugin extends Plugin {

    private static final String TAG = "DbBackupPlugin";
    private static final String DB_NAME = "loanflow";
    private static final String BACKUP_FOLDER = "LoanFlowPro";

    @PluginMethod
    public void backup(PluginCall call) {
        try {
            File dbFile = getDatabaseFile();
            if (dbFile == null || !dbFile.exists()) {
                call.reject("Database file not found");
                return;
            }

            File backupDir = getBackupDirectory();
            if (backupDir == null) {
                call.reject("Cannot access storage");
                return;
            }

            String timestamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(new Date());
            File backupFile = new File(backupDir, "loanflow_backup_" + timestamp + ".db");

            copyFile(dbFile, backupFile);

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("path", backupFile.getAbsolutePath());
            result.put("filename", backupFile.getName());
            call.resolve(result);

            Log.d(TAG, "Backup saved to: " + backupFile.getAbsolutePath());
        } catch (Exception e) {
            Log.e(TAG, "Backup failed: " + e.getMessage());
            call.reject("Backup failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void restore(PluginCall call) {
        try {
            String backupPath = call.getString("path");
            if (backupPath == null) {
                // Auto-find latest backup
                File backupDir = getBackupDirectory();
                if (backupDir == null) { call.reject("No backup found"); return; }
                File[] files = backupDir.listFiles((d, name) -> name.startsWith("loanflow_backup_") && name.endsWith(".db"));
                if (files == null || files.length == 0) { call.reject("No backup file found in Downloads/LoanFlowPro"); return; }
                // Get latest
                File latest = files[0];
                for (File f : files) { if (f.lastModified() > latest.lastModified()) latest = f; }
                backupPath = latest.getAbsolutePath();
            }

            File backupFile = new File(backupPath);
            if (!backupFile.exists()) { call.reject("Backup file not found: " + backupPath); return; }

            File dbFile = getDatabaseFile();
            if (dbFile == null) { call.reject("Cannot find database location"); return; }

            // Close DB before restore — app will restart
            copyFile(backupFile, dbFile);

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("restoredFrom", backupFile.getName());
            call.resolve(result);

            Log.d(TAG, "Restored from: " + backupFile.getAbsolutePath());
        } catch (Exception e) {
            Log.e(TAG, "Restore failed: " + e.getMessage());
            call.reject("Restore failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void listBackups(PluginCall call) {
        try {
            File backupDir = getBackupDirectory();
            JSObject result = new JSObject();

            if (backupDir == null || !backupDir.exists()) {
                result.put("backups", new org.json.JSONArray());
                call.resolve(result);
                return;
            }

            File[] files = backupDir.listFiles((d, name) -> name.startsWith("loanflow_backup_") && name.endsWith(".db"));
            org.json.JSONArray arr = new org.json.JSONArray();
            if (files != null) {
                // Sort by date descending
                java.util.Arrays.sort(files, (a, b) -> Long.compare(b.lastModified(), a.lastModified()));
                for (File f : files) {
                    org.json.JSONObject obj = new org.json.JSONObject();
                    obj.put("name", f.getName());
                    obj.put("path", f.getAbsolutePath());
                    obj.put("size", f.length());
                    obj.put("date", new SimpleDateFormat("dd MMM yyyy, HH:mm", Locale.getDefault()).format(new Date(f.lastModified())));
                    arr.put(obj);
                }
            }
            result.put("backups", arr);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed: " + e.getMessage());
        }
    }

    private File getDatabaseFile() {
        // Try multiple possible locations for the SQLite DB
        String[] possiblePaths = {
            getContext().getDatabasePath(DB_NAME).getAbsolutePath(),
            getContext().getDatabasePath(DB_NAME + ".db").getAbsolutePath(),
            getContext().getFilesDir().getAbsolutePath() + "/databases/" + DB_NAME,
            getContext().getFilesDir().getAbsolutePath() + "/" + DB_NAME,
        };
        for (String path : possiblePaths) {
            File f = new File(path);
            if (f.exists()) return f;
        }
        // Return default path even if not found (for restore target)
        return getContext().getDatabasePath(DB_NAME);
    }

    private File getBackupDirectory() {
        File dir;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Android 10+ — use app-specific external storage (no permission needed, survives uninstall? No)
            // Use Downloads via MediaStore or public Downloads
            dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), BACKUP_FOLDER);
        } else {
            dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), BACKUP_FOLDER);
        }
        if (!dir.exists()) dir.mkdirs();
        return dir.exists() ? dir : null;
    }

    private void copyFile(File src, File dst) throws IOException {
        dst.getParentFile().mkdirs();
        try (FileChannel in = new FileInputStream(src).getChannel();
             FileChannel out = new FileOutputStream(dst).getChannel()) {
            out.transferFrom(in, 0, in.size());
        }
    }
}
