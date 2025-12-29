package com.adaptivestreaming.app;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Bridge;

public class MainActivity extends BridgeActivity {
    private static final int MIXED_CONTENT_ALWAYS_ALLOW = 2;
    private boolean webViewConfigured = false;
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Set up mixed content immediately
        setupWebViewSettings();
    }
    
    @Override
    public void onStart() {
        super.onStart();
        if (!webViewConfigured) {
            setupWebViewSettings();
        }
    }
    
    @Override
    public void onResume() {
        super.onResume();
        // Re-apply settings in case they were reset
        setupWebViewSettings();
    }
    
    private void setupWebViewSettings() {
        // Try immediately on the main thread
        new Handler(Looper.getMainLooper()).post(new Runnable() {
            @Override
            public void run() {
                try {
                    Bridge bridge = getBridge();
                    if (bridge == null) {
                        // Bridge not ready, try again
                        new Handler(Looper.getMainLooper()).postDelayed(this, 100);
                        return;
                    }
                    
                    WebView webView = bridge.getWebView();
                    if (webView != null && !webViewConfigured) {
                        // Enable mixed content mode - MIXED_CONTENT_ALWAYS_ALLOW = 2
                        webView.getSettings().setMixedContentMode(MIXED_CONTENT_ALWAYS_ALLOW);
                        
                        // Also enable JavaScript and DOM storage
                        webView.getSettings().setJavaScriptEnabled(true);
                        webView.getSettings().setDomStorageEnabled(true);
                        
                        // Enable all content types
                        webView.getSettings().setAllowFileAccess(true);
                        webView.getSettings().setAllowContentAccess(true);
                        
                        // Configure WebView scaling for 4K displays
                        webView.getSettings().setUseWideViewPort(true);
                        webView.getSettings().setLoadWithOverviewMode(true);
                        webView.setInitialScale(0); // 0 means fit to screen
                        
                        // Disable zoom controls for TV
                        webView.getSettings().setBuiltInZoomControls(false);
                        webView.getSettings().setDisplayZoomControls(false);
                        webView.getSettings().setSupportZoom(false);
                        
                        int currentMode = webView.getSettings().getMixedContentMode();
                        android.util.Log.d("MainActivity", "Mixed content mode set to: " + currentMode + " (2 = ALWAYS_ALLOW)");
                        
                        // Verify it was set correctly
                        if (currentMode == MIXED_CONTENT_ALWAYS_ALLOW) {
                            webViewConfigured = true;
                            android.util.Log.i("MainActivity", "WebView mixed content mode successfully configured");
                        } else {
                            android.util.Log.w("MainActivity", "Warning: Mixed content mode not set correctly! Current: " + currentMode);
                            // Try setting it again
                            webView.getSettings().setMixedContentMode(MIXED_CONTENT_ALWAYS_ALLOW);
                            new Handler(Looper.getMainLooper()).postDelayed(this, 100);
                        }
                    } else if (webView == null) {
                        // WebView not ready yet, try again soon
                        new Handler(Looper.getMainLooper()).postDelayed(this, 50);
                    } else if (webViewConfigured) {
                        // Already configured, but re-apply settings to be safe
                        webView.getSettings().setMixedContentMode(MIXED_CONTENT_ALWAYS_ALLOW);
                    }
                } catch (Exception e) {
                    android.util.Log.e("MainActivity", "Error setting mixed content mode: " + e.getMessage(), e);
                    // Try again
                    new Handler(Looper.getMainLooper()).postDelayed(this, 200);
                }
            }
        });
    }
}
