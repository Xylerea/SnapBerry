package com.fleura.snapberry;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SnapBerryNativePlugin.class);
        registerPlugin(SnapBerryBluetoothPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
