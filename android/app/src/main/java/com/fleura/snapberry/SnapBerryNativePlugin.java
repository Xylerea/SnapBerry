package com.fleura.snapberry;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.pdf.PdfDocument;
import android.net.Uri;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Environment;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.UUID;

@CapacitorPlugin(name = "SnapBerryNative", permissions = {
    @Permission(alias = "camera", strings = { Manifest.permission.CAMERA })
})
public class SnapBerryNativePlugin extends Plugin {
    @PluginMethod
    public void prepareCamera(PluginCall call) {
        if (getPermissionState("camera") == PermissionState.GRANTED) call.resolve();
        else requestPermissionForAlias("camera", call, "cameraPermissionResult");
    }

    @PermissionCallback
    private void cameraPermissionResult(PluginCall call) {
        if (getPermissionState("camera") == PermissionState.GRANTED) call.resolve();
        else call.reject("Camera permission was denied. Allow Camera in Android Settings, then retry.");
    }

    private byte[] pngData(PluginCall call) {
        String data = call.getString("dataUrl", "");
        if (!data.startsWith("data:image/png;base64,") || data.length() > 40000000) {
            throw new IllegalArgumentException("Invalid or oversized photo strip.");
        }
        byte[] bytes = Base64.decode(data.substring(data.indexOf(',') + 1), Base64.DEFAULT);
        if (bytes.length < 8 || bytes[0] != (byte) 137 || bytes[1] != 80 || bytes[2] != 78 || bytes[3] != 71) {
            throw new IllegalArgumentException("Invalid PNG image.");
        }
        return bytes;
    }

    @PluginMethod
    public void saveImage(PluginCall call) {
        getBridge().execute(() -> {
            ContentResolver resolver = getContext().getContentResolver();
            Uri uri = null;
            try {
                byte[] bytes = pngData(call);
                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.DISPLAY_NAME, "SnapBerry-" + UUID.randomUUID() + ".png");
                values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/SnapBerry");
                values.put(MediaStore.Images.Media.IS_PENDING, 1);
                uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                if (uri == null) throw new IllegalStateException("Unable to create gallery image.");
                try (OutputStream output = resolver.openOutputStream(uri)) {
                    if (output == null) throw new IllegalStateException("Unable to open gallery image.");
                    output.write(bytes);
                }
                values.clear();
                values.put(MediaStore.Images.Media.IS_PENDING, 0);
                if (resolver.update(uri, values, null, null) == 0) throw new IllegalStateException("Unable to publish gallery image.");
                JSObject result = new JSObject();
                result.put("uri", uri.toString());
                call.resolve(result);
            } catch (Exception error) {
                if (uri != null) {
                    try { resolver.delete(uri, null, null); }
                    catch (Exception ignored) { /* Preserve the original save failure. */ }
                }
                call.reject("Could not save the image. Check available storage and try again.", error);
            }
        });
    }

    @PluginMethod
    public void printImage(PluginCall call) {
        getBridge().execute(() -> {
            try {
                int paperWidth = call.getInt("paperWidth", 58);
                if (paperWidth != 57 && paperWidth != 58 && paperWidth != 80) throw new IllegalArgumentException("Unsupported paper size.");
                byte[] bytes = pngData(call);
                Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                if (bitmap == null) throw new IllegalArgumentException("Unable to read photo strip.");
                double marginMm = paperWidth == 57 ? 4.5 : 4.0;
                double printWidthMm = paperWidth - 2 * marginMm;
                double pageHeightMm = printWidthMm * bitmap.getHeight() / bitmap.getWidth() + 2 * marginMm;
                getActivity().runOnUiThread(() -> {
                    try {
                        PrintManager manager = (PrintManager) getContext().getSystemService(Context.PRINT_SERVICE);
                        if (manager == null) throw new IllegalStateException("Android printing is unavailable.");
                        PrintAttributes attributes = new PrintAttributes.Builder()
                            .setMediaSize(new PrintAttributes.MediaSize("SNAPBERRY", "SnapBerry " + paperWidth + "mm",
                                (int) Math.round(paperWidth / 25.4 * 1000), (int) Math.round(pageHeightMm / 25.4 * 1000)))
                            .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                            .build();
                        manager.print("SnapBerry Photo Strip", new StripPrintAdapter(bitmap, paperWidth, pageHeightMm), attributes);
                        call.resolve(); // Dialog opened, not a claim of physical print completion.
                    } catch (Exception error) {
                        bitmap.recycle();
                        call.reject("Could not open Android printing.", error);
                    }
                });
            } catch (Exception error) { call.reject("Could not prepare the strip for printing.", error); }
        });
    }

    private static class StripPrintAdapter extends PrintDocumentAdapter {
        private final Bitmap bitmap;
        private final double widthMm;
        private final double heightMm;
        StripPrintAdapter(Bitmap bitmap, double widthMm, double heightMm) {
            this.bitmap = bitmap; this.widthMm = widthMm; this.heightMm = heightMm;
        }
        @Override
        public void onLayout(PrintAttributes oldAttributes, PrintAttributes newAttributes, CancellationSignal cancellation,
                             LayoutResultCallback callback, Bundle extras) {
            if (cancellation.isCanceled()) { callback.onLayoutCancelled(); return; }
            callback.onLayoutFinished(new PrintDocumentInfo.Builder("snapberry-photo-strip.pdf")
                .setContentType(PrintDocumentInfo.CONTENT_TYPE_PHOTO).setPageCount(1).build(), true);
        }
        @Override
        public void onWrite(PageRange[] pages, ParcelFileDescriptor destination, CancellationSignal cancellation,
                            WriteResultCallback callback) {
            if (cancellation.isCanceled()) { callback.onWriteCancelled(); return; }
            boolean requested = false;
            for (PageRange range : pages) if (range.getStart() <= 0 && range.getEnd() >= 0) requested = true;
            if (!requested) { callback.onWriteFinished(new PageRange[0]); return; }
            PdfDocument pdf = new PdfDocument();
            try (FileOutputStream output = new FileOutputStream(destination.getFileDescriptor())) {
                int width = (int) Math.round(widthMm / 25.4 * 72);
                int height = (int) Math.round(heightMm / 25.4 * 72);
                PdfDocument.Page page = pdf.startPage(new PdfDocument.PageInfo.Builder(width, height, 1).create());
                Canvas canvas = page.getCanvas();
                canvas.drawColor(Color.WHITE);
                float margin = (float) ((widthMm == 57 ? 4.5 : 4.0) / 25.4 * 72);
                float printWidth = width - 2 * margin;
                float printHeight = printWidth * bitmap.getHeight() / bitmap.getWidth();
                Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
                canvas.drawBitmap(bitmap, null, new RectF(margin, margin, margin + printWidth, margin + printHeight), paint);
                pdf.finishPage(page);
                if (cancellation.isCanceled()) { callback.onWriteCancelled(); return; }
                pdf.writeTo(output);
                callback.onWriteFinished(new PageRange[] { new PageRange(0, 0) });
            } catch (Exception error) { callback.onWriteFailed("Could not create print document."); }
            finally { pdf.close(); }
        }
        @Override public void onFinish() { if (!bitmap.isRecycled()) bitmap.recycle(); }
    }
}
