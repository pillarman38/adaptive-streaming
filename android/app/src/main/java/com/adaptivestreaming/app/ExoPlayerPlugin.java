package com.adaptivestreaming.app;

import android.net.Uri;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.view.View;
import android.view.ViewGroup;
import android.view.KeyEvent;
import android.view.View.OnFocusChangeListener;
import android.view.View.OnKeyListener;
import android.view.LayoutInflater;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.SeekBar;
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
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Tracks;
import androidx.media3.common.TrackSelectionParameters;
import androidx.media3.common.TrackGroup;
import androidx.media3.common.TrackSelectionOverride;
import androidx.media3.exoplayer.ExoPlayer;
import android.util.Log;
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector;
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector.SelectionOverride;
import androidx.media3.ui.PlayerView;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.datasource.HttpDataSource;
import androidx.media3.exoplayer.source.ProgressiveMediaSource;
import androidx.media3.exoplayer.source.MediaSource;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONException;
import org.json.JSONObject;
import org.json.JSONArray;
import com.adaptivestreaming.app.R;
import androidx.core.content.FileProvider;

@CapacitorPlugin(name = "ExoPlayer")
public class ExoPlayerPlugin extends Plugin {
    private static final String TAG = "ExoPlayerPlugin";
    private ExoPlayer exoPlayer;
    private PlayerView playerView;
    private FrameLayout containerView;
    private DefaultTrackSelector trackSelector;
    private FrameLayout controlsView;
    private SeekBar seekBar;
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
    private volatile boolean isShowingAudioTrackList = false; // Flag to prevent hideControls from hiding audio list
    private volatile boolean suppressAutoShowAudioList = false; // Flag to prevent auto-showing list when button gets focus programmatically
    private boolean isPaused = false;
    private boolean showSkipIntro = false;
    private boolean showNextEpisode = false;
    private PluginCall timeUpdateCall;
    private android.os.Handler timeUpdateHandler;
    private android.os.Handler controlsHideHandler;
    private Runnable timeUpdateRunnable;
    private volatile boolean isSeeking = false;
    private long pendingSeekPosition = -1;
    private boolean wasPlayingBeforeSeek = false;
    private SeekBar.OnSeekBarChangeListener seekBarChangeListener = null;
    private long lastSeekTime = 0;
    private long lastManualSkipTime = 0; // Timestamp when skip button was pressed
    private long seekStartTime = 0; // Timestamp when seeking started
    private static final long SEEK_COOLDOWN_MS = 300; // Don't update seekbar for 300ms after a seek
    private static final long MANUAL_SKIP_COOLDOWN_MS = 500; // Don't let time updates override manual skips for 500ms
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

                    // exoPlayer = new ExoPlayer.Builder(getContext())
                    //     .setTrackSelector(trackSelector)
                    //     .build();

                    // Store trackSelector as instance variable for later use
                    // this.trackSelector = trackSelector;

                    // Add listener to handle track selection and filter out commentary tracks
                    // exoPlayer.addListener(new Player.Listener() {
                    //     @Override
                    //     public void onTracksChanged(Tracks tracks) {
                    //         // Update audio track UI when tracks change
                    //         updateAudioTrackUI(tracks);

                    //         // When tracks are available, check if a commentary track is selected
                    //         for (Tracks.Group trackGroup : tracks.getGroups()) {
                    //             if (trackGroup.getType() == androidx.media3.common.C.TRACK_TYPE_AUDIO) {
                    //                 // Check if current selection is a commentary track
                    //                 for (int i = 0; i < trackGroup.length; i++) {
                    //                     if (trackGroup.isTrackSelected(i)) {
                    //                         androidx.media3.common.Format format = trackGroup.getTrackFormat(i);
                    //                         String label = format.label != null ? format.label.toLowerCase() : "";
                    //                         String language = format.language != null ? format.language.toLowerCase() : "";

                    //                         // Check for commentary indicators in label or language
                    //                         if (label.contains("commentary") ||
                    //                             label.contains("comment") ||
                    //                             language.contains("commentary") ||
                    //                             language.contains("comment")) {
                    //                             // This is a commentary track - find and select a non-commentary track
                    //                             for (int j = 0; j < trackGroup.length; j++) {
                    //                                 if (j != i) {
                    //                                     androidx.media3.common.Format otherFormat = trackGroup.getTrackFormat(j);
                    //                                     String otherLabel = otherFormat.label != null ? otherFormat.label.toLowerCase() : "";
                    //                                     String otherLanguage = otherFormat.language != null ? otherFormat.language.toLowerCase() : "";

                    //                                     // If this track is not commentary, select it instead
                    //                                     if (!otherLabel.contains("commentary") &&
                    //                                         !otherLabel.contains("comment") &&
                    //                                         !otherLanguage.contains("commentary") &&
                    //                                         !otherLanguage.contains("comment")) {
                    //                                         // Select this non-commentary track using track selector
                    //                                         DefaultTrackSelector.Parameters currentParams = trackSelector.getParameters();
                    //                                         DefaultTrackSelector.Parameters.Builder paramsBuilder = currentParams.buildUpon();

                    //                                         // Create override to select the non-commentary track
                    //                                         // We need to get the renderer index for audio tracks
                    //                                         int rendererIndex = -1;
                    //                                         for (int k = 0; k < exoPlayer.getRendererCount(); k++) {
                    //                                             if (exoPlayer.getRendererType(k) == androidx.media3.common.C.TRACK_TYPE_AUDIO) {
                    //                                                 rendererIndex = k;
                    //                                                 break;
                    //                                             }
                    //                                         }

                    //                                         if (rendererIndex >= 0) {
                    //                                             // Use track selection override to select the non-commentary track
                    //                                             TrackGroup mediaTrackGroup = trackGroup.getMediaTrackGroup();
                    //                                             TrackSelectionOverride override = new TrackSelectionOverride(mediaTrackGroup, Collections.singletonList(j));
                    //                                             // Apply the track selection override directly to ExoPlayer
                    //                                             TrackSelectionParameters currentTrackParams = exoPlayer.getTrackSelectionParameters();
                    //                                             exoPlayer.setTrackSelectionParameters(
                    //                                                 currentTrackParams.buildUpon()
                    //                                                     .addOverride(override)
                    //                                                     .build()
                    //                                             );
                    //                                             android.util.Log.d("ExoPlayerPlugin", "Switched from commentary track to main audio track");
                    //                                             break;
                    //                                         }
                    //                                     }
                    //                                 }
                    //                             }
                    //                         }
                    //                     }
                    //                 }
                    //             }
                    //         }
                    //     }
                    // });

                    // ExoPlayer will be initialized in loadVideo method
                    // Create PlayerView but don't set player yet (will be set in loadVideo)
                    playerView = new PlayerView(getContext());
                    // playerView.setPlayer(exoPlayer); // Will be set after ExoPlayer is created
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

                    // ExoPlayer listener will be set up in loadVideo after ExoPlayer is created
                    // Set up ExoPlayer listener for playback state changes
                    // exoPlayer.addListener(new Player.Listener() {
                    //     @Override
                    //     public void onPlaybackStateChanged(int playbackState) {
                    //         if (playbackState == Player.STATE_READY || playbackState == Player.STATE_BUFFERING) {
                    //             // Start time updates when player is ready or buffering
                    //             startTimeUpdates();
                    //         } else if (playbackState == Player.STATE_ENDED) {
                    //             // Stop time updates when playback ends
                    //             stopTimeUpdates();
                    //         }
                    //     }
                    //
                    //     @Override
                    //     public void onIsPlayingChanged(boolean isPlaying) {
                    //         if (isPlaying) {
                    //             // Start time updates when playing
                    //             startTimeUpdates();
                    //         } else {
                    //             // Stop time updates when paused
                    //             stopTimeUpdates();
                    //         }
                    //     }
                    // });

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
        
        // Create audio track list container as a separate full-screen overlay
        createAudioTrackListContainer(container);

        // Set up seek bar with high precision (10000 = 0.01% precision)
        // This prevents rounding issues where small skips near the end don't move the seekbar
        seekBar.setMax(10000);
        seekBar.setProgress(0);
        seekBar.getProgressDrawable().setColorFilter(Color.RED, android.graphics.PorterDuff.Mode.SRC_IN);
        seekBar.getThumb().setColorFilter(Color.RED, android.graphics.PorterDuff.Mode.SRC_IN);
        
        // Make seekbar focusable for keyboard/remote navigation
        seekBar.setFocusable(true);
        seekBar.setFocusableInTouchMode(true);
        
        // Add key listener to seekbar for Enter key handling
        seekBar.setOnKeyListener(new View.OnKeyListener() {
            @Override
            public boolean onKey(View v, int keyCode, KeyEvent event) {
                if (event.getAction() == KeyEvent.ACTION_DOWN) {
                    // Handle Enter/Select button to perform seek
                    if (keyCode == KeyEvent.KEYCODE_DPAD_CENTER || keyCode == KeyEvent.KEYCODE_ENTER) {
                        // User pressed Enter on seekbar - perform the seek
                        boolean wasSeeking = isSeeking;
                        isSeeking = false;
                        seekStartTime = 0;
                        
                        int finalProgress = seekBar.getProgress();
                        if (exoPlayer != null) {
                            long duration = exoPlayer.getDuration();
                            if (duration > 0) {
                                long seekPosition = (long) (duration * finalProgress / 10000.0);
                                lastSeekTime = System.currentTimeMillis();
                                exoPlayer.seekTo(seekPosition);
                                Log.d(TAG, "Seek on Enter (seekbar listener) to: " + seekPosition + "ms (progress: " + (finalProgress/100.0) + "%)");
                                pendingSeekPosition = -1;
                            }
                        }
                        
                        // Resume playback if it was playing before seeking
                        if (wasSeeking && wasPlayingBeforeSeek && exoPlayer != null) {
                            exoPlayer.play();
                            isPaused = false;
                            if (playPauseBtn != null) {
                                playPauseBtn.setImageResource(android.R.drawable.ic_media_pause);
                            }
                        }
                        
                        // Restart time updates
                        startTimeUpdates();
                        
                        // Restart controls auto-hide timer (5 seconds after seeking completes)
                        resetControlsHideTimer();
                        
                        Log.d(TAG, "Seek completed on Enter (seekbar listener) - wasSeeking: " + wasSeeking + ", resumed: " + (wasSeeking && wasPlayingBeforeSeek));
                        return true; // Consume the event
                    }
                    
                    // Handle D-pad left/right to start seeking
                    if (keyCode == KeyEvent.KEYCODE_DPAD_LEFT || keyCode == KeyEvent.KEYCODE_DPAD_RIGHT) {
                        if (!isSeeking) {
                            isSeeking = true;
                            seekStartTime = System.currentTimeMillis();
                            wasPlayingBeforeSeek = exoPlayer != null && exoPlayer.isPlaying();
                            stopTimeUpdates();
                            
                            // Prevent controls from auto-hiding while seeking
                            if (controlsHideHandler != null) {
                                controlsHideHandler.removeCallbacksAndMessages(null);
                            }
                            
                            // Pause playback while user is navigating (if playing)
                            if (exoPlayer != null && exoPlayer.isPlaying()) {
                                exoPlayer.pause();
                                isPaused = true;
                                if (playPauseBtn != null) {
                                    playPauseBtn.setImageResource(android.R.drawable.ic_media_play);
                                }
                            }
                            
                            Log.d(TAG, "Started seeking via D-pad (seekbar listener) - paused: " + isPaused + ", wasPlaying: " + wasPlayingBeforeSeek);
                        }
                        // Don't consume - let the seekbar handle the navigation
                        return false;
                    }
                }
                return false;
            }
        });

        // Set up seek bar change listener for scrubbing
        seekBarChangeListener = new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                // If user is scrubbing, seek immediately to update the frame
                if (fromUser && exoPlayer != null && isSeeking) {
                    long duration = exoPlayer.getDuration();
                    if (duration > 0) {
                        long seekPosition = (long) (duration * progress / 10000.0);
                        pendingSeekPosition = seekPosition;
                        
                        // Seek immediately to update the video frame while paused
                        exoPlayer.seekTo(seekPosition);
                        
                        Log.d(TAG, "Seeking to position: " + seekPosition + " (progress: " + (progress/100.0) + "%)");
                    }
                }
            }

            @Override
            public void onStartTrackingTouch(SeekBar seekBar) {
                // CRITICAL: Set isSeeking IMMEDIATELY on UI thread to ensure immediate visibility
                // This must happen FIRST, before any other operations
                isSeeking = true;
                seekStartTime = System.currentTimeMillis(); // Record when seeking started
                
                // CRITICAL: Stop time updates IMMEDIATELY to prevent seekbar from snapping back
                // This must happen before anything else
                stopTimeUpdates();
                
                // Prevent controls from auto-hiding while seeking
                if (controlsHideHandler != null) {
                    controlsHideHandler.removeCallbacksAndMessages(null);
                }
                
                // Store whether video was playing before seeking
                wasPlayingBeforeSeek = exoPlayer != null && exoPlayer.isPlaying();
                
                // Pause playback while user is scrubbing (if playing)
                if (exoPlayer != null && exoPlayer.isPlaying()) {
                    exoPlayer.pause();
                    isPaused = true;
                    playPauseBtn.setImageResource(android.R.drawable.ic_media_play);
                }
                
                Log.d(TAG, "Started seeking - isSeeking: " + isSeeking + ", paused: " + isPaused + ", wasPlaying: " + wasPlayingBeforeSeek);
            }

            @Override
            public void onStopTrackingTouch(SeekBar seekBar) {
                isSeeking = false;
                seekStartTime = 0; // Reset seek start time
                
                // Get the final progress directly from the seekbar since we may have removed the listener
                // This ensures we get the exact position where the user released, even if onProgressChanged
                // wasn't called due to listener removal
                int finalProgress = seekBar.getProgress();
                if (exoPlayer != null) {
                    long duration = exoPlayer.getDuration();
                    if (duration > 0) {
                        long seekPosition = (long) (duration * finalProgress / 10000.0);
                        lastSeekTime = System.currentTimeMillis();
                        exoPlayer.seekTo(seekPosition);
                        Log.d(TAG, "Final seek to: " + seekPosition + "ms (progress: " + (finalProgress/100.0) + "%)");
                        pendingSeekPosition = -1;
                    }
                }
                
                // Resume playback if it was playing before seeking
                if (wasPlayingBeforeSeek && exoPlayer != null) {
                    exoPlayer.play();
                    isPaused = false;
                    playPauseBtn.setImageResource(android.R.drawable.ic_media_pause);
                }
                
                // Restart time updates to reflect the new position (always, whether playing or paused)
                startTimeUpdates();
                
                // Restart controls auto-hide timer (5 seconds after seeking stops)
                resetControlsHideTimer();
                
                Log.d(TAG, "Stopped seeking - resumed: " + wasPlayingBeforeSeek);
            }
        };
        
        seekBar.setOnSeekBarChangeListener(seekBarChangeListener);

        // Set up button click listeners
        skipBack30Btn.setOnClickListener(v -> {
            skipBackward(30);
            resetControlsHideTimer();
        });

        skipBack15Btn.setOnClickListener(v -> {
            skipBackward(15);
            resetControlsHideTimer();
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
            resetControlsHideTimer();
            // sendEventToListener("playPause", new JSObject());
        });

        skipForward15Btn.setOnClickListener(v -> {
            skipForward(15);
            resetControlsHideTimer();
        });

        skipForward30Btn.setOnClickListener(v -> {
            skipForward(30);
            resetControlsHideTimer();
        });

        skipIntroBtn.setOnClickListener(v -> {
            sendEventToListener("skipIntro", new JSObject());
            resetControlsHideTimer();
        });

        nextEpisodeBtn.setOnClickListener(v -> {
            sendEventToListener("getNextEp", new JSObject());
            resetControlsHideTimer();
        });

        // Set up audio track selection button
        audioTrackBtn.setOnClickListener(v -> {
            // #region agent log
            android.util.Log.d("ExoPlayerPlugin", "Audio track button clicked - calling toggleAudioTrackList()");
            // #endregion
            toggleAudioTrackList();
            resetControlsHideTimer();
        });

        // Set up focus change listener for audio track button to show/hide list
        audioTrackBtn.setOnFocusChangeListener(new OnFocusChangeListener() {
            @Override
            public void onFocusChange(View v, boolean hasFocus) {
                // #region agent log
                android.util.Log.d("ExoPlayerPlugin", "Audio track button focus changed: " + hasFocus + ", suppressAutoShow: " + suppressAutoShowAudioList + ", listVisible: " + (audioTrackListContainer != null ? (audioTrackListContainer.getVisibility() == View.VISIBLE) : "null"));
                // #endregion
                
                if (hasFocus && audioTrackListContainer != null && audioTrackListContainer.getVisibility() == View.GONE) {
                    // When button gets focus, show the track list (unless we're suppressing auto-show)
                    // Only auto-show if button is visible (controls might be hidden but button could still be accessible)
                    if (!suppressAutoShowAudioList && audioTrackBtn.getVisibility() == View.VISIBLE) {
                        // #region agent log
                        android.util.Log.d("ExoPlayerPlugin", "Auto-showing audio track list due to focus change - controlsVisible: " + controlsVisible);
                        // #endregion
                        showAudioTrackList();
                    } else {
                        // #region agent log
                        android.util.Log.d("ExoPlayerPlugin", "Suppressed auto-show of audio track list - suppressAutoShow: " + suppressAutoShowAudioList + ", buttonVisibility: " + audioTrackBtn.getVisibility());
                        // #endregion
                    }
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
                        // #region agent log
                        android.util.Log.d("ExoPlayerPlugin", "Hiding audio track list because button lost focus and no list item has focus");
                        // #endregion
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
                    // Check if audio track list is visible - if so, let the buttons handle navigation
                    boolean audioListVisible = audioTrackListContainer != null && 
                        audioTrackListContainer.getVisibility() == View.VISIBLE;
                    
                    if (audioListVisible) {
                        // If audio list is visible, only handle Back and Left to close it
                        // Let all other keys (Up/Down/Enter) be handled by the track buttons
                        if (keyCode == KeyEvent.KEYCODE_BACK) {
                            android.util.Log.d("ExoPlayerPlugin", "Back pressed while audio track list visible - hiding list and consuming event");
                            // Hide the list immediately (synchronously) to prevent event propagation
                            audioTrackListContainer.setVisibility(View.GONE);
                            isShowingAudioTrackList = false;
                            
                            getActivity().runOnUiThread(() -> {
                                // Show controls
                                showControls(null);
                                
                                // Focus the audio track button
                                if (audioTrackBtn != null) {
                                    audioTrackBtn.requestFocus();
                                }
                            });
                            return true; // Consume the event to prevent going back to overview
                        }
                        
                        // Handle D-pad Left - hide audio track list if visible
                        if (keyCode == KeyEvent.KEYCODE_DPAD_LEFT) {
                            android.util.Log.d("ExoPlayerPlugin", "Left pressed while audio track list visible - hiding list and consuming event");
                            // Hide the list immediately (synchronously) to prevent event propagation
                            audioTrackListContainer.setVisibility(View.GONE);
                            isShowingAudioTrackList = false;
                            
                            getActivity().runOnUiThread(() -> {
                                // Show controls
                                showControls(null);
                                
                                // Focus the audio track button
                                if (audioTrackBtn != null) {
                                    audioTrackBtn.requestFocus();
                                }
                            });
                            return true; // Consume the event
                        }
                        
                        // For all other keys when audio list is visible, check which view has focus
                        View focusedView = getActivity().getCurrentFocus();
                        android.util.Log.d("ExoPlayerPlugin", "Key " + keyCode + " (DPAD_UP=" + KeyEvent.KEYCODE_DPAD_UP + ", DPAD_DOWN=" + KeyEvent.KEYCODE_DPAD_DOWN + ") pressed while audio list visible. Focused view: " + (focusedView != null ? focusedView.getClass().getSimpleName() : "null"));
                        
                        // If no button has focus, try to focus the first one
                        if (focusedView == null || !audioTrackButtons.contains(focusedView)) {
                            android.util.Log.d("ExoPlayerPlugin", "No track button has focus, attempting to focus first button");
                            if (!audioTrackButtons.isEmpty()) {
                                audioTrackButtons.get(0).requestFocus();
                            }
                        }
                        
                        return false; // Let buttons handle it
                    }
                    
                    // Handle Back button - hide audio track list if visible
                    if (keyCode == KeyEvent.KEYCODE_BACK) {
                        // If audio list is not visible, let the event propagate (normal back behavior)
                        return false;
                    }
                    
                    // Handle D-pad navigation keys - show controls (or reset timer if already visible)
                    if (keyCode == KeyEvent.KEYCODE_DPAD_UP ||
                        keyCode == KeyEvent.KEYCODE_DPAD_DOWN ||
                        keyCode == KeyEvent.KEYCODE_DPAD_LEFT ||
                        keyCode == KeyEvent.KEYCODE_DPAD_RIGHT) {
                        // If seekbar has focus and user is navigating left/right, set isSeeking
                        if (seekBar != null && seekBar.hasFocus() && 
                            (keyCode == KeyEvent.KEYCODE_DPAD_LEFT || keyCode == KeyEvent.KEYCODE_DPAD_RIGHT)) {
                            // User is navigating the seekbar - set seeking state
                            if (!isSeeking) {
                                isSeeking = true;
                                seekStartTime = System.currentTimeMillis();
                                wasPlayingBeforeSeek = exoPlayer != null && exoPlayer.isPlaying();
                                stopTimeUpdates();
                                
                                // Prevent controls from auto-hiding while seeking
                                if (controlsHideHandler != null) {
                                    controlsHideHandler.removeCallbacksAndMessages(null);
                                }
                                
                                // Pause playback while user is navigating (if playing)
                                if (exoPlayer != null && exoPlayer.isPlaying()) {
                                    exoPlayer.pause();
                                    isPaused = true;
                                    if (playPauseBtn != null) {
                                        playPauseBtn.setImageResource(android.R.drawable.ic_media_play);
                                    }
                                }
                                
                                Log.d(TAG, "Started seeking via D-pad - paused: " + isPaused + ", wasPlaying: " + wasPlayingBeforeSeek);
                            }
                        }
                        
                        // Show controls (or reset timer if already visible)
                        android.util.Log.d("ExoPlayerPlugin", "D-pad key pressed (keyCode: " + keyCode + ") - controlsVisible: " + controlsVisible + ", showing controls");
                        showControls(null);
                        // Don't consume the event - let focus navigation work
                        return false;
                    }

                    // Handle Enter/Select button from Nvidia Shield remote
                    if (keyCode == KeyEvent.KEYCODE_DPAD_CENTER || keyCode == KeyEvent.KEYCODE_ENTER) {
                        // If seekbar has focus, let it handle the Enter key (don't consume here)
                        // The seekbar's OnKeyListener will handle it
                        if (seekBar != null && seekBar.hasFocus()) {
                            Log.d(TAG, "Enter pressed while seekbar has focus - letting seekbar handle it");
                            return false; // Don't consume - let seekbar handle it
                        }
                        
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

        // Initialize controls hide handler
        controlsHideHandler = new android.os.Handler(android.os.Looper.getMainLooper());

        // Auto-hide controls after 5 seconds (controls start visible)
        controlsHideHandler.postDelayed(() -> hideControls(null), 5000);
    }

    private void createAudioTrackListContainer(FrameLayout container) {
        // Create the outer container that spans full screen
        audioTrackListContainer = new LinearLayout(getContext());
        audioTrackListContainer.setOrientation(LinearLayout.VERTICAL);
        // No background on outer container - we'll add it to inner container instead
        audioTrackListContainer.setPadding(0, 0, 0, 0); // Remove padding from outer container
        audioTrackListContainer.setGravity(Gravity.END);
        audioTrackListContainer.setVisibility(View.GONE);
        audioTrackListContainer.setFocusable(false);
        audioTrackListContainer.setFocusableInTouchMode(false);
        audioTrackListContainer.setDescendantFocusability(LinearLayout.FOCUS_AFTER_DESCENDANTS); // Allow children to receive focus
        audioTrackListContainer.setElevation(15f);
        
        FrameLayout.LayoutParams containerParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        );
        audioTrackListContainer.setLayoutParams(containerParams);
        
        // Create inner container to constrain content width to 1/3 of screen width
        LinearLayout innerContainer = new LinearLayout(getContext());
        innerContainer.setOrientation(LinearLayout.VERTICAL);
        int screenWidth = getContext().getResources().getDisplayMetrics().widthPixels;
        int listWidth = screenWidth / 3; // One third of screen width
        LinearLayout.LayoutParams innerParams = new LinearLayout.LayoutParams(
            listWidth,
            LinearLayout.LayoutParams.MATCH_PARENT // Fill available height for scrolling
        );
        innerParams.gravity = Gravity.END;
        innerContainer.setLayoutParams(innerParams);
        innerContainer.setGravity(Gravity.END);
        // Add the dark background to the inner container instead
        innerContainer.setBackgroundColor(Color.argb(230, 0, 0, 0)); // #E6000000
        innerContainer.setPadding(
            (int)(10 * getContext().getResources().getDisplayMetrics().density),
            (int)(10 * getContext().getResources().getDisplayMetrics().density),
            (int)(10 * getContext().getResources().getDisplayMetrics().density),
            (int)(10 * getContext().getResources().getDisplayMetrics().density)
        );
        innerContainer.setFocusable(false);
        innerContainer.setFocusableInTouchMode(false);
        innerContainer.setDescendantFocusability(LinearLayout.FOCUS_AFTER_DESCENDANTS); // Allow children to receive focus
        
        // Create title TextView
        TextView titleView = new TextView(getContext());
        titleView.setId(View.generateViewId()); // Generate a unique ID since we're creating this programmatically
        titleView.setText("Select Audio Track");
        titleView.setTextColor(Color.WHITE);
        titleView.setTextSize(18);
        titleView.setTypeface(null, android.graphics.Typeface.BOLD);
        titleView.setPadding(0, 0, 0, (int)(10 * getContext().getResources().getDisplayMetrics().density));
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        titleView.setLayoutParams(titleParams);
        
        // Create ScrollView to wrap the track list for scrollability
        android.widget.ScrollView scrollView = new android.widget.ScrollView(getContext());
        LinearLayout.LayoutParams scrollParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            0, // Will use weight
            1.0f // Weight to fill remaining space
        );
        scrollView.setLayoutParams(scrollParams);
        scrollView.setFillViewport(true); // Ensure content fills the viewport
        scrollView.setFocusable(false); // Don't intercept focus - let buttons handle it
        scrollView.setFocusableInTouchMode(false);
        
        // Create the track list LinearLayout
        audioTrackList = new LinearLayout(getContext());
        audioTrackList.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams listParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        audioTrackList.setLayoutParams(listParams);
        
        // Add track list to ScrollView
        scrollView.addView(audioTrackList);
        
        // Add views to hierarchy
        innerContainer.addView(titleView);
        innerContainer.addView(scrollView);
        audioTrackListContainer.addView(innerContainer);
        
        // Add to the main container (full screen)
        container.addView(audioTrackListContainer);
    }

    private JSObject createSkipObject(int seconds) {
        JSObject obj = new JSObject();
        obj.put("skipBy", seconds);
        return obj;
    }

    /**
     * Resets the controls auto-hide timer to 5 seconds.
     * Call this whenever the user interacts with any control to keep controls visible.
     */
    private void resetControlsHideTimer() {
        if (controlsHideHandler != null) {
            controlsHideHandler.removeCallbacksAndMessages(null);
            controlsHideHandler.postDelayed(() -> hideControls(null), 5000);
        }
    }

    private void skipForward(int seconds) {
        if (exoPlayer == null) {
            return;
        }
        
        // CRITICAL: Use the ACTUAL player position after any pending seeks complete
        // If we just called seekTo(), getCurrentPosition() may still return the old value
        // So we need to track the target position ourselves
        long currentPosition = pendingSeekPosition >= 0 ? pendingSeekPosition : exoPlayer.getCurrentPosition();
        long duration = exoPlayer.getDuration();
        long newPosition = currentPosition + (seconds * 1000L); // Convert seconds to milliseconds
        if (newPosition > duration) {
            newPosition = duration;
        }
        
        // Store this as the pending position for next rapid skip
        pendingSeekPosition = newPosition;
        
        lastSeekTime = System.currentTimeMillis();
        lastManualSkipTime = System.currentTimeMillis(); // Track manual skip for time update blocking
        exoPlayer.seekTo(newPosition);
        
        // Update seekbar to reflect new position IMMEDIATELY on UI thread
        // This must happen synchronously to prevent time updates from overwriting it
        if (seekBar != null && duration > 0) {
            final int progress = (int) ((newPosition * 10000) / duration);
            
            // CRITICAL: Update immediately if we're already on UI thread, otherwise post
            if (android.os.Looper.myLooper() == android.os.Looper.getMainLooper()) {
                seekBar.setProgress(progress);
            } else {
                getActivity().runOnUiThread(() -> {
                    if (seekBar != null) {
                        seekBar.setProgress(progress);
                    }
                });
            }
        }
        
        android.util.Log.d("ExoPlayerPlugin", "Skipped forward " + seconds + " seconds to position " + newPosition);
    }

    private void skipBackward(int seconds) {
        if (exoPlayer == null) {
            return;
        }
        
        // CRITICAL: Use the ACTUAL player position after any pending seeks complete
        // If we just called seekTo(), getCurrentPosition() may still return the old value
        // So we need to track the target position ourselves
        long currentPosition = pendingSeekPosition >= 0 ? pendingSeekPosition : exoPlayer.getCurrentPosition();
        long newPosition = currentPosition - (seconds * 1000L); // Convert seconds to milliseconds
        if (newPosition < 0) {
            newPosition = 0;
        }
        
        // Store this as the pending position for next rapid skip
        pendingSeekPosition = newPosition;
        
        lastSeekTime = System.currentTimeMillis();
        lastManualSkipTime = System.currentTimeMillis(); // Track manual skip for time update blocking
        exoPlayer.seekTo(newPosition);
        
        // Update seekbar to reflect new position IMMEDIATELY on UI thread
        // This must happen synchronously to prevent time updates from overwriting it
        if (seekBar != null) {
            long duration = exoPlayer.getDuration();
            if (duration > 0) {
                final int progress = (int) ((newPosition * 10000) / duration);
                
                // CRITICAL: Update immediately if we're already on UI thread, otherwise post
                if (android.os.Looper.myLooper() == android.os.Looper.getMainLooper()) {
                    seekBar.setProgress(progress);
                } else {
                    getActivity().runOnUiThread(() -> {
                        if (seekBar != null) {
                            seekBar.setProgress(progress);
                        }
                    });
                }
            }
        }
        
        android.util.Log.d("ExoPlayerPlugin", "Skipped backward " + seconds + " seconds to position " + newPosition);
    }

    private void sendEventToListener(String eventName, JSObject data) {
        android.util.Log.d("ExoPlayerPlugin", "sendEventToListener called for: " + eventName);

        // Try Capacitor's notifyListeners first - this should work if listeners are registered
        notifyListeners(eventName, data);
    }

    /**
     * Generates a user-friendly display name for an audio track based on codec and channel information
     */
    private String getAudioTrackDisplayName(androidx.media3.common.Format format) {
        String codecName = "";
        String channelInfo = "";
        
        // Check MIME type first (e.g., "audio/ac3", "audio/eac3", "audio/true-hd")
        String mimeType = format.sampleMimeType;
        if (mimeType != null && !mimeType.isEmpty()) {
            String mime = mimeType.toLowerCase();
            
            // Extract codec name from MIME type (e.g., "ac3" from "audio/ac3")
            if (mime.startsWith("audio/")) {
                String codecPart = mime.substring(6); // Remove "audio/" prefix
                
                if (codecPart.contains("true-hd") || codecPart.contains("truehd") || codecPart.contains("mlp")) {
                    codecName = "truehd";
                } else if (codecPart.contains("eac3") || codecPart.contains("ec-3")) {
                    codecName = "eac3";
                } else if (codecPart.contains("ac3")) {
                    codecName = "ac3";
                } else if (codecPart.contains("dts")) {
                    if (codecPart.contains("dtsx") || codecPart.contains("dts-x")) {
                        codecName = "dts:x";
                    } else if (codecPart.contains("dts-hd") || codecPart.contains("dtshd")) {
                        codecName = "dts-hd";
                    } else {
                        codecName = "dts";
                    }
                } else if (codecPart.contains("aac")) {
                    codecName = "aac";
                } else if (codecPart.contains("opus")) {
                    codecName = "opus";
                } else if (codecPart.contains("vorbis")) {
                    codecName = "vorbis";
                } else if (codecPart.contains("flac")) {
                    codecName = "flac";
                } else if (codecPart.contains("pcm")) {
                    codecName = "pcm";
                } else {
                    // Use the codec part as-is in lowercase (e.g., "ac3" from "audio/ac3")
                    codecName = codecPart;
                }
            }
        }
        
        // If MIME type didn't give us a codec, check codecs field
        if (codecName.isEmpty() && format.codecs != null && !format.codecs.isEmpty()) {
            String codecs = format.codecs.toLowerCase();
            
            // Map codec strings to user-friendly names (lowercase)
            if (codecs.contains("truehd") || codecs.contains("mlp")) {
                codecName = "truehd";
            } else if (codecs.contains("eac3") || codecs.contains("ec-3")) {
                codecName = "eac3";
            } else if (codecs.contains("ac-3") || codecs.contains("ac3")) {
                codecName = "ac3";
            } else if (codecs.contains("dts-hd") || codecs.contains("dtshd")) {
                codecName = "dts-hd";
            } else if (codecs.contains("dtsx") || codecs.contains("dts-x")) {
                codecName = "dts:x";
            } else if (codecs.contains("dts")) {
                codecName = "dts";
            } else if (codecs.contains("aac")) {
                codecName = "aac";
            } else if (codecs.contains("mp4a") || codecs.contains("mp4")) {
                codecName = "aac";
            } else if (codecs.contains("opus")) {
                codecName = "opus";
            } else if (codecs.contains("vorbis")) {
                codecName = "vorbis";
            } else if (codecs.contains("flac")) {
                codecName = "flac";
            } else if (codecs.contains("pcm")) {
                codecName = "pcm";
            } else {
                // Use the codec string as-is in lowercase if we don't recognize it
                codecName = format.codecs.toLowerCase();
            }
        }
        
        // Get channel count and format channel info
        if (format.channelCount > 0) {
            int channels = format.channelCount;
            if (channels == 1) {
                channelInfo = "Mono";
            } else if (channels == 2) {
                channelInfo = "Stereo";
            } else if (channels == 6) {
                channelInfo = "5.1";
            } else if (channels == 8) {
                // Check if it's Atmos (TrueHD with 8 channels often indicates Atmos)
                if (codecName.equals("truehd") || (format.codecs != null && format.codecs.toLowerCase().contains("truehd"))) {
                    channelInfo = "atmos";
                } else {
                    channelInfo = "7.1";
                }
            } else if (channels > 8) {
                // For more than 8 channels, check for Atmos or DTS:X
                if (codecName.equals("truehd") || (format.codecs != null && format.codecs.toLowerCase().contains("truehd"))) {
                    channelInfo = "atmos";
                } else if (codecName.equals("dts:x") || codecName.equals("dts-hd")) {
                    channelInfo = "x";
                } else {
                    channelInfo = channels + ".1";
                }
            } else {
                channelInfo = channels + "ch";
            }
        }
        
        // Combine codec and channel info
        String displayName = "";
        if (!codecName.isEmpty() && !channelInfo.isEmpty()) {
            displayName = codecName + " " + channelInfo;
        } else if (!codecName.isEmpty()) {
            displayName = codecName;
        } else if (!channelInfo.isEmpty()) {
            displayName = channelInfo;
        } else {
            // Fallback to label or language
            displayName = format.label != null ? format.label :
                (format.language != null ? format.language : "Track");
        }
        
        return displayName;
    }

    /**
     * Notifies JavaScript about detected audio tracks
     */
    private void notifyAudioTracksDetected(Tracks tracks) {
        if (tracks == null) {
            return;
        }

        try {
            // Find audio tracks
            for (Tracks.Group trackGroup : tracks.getGroups()) {
                if (trackGroup.getType() == androidx.media3.common.C.TRACK_TYPE_AUDIO) {
                    org.json.JSONArray tracksArray = new org.json.JSONArray();
                    
                    int currentIndex = -1;
                    int trackCount = trackGroup.length;
                    
                    // Build array of track information
                    for (int i = 0; i < trackGroup.length; i++) {
                        androidx.media3.common.Format format = trackGroup.getTrackFormat(i);
                        String trackName = getAudioTrackDisplayName(format);
                        
                        org.json.JSONObject trackInfo = new org.json.JSONObject();
                        trackInfo.put("id", i);
                        trackInfo.put("label", trackName);
                        trackInfo.put("language", format.language != null ? format.language : "");
                        trackInfo.put("enabled", trackGroup.isTrackSelected(i));
                        
                        tracksArray.put(trackInfo);
                        
                        if (trackGroup.isTrackSelected(i)) {
                            currentIndex = i;
                        }
                    }
                    
                    JSObject audioTracksData = new JSObject();
                    audioTracksData.put("tracks", tracksArray.toString());
                    audioTracksData.put("count", trackCount);
                    audioTracksData.put("currentIndex", currentIndex);
                    audioTracksData.put("hasMultiple", trackCount > 1);
                    
                    // Notify JavaScript listeners
                    notifyListeners("audioTracksDetected", audioTracksData);
                    
                    android.util.Log.d(TAG, "Notified JavaScript about " + trackCount + " audio tracks, current: " + currentIndex);
                    break;
                }
            }
        } catch (Exception e) {
            android.util.Log.e(TAG, "Error notifying JavaScript about audio tracks", e);
        }
    }

    private void updateAudioTrackUI(Tracks tracks) {
        if (audioTrackRow == null || exoPlayer == null) {
            android.util.Log.d("ExoPlayerPlugin", "updateAudioTrackUI: audioTrackRow or exoPlayer is null");
            return;
        }

        getActivity().runOnUiThread(() -> {
            // Collect ALL audio tracks from ALL audio track groups
            java.util.List<Tracks.Group> audioTrackGroups = new java.util.ArrayList<>();
            int totalAudioTrackCount = 0;
            int currentTrackGroupIndex = -1;
            int currentTrackIndexInGroup = -1;
            
            for (Tracks.Group trackGroup : tracks.getGroups()) {
                if (trackGroup.getType() == androidx.media3.common.C.TRACK_TYPE_AUDIO) {
                    audioTrackGroups.add(trackGroup);
                    totalAudioTrackCount += trackGroup.length;
                    
                    // Find currently selected track
                    for (int i = 0; i < trackGroup.length; i++) {
                        if (trackGroup.isTrackSelected(i)) {
                            currentTrackGroupIndex = audioTrackGroups.size() - 1;
                            currentTrackIndexInGroup = i;
                            break;
                        }
                    }
                }
            }
            
            android.util.Log.d("ExoPlayerPlugin", "Total audio tracks found: " + totalAudioTrackCount + " across " + audioTrackGroups.size() + " groups");
            
            // Show audio track selection UI if there are multiple audio tracks (across all groups)
            if (totalAudioTrackCount > 1) {
                android.util.Log.d("ExoPlayerPlugin", "Showing audio track selection UI - multiple tracks available (" + totalAudioTrackCount + " total)");
                
                // Show the audio track button
                if (audioTrackBtn != null) {
                    audioTrackBtn.setVisibility(View.VISIBLE);
                    android.util.Log.d("ExoPlayerPlugin", "Audio track button made VISIBLE");
                } else {
                    android.util.Log.w("ExoPlayerPlugin", "Audio track button is null - cannot show");
                }
                audioTrackRow.setVisibility(View.VISIBLE);

                // Update current track label
                if (currentTrackGroupIndex >= 0 && currentTrackIndexInGroup >= 0) {
                    Tracks.Group selectedGroup = audioTrackGroups.get(currentTrackGroupIndex);
                    androidx.media3.common.Format format = selectedGroup.getTrackFormat(currentTrackIndexInGroup);
                    String trackName = getAudioTrackDisplayName(format);
                    if (currentAudioTrackLabel != null) {
                        currentAudioTrackLabel.setText("Audio: " + trackName);
                        currentAudioTrackLabel.setVisibility(View.VISIBLE);
                    }
                    android.util.Log.d("ExoPlayerPlugin", "Current audio track: " + trackName);
                    
                    // Calculate global track index across all groups
                    int globalIndex = 0;
                    for (int g = 0; g < currentTrackGroupIndex; g++) {
                        globalIndex += audioTrackGroups.get(g).length;
                    }
                    globalIndex += currentTrackIndexInGroup;
                    selectedAudioTrackIndex = globalIndex;
                }

                // Populate audio track list with all tracks from all groups
                populateAudioTrackListFromMultipleGroups(audioTrackGroups, selectedAudioTrackIndex);
            } else {
                // Hide audio track selection if only one track
                android.util.Log.d("ExoPlayerPlugin", "Hiding audio track selection UI - only one track");
                
                // Hide the audio track button
                if (audioTrackBtn != null) {
                    audioTrackBtn.setVisibility(View.GONE);
                }
                audioTrackRow.setVisibility(View.GONE);
                hideAudioTrackList();
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
                String trackName = getAudioTrackDisplayName(format);
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
                                // Move focus back to audio track button and hide the list
                                android.util.Log.d("ExoPlayerPlugin", "Left/Back pressed on audio track button - hiding list");
                                audioTrackBtn.requestFocus();
                                hideAudioTrackList();
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

    private void populateAudioTrackListFromMultipleGroups(java.util.List<Tracks.Group> audioTrackGroups, int selectedGlobalIndex) {
        if (audioTrackList == null) {
            return;
        }

        getActivity().runOnUiThread(() -> {
            // Clear existing buttons
            audioTrackList.removeAllViews();
            audioTrackButtons.clear();

            int globalIndex = 0;
            
            // Create a button for each audio track across all groups
            for (int groupIdx = 0; groupIdx < audioTrackGroups.size(); groupIdx++) {
                Tracks.Group trackGroup = audioTrackGroups.get(groupIdx);
                
                for (int trackIdx = 0; trackIdx < trackGroup.length; trackIdx++) {
                    androidx.media3.common.Format format = trackGroup.getTrackFormat(trackIdx);
                    String trackName = getAudioTrackDisplayName(format);
                    boolean isSelected = (globalIndex == selectedGlobalIndex);

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

                    final int finalGlobalIndex = globalIndex;
                    final int finalGroupIdx = groupIdx;
                    final int finalTrackIdx = trackIdx;
                    
                    trackButton.setOnClickListener(v -> {
                        // #region agent log
                        android.util.Log.d("ExoPlayerPlugin", "Track button " + finalGlobalIndex + " clicked - calling selectAudioTrackFromMultipleGroups");
                        android.util.Log.d("ExoPlayerPlugin", "  - controlsVisible: " + controlsVisible);
                        android.util.Log.d("ExoPlayerPlugin", "  - isShowingAudioTrackList: " + isShowingAudioTrackList);
                        android.util.Log.d("ExoPlayerPlugin", "  - button clickable: " + trackButton.isClickable() + ", enabled: " + trackButton.isEnabled() + ", visibility: " + trackButton.getVisibility());
                        android.util.Log.d("ExoPlayerPlugin", "  - container visibility: " + (audioTrackListContainer != null ? audioTrackListContainer.getVisibility() : "null"));
                        // #endregion
                        selectAudioTrackFromMultipleGroups(audioTrackGroups, finalGlobalIndex, finalGroupIdx, finalTrackIdx);
                    });

                    // Set up focus change listener to update selection
                    trackButton.setOnFocusChangeListener(new OnFocusChangeListener() {
                        @Override
                        public void onFocusChange(View v, boolean hasFocus) {
                            android.util.Log.d("ExoPlayerPlugin", "Track button " + finalGlobalIndex + " focus changed: " + hasFocus);
                            if (hasFocus) {
                                // Highlight focused item
                                trackButton.setBackgroundColor(Color.argb(150, 255, 255, 255));
                            } else {
                                // Reset to normal or selected state
                                boolean isCurrentlySelected = finalGlobalIndex == selectedAudioTrackIndex;
                                trackButton.setBackgroundColor(isCurrentlySelected ? Color.argb(100, 255, 255, 0) : Color.TRANSPARENT);
                                trackButton.setTextColor(isCurrentlySelected ? Color.YELLOW : Color.WHITE);
                            }
                        }
                    });

                    // Set up key listener for navigation
                    trackButton.setOnKeyListener(new View.OnKeyListener() {
                        @Override
                        public boolean onKey(View v, int keyCode, KeyEvent event) {
                            // #region agent log
                            android.util.Log.d("ExoPlayerPlugin", "Track button " + finalGlobalIndex + " key listener - keyCode: " + keyCode + ", action: " + event.getAction());
                            android.util.Log.d("ExoPlayerPlugin", "  - button hasFocus: " + trackButton.hasFocus() + ", isFocused: " + trackButton.isFocused());
                            android.util.Log.d("ExoPlayerPlugin", "  - container visibility: " + (audioTrackListContainer != null ? audioTrackListContainer.getVisibility() : "null"));
                            android.util.Log.d("ExoPlayerPlugin", "  - button parent: " + (trackButton.getParent() != null ? trackButton.getParent().getClass().getSimpleName() : "null"));
                            // #endregion
                            if (event.getAction() == KeyEvent.ACTION_DOWN) {
                                if (keyCode == KeyEvent.KEYCODE_DPAD_UP) {
                                    android.util.Log.d("ExoPlayerPlugin", "DPAD_UP on track " + finalGlobalIndex);
                                    // Move focus to previous item or back to button
                                    if (finalGlobalIndex > 0) {
                                        android.util.Log.d("ExoPlayerPlugin", "Moving focus to track " + (finalGlobalIndex - 1));
                                        audioTrackButtons.get(finalGlobalIndex - 1).requestFocus();
                                    } else {
                                        android.util.Log.d("ExoPlayerPlugin", "Moving focus to audio track button");
                                        audioTrackBtn.requestFocus();
                                    }
                                    return true;
                                } else if (keyCode == KeyEvent.KEYCODE_DPAD_DOWN) {
                                    android.util.Log.d("ExoPlayerPlugin", "DPAD_DOWN on track " + finalGlobalIndex);
                                    // Move focus to next item
                                    if (finalGlobalIndex < audioTrackButtons.size() - 1) {
                                        android.util.Log.d("ExoPlayerPlugin", "Moving focus to track " + (finalGlobalIndex + 1));
                                        audioTrackButtons.get(finalGlobalIndex + 1).requestFocus();
                                    } else {
                                        android.util.Log.d("ExoPlayerPlugin", "Already at last track");
                                    }
                                    return true;
                                } else if (keyCode == KeyEvent.KEYCODE_DPAD_LEFT || keyCode == KeyEvent.KEYCODE_BACK) {
                                    // Move focus back to audio track button and hide the list
                                    android.util.Log.d("ExoPlayerPlugin", "Left/Back pressed on audio track button - hiding list");
                                    audioTrackBtn.requestFocus();
                                    hideAudioTrackList();
                                    return true;
                                } else if (keyCode == KeyEvent.KEYCODE_DPAD_CENTER || keyCode == KeyEvent.KEYCODE_ENTER) {
                                    // #region agent log
                                    android.util.Log.d("ExoPlayerPlugin", "Enter pressed on track " + finalGlobalIndex + " - selecting track");
                                    android.util.Log.d("ExoPlayerPlugin", "  - button clickable: " + trackButton.isClickable() + ", enabled: " + trackButton.isEnabled() + ", visibility: " + trackButton.getVisibility());
                                    android.util.Log.d("ExoPlayerPlugin", "  - container visibility: " + (audioTrackListContainer != null ? audioTrackListContainer.getVisibility() : "null"));
                                    android.util.Log.d("ExoPlayerPlugin", "  - isShowingAudioTrackList: " + isShowingAudioTrackList);
                                    android.util.Log.d("ExoPlayerPlugin", "  - audioTrackGroups size: " + (audioTrackGroups != null ? audioTrackGroups.size() : "null"));
                                    // #endregion
                                    // Select this track
                                    selectAudioTrackFromMultipleGroups(audioTrackGroups, finalGlobalIndex, finalGroupIdx, finalTrackIdx);
                                    return true;
                                }
                            }
                            android.util.Log.d("ExoPlayerPlugin", "Track button key listener returning false for keyCode: " + keyCode);
                            return false;
                        }
                    });

                    audioTrackList.addView(trackButton);
                    audioTrackButtons.add(trackButton);
                    
                    globalIndex++;
                }
            }
            
            android.util.Log.d("ExoPlayerPlugin", "Populated " + globalIndex + " audio track buttons from " + audioTrackGroups.size() + " groups");
        });
    }

    private void selectAudioTrackFromMultipleGroups(java.util.List<Tracks.Group> audioTrackGroups, int globalIndex, int groupIdx, int trackIdx) {
        if (exoPlayer == null || groupIdx < 0 || groupIdx >= audioTrackGroups.size()) {
            android.util.Log.w("ExoPlayerPlugin", "Cannot select audio track: invalid group index");
            return;
        }

        Tracks.Group targetGroup = audioTrackGroups.get(groupIdx);
        if (trackIdx < 0 || trackIdx >= targetGroup.length) {
            android.util.Log.w("ExoPlayerPlugin", "Cannot select audio track: invalid track index");
            return;
        }

        androidx.media3.common.Format format = targetGroup.getTrackFormat(trackIdx);
        String trackName = getAudioTrackDisplayName(format);

        // Get the media track group for this audio track
        TrackGroup mediaTrackGroup = targetGroup.getMediaTrackGroup();
        
        // #region agent log
        android.util.Log.d("ExoPlayerPlugin", "Track selection details:");
        android.util.Log.d("ExoPlayerPlugin", "  - globalIndex: " + globalIndex);
        android.util.Log.d("ExoPlayerPlugin", "  - groupIdx: " + groupIdx + " (of " + audioTrackGroups.size() + " groups)");
        android.util.Log.d("ExoPlayerPlugin", "  - trackIdx: " + trackIdx + " (of " + targetGroup.length + " tracks in group)");
        android.util.Log.d("ExoPlayerPlugin", "  - trackName: " + trackName);
        android.util.Log.d("ExoPlayerPlugin", "  - mediaTrackGroup tracks: " + mediaTrackGroup.length);
        for (int i = 0; i < mediaTrackGroup.length; i++) {
            androidx.media3.common.Format f = mediaTrackGroup.getFormat(i);
            android.util.Log.d("ExoPlayerPlugin", "    Track " + i + ": " + getAudioTrackDisplayName(f));
        }
        // #endregion
        
        // Get current track selection parameters
        TrackSelectionParameters currentTrackParams = exoPlayer.getTrackSelectionParameters();
        
        // Create the override for the selected track
        TrackSelectionOverride override = new TrackSelectionOverride(mediaTrackGroup, Collections.singletonList(trackIdx));
        
        // #region agent log
        android.util.Log.d("ExoPlayerPlugin", "Creating override for trackIdx: " + trackIdx + " in mediaTrackGroup with " + mediaTrackGroup.length + " tracks");
        android.util.Log.d("ExoPlayerPlugin", "Current track selection parameters before change:");
        android.util.Log.d("ExoPlayerPlugin", "  - Overrides count: " + currentTrackParams.overrides.size());
        for (java.util.Map.Entry<TrackGroup, TrackSelectionOverride> entry : currentTrackParams.overrides.entrySet()) {
            TrackGroup tg = entry.getKey();
            android.util.Log.d("ExoPlayerPlugin", "    Override: TrackGroup with " + tg.length + " tracks");
        }
        // #endregion
        
        // Clear all existing audio track overrides first, then add the new one
        // This ensures only one audio track is selected at a time
        TrackSelectionParameters.Builder paramsBuilder = currentTrackParams.buildUpon();
        
        // #region agent log
        int audioOverrideCount = 0;
        for (java.util.Map.Entry<TrackGroup, TrackSelectionOverride> entry : currentTrackParams.overrides.entrySet()) {
            TrackGroup tg = entry.getKey();
            // Check if this is an audio track group by looking at the format
            if (tg.length > 0) {
                androidx.media3.common.Format firstFormat = tg.getFormat(0);
                if (firstFormat != null && firstFormat.sampleMimeType != null && firstFormat.sampleMimeType.startsWith("audio/")) {
                    audioOverrideCount++;
                }
            }
        }
        android.util.Log.d("ExoPlayerPlugin", "Found " + audioOverrideCount + " existing audio track overrides to clear");
        // #endregion
        
        // Clear all audio track overrides using clearOverridesOfType
        paramsBuilder.clearOverridesOfType(androidx.media3.common.C.TRACK_TYPE_AUDIO);
        
        // Now add the new override
        paramsBuilder.addOverride(override);
        
        TrackSelectionParameters newParams = paramsBuilder.build();
        
        // #region agent log
        android.util.Log.d("ExoPlayerPlugin", "New track selection parameters:");
        android.util.Log.d("ExoPlayerPlugin", "  - Overrides count: " + newParams.overrides.size());
        for (java.util.Map.Entry<TrackGroup, TrackSelectionOverride> entry : newParams.overrides.entrySet()) {
            TrackGroup tg = entry.getKey();
            android.util.Log.d("ExoPlayerPlugin", "    Override: TrackGroup with " + tg.length + " tracks");
        }
        // #endregion
        
        exoPlayer.setTrackSelectionParameters(newParams);
        
        // #region agent log
        // Immediately check what ExoPlayer reports as selected (before onTracksChanged)
        android.util.Log.d("ExoPlayerPlugin", "Verifying track selection immediately after setTrackSelectionParameters...");
        Tracks currentTracks = exoPlayer.getCurrentTracks();
        if (currentTracks != null) {
            for (Tracks.Group trackGroupCheck : currentTracks.getGroups()) {
                if (trackGroupCheck.getType() == androidx.media3.common.C.TRACK_TYPE_AUDIO) {
                    for (int i = 0; i < trackGroupCheck.length; i++) {
                        if (trackGroupCheck.isTrackSelected(i)) {
                            androidx.media3.common.Format formatCheck = trackGroupCheck.getTrackFormat(i);
                            String trackNameCheck = getAudioTrackDisplayName(formatCheck);
                            android.util.Log.d("ExoPlayerPlugin", "IMMEDIATELY AFTER SELECTION - Selected audio track: " + trackNameCheck + " (index " + i + " in group)");
                        }
                    }
                }
            }
        } else {
            android.util.Log.d("ExoPlayerPlugin", "IMMEDIATELY AFTER SELECTION - currentTracks is null");
        }
        // #endregion

        selectedAudioTrackIndex = globalIndex;

        android.util.Log.d("ExoPlayerPlugin", "Selected audio track: " + globalIndex + " (" + trackName + ") from group " + groupIdx + ", track " + trackIdx + " - Track switching applied to ExoPlayer");

        // Update UI and hide the audio list
        getActivity().runOnUiThread(() -> {
            // #region agent log
            android.util.Log.d("ExoPlayerPlugin", "Updating UI after track selection - buttons count: " + audioTrackButtons.size() + ", selected index: " + globalIndex);
            // #endregion
            
            // Update button colors
            for (int i = 0; i < audioTrackButtons.size(); i++) {
                Button btn = audioTrackButtons.get(i);
                if (btn == null) {
                    // #region agent log
                    android.util.Log.w("ExoPlayerPlugin", "Button " + i + " is null!");
                    // #endregion
                    continue;
                }
                if (i == globalIndex) {
                    btn.setTextColor(Color.YELLOW);
                    btn.setBackgroundColor(Color.argb(100, 255, 255, 0));
                } else {
                    btn.setTextColor(Color.WHITE);
                    btn.setBackgroundColor(Color.TRANSPARENT);
                }
                // #region agent log
                android.util.Log.d("ExoPlayerPlugin", "Button " + i + " updated - clickable: " + btn.isClickable() + ", enabled: " + btn.isEnabled() + ", visibility: " + btn.getVisibility() + ", hasOnClick: " + btn.hasOnClickListeners());
                // #endregion
            }

            // Update label
            if (currentAudioTrackLabel != null) {
                currentAudioTrackLabel.setText("Audio: " + trackName);
            }
            
            // Hide the audio track list and show controls after selection
            android.util.Log.d("ExoPlayerPlugin", "Hiding audio track list after track selection");
            isShowingAudioTrackList = false;
            if (audioTrackListContainer != null) {
                audioTrackListContainer.setVisibility(View.GONE);
                // #region agent log
                android.util.Log.d("ExoPlayerPlugin", "Set audioTrackListContainer visibility to GONE (8) after track selection, actual visibility: " + audioTrackListContainer.getVisibility());
                // #endregion
            }
            
            // Suppress auto-show when we programmatically focus the button after selection
            suppressAutoShowAudioList = true;
            // #region agent log
            android.util.Log.d("ExoPlayerPlugin", "Set suppressAutoShowAudioList = true before focusing button after track selection");
            // #endregion
            
            // Show controls and focus the audio track button
            showControls(null);
            if (audioTrackBtn != null) {
                // #region agent log
                android.util.Log.d("ExoPlayerPlugin", "Requesting focus on audioTrackBtn after track selection, button focusable: " + audioTrackBtn.isFocusable());
                // #endregion
                boolean focusResult = audioTrackBtn.requestFocus();
                // #region agent log
                android.util.Log.d("ExoPlayerPlugin", "Focus request result on audioTrackBtn: " + focusResult + ", hasFocus: " + audioTrackBtn.hasFocus());
                // #endregion
            }
            
            // Re-enable auto-show after a short delay to allow focus to settle
            audioTrackBtn.postDelayed(() -> {
                suppressAutoShowAudioList = false;
                // #region agent log
                android.util.Log.d("ExoPlayerPlugin", "Set suppressAutoShowAudioList = false after delay, audioTrackBtn hasFocus: " + (audioTrackBtn != null ? audioTrackBtn.hasFocus() : "null"));
                // Verify track buttons still have click handlers
                android.util.Log.d("ExoPlayerPlugin", "Verifying track buttons after track selection - buttons count: " + audioTrackButtons.size());
                for (int i = 0; i < audioTrackButtons.size(); i++) {
                    Button btn = audioTrackButtons.get(i);
                    if (btn != null) {
                        android.util.Log.d("ExoPlayerPlugin", "Track button " + i + " - clickable: " + btn.isClickable() + ", enabled: " + btn.isEnabled() + ", visibility: " + btn.getVisibility() + ", hasOnClick: " + btn.hasOnClickListeners());
                    } else {
                        android.util.Log.w("ExoPlayerPlugin", "Track button " + i + " is NULL!");
                    }
                }
                // #endregion
            }, 300);
        });
    }

    private void toggleAudioTrackList() {
        if (audioTrackListContainer == null) {
            // #region agent log
            android.util.Log.d("ExoPlayerPlugin", "toggleAudioTrackList() called but container is null");
            // #endregion
            return;
        }

        getActivity().runOnUiThread(() -> {
            // #region agent log
            android.util.Log.d("ExoPlayerPlugin", "toggleAudioTrackList() - current visibility: " + audioTrackListContainer.getVisibility() + ", isShowingAudioTrackList: " + isShowingAudioTrackList);
            // #endregion
            
            if (audioTrackListContainer.getVisibility() == View.VISIBLE) {
                // #region agent log
                android.util.Log.d("ExoPlayerPlugin", "toggleAudioTrackList() - hiding list");
                // #endregion
                hideAudioTrackList();
            } else {
                // #region agent log
                android.util.Log.d("ExoPlayerPlugin", "toggleAudioTrackList() - showing list");
                // #endregion
                // Clear suppress flag when user explicitly toggles
                suppressAutoShowAudioList = false;
                showAudioTrackList();
            }
        });
    }

    private void showAudioTrackList() {
        if (audioTrackListContainer == null || audioTrackList == null) {
            // #region agent log
            android.util.Log.d("ExoPlayerPlugin", "showAudioTrackList() called but container or list is null");
            // #endregion
            return;
        }

        getActivity().runOnUiThread(() -> {
            android.util.Log.d("ExoPlayerPlugin", "showAudioTrackList() called");
            // #region agent log
            android.util.Log.d("ExoPlayerPlugin", "showAudioTrackList - container visibility before: " + (audioTrackListContainer != null ? audioTrackListContainer.getVisibility() : "null") + ", buttons count: " + audioTrackButtons.size());
            // #endregion
            
            // Set flag to prevent hideControls from hiding the audio list
            isShowingAudioTrackList = true;
            android.util.Log.d("ExoPlayerPlugin", "Set isShowingAudioTrackList = true");
            
            // Hide controls when showing audio track list
            android.util.Log.d("ExoPlayerPlugin", "Calling hideControls() to hide controls");
            hideControls(null);
            
            // Clear focus from containerView so buttons can receive focus
            if (containerView != null && containerView.hasFocus()) {
                containerView.clearFocus();
                android.util.Log.d("ExoPlayerPlugin", "Cleared focus from containerView");
            }
            
            audioTrackListContainer.setVisibility(View.VISIBLE);
            // #region agent log
            android.util.Log.d("ExoPlayerPlugin", "Set audioTrackListContainer visibility to VISIBLE (0), current visibility: " + audioTrackListContainer.getVisibility());
            android.util.Log.d("ExoPlayerPlugin", "Verifying track buttons when showing list - buttons count: " + audioTrackButtons.size());
            for (int i = 0; i < audioTrackButtons.size(); i++) {
                Button btn = audioTrackButtons.get(i);
                if (btn != null) {
                    android.util.Log.d("ExoPlayerPlugin", "Track button " + i + " - clickable: " + btn.isClickable() + ", enabled: " + btn.isEnabled() + ", visibility: " + btn.getVisibility() + ", hasOnClick: " + btn.hasOnClickListeners() + ", parent: " + (btn.getParent() != null ? btn.getParent().getClass().getSimpleName() : "null"));
                } else {
                    android.util.Log.w("ExoPlayerPlugin", "Track button " + i + " is NULL when showing list!");
                }
            }
            // #endregion
            
            // Focus the first track button or currently selected one
            if (!audioTrackButtons.isEmpty()) {
                int focusIndex = selectedAudioTrackIndex >= 0 && selectedAudioTrackIndex < audioTrackButtons.size()
                    ? selectedAudioTrackIndex : 0;
                android.util.Log.d("ExoPlayerPlugin", "Showing audio track list, focusing button " + focusIndex + " of " + audioTrackButtons.size());
                Button focusButton = audioTrackButtons.get(focusIndex);
                android.util.Log.d("ExoPlayerPlugin", "Button focusable: " + focusButton.isFocusable() + ", focusableInTouchMode: " + focusButton.isFocusableInTouchMode());
                
                // Post the focus request to ensure it happens after the view is visible
                // Use a longer delay to ensure hideControls animation has completed
                focusButton.postDelayed(() -> {
                    // Clear any focus from containerView first
                    if (containerView != null && containerView.hasFocus()) {
                        containerView.clearFocus();
                        android.util.Log.d("ExoPlayerPlugin", "Cleared focus from containerView before focusing button");
                    }
                    
                    boolean focusResult = focusButton.requestFocus();
                    android.util.Log.d("ExoPlayerPlugin", "Focus request result: " + focusResult + ", button has focus: " + focusButton.hasFocus());
                    // Also check which view currently has focus
                    View focusedView = getActivity().getCurrentFocus();
                    android.util.Log.d("ExoPlayerPlugin", "Current focused view: " + (focusedView != null ? focusedView.getClass().getSimpleName() : "null"));
                    if (focusedView == focusButton) {
                        android.util.Log.d("ExoPlayerPlugin", "SUCCESS: Track button has focus!");
                    } else {
                        android.util.Log.w("ExoPlayerPlugin", "WARNING: Track button does NOT have focus. Focused view: " + (focusedView != null ? focusedView.toString() : "null"));
                        // Try one more time after a short delay
                        focusButton.postDelayed(() -> {
                            focusButton.requestFocus();
                            android.util.Log.d("ExoPlayerPlugin", "Retry focus request - button has focus: " + focusButton.hasFocus());
                        }, 100);
                    }
                }, 350); // Wait 350ms to ensure hideControls animation (300ms) has completed
            } else {
                android.util.Log.w("ExoPlayerPlugin", "No audio track buttons available to focus");
            }
        });
    }

    private void hideAudioTrackList() {
        if (audioTrackListContainer == null) {
            return;
        }

        getActivity().runOnUiThread(() -> {
            android.util.Log.d("ExoPlayerPlugin", "Hiding audio track list");
            // Clear the flag since we're hiding the list
            isShowingAudioTrackList = false;
            audioTrackListContainer.setVisibility(View.GONE);
            
            // Only show controls if they're not already hidden
            // This prevents showing controls when they're being auto-hidden
            if (controlsVisible && controlsView != null && controlsView.getVisibility() == View.VISIBLE) {
                // Controls are already visible, just reset the timer
                resetControlsHideTimer();
            } else if (!controlsVisible && !isShowingAudioTrackList) {
                // Show controls again when hiding audio track list (if controls were hidden and we're not showing the list)
                android.util.Log.d("ExoPlayerPlugin", "Showing controls after hiding audio track list");
                showControls(null);
            } else if (isShowingAudioTrackList) {
                android.util.Log.d("ExoPlayerPlugin", "NOT showing controls - isShowingAudioTrackList is true (audio list is being shown)");
            }
        });
    }

    private void selectAudioTrack(int trackIndex) {
        if (exoPlayer == null || trackSelector == null) {
            android.util.Log.w("ExoPlayerPlugin", "Cannot select audio track: exoPlayer or trackSelector is null");
            return;
        }

        Tracks tracks = exoPlayer.getCurrentTracks();
        if (tracks == null) {
            android.util.Log.w("ExoPlayerPlugin", "Cannot select audio track: no tracks available");
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
            android.util.Log.w("ExoPlayerPlugin", "Cannot select audio track: invalid track index " + trackIndex + " (available: " + (audioTrackGroup != null ? audioTrackGroup.length : 0) + ")");
            return;
        }

        // Extract format information before lambda (must be final or effectively final)
        final Tracks.Group finalAudioTrackGroup = audioTrackGroup;
        final int finalTrackIndex = trackIndex;
        androidx.media3.common.Format format = audioTrackGroup.getTrackFormat(trackIndex);
        final String trackName = getAudioTrackDisplayName(format);

        // Get the media track group for this audio track
        final TrackGroup mediaTrackGroup = audioTrackGroup.getMediaTrackGroup();
        
        // Get current track selection parameters
        TrackSelectionParameters currentTrackParams = exoPlayer.getTrackSelectionParameters();
        
        // Create the override for the selected track
        // Note: addOverride() will automatically replace any existing override for the same TrackGroup
        TrackSelectionOverride override = new TrackSelectionOverride(mediaTrackGroup, Collections.singletonList(trackIndex));
        
        // Apply the new track selection parameters
        // addOverride() replaces any existing override for the same TrackGroup, so we don't need to manually remove it
        exoPlayer.setTrackSelectionParameters(
            currentTrackParams.buildUpon()
                .addOverride(override)
                .build()
        );

        selectedAudioTrackIndex = trackIndex;

        android.util.Log.d("ExoPlayerPlugin", "Selected audio track: " + trackIndex + " (" + trackName + ")");

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
            String trackName = getAudioTrackDisplayName(format);
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
                // Select the chosen track using the same method as selectAudioTrack
                TrackSelectionOverride override = new TrackSelectionOverride(mediaTrackGroup, Collections.singletonList(which));
                // Apply the track selection override directly to ExoPlayer
                TrackSelectionParameters currentTrackParams = exoPlayer.getTrackSelectionParameters();
                
                // addOverride() will automatically replace any existing override for the same TrackGroup
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
                // CRITICAL: Exit immediately if user is seeking - prevents ANY updates during dragging
                // This check must happen FIRST, before any other operations
                if (isSeeking) {
                    return;
                }
                
                // Also check if seekbar is pressed (user is actively dragging)
                // This provides an additional safety check
                if (seekBar != null && seekBar.isPressed()) {
                    return;
                }
                
                if (exoPlayer != null && exoPlayer.isPlaying()) {
                    long currentPosition = exoPlayer.getCurrentPosition();
                    long duration = exoPlayer.getDuration();
                    
                    // Clear pendingSeekPosition once the player has caught up to it
                    // This allows subsequent skip button presses to use the correct current position
                    if (pendingSeekPosition >= 0 && Math.abs(currentPosition - pendingSeekPosition) < 1000) {
                        // Player position is within 1 second of pending position, clear it
                        pendingSeekPosition = -1;
                    }

                    // Send time update event
                    JSObject timeData = new JSObject();
                    timeData.put("currentTime", currentPosition / 1000.0); // Convert to seconds
                    timeData.put("duration", duration > 0 ? duration / 1000.0 : 0); // Convert to seconds

                    // Calculate progress percentage for seek bar (0-10000 for 0.01% precision)
                    final int progress = duration > 0 ? (int) ((currentPosition * 10000) / duration) : 0;
                    timeData.put("progress", progress / 100.0); // Convert back to percentage for JS

                    // Update seek bar on UI thread
                    // CRITICAL: Triple-check isSeeking and isPressed on UI thread right before updating
                    // This prevents race conditions where isSeeking becomes true or user starts dragging
                    // after we've calculated progress but before we update the seekbar
                    if (seekBar != null) {
                        final SeekBar seekBarRef = seekBar; // Create final reference for lambda
                        final int finalProgress = progress; // Final reference for progress
                        // Capture the time when this update was calculated
                        final long updateCalculationTime = System.currentTimeMillis();
                        getActivity().runOnUiThread(() -> {
                            // CRITICAL: Check isSeeking and isPressed AGAIN on UI thread
                            // This is the final gate - if either is true, DO NOT UPDATE
                            if (isSeeking || seekBarRef.isPressed()) {
                                Log.d(TAG, "Blocked seekbar update - isSeeking: " + isSeeking + ", isPressed: " + seekBarRef.isPressed());
                                return;
                            }
                            
                            // CRITICAL: If this update was calculated before seeking started, don't apply it
                            // This prevents queued updates from executing after user starts dragging
                            if (seekStartTime > 0 && updateCalculationTime < seekStartTime) {
                                Log.d(TAG, "Blocked seekbar update - calculated before seeking started. Calc time: " + updateCalculationTime + ", Seek start: " + seekStartTime);
                                return;
                            }
                            
                            // CRITICAL: Check if user has moved the seekbar manually
                            // If the current progress differs significantly from what we calculated,
                            // it means the user has moved it, so don't override it
                            // This prevents the "snap back" when a queued update executes right after user starts dragging
                            int currentSeekBarProgress = seekBarRef.getProgress();
                            if (Math.abs(currentSeekBarProgress - finalProgress) > 3) {
                                // User has moved the seekbar significantly - don't override
                                // This means a queued update is trying to reset the seekbar after user started dragging
                                Log.d(TAG, "Blocked seekbar update - user moved seekbar. Current: " + currentSeekBarProgress + ", Calculated: " + finalProgress);
                                return;
                            }
                            
                            // CRITICAL: Check both seek cooldown AND manual skip cooldown
                            // Manual skip cooldown is longer to prevent time updates from overwriting skip button updates
                            long timeSinceLastSeek = System.currentTimeMillis() - lastSeekTime;
                            long timeSinceManualSkip = System.currentTimeMillis() - lastManualSkipTime;
                            boolean shouldUpdate = timeSinceLastSeek > SEEK_COOLDOWN_MS && timeSinceManualSkip > MANUAL_SKIP_COOLDOWN_MS;
                            
                            if (shouldUpdate) {
                                seekBarRef.setProgress(finalProgress);
                            }
                        });
                    }

                    // Note: timeupdate events are not currently used by JavaScript
                    // Removed notifyListeners call to reduce log noise
                    // If needed in the future, uncomment: notifyListeners("timeupdate", timeData);

                    // Schedule next update (every 250ms for smooth updates)
                    // Only schedule if not seeking and seekbar is not pressed
                    if (timeUpdateHandler != null && !isSeeking && (seekBar == null || !seekBar.isPressed())) {
                        timeUpdateHandler.postDelayed(this, 250);
                    }
                }
            }
        };

        // Start the time update loop
        timeUpdateHandler.post(timeUpdateRunnable);
    }

    private void stopTimeUpdates() {
        if (timeUpdateHandler != null) {
            // Remove all pending callbacks to ensure no updates happen
            // This is critical to prevent seekbar from snapping back during dragging
            // Remove all messages and callbacks, including any queued runOnUiThread calls
            timeUpdateHandler.removeCallbacksAndMessages(null);
            timeUpdateRunnable = null;
            
            // Also remove any pending runnables from the main thread handler
            // This ensures no queued UI updates can execute after we stop time updates
            getActivity().runOnUiThread(() -> {
                // This empty runnable ensures any previously queued runOnUiThread calls
                // from the time update handler are processed, but we've already set isSeeking = true
                // so they will be blocked by the checks inside the lambda
            });
            
            Log.d(TAG, "Time updates stopped - isSeeking: " + isSeeking);
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

            // Note: ExoPlayer is created in this method, so we don't check for null here
            // The container and PlayerView are set up in initialize(), but ExoPlayer itself
            // is created here when loading the video

            getActivity().runOnUiThread(() -> {
                try {
                    // Create HttpDataSourceFactory with cross-protocol redirects enabled
                    // ExoPlayer's DefaultHttpDataSource automatically sends Range headers
                    // when making requests for progressive media streams via ProgressiveMediaSource


                    // When using ProgressiveMediaSource, ExoPlayer automatically adds Range headers
                    // (e.g., "Range: bytes=0-1048575") for chunked requests. This is handled
                    // internally by the DataSource when reading progressive media files.

                    // Create MediaItem
                    MediaItem.Builder mediaItemBuilder = new MediaItem.Builder()
                        .setUri(url);

                    if (subtitleUrl != null && !subtitleUrl.isEmpty()) {
                        Uri subtitleUri = Uri.parse(subtitleUrl);
                        mediaItemBuilder.setSubtitleConfigurations(
                            java.util.Collections.singletonList(
                                new androidx.media3.common.MediaItem.SubtitleConfiguration.Builder(subtitleUri)
                                    .setMimeType("text/vtt")
                                    .setLanguage("en")
                                    .build()
                            )
                        );
                    }

                    MediaItem mediaItem = mediaItemBuilder.build();

                    // Create ProgressiveMediaSource with the configured DataSourceFactory

                    // Create HttpDataSourceFactory with cross-protocol redirects enabled
                    DefaultHttpDataSource.Factory httpDataSourceFactory = new DefaultHttpDataSource.Factory()
                        .setAllowCrossProtocolRedirects(true)
                        .setConnectTimeoutMs(15000)
                        .setReadTimeoutMs(15000);
                        
                    ProgressiveMediaSource.Factory progressiveFactory = new ProgressiveMediaSource.Factory(httpDataSourceFactory);
                    MediaSource mediaSource = progressiveFactory.createMediaSource(mediaItem);
                    
                    // Initialize track selector for ExoPlayer
                    DefaultTrackSelector trackSelector = new DefaultTrackSelector(getContext());
                    this.trackSelector = trackSelector;
                    
                    exoPlayer = new ExoPlayer.Builder(getContext())
                        .setTrackSelector(trackSelector)
                        .build();

                    // Set the player on the PlayerView
                    if (playerView != null) {
                        playerView.setPlayer(exoPlayer);
                    }

                    // Set up ExoPlayer listener for playback state changes and errors
                    exoPlayer.addListener(new Player.Listener() {
                        @Override
                        public void onPlaybackStateChanged(int playbackState) {
                            if (playbackState == Player.STATE_READY || playbackState == Player.STATE_BUFFERING) {
                                // Start time updates when player is ready or buffering
                                startTimeUpdates();
                            } else if (playbackState == Player.STATE_ENDED) {
                                // Stop time updates when playback ends
                                stopTimeUpdates();
                            } else if (playbackState == Player.STATE_IDLE) {
                                // Player is idle - might indicate an error
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

                        @Override
                        public void onTracksChanged(Tracks tracks) {
                            android.util.Log.d(TAG, "onTracksChanged called - tracks: " + (tracks != null ? "not null" : "null"));
                            if (tracks != null) {
                                android.util.Log.d(TAG, "Total track groups count: " + tracks.getGroups().size());
                                
                                // #region agent log
                                // Log currently selected audio track after change
                                for (Tracks.Group trackGroup : tracks.getGroups()) {
                                    if (trackGroup.getType() == androidx.media3.common.C.TRACK_TYPE_AUDIO) {
                                        for (int i = 0; i < trackGroup.length; i++) {
                                            if (trackGroup.isTrackSelected(i)) {
                                                androidx.media3.common.Format format = trackGroup.getTrackFormat(i);
                                                String trackName = getAudioTrackDisplayName(format);
                                                android.util.Log.d(TAG, "CURRENTLY SELECTED AUDIO TRACK after onTracksChanged: " + trackName + " (index " + i + " in group)");
                                            }
                                        }
                                    }
                                }
                                // #endregion
                                
                                // Log details about all track types
                                int videoTrackCount = 0;
                                int audioTrackCount = 0;
                                int subtitleTrackCount = 0;
                                int otherTrackCount = 0;
                                
                                for (Tracks.Group trackGroup : tracks.getGroups()) {
                                    int trackType = trackGroup.getType();
                                    int trackLength = trackGroup.length;
                                    
                                    if (trackType == androidx.media3.common.C.TRACK_TYPE_VIDEO) {
                                        videoTrackCount += trackLength;
                                        android.util.Log.d(TAG, "Video track group found with " + trackLength + " track(s)");
                                        for (int i = 0; i < trackLength; i++) {
                                            androidx.media3.common.Format format = trackGroup.getTrackFormat(i);
                                            String codec = format.codecs != null ? format.codecs : "unknown";
                                            String resolution = format.width > 0 && format.height > 0 ? 
                                                format.width + "x" + format.height : "unknown";
                                            boolean isSelected = trackGroup.isTrackSelected(i);
                                            android.util.Log.d(TAG, "  Video track " + i + ": codec=" + codec + 
                                                ", resolution=" + resolution + ", selected=" + isSelected);
                                        }
                                    } else if (trackType == androidx.media3.common.C.TRACK_TYPE_AUDIO) {
                                        audioTrackCount += trackLength;
                                        android.util.Log.d(TAG, "Audio track group found with " + trackLength + " track(s)");
                                        for (int i = 0; i < trackLength; i++) {
                                            androidx.media3.common.Format format = trackGroup.getTrackFormat(i);
                                            String label = format.label != null ? format.label : 
                                                (format.language != null ? format.language : "Track " + (i + 1));
                                            String codec = format.codecs != null ? format.codecs : "unknown";
                                            int channels = format.channelCount > 0 ? format.channelCount : 0;
                                            boolean isSelected = trackGroup.isTrackSelected(i);
                                            android.util.Log.d(TAG, "  Audio track " + i + ": label=" + label + 
                                                ", codec=" + codec + ", channels=" + channels + ", selected=" + isSelected);
                                        }
                                    } else if (trackType == androidx.media3.common.C.TRACK_TYPE_TEXT) {
                                        subtitleTrackCount += trackLength;
                                        android.util.Log.d(TAG, "Subtitle/text track group found with " + trackLength + " track(s)");
                                    } else {
                                        otherTrackCount += trackLength;
                                        android.util.Log.d(TAG, "Other track group (type=" + trackType + ") found with " + trackLength + " track(s)");
                                    }
                                }
                                
                                android.util.Log.d(TAG, "Track summary - Video: " + videoTrackCount + 
                                    ", Audio: " + audioTrackCount + 
                                    ", Subtitle: " + subtitleTrackCount + 
                                    ", Other: " + otherTrackCount);
                            }
                            
                            // Update audio track UI when tracks change
                            updateAudioTrackUI(tracks);
                            
                            // Notify JavaScript about available audio tracks
                            notifyAudioTracksDetected(tracks);
                        }

                        @Override
                        public void onPlayerError(PlaybackException error) {
                            String errorMessage = "Playback error: " + error.getMessage();
                            if (error.getCause() != null) {
                                errorMessage += " (Cause: " + error.getCause().getMessage() + ")";
                            }
                            
                            // Check if it's a codec-related error
                            if (error.errorCode == PlaybackException.ERROR_CODE_DECODER_INIT_FAILED ||
                                error.errorCode == PlaybackException.ERROR_CODE_DECODER_QUERY_FAILED ||
                                error.errorCode == PlaybackException.ERROR_CODE_PARSING_CONTAINER_MALFORMED) {
                                errorMessage = "Codec not supported: " + errorMessage;
                                Log.e(TAG, "Codec error detected - video codec may not be supported by this device");
                            }
                            
                            Log.e(TAG, errorMessage);
                            
                            // Notify JavaScript about the error
                            try {
                                JSObject errorData = new JSObject();
                                errorData.put("error", errorMessage);
                                errorData.put("errorCode", error.errorCode);
                                errorData.put("codecError", error.errorCode == PlaybackException.ERROR_CODE_DECODER_INIT_FAILED ||
                                                          error.errorCode == PlaybackException.ERROR_CODE_DECODER_QUERY_FAILED);
                                notifyListeners("playerError", errorData);
                            } catch (Exception e) {
                                Log.e(TAG, "Error notifying listeners about playback error", e);
                            }
                        }
                    });

                    // Set the media source directly (ProgressiveMediaSource ensures range headers are sent)
                    exoPlayer.setMediaSource(mediaSource);
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
    public void getAudioTracks(PluginCall call) {
        if (exoPlayer == null) {
            call.reject("ExoPlayer not initialized");
            return;
        }

        Tracks tracks = exoPlayer.getCurrentTracks();
        if (tracks == null) {
            JSObject ret = new JSObject();
            ret.put("tracks", "[]");
            ret.put("count", 0);
            ret.put("currentIndex", -1);
            ret.put("hasMultiple", false);
            call.resolve(ret);
            return;
        }

        try {
            // Find audio tracks
            for (Tracks.Group trackGroup : tracks.getGroups()) {
                if (trackGroup.getType() == androidx.media3.common.C.TRACK_TYPE_AUDIO) {
                    org.json.JSONArray tracksArray = new org.json.JSONArray();
                    
                    int currentIndex = -1;
                    int trackCount = trackGroup.length;
                    
                    // Build array of track information
                    for (int i = 0; i < trackGroup.length; i++) {
                        androidx.media3.common.Format format = trackGroup.getTrackFormat(i);
                        String trackName = getAudioTrackDisplayName(format);
                        
                        org.json.JSONObject trackInfo = new org.json.JSONObject();
                        trackInfo.put("id", i);
                        trackInfo.put("label", trackName);
                        trackInfo.put("language", format.language != null ? format.language : "");
                        trackInfo.put("enabled", trackGroup.isTrackSelected(i));
                        
                        tracksArray.put(trackInfo);
                        
                        if (trackGroup.isTrackSelected(i)) {
                            currentIndex = i;
                        }
                    }
                    
                    JSObject ret = new JSObject();
                    ret.put("tracks", tracksArray.toString());
                    ret.put("count", trackCount);
                    ret.put("currentIndex", currentIndex);
                    ret.put("hasMultiple", trackCount > 1);
                    call.resolve(ret);
                    return;
                }
            }
            
            // No audio tracks found
            JSObject ret = new JSObject();
            ret.put("tracks", "[]");
            ret.put("count", 0);
            ret.put("currentIndex", -1);
            ret.put("hasMultiple", false);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error getting audio tracks: " + e.getMessage());
        }
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

            // Only hide audio track list when controls are shown if we're not intentionally showing it
            // #region agent log
            android.util.Log.d("ExoPlayerPlugin", "showControls - checking audio list: isShowingAudioTrackList=" + isShowingAudioTrackList + ", container null=" + (audioTrackListContainer == null) + ", container visibility=" + (audioTrackListContainer != null ? audioTrackListContainer.getVisibility() : "null") + ", buttons count=" + audioTrackButtons.size());
            // #endregion
            if (!isShowingAudioTrackList && audioTrackListContainer != null && audioTrackListContainer.getVisibility() == View.VISIBLE) {
                android.util.Log.d("ExoPlayerPlugin", "Hiding audio track list because controls are being shown (not showing audio list)");
                audioTrackListContainer.setVisibility(View.GONE);
            } else if (isShowingAudioTrackList) {
                android.util.Log.d("ExoPlayerPlugin", "NOT hiding audio track list in showControls - isShowingAudioTrackList flag is true");
            }

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
            resetControlsHideTimer();

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
                    
                    // Only hide audio track list if we're not intentionally showing it
                    // #region agent log
                    android.util.Log.d("ExoPlayerPlugin", "hideControls - checking audio list: isShowingAudioTrackList=" + isShowingAudioTrackList + ", container null=" + (audioTrackListContainer == null) + ", container visibility=" + (audioTrackListContainer != null ? audioTrackListContainer.getVisibility() : "null") + ", buttons count=" + audioTrackButtons.size());
                    // #endregion
                    if (!isShowingAudioTrackList && audioTrackListContainer != null && audioTrackListContainer.getVisibility() == View.VISIBLE) {
                        android.util.Log.d("ExoPlayerPlugin", "Hiding audio track list because controls are being hidden (not showing audio list)");
                        audioTrackListContainer.setVisibility(View.GONE);
                        // #region agent log
                        android.util.Log.d("ExoPlayerPlugin", "Audio list hidden - checking if track buttons are still clickable");
                        for (int i = 0; i < audioTrackButtons.size(); i++) {
                            Button btn = audioTrackButtons.get(i);
                            android.util.Log.d("ExoPlayerPlugin", "Track button " + i + " - clickable: " + btn.isClickable() + ", enabled: " + btn.isEnabled() + ", visibility: " + btn.getVisibility() + ", hasOnClick: " + (btn.hasOnClickListeners()));
                        }
                        // #endregion
                    } else if (isShowingAudioTrackList) {
                        android.util.Log.d("ExoPlayerPlugin", "NOT hiding audio track list - isShowingAudioTrackList flag is true");
                    }
                    
                    // Only re-request focus on containerView if audio list is NOT visible
                    // If audio list is visible, let the track buttons keep focus
                    if (!isShowingAudioTrackList && containerView != null) {
                        // #region agent log
                        android.util.Log.d("ExoPlayerPlugin", "Controls hidden - checking audioTrackBtn focus before re-requesting containerView focus");
                        if (audioTrackBtn != null) {
                            android.util.Log.d("ExoPlayerPlugin", "audioTrackBtn hasFocus: " + audioTrackBtn.hasFocus() + ", isClickable: " + audioTrackBtn.isClickable() + ", visibility: " + audioTrackBtn.getVisibility());
                        }
                        // #endregion
                        
                        containerView.post(() -> {
                            if (containerView != null) {
                                containerView.requestFocus();
                                // #region agent log
                                android.util.Log.d("ExoPlayerPlugin", "Re-requested focus on containerView, audioTrackBtn now hasFocus: " + (audioTrackBtn != null ? audioTrackBtn.hasFocus() : "null"));
                                // #endregion
                            }
                        });
                        android.util.Log.d("ExoPlayerPlugin", "Controls hidden - visibility: GONE, re-requested focus on containerView");
                    } else if (isShowingAudioTrackList) {
                        android.util.Log.d("ExoPlayerPlugin", "NOT re-requesting focus on containerView - audio list is visible, buttons should keep focus");
                    }
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
            // Never update if user is currently dragging (isSeeking takes absolute priority)
            // Also check cooldown for skip operations
            long timeSinceLastSeek = System.currentTimeMillis() - lastSeekTime;
            boolean canUpdate = !isSeeking && !seekBar.isPressed() && timeSinceLastSeek > SEEK_COOLDOWN_MS;
            
            if (canUpdate) {
                final int finalProgress = progress;
                getActivity().runOnUiThread(() -> {
                    // Double-check isSeeking on UI thread right before updating
                    // This prevents race conditions where isSeeking becomes true
                    // after we've checked but before we update the seekbar
                    if (!isSeeking && !seekBar.isPressed()) {
                        seekBar.setProgress(finalProgress);
                    }
                });
            }
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
            int progress = (int)((currentTime * 10000.0) / duration);
            // Never update if user is currently dragging (isSeeking takes absolute priority)
            // Also check cooldown for skip operations
            long timeSinceLastSeek = System.currentTimeMillis() - lastSeekTime;
            boolean canUpdate = !isSeeking && !seekBar.isPressed() && timeSinceLastSeek > SEEK_COOLDOWN_MS;
            
            if (canUpdate) {
                final int finalProgress = progress;
                getActivity().runOnUiThread(() -> {
                    // Double-check isSeeking on UI thread right before updating
                    // This prevents race conditions where isSeeking becomes true
                    // after we've checked but before we update the seekbar
                    if (!isSeeking && !seekBar.isPressed()) {
                        seekBar.setProgress(finalProgress);
                    }
                });
            }
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

    @PluginMethod
    public void launchZidooPlayer(PluginCall call) {
        try {
            String videoUrl = call.getString("url");
            String title = call.getString("title", "");
            int position = call.getInt("position", 0);
            
            // #region agent log
            Log.d(TAG, "launchZidooPlayer called - url: " + (videoUrl != null ? videoUrl.substring(0, Math.min(50, videoUrl.length())) : "null") + ", title: " + title);
            // #endregion
            
            if (videoUrl == null || videoUrl.isEmpty()) {
                call.reject("Video URL is required");
                return;
            }

            // Check if Zidoo player is installed
            PackageManager pm = getContext().getPackageManager();
            
            // #region agent log
            Log.d(TAG, "Checking for Zidoo player - trying multiple detection methods");
            // #endregion
            
            // Method 1: Check for com.zidoo.poster package (we know this exists on Z9X Pro)
            boolean isZidooDevice = false;
            try {
                pm.getPackageInfo("com.zidoo.poster", 0);
                isZidooDevice = true;
                // #region agent log
                Log.d(TAG, "Method 1: Found com.zidoo.poster package - Zidoo device confirmed");
                // #endregion
            } catch (PackageManager.NameNotFoundException e) {
                // #region agent log
                Log.d(TAG, "Method 1: com.zidoo.poster package not found");
                // #endregion
            }
            
            // Method 2: Try queryIntentActivities (for Activities that handle the Intent)
            if (!isZidooDevice) {
                Intent testIntent = new Intent("com.zidoo.player.action.VIDEO_PLAY");
                java.util.List<android.content.pm.ResolveInfo> activityHandlers = pm.queryIntentActivities(testIntent, 0);
                // #region agent log
                Log.d(TAG, "Method 2: queryIntentActivities found " + (activityHandlers != null ? activityHandlers.size() : 0) + " handler(s)");
                // #endregion
                isZidooDevice = activityHandlers != null && !activityHandlers.isEmpty();
            }
            
            // Method 3: Try queryBroadcastReceivers (for BroadcastReceivers that handle the Intent)
            if (!isZidooDevice) {
                Intent testIntent = new Intent("com.zidoo.player.action.VIDEO_PLAY");
                java.util.List<android.content.pm.ResolveInfo> broadcastHandlers = pm.queryBroadcastReceivers(testIntent, 0);
                // #region agent log
                Log.d(TAG, "Method 3: queryBroadcastReceivers found " + (broadcastHandlers != null ? broadcastHandlers.size() : 0) + " handler(s)");
                // #endregion
                isZidooDevice = broadcastHandlers != null && !broadcastHandlers.isEmpty();
            }
            
            // #region agent log
            Log.d(TAG, "Final Zidoo device detection result: " + (isZidooDevice ? "CONFIRMED" : "NOT FOUND"));
            // #endregion
            
            if (!isZidooDevice) {
                // #region agent log
                Log.e(TAG, "No Zidoo player packages found - hypothesis A REJECTED, hypothesis C (not installed) CONFIRMED");
                // Try to list all installed packages with "zidoo" in name for debugging
                try {
                    java.util.List<android.content.pm.PackageInfo> packages = pm.getInstalledPackages(0);
                    int zidooCount = 0;
                    for (android.content.pm.PackageInfo pkgInfo : packages) {
                        if (pkgInfo.packageName.toLowerCase().contains("zidoo")) {
                            Log.d(TAG, "Found installed package with 'zidoo' in name: " + pkgInfo.packageName);
                            zidooCount++;
                        }
                    }
                    Log.d(TAG, "Total packages with 'zidoo' in name: " + zidooCount);
                } catch (Exception e) {
                    Log.e(TAG, "Error listing packages: " + e.getMessage());
                }
                // #endregion
                
                // Fallback: Try generic video player Intent (let Android choose the best player)
                // #region agent log
                Log.d(TAG, "Attempting fallback to generic video player Intent");
                // #endregion
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW);
                    intent.setDataAndType(Uri.parse(videoUrl), "video/*");
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    
                    // Check if any app can handle this Intent
                    if (intent.resolveActivity(pm) != null) {
                        // #region agent log
                        Log.d(TAG, "Generic video player Intent can be resolved - launching");
                        // #endregion
                        getActivity().startActivity(intent);
                        
                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        ret.put("fallback", true);
                        call.resolve(ret);
                        return;
                    } else {
                        // #region agent log
                        Log.e(TAG, "No app can handle video Intent");
                        // #endregion
                        call.reject("Zidoo player is not installed and no video player app found");
                        return;
                    }
                } catch (Exception e) {
                    // #region agent log
                    Log.e(TAG, "Error with fallback Intent: " + e.getMessage());
                    // #endregion
                    call.reject("Zidoo player is not installed and failed to launch fallback player: " + e.getMessage());
                    return;
                }
            }
            
            try {
                // Check if videoUrl is an HTTP URL - Zidoo needs file paths, not HTTP URLs
                boolean isHttpUrl = videoUrl.startsWith("http://") || videoUrl.startsWith("https://");
                
                // #region agent log
                Log.d(TAG, "Video URL/path received: " + videoUrl.substring(0, Math.min(100, videoUrl.length())));
                Log.d(TAG, "Is HTTP URL: " + isHttpUrl);
                // #endregion
                
                if (isHttpUrl) {
                    // #region agent log
                    Log.e(TAG, "Zidoo player does not support HTTP streaming - need file path");
                    // #endregion
                    call.reject("Zidoo player requires a file path, not an HTTP URL. The server should provide the file path for Zidoo devices.");
                    return;
                }
                
                // Option 1: Launch Zidoo's File Manager or file browser to open the file
                // This allows Zidoo's File Manager to handle the file and launch the native player
                // NOTE: We don't check if the file exists because our app is sandboxed and cannot
                // see system mount points (/mnt/*), USB drives, or SMB/NFS mounts. Zidoo's native
                // player can see these paths, so we trust the path and let Zidoo validate it.
                // #region agent log
                Log.d(TAG, "Using file browser method to launch Zidoo player");
                Log.d(TAG, "File path: " + videoUrl);
                Log.d(TAG, "Note: Not checking file existence - app is sandboxed, Zidoo can see the file");
                // #endregion
                
                // Create file URI from path string (don't use File object since we can't verify existence)
                // Use file:// URI scheme for local file paths
                Uri fileUri;
                if (videoUrl.startsWith("/")) {
                    // Local file path - use file:// URI
                    fileUri = Uri.parse("file://" + videoUrl);
                } else {
                    // Already a URI or unexpected format
                    fileUri = Uri.parse(videoUrl);
                }
                
                // Try to determine MIME type from file extension (extract from path string)
                String mimeType = "video/*";
                String pathLower = videoUrl.toLowerCase();
                if (pathLower.endsWith(".mkv")) {
                    mimeType = "video/x-matroska";
                } else if (pathLower.endsWith(".mp4")) {
                    mimeType = "video/mp4";
                } else if (pathLower.endsWith(".avi")) {
                    mimeType = "video/x-msvideo";
                } else if (pathLower.endsWith(".m4v")) {
                    mimeType = "video/mp4";
                } else if (pathLower.endsWith(".mov")) {
                    mimeType = "video/quicktime";
                }
                
                // #region agent log
                Log.d(TAG, "File URI: " + fileUri.toString());
                Log.d(TAG, "MIME type: " + mimeType);
                // #endregion
                
                // Check if path is on a system mount point that regular apps can't access
                // Paths like /mnt/*, /storage/*, etc. are only accessible to system apps
                boolean isSystemMountPath = videoUrl.startsWith("/mnt/") || 
                                           videoUrl.startsWith("/storage/") ||
                                           videoUrl.startsWith("/sdcard/");
                
                // #region agent log
                Log.d(TAG, "File path: " + videoUrl);
                Log.d(TAG, "Is system mount path: " + isSystemMountPath);
                // #endregion
                
                // If it's a system mount path, skip regular apps (they can't access it)
                // and go straight to trying to open Zidoo's File Manager
                if (!isSystemMountPath) {
                    // Method 1: Try ACTION_VIEW but EXCLUDE com.zidoo.poster (Poster Wall)
                    // Only try this for paths that regular apps might be able to access
                    Intent fileManagerIntent = new Intent(Intent.ACTION_VIEW);
                    fileManagerIntent.setDataAndType(fileUri, mimeType);
                    fileManagerIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    fileManagerIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    
                    // Get all apps that can handle this Intent
                    java.util.List<android.content.pm.ResolveInfo> resolveList = pm.queryIntentActivities(fileManagerIntent, 0);
                    
                    // #region agent log
                    Log.d(TAG, "Method 1: Trying ACTION_VIEW with file URI (non-system path)");
                    Log.d(TAG, "Found " + (resolveList != null ? resolveList.size() : 0) + " apps that can handle this Intent");
                    // #endregion
                    
                    // Filter out com.zidoo.poster (Poster Wall) from the list
                    if (resolveList != null && !resolveList.isEmpty()) {
                        // Find an app that's NOT Poster Wall
                        android.content.pm.ResolveInfo selectedApp = null;
                        for (android.content.pm.ResolveInfo info : resolveList) {
                            if (info.activityInfo != null && !info.activityInfo.packageName.equals("com.zidoo.poster")) {
                                selectedApp = info;
                                // #region agent log
                                Log.d(TAG, "Found non-Poster app: " + info.activityInfo.packageName);
                                // #endregion
                                break;
                            }
                        }
                        
                        if (selectedApp != null) {
                            try {
                                Intent specificIntent = new Intent(Intent.ACTION_VIEW);
                                specificIntent.setDataAndType(fileUri, mimeType);
                                specificIntent.setClassName(selectedApp.activityInfo.packageName, selectedApp.activityInfo.name);
                                specificIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                specificIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                                
                                if (specificIntent.resolveActivity(pm) != null) {
                                    getActivity().startActivity(specificIntent);
                                    // #region agent log
                                    Log.d(TAG, "Method 1 SUCCESS: Launched " + selectedApp.activityInfo.packageName);
                                    // #endregion
                                    JSObject ret = new JSObject();
                                    ret.put("success", true);
                                    call.resolve(ret);
                                    return;
                                }
                            } catch (Exception e) {
                                // #region agent log
                                Log.w(TAG, "Method 1 failed: " + e.getMessage());
                                // #endregion
                            }
                        }
                    }
                } else {
                    // #region agent log
                    Log.d(TAG, "Skipping Method 1 - system mount path requires File Manager");
                    // #endregion
                }
                
                // Method 2: Show chooser dialog excluding Poster Wall
                // This lets the user choose which app to use, but we'll filter out Poster Wall
                // Only try this for non-system mount paths
                if (!isSystemMountPath) {
                    try {
                        Intent chooserIntent = new Intent(Intent.ACTION_VIEW);
                        chooserIntent.setDataAndType(fileUri, mimeType);
                        chooserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        
                        // Get apps that can handle this Intent
                        java.util.List<android.content.pm.ResolveInfo> resolveList2 = pm.queryIntentActivities(chooserIntent, 0);
                        
                        // Create a list of apps excluding Poster Wall
                        java.util.List<android.content.pm.ResolveInfo> filteredList = new java.util.ArrayList<>();
                        if (resolveList2 != null) {
                            for (android.content.pm.ResolveInfo info : resolveList2) {
                                if (info.activityInfo != null && !info.activityInfo.packageName.equals("com.zidoo.poster")) {
                                    filteredList.add(info);
                                }
                            }
                        }
                    
                    if (!filteredList.isEmpty()) {
                        // Create chooser with filtered list
                        android.content.Intent[] initialIntents = new android.content.Intent[filteredList.size()];
                        for (int i = 0; i < filteredList.size(); i++) {
                            android.content.pm.ResolveInfo info = filteredList.get(i);
                            Intent specificIntent = new Intent(Intent.ACTION_VIEW);
                            specificIntent.setDataAndType(fileUri, mimeType);
                            specificIntent.setClassName(info.activityInfo.packageName, info.activityInfo.name);
                            specificIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            initialIntents[i] = specificIntent;
                        }
                        
                        Intent chooser = Intent.createChooser(chooserIntent, "Open with");
                        chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, initialIntents);
                        
                        // #region agent log
                        Log.d(TAG, "Method 2: Showing chooser dialog with " + filteredList.size() + " apps (Poster Wall excluded)");
                        // #endregion
                        
                        getActivity().startActivity(chooser);
                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        call.resolve(ret);
                        return;
                    }
                    } catch (Exception e) {
                        // #region agent log
                        Log.w(TAG, "Method 2 failed: " + e.getMessage());
                        // #endregion
                    }
                }
                
                // Method 3: Open Zidoo Media Center at the directory containing the file
                // Media Center cannot auto-play files, but it can open folders
                // User will need to manually select the file in Media Center to play it
                try {
                    int lastSlash = videoUrl.lastIndexOf('/');
                    if (lastSlash > 0) {
                        String directoryPath = videoUrl.substring(0, lastSlash);
                        String fileName = videoUrl.substring(lastSlash + 1);
                        
                        // #region agent log
                        Log.d(TAG, "Method 3: Opening Zidoo Media Center at directory");
                        Log.d(TAG, "Directory: " + directoryPath);
                        Log.d(TAG, "File name: " + fileName);
                        // #endregion
                        
                        // Create URI for the directory (not the file)
                        Uri dirUri = Uri.parse("file://" + directoryPath);
                        
                        // Method 3a: Try ACTION_VIEW with directory URI, targeting Media Center
                        try {
                            Intent viewIntent = new Intent(Intent.ACTION_VIEW);
                            viewIntent.setDataAndType(dirUri, "resource/folder");
                            viewIntent.setPackage("com.zidoo.poster");
                            viewIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            viewIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
                            
                            // Add directory path as extra
                            viewIntent.putExtra("path", directoryPath);
                            viewIntent.putExtra("folderPath", directoryPath);
                            viewIntent.putExtra("directory", directoryPath);
                            
                            // Also include the filename so Media Center knows which file to highlight (if supported)
                            viewIntent.putExtra("fileName", fileName);
                            viewIntent.putExtra("file", fileName);
                            
                            // #region agent log
                            Log.d(TAG, "Method 3a: Trying ACTION_VIEW with directory, targeting com.zidoo.poster");
                            Log.d(TAG, "Directory URI: " + dirUri.toString());
                            // #endregion
                            
                            if (viewIntent.resolveActivity(pm) != null) {
                                getActivity().startActivity(viewIntent);
                                // #region agent log
                                Log.d(TAG, "Method 3a SUCCESS: Opened Media Center at directory");
                                // #endregion
                                JSObject ret = new JSObject();
                                ret.put("success", true);
                                ret.put("message", "Media Center opened. Please select " + fileName + " to play.");
                                ret.put("directory", directoryPath);
                                ret.put("fileName", fileName);
                                call.resolve(ret);
                                return;
                            } else {
                                // #region agent log
                                Log.w(TAG, "Method 3a: ACTION_VIEW cannot be resolved by com.zidoo.poster");
                                // #endregion
                            }
                        } catch (Exception e) {
                            // #region agent log
                            Log.d(TAG, "Method 3a failed: " + e.getMessage());
                            // #endregion
                        }
                        
                        // Method 3b: Launch Media Center and pass directory path as extra
                        try {
                            Intent mediaCenterIntent = pm.getLaunchIntentForPackage("com.zidoo.poster");
                            if (mediaCenterIntent != null) {
                                mediaCenterIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                mediaCenterIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
                                
                                // Add directory path in multiple formats
                                mediaCenterIntent.putExtra("path", directoryPath);
                                mediaCenterIntent.putExtra("folderPath", directoryPath);
                                mediaCenterIntent.putExtra("directory", directoryPath);
                                mediaCenterIntent.putExtra("folder", directoryPath);
                                
                                // Include filename for reference
                                mediaCenterIntent.putExtra("fileName", fileName);
                                mediaCenterIntent.putExtra("file", fileName);
                                
                                // Set directory URI as data
                                mediaCenterIntent.setData(dirUri);
                                mediaCenterIntent.setType("resource/folder");
                                
                                // #region agent log
                                Log.d(TAG, "Method 3b: Launching com.zidoo.poster with directory path");
                                // #endregion
                                
                                getActivity().startActivity(mediaCenterIntent);
                                
                                // #region agent log
                                Log.d(TAG, "Method 3b SUCCESS: Zidoo Media Center launched at directory");
                                // #endregion
                                
                                JSObject ret = new JSObject();
                                ret.put("success", true);
                                ret.put("message", "Media Center opened. Please select " + fileName + " to play.");
                                ret.put("directory", directoryPath);
                                ret.put("fileName", fileName);
                                call.resolve(ret);
                                return;
                            }
                        } catch (Exception e) {
                            // #region agent log
                            Log.d(TAG, "Method 3b failed: " + e.getMessage());
                            // #endregion
                        }
                    } else {
                        // #region agent log
                        Log.w(TAG, "Method 3: Could not extract directory from file path: " + videoUrl);
                        // #endregion
                    }
                } catch (Exception e) {
                    // #region agent log
                    Log.e(TAG, "Method 3 failed to open Zidoo Media Center: " + e.getMessage(), e);
                    // #endregion
                }
                
                // #region agent log
                Log.e(TAG, "All methods failed - could not launch Zidoo player or file manager");
                Log.e(TAG, "File path: " + videoUrl);
                // #endregion
                
                // Return failure - we tried everything
                JSObject ret = new JSObject();
                ret.put("success", false);
                ret.put("filePath", videoUrl);
                call.resolve(ret);
            } catch (Exception e) {
                // #region agent log
                Log.e(TAG, "Error launching Zidoo player: " + e.getMessage(), e);
                // #endregion
                call.reject("Failed to launch Zidoo player: " + e.getMessage());
            }
        } catch (Exception e) {
            Log.e(TAG, "Error launching Zidoo player", e);
            call.reject("Failed to launch Zidoo player: " + e.getMessage());
        }
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

