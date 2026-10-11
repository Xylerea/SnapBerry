package com.fleura.snapberry;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.BluetoothStatusCodes;
import android.content.Context;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.Arrays;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

// UUIDs, raster format and pacing come from a physically tested YHK implementation:
// https://www.joshmcarthur.com/case-studies/yhk-mini-printer/
// No bytes are sent until the complete ISSC profile matches. Full strips additionally
// require the user's physical test-print confirmation, keyed to this paired device.
@CapacitorPlugin(name = "SnapBerryBluetooth", permissions = {
    @Permission(alias = "connect", strings = { Manifest.permission.BLUETOOTH_CONNECT })
})
public class SnapBerryBluetoothPlugin extends Plugin {
    private static final UUID SERVICE = UUID.fromString("49535343-fe7d-4ae5-8fa9-9fafd205e455");
    private static final UUID TX = UUID.fromString("49535343-8841-43f4-a8d4-ecbe34729bb3");
    private static final UUID RX = UUID.fromString("49535343-1e4d-4bd9-ba61-23c647249616");
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService writer = Executors.newSingleThreadExecutor();
    private final AtomicBoolean sending = new AtomicBoolean(false);
    private volatile BluetoothGatt gatt;
    private volatile BluetoothGattCharacteristic tx;
    private volatile boolean ready, confirmed, testSent;
    private volatile int chunkSize = 20;
    private volatile CountDownLatch writeLatch;
    private volatile int writeStatus = -1;
    private volatile int generation = 0;
    private PluginCall connectionCall;
    private String address = "", name = "";
    private boolean discovering;
    private Runnable connectionTimeout, mtuTimeout;

    private boolean permitted() {
        return Build.VERSION.SDK_INT < 31 || getPermissionState("connect") == PermissionState.GRANTED;
    }

    private BluetoothAdapter adapter() {
        BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        if (manager == null || manager.getAdapter() == null) throw new IllegalStateException("This phone has no Bluetooth adapter.");
        BluetoothAdapter adapter = manager.getAdapter();
        if (!adapter.isEnabled()) throw new IllegalStateException("Turn on Bluetooth, then try again.");
        return adapter;
    }

    @PluginMethod public void pairedPrinters(PluginCall call) {
        if (!permitted()) { requestPermissionForAlias("connect", call, "pairedPermission"); return; }
        listPaired(call);
    }

    @PermissionCallback private void pairedPermission(PluginCall call) {
        if (!permitted()) call.reject("Allow Nearby devices for SnapBerry in Android Settings, then retry.");
        else listPaired(call);
    }

    private void listPaired(PluginCall call) {
        try {
            JSArray devices = new JSArray();
            for (BluetoothDevice device : adapter().getBondedDevices()) {
                String deviceName = device.getName();
                if (deviceName != null && deviceName.startsWith("YHK-")) {
                    JSObject item = new JSObject(); item.put("name", deviceName); item.put("address", device.getAddress()); devices.put(item);
                }
            }
            JSObject result = new JSObject(); result.put("devices", devices); call.resolve(result);
        } catch (Exception error) { call.reject(error.getMessage(), error); }
    }

    private JSObject info(String message) {
        JSObject result = new JSObject(); result.put("connected", ready); result.put("confirmed", confirmed);
        result.put("name", name); result.put("message", message); return result;
    }

    @PluginMethod public void status(PluginCall call) { call.resolve(info("")); }

    @PluginMethod public void connect(PluginCall call) {
        if (!permitted()) { call.reject("Tap Connect Printer and allow Nearby devices first."); return; }
        main.post(() -> {
            if (connectionCall != null || sending.get()) { call.reject("Printer is busy. Please wait."); return; }
            try {
                BluetoothDevice selected = null;
                String requested = call.getString("address", "");
                for (BluetoothDevice device : adapter().getBondedDevices()) {
                    if (requested.equals(device.getAddress()) && device.getName() != null && device.getName().startsWith("YHK-")) selected = device;
                }
                if (selected == null) throw new IllegalStateException("Pair your YHK printer in Android Bluetooth Settings first.");
                close("Disconnected", false);
                address = selected.getAddress(); name = selected.getName();
                connectionCall = call; discovering = false; chunkSize = 20;
                gatt = selected.connectGatt(getContext(), false, callbacks, BluetoothDevice.TRANSPORT_LE);
                if (gatt == null) throw new IllegalStateException("Unable to start the printer connection.");
                connectionTimeout = () -> close("Connection timed out. Close WalkPrint, keep the printer nearby, then retry.", true);
                main.postDelayed(connectionTimeout, 25000);
            } catch (Exception error) {
                boolean pending = connectionCall == call;
                close(error.getMessage(), true);
                if (!pending) call.reject(error.getMessage(), error);
            }
        });
    }

    private void discover(BluetoothGatt device) {
        if (device != gatt || discovering) return;
        discovering = true;
        if (mtuTimeout != null) main.removeCallbacks(mtuTimeout);
        try { if (!device.discoverServices()) close("Unable to read the printer services. Please reconnect.", true); }
        catch (Exception error) { close(error.getMessage(), true); }
    }

    private final BluetoothGattCallback callbacks = new BluetoothGattCallback() {
        @Override public void onConnectionStateChange(BluetoothGatt device, int status, int state) {
            main.post(() -> {
                if (device != gatt) return;
                if (status != BluetoothGatt.GATT_SUCCESS || state == BluetoothProfile.STATE_DISCONNECTED) {
                    close("Printer disconnected. Close WalkPrint and reconnect in SnapBerry.", true); return;
                }
                if (state == BluetoothProfile.STATE_CONNECTED) {
                    try {
                        mtuTimeout = () -> discover(device);
                        main.postDelayed(mtuTimeout, 3000);
                        if (!device.requestMtu(185)) discover(device);
                    } catch (Exception error) { close(error.getMessage(), true); }
                }
            });
        }
        @Override public void onMtuChanged(BluetoothGatt device, int mtu, int status) {
            main.post(() -> {
                if (device != gatt) return;
                if (status == BluetoothGatt.GATT_SUCCESS) chunkSize = Math.max(1, Math.min(182, mtu - 3));
                discover(device);
            });
        }
        @Override public void onServicesDiscovered(BluetoothGatt device, int status) {
            main.post(() -> {
                if (device != gatt) return;
                BluetoothGattService service = device.getService(SERVICE);
                BluetoothGattCharacteristic write = service == null ? null : service.getCharacteristic(TX);
                BluetoothGattCharacteristic read = service == null ? null : service.getCharacteristic(RX);
                if (status != BluetoothGatt.GATT_SUCCESS || write == null || read == null
                    || (write.getProperties() & BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE) == 0
                    || (read.getProperties() & BluetoothGattCharacteristic.PROPERTY_NOTIFY) == 0) {
                    close("This printer exposes a different Bluetooth protocol. Direct printing stays disabled.", true); return;
                }
                tx = write; ready = true;
                confirmed = getContext().getSharedPreferences("snapberry-printers", Context.MODE_PRIVATE).getBoolean("yhk-issc-v1:" + address, false);
                if (connectionTimeout != null) main.removeCallbacks(connectionTimeout);
                JSObject result = info(confirmed ? "Connected. Ready for direct printing." : "Services match. Print a small test to confirm your printer.");
                PluginCall pending = connectionCall; connectionCall = null;
                if (pending != null) pending.resolve(result);
                notifyListeners("printerStatus", result);
            });
        }
        @Override public void onCharacteristicWrite(BluetoothGatt device, BluetoothGattCharacteristic characteristic, int status) {
            if (device != gatt || !TX.equals(characteristic.getUuid())) return;
            writeStatus = status;
            CountDownLatch latch = writeLatch;
            if (latch != null) latch.countDown();
        }
    };

    @PluginMethod public void confirmTest(PluginCall call) {
        main.post(() -> {
            if (!ready || !testSent || sending.get()) { call.reject("Print a test first and check the paper before confirming."); return; }
            getContext().getSharedPreferences("snapberry-printers", Context.MODE_PRIVATE).edit().putBoolean("yhk-issc-v1:" + address, true).apply();
            confirmed = true;
            JSObject result = info("Printer confirmed. You can print your photo strip directly.");
            call.resolve(result); notifyListeners("printerStatus", result);
        });
    }

    @PluginMethod public void send(PluginCall call) {
        boolean test = Boolean.TRUE.equals(call.getBoolean("test", false));
        if (!permitted() || !ready || tx == null || (!test && !confirmed)) { call.reject("Connect and confirm a successful test print first."); return; }
        if (!sending.compareAndSet(false, true)) { call.reject("A print is already being sent. Please wait."); return; }
        final byte[] job;
        try {
            String encoded = call.getString("job", "");
            if (encoded.length() > 340000) throw new IllegalArgumentException("Print image is too large.");
            job = Base64.decode(encoded, Base64.DEFAULT);
            if (job.length < 16 || job[0] != 27 || job[1] != 64 || job[2] != 29 || job[3] != 118 || job[4] != 48
                || job[5] != 0 || (job[6] & 255) != 48 || job[7] != 0) throw new IllegalArgumentException("Invalid YHK raster image.");
            int height = (job[8] & 255) | ((job[9] & 255) << 8);
            if (height < 1 || height > 5000 || (test && height > 128) || job.length != 16 + 48 * height
                || !Arrays.equals(Arrays.copyOfRange(job, job.length - 6, job.length), new byte[] {27, 100, 4, 10, 10, 10})) {
                throw new IllegalArgumentException("Invalid print dimensions or feed commands.");
            }
        } catch (Exception error) { sending.set(false); call.reject(error.getMessage(), error); return; }
        if (test) {
            testSent = false;
            confirmed = false;
            getContext().getSharedPreferences("snapberry-printers", Context.MODE_PRIVATE).edit().remove("yhk-issc-v1:" + address).apply();
            notifyListeners("printerStatus", info("Test printing: please check the paper before confirming."));
        }
        final BluetoothGatt target = gatt;
        final BluetoothGattCharacteristic characteristic = tx;
        final int operation = generation;
        writer.execute(() -> {
            try {
                for (int offset = 0; offset < job.length; ) {
                    if (operation != generation || target != gatt || !ready) throw new IllegalStateException("Printer disconnected. The strip may be incomplete; check the paper before retrying.");
                    int length = Math.min(chunkSize, job.length - offset);
                    byte[] packet = Arrays.copyOfRange(job, offset, offset + length);
                    CountDownLatch latch = new CountDownLatch(1); writeLatch = latch; writeStatus = -1;
                    main.post(() -> {
                        if (target != gatt || operation != generation) { latch.countDown(); return; }
                        try {
                            boolean accepted;
                            if (Build.VERSION.SDK_INT >= 33) accepted = target.writeCharacteristic(characteristic, packet, BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE) == BluetoothStatusCodes.SUCCESS;
                            else {
                                characteristic.setWriteType(BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE);
                                characteristic.setValue(packet); accepted = target.writeCharacteristic(characteristic);
                            }
                            if (!accepted) { writeStatus = -1; latch.countDown(); }
                        } catch (Exception error) { writeStatus = -1; latch.countDown(); }
                    });
                    if (!latch.await(5, TimeUnit.SECONDS) || writeStatus != BluetoothGatt.GATT_SUCCESS) throw new IllegalStateException("Bluetooth transfer failed. Check the paper before retrying; it may have printed part of the strip.");
                    writeLatch = null;
                    offset += length;
                    JSObject progress = new JSObject(); progress.put("sent", offset); progress.put("total", job.length);
                    notifyListeners("printerProgress", progress);
                    Thread.sleep(40); // Documented pacing protects the small printer buffer.
                }
                Thread.sleep(1500);
                if (target != gatt || operation != generation || !ready) throw new IllegalStateException("Printer disconnected. Check the printed output.");
                if (test) testSent = true;
                call.resolve(); // Bytes transferred; no physical print-completion acknowledgement exists.
            } catch (Exception error) {
                call.reject(error.getMessage(), error);
                main.post(() -> { if (target == gatt) close("Transfer failed. Check the paper, then reconnect.", true); });
            } finally { writeLatch = null; sending.set(false); }
        });
    }

    private void close(String message, boolean announce) {
        generation++; ready = false; confirmed = false; testSent = false; tx = null;
        if (connectionTimeout != null) main.removeCallbacks(connectionTimeout);
        if (mtuTimeout != null) main.removeCallbacks(mtuTimeout);
        BluetoothGatt previous = gatt; gatt = null;
        CountDownLatch latch = writeLatch; if (latch != null) latch.countDown();
        if (previous != null) { try { previous.disconnect(); } catch (Exception ignored) {} try { previous.close(); } catch (Exception ignored) {} }
        PluginCall pending = connectionCall; connectionCall = null;
        if (pending != null) pending.reject(message);
        if (announce) notifyListeners("printerStatus", info(message));
    }

    @PluginMethod public void disconnect(PluginCall call) { main.post(() -> { close("Printer disconnected.", true); call.resolve(); }); }
    @Override protected void handleOnDestroy() { main.post(() -> { close("App closed", false); main.removeCallbacksAndMessages(null); }); writer.shutdownNow(); }
}
