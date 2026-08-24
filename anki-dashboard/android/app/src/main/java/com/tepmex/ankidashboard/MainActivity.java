package com.tepmex.ankidashboard;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.tepmex.ankidashboard.sync.AnkiWebPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AnkiWebPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
