package com.finance.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(SmsSenderPlugin.class);
        registerPlugin(DbBackupPlugin.class);
        registerPlugin(DbStoragePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
