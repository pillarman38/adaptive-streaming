package com.adaptivestreaming.app;

import android.net.Uri;
import android.view.View;
import android.view.ViewGroup;
import android.view.KeyEvent;
import android.view.View.OnFocusChangeListener;
import android.view.View.OnKeyListener;
import android.view.LayoutInflater;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ImageButton;
import android.widget.Button;
import android.widget.TextView;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.StateListDrawable;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.Drawable;
import android.graphics.PorterDuff;
import android.graphics.Color;
import android.view.Gravity;
import android.util.DisplayMetrics;
import androidx.media3.common.MediaItem;
import androidx.media3.common.Player;
import androidx.media3.common.Tracks;
import androidx.media3.common.TrackSelectionParameters;
import androidx.media3.common.TrackGroup;
import androidx.media3.common.TrackSelectionOverride;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector;
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector.SelectionOverride;
import androidx.media3.ui.PlayerView;
import java.util.Collections;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONException;
import com.adaptivestreaming.app.R;

@CapacitorPlugin(name = "ExoPlayer")
public class ExoPlayerPlugin extends Plugin {
    private ExoPlayer exoPlayer;
    private PlayerView playerView;
    private FrameLayout containerView;
    private DefaultTrackSelector trackSelector;
    private FrameLayout controlsView;
    private ProgressBar seekBar;
    private ImageButton playPauseBtn;
    private ImageButton skipBack30Btn;
    private ImageButton skipBack15Btn;
    private ImageButton skipForward15Btn;
    private ImageButton skipForward30Btn;
    private Button skipIntroBtn;
    private Button nextEpisodeBtn;
    private ImageButton audioTrackBtn;
    private TextView currentAudioTrackLabel;
    private LinearLayout audioTrackRow;
    private LinearLayout audioTrackListContainer;
    private LinearLayout audioTrackList;
    private java.util.List<Button> audioTrackButtons = new java.util.ArrayList<>();
    private int selectedAudioTrackIndex = -1;
    private boolean controlsVisible = false;
    private boolean isPaused = false;
    private boolean showSkipIntro = false;
    private boolean showNextEpisode = false;
    private PluginCall timeUpdateCall;
    private android.os.Handler timeUpdateHandler;
    private android.os.Handler controlsHideHandler;
    private Runnable timeUpdateRunnable;
    // private java.util.Map<String, PluginCall> eventListeners = new java.util.HashMap<>();

    @PluginMethod
    public void initialize(PluginCall call) {
        try {
            String containerId = call.getString("containerId", "videoContainer");

            getActivity().runOnUiThread(() -> {
                try {
                    // Get the root view of the activity
                    ViewGroup rootView = (ViewGroup) getActivity().findViewById(android.R.id.content);

                    // Create a container for ExoPlayer that will overlay the WebView
                    // Make it full screen - we'll handle controls visibility differently
                    containerView = new FrameLayout(getContext());
                    FrameLayout.LayoutParams containerParams = new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT
                    );
                    containerView.setLayoutParams(containerParams);
                    containerView.setTag(containerId);
                    // Set elevation to ensure proper layering
                    containerView.setElevation(1f);
                    // Make the container background transparent
                    containerView.setBackgroundColor(android.graphics.Color.TRANSPARENT);

                    // Add container to root view (will overlay WebView)
                    rootView.addView(containerView);

                    // Initialize ExoPlayer with track selector that excludes commentary tracks
                    DefaultTrackSelector trackSelector = new DefaultTrackSelector(getContext());
                    
                    exoPlayer = new ExoPlayer.Builder(getContext())
                        .setTrackSelector(trackSelector)
                        .build();
                    
                    // Store trackSelector as instance variable for later use
                    this.trackSelector = trackSelector;
                    
                    // Add listener to handle track selection and filter out commentary tracks
                    exoPlayer.addListener(new Player.Listener() {
                        @Override
                        public void onTracksChanged(Tracks tracks) {
                            // Update audio track UI when tracks change
                            updateAudioTrackUI(tracks);
                            
                            // When tracks are available, check if a commentary track is selected
                            for (Tracks.Group trackGroup : tracks.getGroups()) {
                                if (trackGroup.getType() == androidx.media3.common.C.TRACK_TYPE_AUDIO) {
                                    // Check if current selection is a commentary track
                                    for (int i = 0; i < trackGroup.length; i++) {
                                        if (trackGroup.isTrackSelected(i)) {
                                            androidx.media3.common.Format format = trackGroup.getTrackFormat(i);
                                            String label = format.label != null ? format.label.toLowerCase() : "";
                                            String language = format.language != null ? format.language.toLowerCase() : "";
                                            
                                            // Check for commentary indicators in label or language
                                            if (label.contains("commentary") || 
                                                label.contains("comment") ||
                                                language.contains("commentary") ||
                                                language.contains("comment")) {
                                                // This is a commentary track - find and select a non-commentary track
                                                for (int j = 0; j < trackGroup.length; j++) {
                                                    if (j != i) {
                                                        androidx.media3.common.Format otherFormat = trackGroup.getTrackFormat(j);
                                                        String otherLabel = otherFormat.label != null ? otherFormat.label.toLowerCase() : "";
                                                        String otherLanguage = otherFormat.language != null ? otherFormat.language.toLowerCase() : "";
                                                        
                                                        // If this track is not commentary, select it instead
                                                        if (!otherLabel.contains("commentary") && 
                                                            !otherLabel.contains("comment") &&
                                                            !otherLanguage.contains("commentary") &&
                                                            !otherLanguage.contains("comment")) {
                                                            // Select this non-commentary track using track selector
                                                            DefaultTrackSelector.Parameters currentParams = trackSelector.getParameters();
                                                            DefaultTrackSelector.Parameters.Builder paramsBuilder = currentParams.buildUpon();
                                                            
                                                            // Create override to select the non-commentary track
                                                            // We need to get the renderer index for audio tracks
                                                            int rendererIndex = -1;
                                                            for (int k = 0; k < exoPlayer.getRendererCount(); k++) {
                                                                if (exoPlayer.getRendererType(k) == androidx.media3.common.C.TRACK_TYPE_AUDIO) {
                                                                    rendererIndex = k;
                                                                    break;
                                                                }
                                                            }
                                                            
                                                            if (rendererIndex >= 0) {
                                                                // Use track selection override to select the non-commentary track
                                                                TrackGroup mediaTrackGroup = trackGroup.getMediaTrackGroup();
                                                                TrackSelectionOverride override = new TrackSelectionOverride(mediaTrackGroup, Collections.singletonList(j));
                                                                // Apply the track selection override directly to ExoPlayer
                                                                TrackSelectionParameters currentTrackParams = exoPlayer.getTrackSelectionParameters();
                                                                exoPlayer.setTrackSelectionParameters(
                                                                    currentTrackParams.buildUpon()
                                                                        .addOverride(override)
                                                                        .build()
                                                                );
                                                                android.util.Log.d("ExoPlayerPlugin", "Switched from commentary track to main audio track");
                                                                break;
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    });
                    playerView = new PlayerView(getContext());
                    playerView.setPlayer(exoPlayer);
                    playerView.setUseController(false);
                    // Ensure PlayerView fills its container
                    playerView.setResizeMode(androidx.media3.ui.AspectRatioFrameLayout.RESIZE_MODE_FILL);
                    
                    FrameLayout.LayoutParams playerParams = new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT
                    );
                    containerView.addView(playerView, playerParams);
                    
                    // Create native Android controls overlay
                    createControlsOverlay(containerView);

                    // Initialize handler for time updates
                    timeUpdateHandler = new android.os.Handler(android.os.Looper.getMainLooper());
                    
                    // Set up ExoPlayer listener for playback state changes
                    exoPlayer.addListener(new Player.Listener() {
                        @Override
                        public void onPlaybackStateChanged(int playbackState) {
                            if (playbackState == Player.STATE_READY || playbackState == Player.STATE_BUFFERING) {
                                // Start time updates when player is ready or buffering
                                startTimeUpdates();
                            } else if (playbackState == Player.STATE_ENDED) {
                                // Stop time updates when playback ends
                                stopTimeUpdates();
                            }
                        }
                        
                        @Override
                        public void onIsPlayingChanged(boolean isPlaying) {
                            if (isPlaying) {
                                // Start time updates when playing
                                startTimeUpdates();
                            } else {
                                // Stop time updates when paused
                                stopTimeUpdates();
                            }
                        }
                    });

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

    private void createControlsOverlay(FrameLayout container) {
        float density = getContext().getResources().getDisplayMetrics().density;
        int controlsHeight = (int)(200 * density);
        
        // Inflate the controls layout
        LayoutInflater inflater = LayoutInflater.from(getContext());
        controlsView = (FrameLayout) inflater.inflate(R.layout.exoplayer_controls_overlay, container, false);
        
        // Set layout parameters for the controls view
        FrameLayout.LayoutParams controlsParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            controlsHeight
        );
        controlsParams.gravity = Gravity.BOTTOM;
        controlsView.setLayoutParams(controlsParams);
        controlsView.setAlpha(1f); // Start visible
        controlsView.setVisibility(View.VISIBLE); // Start visible
        controlsView.setClickable(false); // Don't intercept clicks, let buttons handle them
        controlsView.setFocusable(false);
        controlsVisible = true;
        
        // Find views by ID
        LinearLayout seekContainer = controlsView.findViewById(R.id.seekContainer);
        seekBar = controlsView.findViewById(R.id.seekBar);
        playPauseBtn = controlsView.findViewById(R.id.playPauseBtn);
        skipBack30Btn = controlsView.findViewById(R.id.skipBack30Btn);
        skipBack15Btn = controlsView.findViewById(R.id.skipBack15Btn);
        skipForward15Btn = controlsView.findViewById(R.id.skipForward15Btn);
        skipForward30Btn = controlsView.findViewById(R.id.skipForward30Btn);
        skipIntroBtn = controlsView.findViewById(R.id.skipIntroBtn);
        nextEpisodeBtn = controlsView.findViewById(R.id.nextEpisodeBtn);
        audioTrackBtn = controlsView.findViewById(R.id.audioTrackBtn);
        currentAudioTrackLabel = controlsView.findViewById(R.id.currentAudioTrackLabel);
        audioTrackRow = controlsView.findViewById(R.id.audioTrackRow);
        audioTrackListContainer = controlsView.findViewById(R.id.audioTrackListContainer);
        audioTrackList = controlsView.findViewById(R.id.audioTrackList);
        
        // Set up seek bar
        seekBar.setMax(100);
        seekBar.setProgress(0);
        seekBar.getProgressDrawable().setColorFilter(Color.RED, android.graphics.PorterDuff.Mode.SRC_IN);
        
        // Make seek bar container clickable
        seekContainer.setOnClickListener(v -> {
            notifyListeners("seekBarClick", new JSObject());
        });
        
        // Set up button click listeners
        skipBack30Btn.setOnClickListener(v -> {
            skipBackward(30);
        });
        
        skipBack15Btn.setOnClickListener(v -> {
            skipBackward(15);
        });
        
        playPauseBtn.setOnClickListener(v -> {
            android.util.Log.d("ExoPlayerPlugin", ">>> playPauseBtn clicked <<<");
                getActivity().runOnUiThread(() -> {
                    if (isPaused && controlsVisible) {
                        exoPlayer.play();
                        isPaused = false;
                        playPauseBtn.setImageResource(android.R.drawable.ic_media_pause);
                        startTimeUpdates();
                    } else {
                        exoPlayer.pause();
                        isPaused = true;
                        playPauseBtn.setImageResource(android.R.drawable.ic_media_play);
                        stopTimeUpdates();
                    }
                });
            // sendEventToListener("playPause", new JSObject());
        });
        
        skipForward15Btn.setOnClickListener(v -> {
            skipForward(15);
        });
        
        skipForward30Btn.setOnClickListener(v -> {
            skipForward(30);
        });
        
        skipIntroBtn.setOnClickListener(v -> {
            sendEventToListener("skipIntro", new JSObject());
        });
        
        nextEpisodeBtn.setOnClickListener(v -> {
            sendEventToListener("getNextEp", new JSObject());
        });
        
        // Set up audio track selection button
        audioTrackBtn.setOnClickListener(v -> {
            toggleAudioTrackList();
        });
        
        // Set up focus change listener for audio track button to show/hide list
        audioTrackBtn.setOnFocusChangeListener(new OnFocusChangeListener() {
            @Override
            public void onFocusChange(View v, boolean hasFocus) {
                if (hasFocus && audioTrackListContainer != null && audioTrackListContainer.getVisibility() == View.GONE) {
                    // When button gets focus, show the track list
                    showAudioTrackList();
                } else if (!hasFocus && audioTrackListContainer != null && audioTrackListContainer.getVisibility() == View.VISIBLE) {
                    // When button loses focus and no item in list is focused, hide the list
                    boolean listItemFocused = false;
                    for (Button btn : audioTrackButtons) {
                        if (btn.hasFocus()) {
                            listItemFocused = true;
                            break;
                        }
                    }
                    if (!listItemFocused) {
                        hideAudioTrackList();
                    }
                }
            }
        });
        
        // Set up key listener for audio track button to navigate to list
        audioTrackBtn.setOnKeyListener(new View.OnKeyListener() {
            @Override
            public boolean onKey(View v, int keyCode, KeyEvent event) {
                if (event.getAction() == KeyEvent.ACTION_DOWN) {
                    if (keyCode == KeyEvent.KEYCODE_DPAD_DOWN || keyCode == KeyEvent.KEYCODE_DPAD_RIGHT) {
                        // Show list and focus first item
                        if (audioTrackListContainer != null && audioTrackListContainer.getVisibility() == View.GONE) {
                            showAudioTrackList();
                        } else if (!audioTrackButtons.isEmpty()) {
                            audioTrackButtons.get(0).requestFocus();
                        }
                        return true;
                    }
                }
                return false;
            }
        });
        
        // Set up button focus (for TV remote navigation)
        // The focus selector is already defined in XML, but we can add additional setup if needed
        setupButtonFocus(playPauseBtn);
        setupButtonFocus(skipBack30Btn);
        setupButtonFocus(skipBack15Btn);
        setupButtonFocus(skipForward15Btn);
        setupButtonFocus(skipForward30Btn);
        setupButtonFocus(skipIntroBtn);
        setupButtonFocus(nextEpisodeBtn);
        setupButtonFocus(audioTrackBtn);
        
        // Add controls to container
        container.addView(controlsView);
        
        // Set up key listener to handle D-pad and Enter keys (Nvidia Shield remote)
        // Must set focusable and request focus BEFORE setting the key listener
        containerView.setFocusable(true);
        containerView.setFocusableInTouchMode(false); // For TV remotes, don't need touch mode
        containerView.requestFocus(); // Request focus so it can receive key events
        
        containerView.setOnKeyListener(new View.OnKeyListener() {
            @Override
            public boolean onKey(View v, int keyCode, KeyEvent event) {
                if (event.getAction() == KeyEvent.ACTION_DOWN) {
                    // Handle D-pad navigation keys - show controls (or reset timer if already visible)
                    if (keyCode == KeyEvent.KEYCODE_DPAD_UP || 
                        keyCode == KeyEvent.KEYCODE_DPAD_DOWN || 
                        keyCode == KeyEvent.KEYCODE_DPAD_LEFT || 
                        keyCode == KeyEvent.KEYCODE_DPAD_RIGHT) {
                        // Show controls (or reset timer if already visible)
                        android.util.Log.d("ExoPlayerPlugin", "D-pad key pressed (keyCode: " + keyCode + ") - controlsVisible: " + controlsVisible + ", showing controls");
                        showControls(null);
                        // Don't consume the event - let focus navigation work
                        return false;
                    }
                    
                    // Handle Enter/Select button from Nvidia Shield remote
                    if (keyCode == KeyEvent.KEYCODE_DPAD_CENTER || keyCode == KeyEvent.KEYCODE_ENTER) {
                        // Only handle if controls are not visible
                        // If controls are visible, let the buttons handle Enter normally
                        if (!controlsVisible && exoPlayer != null) {
                            getActivity().runOnUiThread(() -> {
                                // Pause the video if it's playing
                                if (!isPaused) {
                                    exoPlayer.pause();
                                    isPaused = true;
                                    if (playPauseBtn != null) {
                                        playPauseBtn.setImageResource(android.R.drawable.ic_media_play);
                                    }
                                    stopTimeUpdates();
                                }
                                // Show controls
                                showControls(null);
                            });
                            android.util.Log.d("ExoPlayerPlugin", "Enter pressed - paused video and showing controls");
                            return true; // Consume the event
                        }
                        // If controls are visible, return false to let buttons handle it
                        return false;
                    }
                }
                return false; // Let other key events propagate
            }
        });
        // containerView.setOnTouchListener(new View.OnTouchListener() {
        //     @Override
        //     public boolean onTouch(View v, android.view.MotionEvent event) {
        //         // Check if touch is on a button - if so, don't handle it
        //         if (controlsView != null && controlsView.getVisibility() == View.VISIBLE) {
        //             // Check if touch is within controlsView bounds
        //             int[] location = new int[2];
        //             controlsView.getLocationOnScreen(location);
        //             int x = (int) event.getRawX();
        //             int y = (int) event.getRawY();
        //             int left = location[0];
        //             int top = location[1];
        //             int right = left + controlsView.getWidth();
        //             int bottom = top + controlsView.getHeight();
                    
        //             if (x >= left && x <= right && y >= top && y <= bottom) {
        //                 // Touch is on controls - let buttons handle it
        //                 android.util.Log.d("ExoPlayerPlugin", "Touch on controls, letting buttons handle");
        //                 return false;
        //             }
        //         }
                
        //         if (event.getAction() == android.view.MotionEvent.ACTION_UP) {
        //             // Toggle controls visibility on tap (only if not on controls)
        //             if (controlsVisible) {
        //                 hideControls(null);
        //             } else {
        //                 showControls(null);
        //             }
        //         }
        //         return false; // Let video handle other touches
        //     }
        // });
        
        // Ensure containerView maintains focus even when controls are hidden
        // This allows key events to be received at all times
        containerView.setOnFocusChangeListener(new OnFocusChangeListener() {
            @Override
            public void onFocusChange(View v, boolean hasFocus) {
                if (!hasFocus && !controlsVisible) {
                    // Re-request focus if we lose it when controls are hidden
                    // This ensures we can still receive D-pad key events
                    if (containerView != null) {
                        containerView.post(() -> {
                            if (containerView != null) {
                                containerView.requestFocus();
                            }
                        });
                    }
                }
            }
        });
        
        // containerView.setOnKeyListener(new View.OnKeyListener() {
        //     @Override
        //     public boolean onKey(View v, int keyCode, KeyEvent event) {
        //         if (event.getAction() == KeyEvent.ACTION_DOWN) {
        //             // Handle Enter/Select button from Nvidia Shield remote
        //             if (keyCode == KeyEvent.KEYCODE_DPAD_CENTER || keyCode == KeyEvent.KEYCODE_ENTER) {
        //                 // Only handle if controls are not visible
        //                 // If controls are visible, let the buttons handle Enter normally
        //                 if (!controlsVisible && exoPlayer != null) {
        //                     getActivity().runOnUiThread(() -> {
        //                         // Pause the video if it's playing
        //                         if (!isPaused) {
        //                             exoPlayer.pause();
        //                             isPaused = true;
        //                             if (playPauseBtn != null) {
        //                                 playPauseBtn.setImageResource(android.R.drawable.ic_media_play);
        //                             }
        //                             stopTimeUpdates();
        //                         }
        //                         // Show controls
        //                         showControls(null);
        //                     });
        //                     android.util.Log.d("ExoPlayerPlugin", "Enter pressed - paused video and showing controls");
        //                     return true; // Consume the event
        //                 }
        //                 // If controls are visible, return false to let buttons handle it
        //                 return false;
        //             }
        //         }
        //         return false; // Let other key events propagate
        //     }
        // });
        
        // Initialize controls hide handler
        controlsHideHandler = new android.os.Handler(android.os.Looper.getMainLooper());
        
        // Auto-hide controls after 5 seconds (controls start visible)
        controlsHideHandler.postDelayed(() -> hideControls(null), 5000);
    }
    
    private JSObject createSkipObject(int seconds) {
        JSObject obj = new JSObject();
        obj.put("skipBy", seconds);
        return obj;
    }
    
    private void skipForward(int seconds) {
        if (exoPlayer == null) {
            return;
        }
        long currentPosition = exoPlayer.getCurrentPosition();
        long duration = exoPlayer.getDuration();
        long newPosition = currentPosition + (seconds * 1000L); // Convert seconds to milliseconds
        if (newPosition > duration) {
            newPosition = duration;
        }
        exoPlayer.seekTo(newPosition);
        android.util.Log.d("ExoPlayerPlugin", "Skipped forward " + seconds + " seconds to position " + newPosition);
    }
    
    private void skipBackward(int seconds) {
        if (exoPlayer == null) {
            return;
        }
        long currentPosition = exoPlayer.getCurrentPosition();
        long newPosition = currentPosition - (seconds * 1000L); // Convert seconds to milliseconds
        if (newPosition < 0) {
            newPosition = 0;
        }
        exoPlayer.seekTo(newPosition);
        android.util.Log.d("ExoPlayerPlugin", "Skipped backward " + seconds + " seconds to position " + newPosition);
    }
    
    private void sendEventToListener(String eventName, JSObject data) {
        android.util.Log.d("ExoPlayerPlugin", "sendEventToListener called for: " + eventName);
        
        // Try Capacitor's notifyListeners first - this should work if listeners are registered
        notifyListeners(eventName, data);
    }
    
    private void updateAudioTrackUI(Tracks tracks) {
        if (audioTrackRow == null || exoPlayer == null) {
            android.util.Log.d("ExoPlayerPlugin", "updateAudioTrackUI: audioTrackRow or exoPlayer is null");
            return;
        }
        
        getActivity().runOnUiThread(() -> {
            // Find audio tracks
            for (Tracks.Group trackGroup : tracks.getGroups()) {
                if (trackGroup.getType() == androidx.media3.common.C.TRACK_TYPE_AUDIO) {
                    android.util.Log.d("ExoPlayerPlugin", "Found audio track group with " + trackGroup.length + " tracks");
                    // Show audio track selection UI if there are multiple audio tracks
                    if (trackGroup.length > 1) {
                        android.util.Log.d("ExoPlayerPlugin", "Showing audio track selection UI - multiple tracks available");
                        audioTrackRow.setVisibility(View.VISIBLE);
                        
                        // Update current track label
                        for (int i = 0; i < trackGroup.length; i++) {
                            if (trackGroup.isTrackSelected(i)) {
                                androidx.media3.common.Format format = trackGroup.getTrackFormat(i);
                                String trackName = format.label != null ? format.label : 
                                    (format.language != null ? format.language : "Track " + (i + 1));
                                if (currentAudioTrackLabel != null) {
                                    currentAudioTrackLabel.setText("Audio: " + trackName);
                                    currentAudioTrackLabel.setVisibility(View.VISIBLE);
                                }
                                android.util.Log.d("ExoPlayerPlugin", "Current audio track: " + trackName);
                                selectedAudioTrackIndex = i;
                                break;
                            }
                        }
                        
                        // Populate audio track list
                        populateAudioTrackList(trackGroup);
                    } else {
                        // Hide audio track selection if only one track
                        android.util.Log.d("ExoPlayerPlugin", "Hiding audio track selection UI - only one track");
                        audioTrackRow.setVisibility(View.GONE);
                        hideAudioTrackList();
                    }
                    break;
                }
            }
        });
    }
    
    private void populateAudioTrackList(Tracks.Group trackGroup) {
        if (audioTrackList == null) {
            return;
        }
        
        getActivity().runOnUiThread(() -> {
            // Clear existing buttons
            audioTrackList.removeAllViews();
            audioTrackButtons.clear();
            
            // Create a button for each audio track
            for (int i = 0; i < trackGroup.length; i++) {
                androidx.media3.common.Format format = trackGroup.getTrackFormat(i);
                String trackName = format.label != null ? format.label : 
                    (format.language != null ? format.language : "Track " + (i + 1));
                boolean isSelected = trackGroup.isTrackSelected(i);
                
                Button trackButton = new Button(getContext());
                trackButton.setText(trackName);
                trackButton.setTextColor(isSelected ? Color.YELLOW : Color.WHITE);
                trackButton.setBackgroundColor(isSelected ? Color.argb(100, 255, 255, 0) : Color.TRANSPARENT);
                trackButton.setPadding((int)(20 * getContext().getResources().getDisplayMetrics().density), 
                                       (int)(15 * getContext().getResources().getDisplayMetrics().density),
                                       (int)(20 * getContext().getResources().getDisplayMetrics().density),
                                       (int)(15 * getContext().getResources().getDisplayMetrics().density));
                
                LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                );
                params.setMargins(0, (int)(5 * getContext().getResources().getDisplayMetrics().density), 0, 0);
                trackButton.setLayoutParams(params);
                
                trackButton.setFocusable(true);
                trackButton.setFocusableInTouchMode(true);
                setupButtonFocus(trackButton);
                
                final int trackIndex = i;
                trackButton.setOnClickListener(v -> {
                    selectAudioTrack(trackIndex);
                });
                
                // Set up focus change listener to update selection
                trackButton.setOnFocusChangeListener(new OnFocusChangeListener() {
                    @Override
                    public void onFocusChange(View v, boolean hasFocus) {
                        if (hasFocus) {
                            // Highlight focused item
                            trackButton.setBackgroundColor(Color.argb(150, 255, 255, 255));
                        } else {
                            // Reset to normal or selected state
                            boolean isCurrentlySelected = trackIndex == selectedAudioTrackIndex;
                            trackButton.setBackgroundColor(isCurrentlySelected ? Color.argb(100, 255, 255, 0) : Color.TRANSPARENT);
                            trackButton.setTextColor(isCurrentlySelected ? Color.YELLOW : Color.WHITE);
                        }
                    }
                });
                
                // Set up key listener for navigation
                trackButton.setOnKeyListener(new View.OnKeyListener() {
                    @Override
                    public boolean onKey(View v, int keyCode, KeyEvent event) {
                        if (event.getAction() == KeyEvent.ACTION_DOWN) {
                            if (keyCode == KeyEvent.KEYCODE_DPAD_UP) {
                                // Move focus to previous item or back to button
                                if (trackIndex > 0) {
                                    audioTrackButtons.get(trackIndex - 1).requestFocus();
                                } else {
                                    audioTrackBtn.requestFocus();
                                }
                                return true;
                            } else if (keyCode == KeyEvent.KEYCODE_DPAD_DOWN) {
                                // Move focus to next item
                                if (trackIndex < audioTrackButtons.size() - 1) {
                                    audioTrackButtons.get(trackIndex + 1).requestFocus();
                                }
                                return true;
                            } else if (keyCode == KeyEvent.KEYCODE_DPAD_LEFT || keyCode == KeyEvent.KEYCODE_BACK) {
                                // Move focus back to audio track button
                                audioTrackBtn.requestFocus();
                                return true;
                            } else if (keyCode == KeyEvent.KEYCODE_DPAD_CENTER || keyCode == KeyEvent.KEYCODE_ENTER) {
                                // Select this track
                                selectAudioTrack(trackIndex);
                                return true;
                            }
                        }
                        return false;
                    }
                });
                
                audioTrackList.addView(trackButton);
                audioTrackButtons.add(trackButton);
            }
        });
    }
    
    private void toggleAudioTrackList() {
        if (audioTrackListContainer == null) {
            return;
        }
        
        getActivity().runOnUiThread(() -> {
            if (audioTrackListContainer.getVisibility() == View.VISIBLE) {
                hideAudioTrackList();
            } else {
                showAudioTrackList();
            }
        });
    }
    
    private void showAudioTrackList() {
        if (audioTrackListContainer == null || audioTrackList == null) {
            return;
        }
        
        getActivity().runOnUiThread(() -> {
            audioTrackListContainer.setVisibility(View.VISIBLE);
            // Focus the first track button or currently selected one
            if (!audioTrackButtons.isEmpty()) {
                int focusIndex = selectedAudioTrackIndex >= 0 && selectedAudioTrackIndex < audioTrackButtons.size() 
                    ? selectedAudioTrackIndex : 0;
                audioTrackButtons.get(focusIndex).requestFocus();
            }
        });
    }
    
    private void hideAudioTrackList() {
        if (audioTrackListContainer == null) {
            return;
        }
        
        getActivity().runOnUiThread(() -> {
            audioTrackListContainer.setVisibility(View.GONE);
        });
    }
    
    private void selectAudioTrack(int trackIndex) {
        if (exoPlayer == null || trackSelector == null) {
            return;
        }
        
        Tracks tracks = exoPlayer.getCurrentTracks();
        if (tracks == null) {
            return;
        }
        
        // Find audio tracks
        Tracks.Group audioTrackGroup = null;
        for (Tracks.Group trackGroup : tracks.getGroups()) {
            if (trackGroup.getType() == androidx.media3.common.C.TRACK_TYPE_AUDIO) {
                audioTrackGroup = trackGroup;
                break;
            }
        }
        
        if (audioTrackGroup == null || trackIndex < 0 || trackIndex >= audioTrackGroup.length) {
            return;
        }
        
        // Extract format information before lambda (must be final or effectively final)
        final Tracks.Group finalAudioTrackGroup = audioTrackGroup;
        final int finalTrackIndex = trackIndex;
        androidx.media3.common.Format format = audioTrackGroup.getTrackFormat(trackIndex);
        final String trackName = format.label != null ? format.label : 
            (format.language != null ? format.language : "Track " + (trackIndex + 1));
        
        // Select the track
        final TrackGroup mediaTrackGroup = audioTrackGroup.getMediaTrackGroup();
        TrackSelectionOverride override = new TrackSelectionOverride(mediaTrackGroup, Collections.singletonList(trackIndex));
        TrackSelectionParameters currentTrackParams = exoPlayer.getTrackSelectionParameters();
        exoPlayer.setTrackSelectionParameters(
            currentTrackParams.buildUpon()
                .addOverride(override)
                .build()
        );
        
        selectedAudioTrackIndex = trackIndex;
        
        // Update UI
        getActivity().runOnUiThread(() -> {
            // Update button colors
            for (int i = 0; i < audioTrackButtons.size(); i++) {
                Button btn = audioTrackButtons.get(i);
                if (i == finalTrackIndex) {
                    btn.setTextColor(Color.YELLOW);
                    btn.setBackgroundColor(Color.argb(100, 255, 255, 0));
                } else {
                    btn.setTextColor(Color.WHITE);
                    btn.setBackgroundColor(Color.TRANSPARENT);
                }
            }
            
            // Update label
            if (currentAudioTrackLabel != null) {
                currentAudioTrackLabel.setText("Audio: " + trackName);
            }
        });
        
        android.util.Log.d("ExoPlayerPlugin", "Selected audio track: " + trackIndex);
    }
    
    private void showAudioTrackSelectionDialog() {
        if (exoPlayer == null || trackSelector == null) {
            return;
        }
        
        Tracks tracks = exoPlayer.getCurrentTracks();
        if (tracks == null) {
            return;
        }
        
        // Find audio tracks
        Tracks.Group audioTrackGroup = null;
        for (Tracks.Group trackGroup : tracks.getGroups()) {
            if (trackGroup.getType() == androidx.media3.common.C.TRACK_TYPE_AUDIO) {
                audioTrackGroup = trackGroup;
                break;
            }
        }
        
        if (audioTrackGroup == null || audioTrackGroup.length <= 1) {
            return;
        }
        
        // Create dialog with audio track options
        android.app.AlertDialog.Builder builder = new android.app.AlertDialog.Builder(getContext());
        builder.setTitle("Select Audio Track");
        
        // Create array of track names
        String[] trackNames = new String[audioTrackGroup.length];
        for (int i = 0; i < audioTrackGroup.length; i++) {
            androidx.media3.common.Format format = audioTrackGroup.getTrackFormat(i);
            String trackName = format.label != null ? format.label : 
                (format.language != null ? format.language : "Track " + (i + 1));
            trackNames[i] = trackName;
        }
        
        // Find currently selected track index
        int selectedIndex = -1;
        for (int i = 0; i < audioTrackGroup.length; i++) {
            if (audioTrackGroup.isTrackSelected(i)) {
                selectedIndex = i;
                break;
            }
        }
        
        // Store mediaTrackGroup as final for use in lambda
        final TrackGroup mediaTrackGroup = audioTrackGroup.getMediaTrackGroup();
        
        // Set up click listener
        builder.setSingleChoiceItems(trackNames, selectedIndex, (dialog, which) -> {
            // Get renderer index for audio tracks
            int rendererIndex = -1;
            for (int k = 0; k < exoPlayer.getRendererCount(); k++) {
                if (exoPlayer.getRendererType(k) == androidx.media3.common.C.TRACK_TYPE_AUDIO) {
                    rendererIndex = k;
                    break;
                }
            }
            
            if (rendererIndex >= 0) {
                // Select the chosen track
                TrackSelectionOverride override = new TrackSelectionOverride(mediaTrackGroup, Collections.singletonList(which));
                // Apply the track selection override directly to ExoPlayer
                TrackSelectionParameters currentTrackParams = exoPlayer.getTrackSelectionParameters();
                exoPlayer.setTrackSelectionParameters(
                    currentTrackParams.buildUpon()
                        .addOverride(override)
                        .build()
                );
                
                android.util.Log.d("ExoPlayerPlugin", "Selected audio track: " + trackNames[which]);
            }
            
            dialog.dismiss();
        });
        
        builder.setNegativeButton("Cancel", null);
        builder.show();
    }
    
    private void startTimeUpdates() {
        if (exoPlayer == null || timeUpdateHandler == null) {
            return;
        }
        
        // Stop any existing time update loop
        stopTimeUpdates();
        
        // Create and start the time update runnable
        timeUpdateRunnable = new Runnable() {
            @Override
            public void run() {
                if (exoPlayer != null && exoPlayer.isPlaying()) {
                    long currentPosition = exoPlayer.getCurrentPosition();
                    long duration = exoPlayer.getDuration();
                    
                    // Send time update event
                    JSObject timeData = new JSObject();
                    timeData.put("currentTime", currentPosition / 1000.0); // Convert to seconds
                    timeData.put("duration", duration > 0 ? duration / 1000.0 : 0); // Convert to seconds
                    
                    // Calculate progress percentage for seek bar
                    final int progress = duration > 0 ? (int) ((currentPosition * 100) / duration) : 0;
                    timeData.put("progress", progress);
                    
                    // Update seek bar on UI thread
                    if (seekBar != null) {
                        final ProgressBar seekBarRef = seekBar; // Create final reference for lambda
                        getActivity().runOnUiThread(() -> {
                            seekBarRef.setProgress(progress);
                        });
                    }
                    
                    // Send event to JavaScript
                    notifyListeners("timeupdate", timeData);
                    
                    // Schedule next update (every 250ms for smooth updates)
                    if (timeUpdateHandler != null) {
                        timeUpdateHandler.postDelayed(this, 250);
                    }
                }
            }
        };
        
        // Start the time update loop
        timeUpdateHandler.post(timeUpdateRunnable);
    }
    
    private void stopTimeUpdates() {
        if (timeUpdateHandler != null && timeUpdateRunnable != null) {
            timeUpdateHandler.removeCallbacks(timeUpdateRunnable);
            timeUpdateRunnable = null;
        }
    }
    
    private void setupButtonFocus(View button) {
        // Make button focusable for TV remote navigation
        button.setFocusable(true);
        button.setFocusableInTouchMode(true);
        
        // Create focus highlight drawable
        GradientDrawable focusDrawable = new GradientDrawable();
        focusDrawable.setShape(GradientDrawable.RECTANGLE);
        focusDrawable.setCornerRadius(8f);
        focusDrawable.setStroke(4, Color.WHITE); // White border when focused
        focusDrawable.setColor(Color.argb(50, 255, 255, 255)); // Semi-transparent white background
        
        // Create normal state drawable (transparent)
        GradientDrawable normalDrawable = new GradientDrawable();
        normalDrawable.setShape(GradientDrawable.RECTANGLE);
        normalDrawable.setCornerRadius(8f);
        normalDrawable.setColor(Color.TRANSPARENT);
        
        // Create state list drawable
        StateListDrawable stateListDrawable = new StateListDrawable();
        stateListDrawable.addState(new int[]{android.R.attr.state_focused}, focusDrawable);
        stateListDrawable.addState(new int[]{}, normalDrawable);
        
        // Set as background
        button.setBackground(stateListDrawable);
        
        // Add focus change listener to update appearance
        button.setOnFocusChangeListener(new OnFocusChangeListener() {
            @Override
            public void onFocusChange(View v, boolean hasFocus) {
                if (hasFocus) {
                    // Scale up slightly when focused
                    v.setScaleX(1.1f);
                    v.setScaleY(1.1f);
                } else {
                    // Scale back to normal
                    v.setScaleX(1.0f);
                    v.setScaleY(1.0f);
                }
            }
        });
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
            isPaused = false;
            if (playPauseBtn != null) {
                playPauseBtn.setImageResource(android.R.drawable.ic_media_pause);
            }
            // Start time updates when playing
            startTimeUpdates();
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
            isPaused = true;
            if (playPauseBtn != null) {
                playPauseBtn.setImageResource(android.R.drawable.ic_media_play);
            }
            // Stop time updates when paused
            stopTimeUpdates();
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
    public void showControls(PluginCall call) {
        if (controlsView == null) {
            if (call != null) call.resolve();
            return;
        }
        
        getActivity().runOnUiThread(() -> {
            // Always set visibility first (in case it was GONE)
            controlsView.setVisibility(View.VISIBLE);
            controlsVisible = true;
            
            // Animate alpha to visible
            controlsView.animate()
                .alpha(1f)
                .setDuration(300)
                .start();
            
            // Request focus on the play/pause button when controls are shown
            // (even though it's visually in the center, it should be first in focus order)
            if (playPauseBtn != null) {
                playPauseBtn.requestFocus();
            }
            
            // Always reset auto-hide timer (even if already visible)
            // This ensures controls stay visible for 5 seconds after any D-pad press
            if (controlsHideHandler != null) {
                controlsHideHandler.removeCallbacksAndMessages(null);
                controlsHideHandler.postDelayed(() -> hideControls(null), 5000);
            }
            
            android.util.Log.d("ExoPlayerPlugin", "showControls called - visibility: " + controlsView.getVisibility() + ", alpha: " + controlsView.getAlpha() + ", controlsVisible: " + controlsVisible);
        });
        
        if (call != null) call.resolve();
    }
    
    @PluginMethod
    public void hideControls(PluginCall call) {
        if (controlsView == null) {
            if (call != null) call.resolve();
            return;
        }
        
        getActivity().runOnUiThread(() -> {
            controlsVisible = false;
            controlsView.animate()
                .alpha(0f)
                .setDuration(300)
                .withEndAction(() -> {
                    controlsView.setVisibility(View.GONE);
                    // Re-request focus on containerView when controls are hidden
                    // This ensures we can still receive D-pad key events
                    if (containerView != null) {
                        containerView.requestFocus();
                    }
                    android.util.Log.d("ExoPlayerPlugin", "Controls hidden - visibility: GONE, re-requested focus on containerView");
                })
                .start();
        });
        
        if (call != null) call.resolve();
    }
    
    @PluginMethod
    public void updateSeekBar(PluginCall call) {
        if (seekBar == null) {
            call.resolve();
            return;
        }
        
        try {
            int progress = call.getInt("progress", 0);
            getActivity().runOnUiThread(() -> {
                seekBar.setProgress(progress);
            });
            call.resolve();
        } catch (Exception e) {
            call.reject("Error updating seek bar: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void setPaused(PluginCall call) {
        if (playPauseBtn == null) {
            call.resolve();
            return;
        }
        
        try {
            boolean paused = call.getBoolean("paused", false);
            isPaused = paused;
            getActivity().runOnUiThread(() -> {
                if (paused) {
                    playPauseBtn.setImageResource(android.R.drawable.ic_media_play);
                } else {
                    playPauseBtn.setImageResource(android.R.drawable.ic_media_pause);
                }
            });
            call.resolve();
        } catch (Exception e) {
            call.reject("Error setting paused state: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void setShowSkipIntro(PluginCall call) {
        if (skipIntroBtn == null) {
            call.resolve();
            return;
        }
        
        try {
            boolean show = call.getBoolean("show", false);
            showSkipIntro = show;
            getActivity().runOnUiThread(() -> {
                skipIntroBtn.setVisibility(show ? View.VISIBLE : View.GONE);
            });
            call.resolve();
        } catch (Exception e) {
            call.reject("Error setting skip intro visibility: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void setShowNextEpisode(PluginCall call) {
        if (nextEpisodeBtn == null) {
            call.resolve();
            return;
        }
        
        try {
            boolean show = call.getBoolean("show", false);
            showNextEpisode = show;
            getActivity().runOnUiThread(() -> {
                nextEpisodeBtn.setVisibility(show ? View.VISIBLE : View.GONE);
            });
            call.resolve();
        } catch (Exception e) {
            call.reject("Error setting next episode visibility: " + e.getMessage());
        }
    }
    
    private void updateSeekBarProgress(int currentTime, int duration) {
        if (seekBar != null && duration > 0) {
            int progress = (int)((currentTime * 100.0) / duration);
            getActivity().runOnUiThread(() -> {
                seekBar.setProgress(progress);
            });
        }
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

