package com.adaptivestreaming.app;

import android.net.Uri;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import androidx.media3.common.MediaItem;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.ui.PlayerView;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONException;

@CapacitorPlugin(name = "ExoPlayer")
public class ExoPlayerPlugin extends Plugin {
    private ExoPlayer exoPlayer;
    private PlayerView playerView;
    private FrameLayout containerView;
    private PluginCall timeUpdateCall;
    private android.os.Handler timeUpdateHandler;
    private Runnable timeUpdateRunnable;

    @PluginMethod
    public void initialize(PluginCall call) {
        try {
            String containerId = call.getString("containerId", "videoContainer");

            getActivity().runOnUiThread(() -> {
                try {
                    // Get the root view of the activity
                    ViewGroup rootView = (ViewGroup) getActivity().findViewById(android.R.id.content);

                    // Create a container for ExoPlayer that will overlay the WebView
                    containerView = new FrameLayout(getContext());
                    containerView.setLayoutParams(new ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    ));
                    containerView.setTag(containerId);

                    // Add container to root view (will overlay WebView)
                    rootView.addView(containerView);

                    // Initialize ExoPlayer
                    exoPlayer = new ExoPlayer.Builder(getContext()).build();
                    playerView = new PlayerView(getContext());
                    playerView.setPlayer(exoPlayer);
                    playerView.setUseController(false);

                     containerView.addView(playerView, new FrameLayout.LayoutParams(
                         FrameLayout.LayoutParams.MATCH_PARENT,
                         FrameLayout.LayoutParams.MATCH_PARENT
                     ));

                    // Initialize handler for time updates
                    timeUpdateHandler = new android.os.Handler(android.os.Looper.getMainLooper());

                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    call.resolve(ret);
                } catch (Exception e) {
                    call.reject("Failed to initialize ExoPlayer: " + e.getMessage());
                }
            });
        } catch (Exception e) {
            call.reject("Error initializing ExoPlayer: " + e.getMessage());
        }
    }

    @PluginMethod
    public void loadVideo(PluginCall call) {
        try {
            String url = call.getString("url");
            String subtitleUrl = call.getString("subtitleUrl");

            if (exoPlayer == null) {
                call.reject("ExoPlayer not initialized");
                return;
            }

            getActivity().runOnUiThread(() -> {
                try {
                    MediaItem.Builder builder = new MediaItem.Builder()
                        .setUri(url);

                    if (subtitleUrl != null && !subtitleUrl.isEmpty()) {
                        Uri subtitleUri = Uri.parse(subtitleUrl);
                        builder.setSubtitleConfigurations(
                            java.util.Collections.singletonList(
                                new androidx.media3.common.MediaItem.SubtitleConfiguration.Builder(subtitleUri)
                                    .setMimeType("text/vtt")
                                    .setLanguage("en")
                                    .build()
                            )
                        );
                    }

                    exoPlayer.setMediaItem(builder.build());
                    exoPlayer.prepare();

                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    call.resolve(ret);
                } catch (Exception e) {
                    call.reject("Failed to load video: " + e.getMessage());
                }
            });
        } catch (Exception e) {
            call.reject("Error loading video: " + e.getMessage());
        }
    }

    @PluginMethod
    public void play(PluginCall call) {
        if (exoPlayer == null) {
            call.reject("ExoPlayer not initialized");
            return;
        }

        getActivity().runOnUiThread(() -> {
            exoPlayer.play();
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void pause(PluginCall call) {
        if (exoPlayer == null) {
            call.reject("ExoPlayer not initialized");
            return;
        }

        getActivity().runOnUiThread(() -> {
            exoPlayer.pause();
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void seekTo(PluginCall call) {
        try {
            long position = (long) (call.getDouble("position") * 1000); // Convert seconds to milliseconds

            if (exoPlayer == null) {
                call.reject("ExoPlayer not initialized");
                return;
            }

            getActivity().runOnUiThread(() -> {
                exoPlayer.seekTo(position);
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            });
        } catch (Exception e) {
            call.reject("Error seeking: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getCurrentPosition(PluginCall call) {
        if (exoPlayer == null) {
            call.reject("ExoPlayer not initialized");
            return;
        }

        long position = exoPlayer.getCurrentPosition();
        JSObject ret = new JSObject();
        ret.put("position", position / 1000.0); // Convert milliseconds to seconds
        call.resolve(ret);
    }

    @PluginMethod
    public void getDuration(PluginCall call) {
        if (exoPlayer == null) {
            call.reject("ExoPlayer not initialized");
            return;
        }

        long duration = exoPlayer.getDuration();
        JSObject ret = new JSObject();
        ret.put("duration", duration / 1000.0); // Convert milliseconds to seconds
        call.resolve(ret);
    }

    @PluginMethod
    public void release(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (exoPlayer != null) {
                exoPlayer.release();
                exoPlayer = null;
            }
            if (playerView != null && containerView != null) {
                containerView.removeView(playerView);
                playerView = null;
            }
            if (containerView != null) {
                ViewGroup rootView = (ViewGroup) getActivity().findViewById(android.R.id.content);
                rootView.removeView(containerView);
                containerView = null;
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void addListener(PluginCall call) {
        // Extract eventName from call data - Capacitor passes it as the first argument
        String eventName = null;
        try {
            // Try to get from call data object
            if (call.getData().has("eventName")) {
                eventName = call.getData().getString("eventName");
            } else {
                // Fallback: try to get from call arguments
                eventName = call.getString("eventName");
            }
        } catch (Exception e) {
            // If that fails, try getting it from the method name or call data
            eventName = call.getString("eventName");
        }

        if (eventName == null) {
            call.reject("Event name is required");
            return;
        }

        if ("timeupdate".equals(eventName)) {
            // Store the call for time updates
            timeUpdateCall = call;
            call.setKeepAlive(true);

            // Start periodic updates
            if (timeUpdateHandler != null && exoPlayer != null) {
                timeUpdateRunnable = new Runnable() {
                    @Override
                    public void run() {
                        if (exoPlayer != null && timeUpdateCall != null) {
                            JSObject ret = new JSObject();
                            ret.put("currentTime", exoPlayer.getCurrentPosition() / 1000.0);
                            notifyListeners("timeupdate", ret);
                            if (exoPlayer.isPlaying()) {
                                timeUpdateHandler.postDelayed(this, 250); // Update every 250ms
                            }
                        }
                    }
                };
                timeUpdateHandler.post(timeUpdateRunnable);
            }
        } else if ("play".equals(eventName)) {
            call.setKeepAlive(true);
            if (exoPlayer != null) {
                exoPlayer.addListener(new Player.Listener() {
                    @Override
                    public void onIsPlayingChanged(boolean isPlaying) {
                        if (isPlaying) {
                            notifyListeners("play", new JSObject());
                        }
                    }
                });
            }
        } else if ("pause".equals(eventName)) {
            call.setKeepAlive(true);
            if (exoPlayer != null) {
                exoPlayer.addListener(new Player.Listener() {
                    @Override
                    public void onIsPlayingChanged(boolean isPlaying) {
                        if (!isPlaying) {
                            notifyListeners("pause", new JSObject());
                        }
                    }
                });
            }
        } else {
            call.reject("Unknown event name: " + eventName);
        }
    }

    @PluginMethod
    public void removeAllListeners(PluginCall call) {
        if (timeUpdateHandler != null && timeUpdateRunnable != null) {
            timeUpdateHandler.removeCallbacks(timeUpdateRunnable);
            timeUpdateRunnable = null;
        }
        if (timeUpdateCall != null) {
            timeUpdateCall.setKeepAlive(false);
            timeUpdateCall.release(getBridge());
            timeUpdateCall = null;
        }
        call.resolve();
    }


    @Override
    protected void handleOnDestroy() {
        if (timeUpdateHandler != null && timeUpdateRunnable != null) {
            timeUpdateHandler.removeCallbacks(timeUpdateRunnable);
        }
        if (timeUpdateCall != null) {
            timeUpdateCall.setKeepAlive(false);
            timeUpdateCall.release(getBridge());
            timeUpdateCall = null;
        }
        if (exoPlayer != null) {
            exoPlayer.release();
            exoPlayer = null;
        }
        if (playerView != null && containerView != null) {
            containerView.removeView(playerView);
            playerView = null;
        }
        if (containerView != null) {
            ViewGroup rootView = (ViewGroup) getActivity().findViewById(android.R.id.content);
            rootView.removeView(containerView);
            containerView = null;
        }
        super.handleOnDestroy();
    }
}

