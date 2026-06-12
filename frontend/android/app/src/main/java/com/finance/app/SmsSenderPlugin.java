package com.finance.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.telephony.SmsManager;
import android.util.Log;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "SmsSender",
    permissions = {
        @Permission(strings = { Manifest.permission.SEND_SMS }, alias = "sms")
    }
)
public class SmsSenderPlugin extends Plugin {

    private static final String TAG = "SmsSenderPlugin";
    private PluginCall savedCall;

    @PluginMethod
    public void sendSMS(PluginCall call) {
        String phone = call.getString("phone");
        String message = call.getString("message");

        if (phone == null || message == null) {
            call.reject("Phone and message are required");
            return;
        }

        // Check SMS permission
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.SEND_SMS)
                != PackageManager.PERMISSION_GRANTED) {
            savedCall = call;
            requestPermissionForAlias("sms", call, "smsPermissionCallback");
            return;
        }

        doSendSMS(call, phone, message);
    }

    @PermissionCallback
    private void smsPermissionCallback(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.SEND_SMS)
                == PackageManager.PERMISSION_GRANTED) {
            String phone = call.getString("phone");
            String message = call.getString("message");
            doSendSMS(call, phone, message);
        } else {
            call.reject("SMS permission denied");
        }
    }

    private void doSendSMS(PluginCall call, String phone, String message) {
        try {
            SmsManager smsManager = SmsManager.getDefault();
            // Split long messages automatically
            if (message.length() > 160) {
                java.util.ArrayList<String> parts = smsManager.divideMessage(message);
                smsManager.sendMultipartTextMessage(phone, null, parts, null, null);
            } else {
                smsManager.sendTextMessage(phone, null, message, null, null);
            }
            Log.d(TAG, "SMS sent to " + phone);
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "SMS failed: " + e.getMessage());
            call.reject("SMS failed: " + e.getMessage());
        }
    }
}
