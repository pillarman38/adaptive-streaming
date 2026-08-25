package com.adaptivestreaming.app;

import android.net.Uri;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.os.Build;
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
import android.widget.Toast;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.StateListDrawable;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.Drawable;
import android.graphics.PorterDuff;
import android.graphics.Color;
import android.view.Gravity;
import android.util.DisplayMetrics;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import androidx.media3.exoplayer.SeekParameters;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.Format;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.Player;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Tracks;
import androidx.media3.common.TrackSelectionParameters;
import androidx.media3.common.TrackGroup;
import androidx.media3.common.TrackSelectionOverride;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.mediacodec.MediaCodecSelector;
import androidx.media3.exoplayer.mediacodec.MediaCodecUtil;
import androidx.media3.exoplayer.mediacodec.MediaCodecInfo;
import androidx.media3.exoplayer.ExoPlayer;
import android.util.Log;
import androidx.media3.exoplayer.mediacodec.MediaCodecUtil;
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector;
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector.SelectionOverride;
import androidx.media3.ui.PlayerView;
import androidx.media3.datasource.DataSource;
import androidx.media3.datasource.DataSpec;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.datasource.HttpDataSource;
import androidx.media3.datasource.cache.CacheDataSource;
import java.io.IOException;
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor;
import androidx.media3.datasource.cache.SimpleCache;
import androidx.media3.database.StandaloneDatabaseProvider;
import androidx.media3.exoplayer.DefaultLoadControl;
import androidx.media3.exoplayer.source.ProgressiveMediaSource;
import androidx.media3.exoplayer.hls.HlsMediaSource;
import java.io.File;
import androidx.media3.exoplayer.source.MediaSource;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import java.util.Collections;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import com.adaptivestreaming.app.R;
import androidx.core.content.FileProvider;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

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
    private android.widget.ScrollView audioTrackScrollView;
    private java.util.List<Button> audioTrackButtons = new java.util.ArrayList<>();
    private int selectedAudioTrackIndex = -1;
    private int focusedAudioTrackIndex = -1;
    private Runnable pendingAudioTrackListFocusRunnable;
    private int lastWorkingAudioGroupIdx = -1;
    private int lastWorkingAudioTrackIdx = -1;
    private int lastWorkingAudioGlobalIndex = -1;
    private boolean controlsVisible = false;
    private volatile boolean isShowingAudioTrackList = false; // Flag to prevent hideControls from hiding audio list
    private volatile boolean suppressAutoShowAudioList = false; // Flag to prevent auto-showing list when button gets focus programmatically

    private static final class SubtitleTrackOption {
        final String label;
        final String url;

        SubtitleTrackOption(String label, String url) {
            this.label = label;
            this.url = url;
        }
    }

    private ImageButton subtitleTrackBtn;
    private TextView currentSubtitleTrackLabel;
    private LinearLayout subtitleTrackRow;
    private LinearLayout subtitleTrackListContainer;
    private LinearLayout subtitleTrackList;
    private android.widget.ScrollView subtitleTrackScrollView;
    private final java.util.List<Button> subtitleTrackButtons = new java.util.ArrayList<>();
    private final java.util.List<SubtitleTrackOption> availableSubtitleTracks =
            new java.util.ArrayList<>();
    private int selectedSubtitleTrackIndex = -1;
    private int focusedSubtitleTrackIndex = -1;
    private volatile boolean isShowingSubtitleTrackList = false;
    private volatile boolean suppressAutoShowSubtitleList = false;
    private String selectedSubtitleUrl = null;
    private Uri currentPlaybackUri;
    private boolean currentPlaybackIsHls;
    private boolean currentPlaybackIsHttpMkv;
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
    /** Rapid skip presses coalesce to one seekTo. */
    private static final long SEEK_COALESCE_MS = 450;
    private android.os.Handler seekCoalesceHandler;
    private Runnable coalescedSeekRunnable;
    private long coalescedSeekTargetMs = -1;
    private String coalescedSeekSource = "";
    private long lastCommittedSeekMs = 0;
    private String lastCommittedSeekSource = "";
    private boolean hasAutoSelectedAudio = false;
    private boolean userLockedAudioTrack = false;
    private boolean hasAppliedHdrDisplayMode = false;
    private boolean pendingHdrDisplayMode = false;
    private SimpleCache mediaCache;
    private CacheDataSource.Factory activeCacheDataSourceFactory;
    private String currentStreamUrl;
    /** Growing server HLS (shield-streams); duration may exceed encoded segments. */
    private boolean currentStreamIsEventHls = false;
    private volatile boolean indexTailPrewarmed = false;
    private volatile boolean indexTailPrewarmInProgress = false;
    private long streamContentLength = -1;
    private volatile long lastAudioTrackSwitchMs = 0;
    private static final long MANUAL_SKIP_COOLDOWN_MS = 500; // Don't let time updates override manual skips for 500ms

    private void setHdrDisplayMode(boolean enabled) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || getActivity() == null) {
            return;
        }
        int targetMode = enabled ? ActivityInfo.COLOR_MODE_HDR : ActivityInfo.COLOR_MODE_DEFAULT;
        if (getActivity().getWindow().getColorMode() == targetMode) {
            return;
        }
        getActivity().getWindow().setColorMode(targetMode);
    }

    private void applyPendingHdrDisplayMode() {
        if (!pendingHdrDisplayMode || hasAppliedHdrDisplayMode) {
            if (hasAppliedHdrDisplayMode) {
                pendingHdrDisplayMode = false;
            }
            return;
        }
        setHdrDisplayMode(true);
        hasAppliedHdrDisplayMode = true;
        pendingHdrDisplayMode = false;
    }

    private CacheDataSource.Factory buildCacheDataSourceFactory(DefaultHttpDataSource.Factory upstream) {
        if (mediaCache == null) {
            File cacheDir = new File(getContext().getCacheDir(), "exo_media_cache");
            mediaCache = new SimpleCache(
                cacheDir,
                new LeastRecentlyUsedCacheEvictor(1024L * 1024 * 1024),
                new StandaloneDatabaseProvider(getContext()));
        }
        return new CacheDataSource.Factory()
            .setCache(mediaCache)
            .setUpstreamDataSourceFactory(upstream)
            .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR);
    }

    private void applySeekParametersForContent() {
        if (exoPlayer == null) {
            return;
        }
        exoPlayer.setSeekParameters(SeekParameters.CLOSEST_SYNC);
    }

    private DefaultLoadControl buildLoadControl(boolean localMountedFile) {
        DefaultLoadControl.Builder builder = new DefaultLoadControl.Builder();
        if (localMountedFile) {
            // Ugoos heap is 256MB; cap buffer on memory-limited devices.
            builder
                .setBufferDurationsMs(1_500, 4_000, 750, 1_500)
                .setTargetBufferBytes(32 * 1024 * 1024)
                .setPrioritizeTimeOverSizeThresholds(false)
                .setBackBuffer(0, false);
        } else {
            builder
                .setBufferDurationsMs(50_000, 120_000, 2_500, 5_000)
                .setBackBuffer(30_000, true);
        }
        return builder.build();
    }

    /**
     * Plex Direct Play: if the server library is SMB-mounted on Shield, read the MKV locally
     * instead of HTTP range requests on a multi-GB file (avoids seek rebuffer / DV logo flash).
     */
    private String tryResolveLocalMkvPath(String httpUrl) {
        if (httpUrl == null || !httpUrl.toLowerCase().contains(".mkv")) {
            return null;
        }
        try {
            Uri uri = Uri.parse(httpUrl);
            String pathParam = uri.getQueryParameter("path");
            if (pathParam == null) {
                return null;
            }
            String decoded = URLDecoder.decode(pathParam, StandardCharsets.UTF_8.name());
            String norm = decoded.replace('\\', '/');
            String relFromVideos = null;
            int videosIdx = norm.toLowerCase().lastIndexOf("/videos/");
            if (videosIdx >= 0) {
                relFromVideos = norm.substring(videosIdx + 1);
            }
            String fileName = new File(decoded).getName();
            String host = uri.getHost();
            if (host == null) {
                return null;
            }

            String[] prefixes = {
                "/mnt/smb/" + host + "/",
                "/mnt/nfs/" + host + "/",
                "/storage/" + host + "/",
                "/mnt/NetworkStorage/" + host + "/",
                "/mnt/media/" + host + "/",
            };
            String[] rels = relFromVideos != null
                ? new String[] { relFromVideos, fileName, "Videos/" + fileName }
                : new String[] { fileName, "Videos/" + fileName };

            for (String prefix : prefixes) {
                for (String rel : rels) {
                    String candidate = prefix + rel;
                    File file = new File(candidate);
                    if (file.exists() && file.isFile()) {
                        return file.getAbsolutePath();
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "tryResolveLocalMkvPath: " + e.getMessage());
        }
        return null;
    }

    private long probeContentLength(String urlString) throws IOException {
        HttpURLConnection conn = (HttpURLConnection) new URL(urlString).openConnection();
        conn.setRequestMethod("GET");
        conn.setRequestProperty("Range", "bytes=0-0");
        conn.connect();
        try {
            int code = conn.getResponseCode();
            if (code == 206) {
                String contentRange = conn.getHeaderField("Content-Range");
                if (contentRange != null) {
                    int slash = contentRange.lastIndexOf('/');
                    if (slash >= 0) {
                        return Long.parseLong(contentRange.substring(slash + 1).trim());
                    }
                }
            }
            return conn.getContentLengthLong();
        } finally {
            conn.disconnect();
        }
    }

    private void prewarmMatroskaIndexTail(String url, CacheDataSource.Factory cacheFactory) {
        if (indexTailPrewarmed || indexTailPrewarmInProgress || cacheFactory == null) {
            return;
        }
        indexTailPrewarmInProgress = true;
        new Thread(() -> {
            long bytesRead = 0;
            long tailStart = -1;
            try {
                long contentLength = probeContentLength(url);
                if (contentLength <= 0) {
                    return;
                }
                streamContentLength = contentLength;
                long tailSize = Math.min(16L * 1024 * 1024, contentLength);
                tailStart = contentLength - tailSize;
                DataSpec dataSpec = new DataSpec.Builder()
                    .setUri(Uri.parse(url))
                    .setPosition(tailStart)
                    .setLength(tailSize)
                    .build();
                DataSource dataSource = cacheFactory.createDataSource();
                try {
                    dataSource.open(dataSpec);
                    byte[] buffer = new byte[128 * 1024];
                    int read;
                    while ((read = dataSource.read(buffer, 0, buffer.length)) != -1) {
                        bytesRead += read;
                    }
                } finally {
                    dataSource.close();
                }
                indexTailPrewarmed = true;
            } catch (Exception e) {
                Log.w(TAG, "MKV index prewarm failed: " + e.getMessage());
            } finally {
                indexTailPrewarmInProgress = false;
            }
        }, "mkv-index-prewarm").start();
    }

    private void updateHdrModeFromVideoFormat(Format format) {
        if (format == null || hasAppliedHdrDisplayMode) {
            return;
        }
        boolean isHdr = false;
        if (format.colorInfo != null) {
            int transfer = format.colorInfo.colorTransfer;
            if (transfer == C.COLOR_TRANSFER_ST2084 || transfer == C.COLOR_TRANSFER_HLG) {
                isHdr = true;
            }
        }
        String codec = format.codecs != null ? format.codecs.toLowerCase() : "";
        if (codec.contains("dvhe") || codec.contains("dvh1") || codec.contains("dovi")) {
            isHdr = true;
        }
        setHdrDisplayMode(isHdr);
        hasAppliedHdrDisplayMode = true;
    }

    private void releaseExoPlayer() {
        releaseExoPlayer(true);
    }

    private void releaseExoPlayer(boolean resetDisplayEnvironment) {
        stopTimeUpdates();
        cancelCoalescedSeek();
        if (exoPlayer != null) {
            exoPlayer.stop();
            exoPlayer.clearMediaItems();
            if (playerView != null) {
                playerView.setPlayer(null);
            }
            exoPlayer.release();
            exoPlayer = null;
        }
        hasAutoSelectedAudio = false;
        userLockedAudioTrack = false;
        hasAppliedHdrDisplayMode = false;
        pendingHdrDisplayMode = false;
        availableSubtitleTracks.clear();
        selectedSubtitleUrl = null;
        selectedSubtitleTrackIndex = -1;
        currentPlaybackUri = null;
        hideSubtitleTrackList();
        indexTailPrewarmed = false;
        indexTailPrewarmInProgress = false;
        if (resetDisplayEnvironment) {
            setHdrDisplayMode(false);
            setWebViewObscured(false);
        }
    }

    /** Stop HTML5 video/audio in the WebView (e.g. overview trailer) before native ExoPlayer. */
    private void stopWebViewHtmlMedia() {
        Bridge bridge = getBridge();
        if (bridge == null || bridge.getWebView() == null) {
            return;
        }
        bridge.getWebView().evaluateJavascript(
            "(function(){try{document.querySelectorAll('video,audio').forEach(function(el){"
                + "el.pause();el.removeAttribute('src');el.load();});"
                + "}catch(e){}})();",
            null);
    }

    private void setWebViewObscured(boolean obscured) {
        if (getActivity() == null) {
            return;
        }
        Bridge bridge = getBridge();
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().setVisibility(obscured ? View.INVISIBLE : View.VISIBLE);
        }
        if (containerView != null) {
            containerView.setBackgroundColor(Color.BLACK);
            containerView.setElevation(obscured ? 20f : 1f);
        }
    }

    /** Re-bind SurfaceView to the window after WebView pause / player swap (Amlogic compositor). */
    private void ensureVideoSurfaceAttached() {
        if (playerView == null || containerView == null) {
            return;
        }
        containerView.setVisibility(View.VISIBLE);
        playerView.setVisibility(View.VISIBLE);
        playerView.onResume();
        View surfaceView = playerView.getVideoSurfaceView();
        if (surfaceView != null) {
            surfaceView.setVisibility(View.VISIBLE);
        }
        containerView.bringToFront();
        ViewGroup parent = (ViewGroup) containerView.getParent();
        if (parent != null) {
            parent.bringChildToFront(containerView);
            parent.requestLayout();
        }
    }

    private boolean isLosslessAudioFormat(Format format) {
        if (format == null) {
            return false;
        }
        String mime = format.sampleMimeType != null ? format.sampleMimeType.toLowerCase() : "";
        String codecs = format.codecs != null ? format.codecs.toLowerCase() : "";
        return mime.contains("true-hd") || mime.contains("truehd") || mime.contains("mlp")
                || codecs.contains("truehd") || codecs.contains("mlp");
    }

    private boolean isAudioFormatLikelyPlayable(Format format) {
        if (format == null) {
            return false;
        }
        String mime = format.sampleMimeType;
        if (mime == null || mime.isEmpty()) {
            return true;
        }
        try {
            if (!MediaCodecUtil.getDecoderInfos(mime, false, false).isEmpty()) {
                return true;
            }
        } catch (MediaCodecUtil.DecoderQueryException e) {
            Log.w(TAG, "Decoder query failed for " + mime + ": " + e.getMessage());
        }
        String mimeLower = mime.toLowerCase();
        // TrueHD / Dolby Digital+ may use HDMI bitstream passthrough without a software decoder.
        return mimeLower.contains("true-hd") || mimeLower.contains("truehd") || mimeLower.contains("mlp")
                || mimeLower.contains("eac3") || mimeLower.contains("ec-3")
                || mimeLower.contains("ac3") || mimeLower.contains("ac-3");
    }

    private int getAudioCodecPriority(Format format) {
        if (format == null || !isAudioFormatLikelyPlayable(format)) {
            return 0;
        }
        String mime = format.sampleMimeType != null ? format.sampleMimeType.toLowerCase() : "";
        String codecs = format.codecs != null ? format.codecs.toLowerCase() : "";
        int channels = Math.max(format.channelCount, 0);
        if (isLosslessAudioFormat(format)) {
            return 150 + channels;
        }
        if (mime.contains("eac3") || mime.contains("ec-3") || codecs.contains("eac3") || codecs.contains("ec-3")) {
            return 110 + channels;
        }
        if (mime.contains("ac3") || mime.contains("ac-3") || codecs.contains("ac3") || codecs.contains("ac-3")) {
            return 90 + channels;
        }
        if (mime.contains("dts-hd") || codecs.contains("dts-hd") || codecs.contains("dtshd")) {
            return 50 + channels;
        }
        if (mime.contains("dts") || codecs.contains("dts")) {
            return 40 + channels;
        }
        if (mime.contains("aac") || mime.contains("mpeg")) {
            return 60;
        }
        return 40;
    }

    private java.util.List<Tracks.Group> collectAudioTrackGroups(Tracks tracks) {
        java.util.List<Tracks.Group> audioTrackGroups = new java.util.ArrayList<>();
        if (tracks == null) {
            return audioTrackGroups;
        }
        for (Tracks.Group trackGroup : tracks.getGroups()) {
            if (trackGroup.getType() == C.TRACK_TYPE_AUDIO) {
                audioTrackGroups.add(trackGroup);
            }
        }
        return audioTrackGroups;
    }

    private void captureLastWorkingAudioSelection(Tracks tracks) {
        java.util.List<Tracks.Group> audioTrackGroups = collectAudioTrackGroups(tracks);
        int globalIndex = 0;
        for (int groupIdx = 0; groupIdx < audioTrackGroups.size(); groupIdx++) {
            Tracks.Group trackGroup = audioTrackGroups.get(groupIdx);
            for (int trackIdx = 0; trackIdx < trackGroup.length; trackIdx++) {
                if (trackGroup.isTrackSelected(trackIdx)) {
                    lastWorkingAudioGroupIdx = groupIdx;
                    lastWorkingAudioTrackIdx = trackIdx;
                    lastWorkingAudioGlobalIndex = globalIndex;
                    return;
                }
                globalIndex++;
            }
        }
    }

    private void revertToLastWorkingAudioTrack(String failedTrackName) {
        if (exoPlayer == null || lastWorkingAudioGroupIdx < 0 || lastWorkingAudioTrackIdx < 0) {
            return;
        }
        java.util.List<Tracks.Group> audioTrackGroups = collectAudioTrackGroups(exoPlayer.getCurrentTracks());
        if (lastWorkingAudioGroupIdx >= audioTrackGroups.size()) {
            return;
        }
        Log.w(TAG, "Reverting audio from unsupported track: " + failedTrackName);
        selectAudioTrackFromMultipleGroups(
                audioTrackGroups,
                lastWorkingAudioGlobalIndex,
                lastWorkingAudioGroupIdx,
                lastWorkingAudioTrackIdx,
                false);
        if (getActivity() != null) {
            Toast.makeText(
                    getContext(),
                    "Audio format not supported: " + failedTrackName,
                    Toast.LENGTH_LONG).show();
        }
    }

    private void autoSelectPreferredAudioTrack(Tracks tracks) {
        if (hasAutoSelectedAudio || userLockedAudioTrack || exoPlayer == null || tracks == null) {
            return;
        }

        java.util.List<Tracks.Group> audioTrackGroups = new java.util.ArrayList<>();
        for (Tracks.Group trackGroup : tracks.getGroups()) {
            if (trackGroup.getType() == C.TRACK_TYPE_AUDIO) {
                audioTrackGroups.add(trackGroup);
            }
        }
        if (audioTrackGroups.isEmpty()) {
            return;
        }

        int currentGroup = -1;
        int currentTrack = -1;
        int currentPriority = -1;
        int globalIndex = 0;
        int currentGlobalIndex = -1;

        for (int groupIdx = 0; groupIdx < audioTrackGroups.size(); groupIdx++) {
            Tracks.Group trackGroup = audioTrackGroups.get(groupIdx);
            for (int trackIdx = 0; trackIdx < trackGroup.length; trackIdx++) {
                if (trackGroup.isTrackSelected(trackIdx)) {
                    currentGroup = groupIdx;
                    currentTrack = trackIdx;
                    currentGlobalIndex = globalIndex;
                    currentPriority = getAudioCodecPriority(trackGroup.getTrackFormat(trackIdx));
                }
                globalIndex++;
            }
        }

        int bestGroup = -1;
        int bestTrack = -1;
        int bestGlobalIndex = -1;
        int bestPriority = -1;
        globalIndex = 0;
        for (int groupIdx = 0; groupIdx < audioTrackGroups.size(); groupIdx++) {
            Tracks.Group trackGroup = audioTrackGroups.get(groupIdx);
            for (int trackIdx = 0; trackIdx < trackGroup.length; trackIdx++) {
                Format candidateFormat = trackGroup.getTrackFormat(trackIdx);
                int priority = getAudioCodecPriority(candidateFormat);
                if (priority > bestPriority) {
                    bestPriority = priority;
                    bestGroup = groupIdx;
                    bestTrack = trackIdx;
                    bestGlobalIndex = globalIndex;
                }
                globalIndex++;
            }
        }

        if (bestGroup < 0) {
            hasAutoSelectedAudio = true;
            return;
        }

        boolean shouldSwitch = currentGlobalIndex < 0 || bestPriority > currentPriority;
        hasAutoSelectedAudio = true;

        if (shouldSwitch) {
            selectAudioTrackFromMultipleGroups(audioTrackGroups, bestGlobalIndex, bestGroup, bestTrack, false);
        }
    }

    private DefaultTrackSelector buildTrackSelector(boolean localMountedFile) {
        DefaultTrackSelector selector = new DefaultTrackSelector(getContext());

        DefaultTrackSelector.Parameters.Builder paramsBuilder = selector.buildUponParameters();
        paramsBuilder.setPreferredAudioMimeTypes(
                MimeTypes.AUDIO_TRUEHD,
                MimeTypes.AUDIO_E_AC3,
                MimeTypes.AUDIO_AC3,
                MimeTypes.AUDIO_AAC,
                MimeTypes.AUDIO_MPEG);
        paramsBuilder.setTunnelingEnabled(false);

        boolean subtitlesOff =
                selectedSubtitleUrl == null || selectedSubtitleUrl.isEmpty();
        if (subtitlesOff) {
            paramsBuilder.setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true);
        }

        selector.setParameters(paramsBuilder.build());
        return selector;
    }

    private boolean isUgoosDevice() {
        String manufacturer =
            Build.MANUFACTURER == null ? "" : Build.MANUFACTURER.toLowerCase(Locale.US);
        String model = Build.MODEL == null ? "" : Build.MODEL.toLowerCase(Locale.US);
        return manufacturer.contains("ugoos") || model.contains("am6");
    }

    private void resumePlaybackAfterSeekIfNeeded() {
        if (wasPlayingBeforeSeek && exoPlayer != null) {
            exoPlayer.play();
            isPaused = false;
            if (playPauseBtn != null) {
                playPauseBtn.setImageResource(android.R.drawable.ic_media_pause);
            }
        }
    }

    private void cancelCoalescedSeek() {
        if (seekCoalesceHandler != null && coalescedSeekRunnable != null) {
            seekCoalesceHandler.removeCallbacks(coalescedSeekRunnable);
        }
        coalescedSeekRunnable = null;
        coalescedSeekTargetMs = -1;
        coalescedSeekSource = "";
    }

    /** Batches rapid skip-forward/back into a single exoPlayer.seekTo after {@link #SEEK_COALESCE_MS}. */
    private void scheduleCoalescedSeek(long positionMs, String source) {
        if (exoPlayer == null) {
            return;
        }
        coalescedSeekTargetMs = positionMs;
        coalescedSeekSource = source;
        pendingSeekPosition = positionMs;
        if (seekCoalesceHandler == null) {
            seekCoalesceHandler =
                    new android.os.Handler(android.os.Looper.getMainLooper());
        }
        if (coalescedSeekRunnable != null) {
            seekCoalesceHandler.removeCallbacks(coalescedSeekRunnable);
        } else {
            coalescedSeekRunnable =
                    () -> {
                        long target = coalescedSeekTargetMs;
                        String src = coalescedSeekSource;
                        coalescedSeekRunnable = null;
                        if (target >= 0 && src != null && !src.isEmpty()) {
                            performSeek(target, src + "_coalesced");
                        }
                    };
        }
        seekCoalesceHandler.postDelayed(coalescedSeekRunnable, SEEK_COALESCE_MS);
    }

    private void performSeek(long positionMs, String source) {
        if (exoPlayer == null) {
            return;
        }
        if (source != null
                && (source.startsWith("seekbar")
                        || "plugin_seekTo".equals(source)
                        || "navigate_enter".equals(source))) {
            cancelCoalescedSeek();
        }
        long bufferedEnd = exoPlayer.getBufferedPosition();
        long seekPositionMs = positionMs;
        if (currentStreamIsEventHls && bufferedEnd > 0) {
            long maxSeekMs = Math.max(0, bufferedEnd - 1500);
            if (seekPositionMs > maxSeekMs) {
                seekPositionMs = maxSeekMs;
            }
        }
        if (Math.abs(seekPositionMs - exoPlayer.getCurrentPosition()) < 500) {
            return;
        }
        lastSeekTime = System.currentTimeMillis();
        final long targetMs = seekPositionMs;
        final String seekSource = source != null ? source : "unknown";

        Runnable seekRunnable =
                () -> {
                    if (exoPlayer == null) {
                        return;
                    }
                    lastCommittedSeekMs = System.currentTimeMillis();
                    lastCommittedSeekSource = seekSource;
                    applySeekParametersForContent();
                    int mediaItemIndex = exoPlayer.getCurrentMediaItemIndex();
                    if (mediaItemIndex < 0) {
                        exoPlayer.seekTo(targetMs);
                    } else {
                        exoPlayer.seekTo(mediaItemIndex, targetMs);
                    }
                };
        if (getActivity() != null) {
            getActivity().runOnUiThread(seekRunnable);
        } else {
            seekRunnable.run();
        }
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        try {
            String containerId = call.getString("containerId", "videoContainer");

            getActivity().runOnUiThread(() -> {
                try {
                    if (containerView != null && playerView != null) {
                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        ret.put("alreadyInitialized", true);
                        call.resolve(ret);
                        return;
                    }
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
                    // ExoPlayer will be initialized in loadVideo method
                    // Create PlayerView but don't set player yet (will be set in loadVideo)
                    playerView = new PlayerView(getContext());
                    // playerView.setPlayer(exoPlayer); // Will be set after ExoPlayer is created
                    playerView.setUseController(false);
                    playerView.setKeepContentOnPlayerReset(true);
                    // Default surface is SurfaceView (required for HDR; do not switch to TextureView)
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
        createSubtitleTrackListContainer(container);

        subtitleTrackBtn = controlsView.findViewById(R.id.subtitleTrackBtn);
        currentSubtitleTrackLabel = null;
        subtitleTrackRow = null;

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
                                performSeek(seekPosition, "seekbar_enter");
                                Log.d(TAG, "Seek on Enter (seekbar listener) to: " + seekPosition + "ms (progress: " + (finalProgress/100.0) + "%)");
                                pendingSeekPosition = -1;
                            }
                        }
                        
                        if (wasSeeking) {
                            resumePlaybackAfterSeekIfNeeded();
                        }
                        
                        // Restart time updates
                        startTimeUpdates();
                        
                        // Restart controls auto-hide timer (5 seconds after seeking completes)
                        resetControlsHideTimer();
                        
                        Log.d(
                                TAG,
                                "Seek completed on Enter (seekbar listener) - wasSeeking: "
                                        + wasSeeking
                                        + ", resumed: "
                                        + wasPlayingBeforeSeek);
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
                // Update target position only while scrubbing; seek once on release/Enter.
                // Calling seekTo per progress step re-triggers Dolby Vision on LG TVs.
                if (fromUser && exoPlayer != null && isSeeking) {
                    long duration = exoPlayer.getDuration();
                    if (duration > 0) {
                        long seekPosition = (long) (duration * progress / 10000.0);
                        pendingSeekPosition = seekPosition;
                        Log.d(TAG, "Scrub preview position (deferred seek): " + seekPosition + " (progress: " + (progress/100.0) + "%)");
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

                // Shield remote uses Enter (seekbar_enter); touch release must not double-seek.
                if (System.currentTimeMillis() - lastCommittedSeekMs < 1000
                        && lastCommittedSeekSource != null
                        && (lastCommittedSeekSource.startsWith("seekbar_enter")
                                || "navigate_enter".equals(lastCommittedSeekSource))) {
                    Log.d(TAG, "Skipping seekbar_release (already committed via Enter)");
                    startTimeUpdates();
                    resetControlsHideTimer();
                    pendingSeekPosition = -1;
                    return;
                }
                
                // Get the final progress directly from the seekbar since we may have removed the listener
                // This ensures we get the exact position where the user released, even if onProgressChanged
                // wasn't called due to listener removal
                int finalProgress = seekBar.getProgress();
                if (exoPlayer != null) {
                    long duration = exoPlayer.getDuration();
                    if (duration > 0) {
                        long seekPosition = (long) (duration * finalProgress / 10000.0);
                        lastSeekTime = System.currentTimeMillis();
                        performSeek(seekPosition, "seekbar_release");
                        Log.d(TAG, "Final seek to: " + seekPosition + "ms (progress: " + (finalProgress/100.0) + "%)");
                        pendingSeekPosition = -1;
                    }
                }
                
                resumePlaybackAfterSeekIfNeeded();
                
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
                    if (exoPlayer == null) {
                        Log.w(TAG, "playPauseBtn ignored — ExoPlayer not initialized");
                        return;
                    }
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
toggleAudioTrackList();
            resetControlsHideTimer();
        });

        // Set up focus change listener for audio track button to show/hide list
        audioTrackBtn.setOnFocusChangeListener(new OnFocusChangeListener() {
            @Override
            public void onFocusChange(View v, boolean hasFocus) {
if (hasFocus && audioTrackListContainer != null && audioTrackListContainer.getVisibility() == View.GONE) {
                    // When button gets focus, show the track list (unless we're suppressing auto-show)
                    // Only auto-show if button is visible (controls might be hidden but button could still be accessible)
                    if (!suppressAutoShowAudioList && audioTrackBtn.getVisibility() == View.VISIBLE) {
showAudioTrackList();
                    } else {
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

        subtitleTrackBtn.setOnClickListener(
                v -> {
                    toggleSubtitleTrackList();
                    resetControlsHideTimer();
                });

        subtitleTrackBtn.setOnFocusChangeListener(
                new OnFocusChangeListener() {
                    @Override
                    public void onFocusChange(View v, boolean hasFocus) {
                        if (hasFocus
                                && subtitleTrackListContainer != null
                                && subtitleTrackListContainer.getVisibility() == View.GONE) {
                            if (!suppressAutoShowSubtitleList
                                    && subtitleTrackBtn.getVisibility() == View.VISIBLE) {
                                showSubtitleTrackList();
                            }
                        } else if (!hasFocus
                                && subtitleTrackListContainer != null
                                && subtitleTrackListContainer.getVisibility() == View.VISIBLE) {
                            boolean focusOnList = false;
                            for (Button btn : subtitleTrackButtons) {
                                if (btn.hasFocus()) {
                                    focusOnList = true;
                                    break;
                                }
                            }
                            if (!focusOnList) {
                                hideSubtitleTrackList();
                            }
                        }
                    }
                });

        subtitleTrackBtn.setOnKeyListener(
                new View.OnKeyListener() {
                    @Override
                    public boolean onKey(View v, int keyCode, KeyEvent event) {
                        if (event.getAction() == KeyEvent.ACTION_DOWN) {
                            if (keyCode == KeyEvent.KEYCODE_DPAD_CENTER
                                    || keyCode == KeyEvent.KEYCODE_ENTER) {
                                if (subtitleTrackListContainer != null
                                        && subtitleTrackListContainer.getVisibility()
                                                == View.GONE) {
                                    showSubtitleTrackList();
                                } else if (!subtitleTrackButtons.isEmpty()) {
                                    subtitleTrackButtons.get(0).requestFocus();
                                }
                                return true;
                            }
                        }
                        return false;
                    }
                });

        setupButtonFocus(subtitleTrackBtn);

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
                    boolean subtitleListVisible = subtitleTrackListContainer != null
                            && subtitleTrackListContainer.getVisibility() == View.VISIBLE;

                    if (subtitleListVisible) {
                        if (keyCode == KeyEvent.KEYCODE_BACK
                                || keyCode == KeyEvent.KEYCODE_DPAD_RIGHT) {
                            subtitleTrackListContainer.setVisibility(View.GONE);
                            isShowingSubtitleTrackList = false;
                            getActivity().runOnUiThread(() -> {
                                showControls(null);
                                if (subtitleTrackBtn != null) {
                                    subtitleTrackBtn.requestFocus();
                                }
                            });
                            return true;
                        }
                        View focusedView = getActivity().getCurrentFocus();
                        if (focusedView == null || !subtitleTrackButtons.contains(focusedView)) {
                            if (!subtitleTrackButtons.isEmpty()) {
                                subtitleTrackButtons.get(0).requestFocus();
                            }
                        }
                        return false;
                    }
                    
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
        audioTrackScrollView = new android.widget.ScrollView(getContext());
        LinearLayout.LayoutParams scrollParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            0, // Will use weight
            1.0f // Weight to fill remaining space
        );
        audioTrackScrollView.setLayoutParams(scrollParams);
        audioTrackScrollView.setFillViewport(true);
        audioTrackScrollView.setFocusable(false);
        audioTrackScrollView.setFocusableInTouchMode(false);
        audioTrackScrollView.setDescendantFocusability(android.widget.ScrollView.FOCUS_AFTER_DESCENDANTS);
        
        // Create the track list LinearLayout
        audioTrackList = new LinearLayout(getContext());
        audioTrackList.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams listParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        audioTrackList.setLayoutParams(listParams);
        
        // Add track list to ScrollView
        audioTrackScrollView.addView(audioTrackList);
        
        // Add views to hierarchy
        innerContainer.addView(titleView);
        innerContainer.addView(audioTrackScrollView);
        audioTrackListContainer.addView(innerContainer);
        
        // Add to the main container (full screen)
        container.addView(audioTrackListContainer);
    }

    private void createSubtitleTrackListContainer(FrameLayout container) {
        subtitleTrackListContainer = new LinearLayout(getContext());
        subtitleTrackListContainer.setOrientation(LinearLayout.VERTICAL);
        subtitleTrackListContainer.setPadding(0, 0, 0, 0);
        subtitleTrackListContainer.setGravity(Gravity.START);
        subtitleTrackListContainer.setVisibility(View.GONE);
        subtitleTrackListContainer.setFocusable(false);
        subtitleTrackListContainer.setFocusableInTouchMode(false);
        subtitleTrackListContainer.setDescendantFocusability(LinearLayout.FOCUS_AFTER_DESCENDANTS);
        subtitleTrackListContainer.setElevation(15f);

        FrameLayout.LayoutParams containerParams =
                new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT);
        subtitleTrackListContainer.setLayoutParams(containerParams);

        LinearLayout innerContainer = new LinearLayout(getContext());
        innerContainer.setOrientation(LinearLayout.VERTICAL);
        int screenWidth = getContext().getResources().getDisplayMetrics().widthPixels;
        int listWidth = screenWidth / 3;
        LinearLayout.LayoutParams innerParams =
                new LinearLayout.LayoutParams(
                        listWidth, LinearLayout.LayoutParams.MATCH_PARENT);
        innerParams.gravity = Gravity.START;
        innerContainer.setLayoutParams(innerParams);
        innerContainer.setGravity(Gravity.START);
        innerContainer.setBackgroundColor(Color.argb(230, 0, 0, 0));
        float density = getContext().getResources().getDisplayMetrics().density;
        int pad = (int) (10 * density);
        innerContainer.setPadding(pad, pad, pad, pad);
        innerContainer.setFocusable(false);
        innerContainer.setFocusableInTouchMode(false);
        innerContainer.setDescendantFocusability(LinearLayout.FOCUS_AFTER_DESCENDANTS);

        TextView titleView = new TextView(getContext());
        titleView.setText("Select Subtitles");
        titleView.setTextColor(Color.WHITE);
        titleView.setTextSize(18);
        titleView.setTypeface(null, android.graphics.Typeface.BOLD);
        titleView.setPadding(0, 0, 0, (int) (10 * density));

        subtitleTrackScrollView = new android.widget.ScrollView(getContext());
        LinearLayout.LayoutParams scrollParams =
                new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT, 0, 1.0f);
        subtitleTrackScrollView.setLayoutParams(scrollParams);
        subtitleTrackScrollView.setFillViewport(true);
        subtitleTrackScrollView.setFocusable(false);
        subtitleTrackScrollView.setFocusableInTouchMode(false);
        subtitleTrackScrollView.setDescendantFocusability(
                android.widget.ScrollView.FOCUS_AFTER_DESCENDANTS);

        subtitleTrackList = new LinearLayout(getContext());
        subtitleTrackList.setOrientation(LinearLayout.VERTICAL);

        subtitleTrackScrollView.addView(subtitleTrackList);
        innerContainer.addView(titleView);
        innerContainer.addView(subtitleTrackScrollView);
        subtitleTrackListContainer.addView(innerContainer);
        container.addView(subtitleTrackListContainer);
    }

    private void applySubtitleSelectionForLoad(String subtitleUrl) {
        if (subtitleUrl != null && !subtitleUrl.isEmpty()) {
            selectedSubtitleUrl = subtitleUrl;
            selectedSubtitleTrackIndex = 0;
            for (int i = 0; i < availableSubtitleTracks.size(); i++) {
                if (subtitleUrl.equals(availableSubtitleTracks.get(i).url)) {
                    selectedSubtitleTrackIndex = i;
                    break;
                }
            }
        } else if (!availableSubtitleTracks.isEmpty()) {
            selectedSubtitleUrl = availableSubtitleTracks.get(0).url;
            selectedSubtitleTrackIndex = 0;
        } else {
            selectedSubtitleUrl = null;
            selectedSubtitleTrackIndex = -1;
        }
    }

    private void parseSubtitleTracksFromCall(PluginCall call, String fallbackSubtitleUrl) {
        availableSubtitleTracks.clear();
        try {
            JSONArray tracksJson = call.getArray("subtitleTracks");
            if (tracksJson != null) {
                for (int i = 0; i < tracksJson.length(); i++) {
                    JSONObject o = tracksJson.getJSONObject(i);
                    String label = o.optString("label", "Subtitle " + (i + 1));
                    String url = o.optString("url", "");
                    if (url != null && !url.isEmpty()) {
                        availableSubtitleTracks.add(new SubtitleTrackOption(label, url));
                    }
                }
            }
        } catch (JSONException e) {
            Log.w(TAG, "parseSubtitleTracksFromCall: " + e.getMessage());
        }

        if (fallbackSubtitleUrl != null
                && !fallbackSubtitleUrl.isEmpty()
                && !containsSubtitleUrl(fallbackSubtitleUrl)) {
            availableSubtitleTracks.add(
                    0, new SubtitleTrackOption("English (VTT)", fallbackSubtitleUrl));
        }
    }

    private boolean containsSubtitleUrl(String url) {
        for (SubtitleTrackOption option : availableSubtitleTracks) {
            if (url.equals(option.url)) {
                return true;
            }
        }
        return false;
    }

    private void updateSubtitleTrackUI() {
        if (subtitleTrackBtn == null) {
            return;
        }
        getActivity()
                .runOnUiThread(
                        () -> {
                            int itemCount = availableSubtitleTracks.size() + 1;
                            if (itemCount > 1) {
                                subtitleTrackBtn.setVisibility(View.VISIBLE);
                                populateSubtitleTrackList();
                            } else {
                                subtitleTrackBtn.setVisibility(View.GONE);
                                hideSubtitleTrackList();
                            }
                        });
    }

    private void populateSubtitleTrackList() {
        if (subtitleTrackList == null) {
            return;
        }
        subtitleTrackList.removeAllViews();
        subtitleTrackButtons.clear();

        addSubtitleListButton("Off", -1, selectedSubtitleTrackIndex < 0);

        for (int i = 0; i < availableSubtitleTracks.size(); i++) {
            SubtitleTrackOption option = availableSubtitleTracks.get(i);
            addSubtitleListButton(option.label, i, selectedSubtitleTrackIndex == i);
        }
    }

    private void addSubtitleListButton(String label, int trackIndex, boolean selected) {
        Button trackButton = new Button(getContext());
        trackButton.setText(label);
        trackButton.setTextColor(selected ? Color.YELLOW : Color.WHITE);
        trackButton.setBackgroundColor(
                selected ? Color.argb(100, 255, 255, 0) : Color.TRANSPARENT);
        float density = getContext().getResources().getDisplayMetrics().density;
        trackButton.setPadding(
                (int) (20 * density),
                (int) (15 * density),
                (int) (20 * density),
                (int) (15 * density));
        LinearLayout.LayoutParams params =
                new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, (int) (5 * density), 0, 0);
        trackButton.setLayoutParams(params);
        trackButton.setFocusable(true);
        trackButton.setFocusableInTouchMode(true);
        setupButtonFocus(trackButton);

        final int index = trackIndex;
        trackButton.setOnClickListener(v -> selectSubtitleTrack(index));

        trackButton.setOnKeyListener(
                new View.OnKeyListener() {
                    @Override
                    public boolean onKey(View v, int keyCode, KeyEvent event) {
                        if (event.getAction() != KeyEvent.ACTION_DOWN) {
                            return false;
                        }
                        if (keyCode == KeyEvent.KEYCODE_DPAD_UP) {
                            int btnIndex = subtitleTrackButtons.indexOf(trackButton);
                            if (btnIndex > 0) {
                                subtitleTrackButtons.get(btnIndex - 1).requestFocus();
                            } else {
                                subtitleTrackBtn.requestFocus();
                            }
                            return true;
                        }
                        if (keyCode == KeyEvent.KEYCODE_DPAD_DOWN) {
                            int btnIndex = subtitleTrackButtons.indexOf(trackButton);
                            if (btnIndex < subtitleTrackButtons.size() - 1) {
                                subtitleTrackButtons.get(btnIndex + 1).requestFocus();
                            }
                            return true;
                        }
                        if (keyCode == KeyEvent.KEYCODE_DPAD_RIGHT
                                || keyCode == KeyEvent.KEYCODE_BACK) {
                            subtitleTrackBtn.requestFocus();
                            hideSubtitleTrackList();
                            return true;
                        }
                        if (keyCode == KeyEvent.KEYCODE_DPAD_CENTER
                                || keyCode == KeyEvent.KEYCODE_ENTER) {
                            selectSubtitleTrack(index);
                            return true;
                        }
                        return false;
                    }
                });

        subtitleTrackList.addView(trackButton);
        subtitleTrackButtons.add(trackButton);
    }

    private void selectSubtitleTrack(int trackIndex) {
        if (trackIndex < 0) {
            selectedSubtitleTrackIndex = -1;
            selectedSubtitleUrl = null;
        } else if (trackIndex < availableSubtitleTracks.size()) {
            selectedSubtitleTrackIndex = trackIndex;
            selectedSubtitleUrl = availableSubtitleTracks.get(trackIndex).url;
        } else {
            return;
        }
        populateSubtitleTrackList();
        applySelectedSubtitleToPlayer();
        hideSubtitleTrackList();
        if (subtitleTrackBtn != null) {
            subtitleTrackBtn.requestFocus();
        }
    }

    /**
     * Short branding intro (DV Amaze, etc.) — HTTP or local progressive source, no subtitles.
     */
    private MediaSource buildSimpleProgressiveMediaSource(String rawUrl) {
        if (rawUrl == null || rawUrl.isEmpty()) {
            return null;
        }
        try {
            String path = rawUrl.trim();
            boolean isHls = path.toLowerCase(Locale.US).contains(".m3u8");
            if (!isHls
                    && (path.startsWith("http://") || path.startsWith("https://"))) {
                String localPath = tryResolveLocalMkvPath(path);
                if (localPath != null) {
                    path = localPath;
                }
            }
            boolean isHttp =
                    path.startsWith("http://") || path.startsWith("https://");
            if (!isHttp) {
                File localFile = new File(path);
                if (!localFile.exists() || !localFile.canRead()) {
                    Log.w(TAG, "Intro path not readable: " + path);
                    return null;
                }
            }
            Uri uri = isHttp ? Uri.parse(path) : Uri.fromFile(new File(path));
            MediaItem item = new MediaItem.Builder().setUri(uri).build();
            DataSource.Factory factory;
            if (isHttp) {
                factory =
                        new DefaultHttpDataSource.Factory()
                                .setAllowCrossProtocolRedirects(true)
                                .setConnectTimeoutMs(15000)
                                .setReadTimeoutMs(15000);
            } else {
                factory = new DefaultDataSource.Factory(getContext());
            }
            if (isHls) {
                return new HlsMediaSource.Factory(factory).createMediaSource(item);
            }
            return new ProgressiveMediaSource.Factory(factory).createMediaSource(item);
        } catch (Exception e) {
            Log.e(TAG, "Failed to build intro media source: " + rawUrl, e);
            return null;
        }
    }

    private MediaItem buildMediaItemForCurrentPlayback() {
        if (currentPlaybackUri == null) {
            return null;
        }
        MediaItem.Builder mediaItemBuilder = new MediaItem.Builder().setUri(currentPlaybackUri);
        if (currentPlaybackIsHls) {
            mediaItemBuilder.setMimeType(MimeTypes.APPLICATION_M3U8);
        } else if (currentPlaybackIsHttpMkv) {
            mediaItemBuilder.setMimeType(MimeTypes.VIDEO_MATROSKA);
        }
        if (selectedSubtitleUrl != null && !selectedSubtitleUrl.isEmpty()) {
            mediaItemBuilder.setSubtitleConfigurations(
                    java.util.Collections.singletonList(
                            new MediaItem.SubtitleConfiguration.Builder(
                                            Uri.parse(selectedSubtitleUrl))
                                    .setMimeType(MimeTypes.TEXT_VTT)
                                    .setLanguage("en")
                                    .setSelectionFlags(C.SELECTION_FLAG_DEFAULT)
                                    .build()));
        }
        return mediaItemBuilder.build();
    }

    private void applySelectedSubtitleToPlayer() {
        if (exoPlayer == null || currentPlaybackUri == null) {
            return;
        }
        long position = exoPlayer.getCurrentPosition();
        boolean playWhenReady = exoPlayer.getPlayWhenReady();
        MediaItem mediaItem = buildMediaItemForCurrentPlayback();
        if (mediaItem == null) {
            return;
        }
        exoPlayer.setMediaItem(mediaItem, true);
        exoPlayer.prepare();
        exoPlayer.seekTo(position);
        exoPlayer.setPlayWhenReady(playWhenReady);
    }

    private void toggleSubtitleTrackList() {
        if (subtitleTrackListContainer == null) {
            return;
        }
        getActivity()
                .runOnUiThread(
                        () -> {
                            hideAudioTrackList();
                            if (isSubtitleTrackListVisible()) {
                                hideSubtitleTrackList();
                            } else {
                                suppressAutoShowSubtitleList = false;
                                showSubtitleTrackList();
                            }
                        });
    }

    private void showSubtitleTrackList() {
        if (subtitleTrackListContainer == null || subtitleTrackList == null) {
            return;
        }
        getActivity()
                .runOnUiThread(
                        () -> {
                            hideAudioTrackList();
                            isShowingSubtitleTrackList = true;
                            hideControls(null);
                            if (containerView != null && containerView.hasFocus()) {
                                containerView.clearFocus();
                            }
                            subtitleTrackListContainer.setVisibility(View.VISIBLE);
                            int focusIndex =
                                    selectedSubtitleTrackIndex >= 0
                                            ? selectedSubtitleTrackIndex + 1
                                            : 0;
                            if (focusIndex >= 0 && focusIndex < subtitleTrackButtons.size()) {
                                subtitleTrackButtons.get(focusIndex).requestFocus();
                            } else if (!subtitleTrackButtons.isEmpty()) {
                                subtitleTrackButtons.get(0).requestFocus();
                            }
                        });
    }

    private void hideSubtitleTrackList() {
        if (subtitleTrackListContainer == null) {
            return;
        }
        getActivity()
                .runOnUiThread(
                        () -> {
                            isShowingSubtitleTrackList = false;
                            focusedSubtitleTrackIndex = -1;
                            subtitleTrackListContainer.setVisibility(View.GONE);
                            if (controlsVisible
                                    && controlsView != null
                                    && controlsView.getVisibility() == View.VISIBLE) {
                                resetControlsHideTimer();
                            } else if (!controlsVisible && !isShowingSubtitleTrackList) {
                                showControls(null);
                            }
                        });
    }

    private boolean isSubtitleTrackListVisible() {
        return isShowingSubtitleTrackList
                || (subtitleTrackListContainer != null
                        && subtitleTrackListContainer.getVisibility() == View.VISIBLE);
    }

    public boolean handleSubtitleListKey(int keyCode) {
        if (!isSubtitleTrackListVisible()
                || subtitleTrackButtons.isEmpty()
                || getActivity() == null) {
            return false;
        }

        View focused = getActivity().getCurrentFocus();
        int currentIndex = 0;
        for (int i = 0; i < subtitleTrackButtons.size(); i++) {
            if (subtitleTrackButtons.get(i) == focused) {
                currentIndex = i;
                break;
            }
        }

        switch (keyCode) {
            case KeyEvent.KEYCODE_DPAD_DOWN:
                if (currentIndex < subtitleTrackButtons.size() - 1) {
                    subtitleTrackButtons.get(currentIndex + 1).requestFocus();
                }
                return true;
            case KeyEvent.KEYCODE_DPAD_UP:
                if (currentIndex > 0) {
                    subtitleTrackButtons.get(currentIndex - 1).requestFocus();
                }
                return true;
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
                final int selectIndex = currentIndex;
                getActivity()
                        .runOnUiThread(
                                () -> {
                                    if (selectIndex == 0) {
                                        selectSubtitleTrack(-1);
                                    } else {
                                        selectSubtitleTrack(selectIndex - 1);
                                    }
                                });
                return true;
            case KeyEvent.KEYCODE_DPAD_RIGHT:
            case KeyEvent.KEYCODE_BACK:
                getActivity()
                        .runOnUiThread(
                                () -> {
                                    hideSubtitleTrackList();
                                    if (subtitleTrackBtn != null) {
                                        subtitleTrackBtn.requestFocus();
                                    }
                                    showControls(null);
                                });
                return true;
            default:
                return false;
        }
    }

    private JSObject createSkipObject(int seconds) {
        JSObject obj = new JSObject();
        obj.put("skipBy", seconds);
        return obj;
    }

    private void scrollAudioTrackIntoView(View trackButton) {
        if (audioTrackScrollView == null || trackButton == null) {
            return;
        }
        audioTrackScrollView.post(() -> {
            int buttonTop = trackButton.getTop();
            int buttonBottom = trackButton.getBottom();
            int scrollY = audioTrackScrollView.getScrollY();
            int height = audioTrackScrollView.getHeight();
            if (buttonTop < scrollY) {
                audioTrackScrollView.smoothScrollTo(0, buttonTop);
            } else if (buttonBottom > scrollY + height) {
                audioTrackScrollView.smoothScrollTo(0, buttonBottom - height);
            }
        });
    }

    private void cancelPendingAudioTrackListFocus() {
        if (pendingAudioTrackListFocusRunnable != null && audioTrackList != null) {
            audioTrackList.removeCallbacks(pendingAudioTrackListFocusRunnable);
            pendingAudioTrackListFocusRunnable = null;
        }
    }

    private boolean isAudioTrackListVisible() {
        return isShowingAudioTrackList
                || (audioTrackListContainer != null
                && audioTrackListContainer.getVisibility() == View.VISIBLE);
    }

    private void refreshAudioTrackListSelectionStyles() {
        for (int i = 0; i < audioTrackButtons.size(); i++) {
            Button btn = audioTrackButtons.get(i);
            if (btn == null) {
                continue;
            }
            boolean isPlaying = i == selectedAudioTrackIndex;
            boolean isHighlighted = i == focusedAudioTrackIndex;
            if (isHighlighted) {
                btn.setBackgroundColor(Color.argb(150, 255, 255, 255));
                btn.setTextColor(Color.WHITE);
            } else if (isPlaying) {
                btn.setBackgroundColor(Color.argb(100, 255, 255, 0));
                btn.setTextColor(Color.YELLOW);
            } else {
                btn.setBackgroundColor(Color.TRANSPARENT);
                btn.setTextColor(Color.WHITE);
            }
        }
    }

    private void highlightAudioTrackAtIndex(int index) {
        if (index < 0 || index >= audioTrackButtons.size()) {
            return;
        }
        cancelPendingAudioTrackListFocus();
        focusedAudioTrackIndex = index;
        scrollAudioTrackIntoView(audioTrackButtons.get(index));
        refreshAudioTrackListSelectionStyles();
    }

    private void focusAudioTrackButton(int index) {
        highlightAudioTrackAtIndex(index);
        if (index >= 0 && index < audioTrackButtons.size()) {
            audioTrackButtons.get(index).requestFocus();
        }
    }

    /**
     * Handles D-pad keys at Activity level while the audio track list is open.
     * Capacitor keeps focus on the WebView, so keys never reach native buttons or navigateControls.
     */
    public boolean handleAudioListKey(int keyCode) {
        if (!isAudioTrackListVisible() || audioTrackButtons.isEmpty() || getActivity() == null) {
            return false;
        }

        int currentIndex = resolveAudioTrackListFocusIndex(null);
        int newIndex = currentIndex;
        boolean handled = true;

        switch (keyCode) {
            case KeyEvent.KEYCODE_DPAD_DOWN:
                if (currentIndex < audioTrackButtons.size() - 1) {
                    newIndex = currentIndex + 1;
                }
                break;
            case KeyEvent.KEYCODE_DPAD_UP:
                if (currentIndex > 0) {
                    newIndex = currentIndex - 1;
                }
                break;
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
                final int selectIndex = currentIndex;
                getActivity().runOnUiThread(() -> {
                    if (selectIndex >= 0 && selectIndex < audioTrackButtons.size()) {
                        audioTrackButtons.get(selectIndex).performClick();
                    }
                });
return true;
            case KeyEvent.KEYCODE_BACK:
            case KeyEvent.KEYCODE_DPAD_LEFT:
                getActivity().runOnUiThread(this::hideAudioTrackList);
                return true;
            default:
                handled = false;
                break;
        }

        if (!handled) {
            return false;
        }

        if (newIndex != currentIndex) {
            final int targetIndex = newIndex;
            getActivity().runOnUiThread(() -> highlightAudioTrackAtIndex(targetIndex));
        }
return true;
    }

    /** WebView keeps focus on Capacitor; track navigation uses this index instead. */
    private int resolveAudioTrackListFocusIndex(View currentFocus) {
        if (focusedAudioTrackIndex >= 0 && focusedAudioTrackIndex < audioTrackButtons.size()) {
            return focusedAudioTrackIndex;
        }
        for (int i = 0; i < audioTrackButtons.size(); i++) {
            if (audioTrackButtons.get(i) == currentFocus) {
                return i;
            }
        }
        if (selectedAudioTrackIndex >= 0 && selectedAudioTrackIndex < audioTrackButtons.size()) {
            return selectedAudioTrackIndex;
        }
        return 0;
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
        
        lastManualSkipTime = System.currentTimeMillis(); // Track manual skip for time update blocking
        scheduleCoalescedSeek(newPosition, "skip_forward");
        
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
        
        android.util.Log.d(
                TAG,
                "Skipped forward "
                        + seconds
                        + "s (coalesced) preview="
                        + newPosition);
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
        
        lastManualSkipTime = System.currentTimeMillis(); // Track manual skip for time update blocking
        scheduleCoalescedSeek(newPosition, "skip_backward");
        
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

                if (isShowingAudioTrackList) {
                    if (currentAudioTrackLabel != null && currentTrackGroupIndex >= 0 && currentTrackIndexInGroup >= 0) {
                        Tracks.Group selectedGroup = audioTrackGroups.get(currentTrackGroupIndex);
                        String trackName = getAudioTrackDisplayName(
                                selectedGroup.getTrackFormat(currentTrackIndexInGroup));
                        currentAudioTrackLabel.setText("Audio: " + trackName);
                    }
                    refreshAudioTrackListSelectionStyles();
                    return;
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
                    boolean playable = isAudioFormatLikelyPlayable(format);
                    if (!playable) {
                        trackName = trackName + " (unsupported)";
                    }
                    boolean isSelected = (globalIndex == selectedGlobalIndex);

                    Button trackButton = new Button(getContext());
                    trackButton.setText(trackName);
                    if (!playable) {
                        trackButton.setAlpha(0.55f);
                    }
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

                    final int finalGlobalIndex = globalIndex;
                    final int finalGroupIdx = groupIdx;
                    final int finalTrackIdx = trackIdx;
                    
                    trackButton.setOnClickListener(v -> {
selectAudioTrackFromMultipleGroups(audioTrackGroups, finalGlobalIndex, finalGroupIdx, finalTrackIdx);
                    });

                    // Set up focus change listener to update selection
                    trackButton.setOnFocusChangeListener(new OnFocusChangeListener() {
                        @Override
                        public void onFocusChange(View v, boolean hasFocus) {
                            if (hasFocus) {
                                focusedAudioTrackIndex = finalGlobalIndex;
                                cancelPendingAudioTrackListFocus();
                            }
                            refreshAudioTrackListSelectionStyles();
                        }
                    });

                    // Set up key listener for navigation
                    trackButton.setOnKeyListener(new View.OnKeyListener() {
                        @Override
                        public boolean onKey(View v, int keyCode, KeyEvent event) {
if (event.getAction() == KeyEvent.ACTION_DOWN) {
                                if (keyCode == KeyEvent.KEYCODE_DPAD_UP) {
                                    android.util.Log.d("ExoPlayerPlugin", "DPAD_UP on track " + finalGlobalIndex);
                                    if (finalGlobalIndex > 0) {
                                        focusAudioTrackButton(finalGlobalIndex - 1);
                                    } else if (audioTrackBtn != null) {
                                        audioTrackBtn.requestFocus();
                                    }
                                    return true;
                                } else if (keyCode == KeyEvent.KEYCODE_DPAD_DOWN) {
                                    android.util.Log.d("ExoPlayerPlugin", "DPAD_DOWN on track " + finalGlobalIndex);
                                    if (finalGlobalIndex < audioTrackButtons.size() - 1) {
                                        focusAudioTrackButton(finalGlobalIndex + 1);
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

            for (int i = 0; i < audioTrackButtons.size(); i++) {
                Button btn = audioTrackButtons.get(i);
                btn.setId(View.generateViewId());
                if (i > 0) {
                    btn.setNextFocusUpId(audioTrackButtons.get(i - 1).getId());
                }
                if (i < audioTrackButtons.size() - 1) {
                    btn.setNextFocusDownId(audioTrackButtons.get(i + 1).getId());
                }
            }
            refreshAudioTrackListSelectionStyles();
            
            android.util.Log.d("ExoPlayerPlugin", "Populated " + globalIndex + " audio track buttons from " + audioTrackGroups.size() + " groups");
        });
    }

    private void applyAudioTrackSelectionUi(
            TrackSelectionParameters newParams,
            int globalIndex,
            String trackName,
            int groupIdx,
            int trackIdx) {
        if (exoPlayer == null || getActivity() == null) {
            return;
        }
        exoPlayer.setTrackSelectionParameters(newParams);
        selectedAudioTrackIndex = globalIndex;
        android.util.Log.d(
            "ExoPlayerPlugin",
            "Selected audio track: " + globalIndex + " (" + trackName + ") from group "
                + groupIdx + ", track " + trackIdx + " - Track switching applied to ExoPlayer");
        getActivity().runOnUiThread(() -> {
            for (int i = 0; i < audioTrackButtons.size(); i++) {
                Button btn = audioTrackButtons.get(i);
                if (btn == null) {
                    continue;
                }
                if (i == globalIndex) {
                    btn.setTextColor(Color.YELLOW);
                    btn.setBackgroundColor(Color.argb(100, 255, 255, 0));
                } else {
                    btn.setTextColor(Color.WHITE);
                    btn.setBackgroundColor(Color.TRANSPARENT);
                }
            }
            if (currentAudioTrackLabel != null) {
                currentAudioTrackLabel.setText("Audio: " + trackName);
            }
            isShowingAudioTrackList = false;
            if (audioTrackListContainer != null) {
                audioTrackListContainer.setVisibility(View.GONE);
            }
            suppressAutoShowAudioList = true;
            showControls(null);
            if (audioTrackBtn != null) {
                audioTrackBtn.requestFocus();
            }
            if (audioTrackBtn != null) {
                audioTrackBtn.postDelayed(() -> suppressAutoShowAudioList = false, 300);
            }
        });
    }

    private void selectAudioTrackFromMultipleGroups(
            java.util.List<Tracks.Group> audioTrackGroups,
            int globalIndex,
            int groupIdx,
            int trackIdx) {
        selectAudioTrackFromMultipleGroups(audioTrackGroups, globalIndex, groupIdx, trackIdx, true);
    }

    private void selectAudioTrackFromMultipleGroups(
            java.util.List<Tracks.Group> audioTrackGroups,
            int globalIndex,
            int groupIdx,
            int trackIdx,
            boolean userInitiated) {
        if (userInitiated) {
            userLockedAudioTrack = true;
        }
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

        if (!isAudioFormatLikelyPlayable(format)) {
            if (getActivity() != null) {
                Toast.makeText(
                        getContext(),
                        "This audio format is not supported on Shield: " + trackName,
                        Toast.LENGTH_LONG).show();
            }
            return;
        }

        if (userInitiated && exoPlayer.getCurrentTracks() != null) {
            captureLastWorkingAudioSelection(exoPlayer.getCurrentTracks());
        }

        // Get the media track group for this audio track
        TrackGroup mediaTrackGroup = targetGroup.getMediaTrackGroup();
// Get current track selection parameters
        TrackSelectionParameters currentTrackParams = exoPlayer.getTrackSelectionParameters();
        
        // Create the override for the selected track
        TrackSelectionOverride override = new TrackSelectionOverride(mediaTrackGroup, Collections.singletonList(trackIdx));
// Clear all existing audio track overrides first, then add the new one
        // This ensures only one audio track is selected at a time
        TrackSelectionParameters.Builder paramsBuilder = currentTrackParams.buildUpon();
        paramsBuilder.setOverrideForType(override);

        TrackSelectionParameters newParams = paramsBuilder.build();
        final long audioSwitchPositionMs = exoPlayer.getCurrentPosition();
        lastAudioTrackSwitchMs = System.currentTimeMillis();
        applyAudioTrackSelectionUi(newParams, globalIndex, trackName, groupIdx, trackIdx);
    }

    private void toggleAudioTrackList() {
        if (audioTrackListContainer == null) {
return;
        }

        getActivity().runOnUiThread(() -> {
            hideSubtitleTrackList();
            if (audioTrackListContainer.getVisibility() == View.VISIBLE) {
                hideAudioTrackList();
            } else {
                suppressAutoShowAudioList = false;
                showAudioTrackList();
            }
        });
    }

    private void showAudioTrackList() {
        if (audioTrackListContainer == null || audioTrackList == null) {
return;
        }

        getActivity().runOnUiThread(() -> {
            android.util.Log.d("ExoPlayerPlugin", "showAudioTrackList() called");
            hideSubtitleTrackList();
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
if (!audioTrackButtons.isEmpty()) {
                int focusIndex = selectedAudioTrackIndex >= 0 && selectedAudioTrackIndex < audioTrackButtons.size()
                    ? selectedAudioTrackIndex : 0;
                highlightAudioTrackAtIndex(focusIndex);
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
            cancelPendingAudioTrackListFocus();
            isShowingAudioTrackList = false;
            focusedAudioTrackIndex = -1;
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
        userLockedAudioTrack = true;
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
        
        lastAudioTrackSwitchMs = System.currentTimeMillis();
        exoPlayer.setTrackSelectionParameters(
            currentTrackParams.buildUpon()
                .setOverrideForType(override)
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
            String fallbackStreamUrl = call.getString("fallbackStreamUrl");
            String introUrl = call.getString("introUrl");
            // Note: ExoPlayer is created in this method, so we don't check for null here
            // The container and PlayerView are set up in initialize(), but ExoPlayer itself
            // is created here when loading the video

            getActivity().runOnUiThread(() -> {
                try {
                    if (isUgoosDevice()) {
                        stopWebViewHtmlMedia();
                    }
                    releaseExoPlayer(false);
                    cancelCoalescedSeek();
                    parseSubtitleTracksFromCall(call, subtitleUrl);
                    applySubtitleSelectionForLoad(subtitleUrl);

                    String playbackPath = url;
                    boolean isHlsUrl =
                        playbackPath != null
                            && playbackPath.toLowerCase().contains(".m3u8");
                    if (playbackPath != null
                            && !isHlsUrl
                            && (playbackPath.startsWith("http://")
                                    || playbackPath.startsWith("https://"))) {
                        String localPath = tryResolveLocalMkvPath(playbackPath);
                        if (localPath != null) {
                            playbackPath = localPath;
                            Log.i(TAG, "Using local MKV: " + localPath);
                        }
                    }

                    boolean isHttpStream =
                        playbackPath != null
                            && (playbackPath.startsWith("http://")
                                    || playbackPath.startsWith("https://"));
                    boolean localMountedFile =
                        !isHttpStream
                            && playbackPath != null
                            && playbackPath.startsWith("/");
                    if (localMountedFile) {
                        File localFile = new File(playbackPath);
                        if (!localFile.exists() || !localFile.canRead()) {
                            String remapped = null;
                            if (fallbackStreamUrl != null && !fallbackStreamUrl.isEmpty()) {
                                remapped = tryResolveLocalMkvPath(fallbackStreamUrl);
                            }
                            if (remapped != null) {
                                playbackPath = remapped;
                                Log.i(
                                    TAG,
                                    "Local mount remapped via SMB discovery: " + remapped);
                                localMountedFile = true;
                            } else if (fallbackStreamUrl != null
                                    && (fallbackStreamUrl.startsWith("http://")
                                            || fallbackStreamUrl.startsWith("https://"))) {
                                playbackPath = fallbackStreamUrl;
                                isHttpStream = true;
                                localMountedFile = false;
                            } else {
                                Log.e(TAG, "Local mount path not readable: " + playbackPath);
                            }
                        }
                    }

                    if (playbackPath != null
                            && !isHlsUrl
                            && (playbackPath.startsWith("http://")
                                    || playbackPath.startsWith("https://"))) {
                        String localPath = tryResolveLocalMkvPath(playbackPath);
                        if (localPath != null) {
                            playbackPath = localPath;
                            isHttpStream = false;
                            localMountedFile = true;
                            Log.i(TAG, "Using local MKV: " + localPath);
                        }
                    }

                    isHttpStream =
                        playbackPath != null
                            && (playbackPath.startsWith("http://")
                                    || playbackPath.startsWith("https://"));
                    localMountedFile =
                        !isHttpStream
                            && playbackPath != null
                            && playbackPath.startsWith("/");

                    currentStreamUrl = playbackPath;
                    currentStreamIsEventHls =
                        isHlsUrl
                            && playbackPath != null
                            && playbackPath.contains("shield-streams");
                    streamContentLength = -1;
                    indexTailPrewarmed = false;
                    indexTailPrewarmInProgress = false;
                    hasAppliedHdrDisplayMode = false;
                    pendingHdrDisplayMode = false;

                    Uri playbackUri =
                        isHttpStream
                            ? Uri.parse(playbackPath)
                            : Uri.fromFile(new File(playbackPath));

                    currentPlaybackUri = playbackUri;
                    currentPlaybackIsHls = isHlsUrl;
                    currentPlaybackIsHttpMkv =
                        playbackPath != null
                            && (playbackPath.toLowerCase().contains(".mkv")
                                    || playbackPath.contains("/api/mov/stream"));

                    MediaItem mediaItem = buildMediaItemForCurrentPlayback();
                    if (mediaItem == null) {
                        mediaItem =
                                new MediaItem.Builder().setUri(playbackUri).build();
                    }
                    updateSubtitleTrackUI();

                    DataSource.Factory playbackDataSourceFactory;
                    if (isHttpStream) {
                        DefaultHttpDataSource.Factory httpDataSourceFactory =
                            new DefaultHttpDataSource.Factory()
                                .setAllowCrossProtocolRedirects(true)
                                .setConnectTimeoutMs(15000)
                                .setReadTimeoutMs(15000);
                        if (isHlsUrl) {
                            // HLS: no SimpleCache — stale fMP4 init/playlist was causing EOF on FragmentedMp4Extractor.
                            activeCacheDataSourceFactory = null;
                            playbackDataSourceFactory = httpDataSourceFactory;
                        } else {
                            activeCacheDataSourceFactory =
                                buildCacheDataSourceFactory(httpDataSourceFactory);
                            playbackDataSourceFactory = activeCacheDataSourceFactory;
                        }
                    } else {
                        activeCacheDataSourceFactory = null;
                        playbackDataSourceFactory =
                            new DefaultDataSource.Factory(getContext());
                    }

                    MediaSource mediaSource;
                    if (isHlsUrl) {
                        mediaSource =
                            new HlsMediaSource.Factory(playbackDataSourceFactory)
                                .createMediaSource(mediaItem);
                    } else {
                        ProgressiveMediaSource.Factory progressiveFactory =
                            new ProgressiveMediaSource.Factory(playbackDataSourceFactory);
                        mediaSource = progressiveFactory.createMediaSource(mediaItem);
                    }
                    
                    this.trackSelector = buildTrackSelector(localMountedFile);

                    boolean ugoosDevice = isUgoosDevice();
                    DefaultRenderersFactory renderersFactory =
                        ugoosDevice
                            ? new UgoosRenderersFactory(getContext())
                            : new DefaultRenderersFactory(getContext());
                    if (!ugoosDevice) {
                        renderersFactory.setExtensionRendererMode(
                            DefaultRenderersFactory.EXTENSION_RENDERER_MODE_PREFER);
                    }
                    renderersFactory.setEnableDecoderFallback(true);
                    
                    exoPlayer = new ExoPlayer.Builder(getContext())
                        .setRenderersFactory(renderersFactory)
                        .setTrackSelector(trackSelector)
                        .setLoadControl(buildLoadControl(localMountedFile))
                        .build();
                    applySeekParametersForContent();
                    exoPlayer.setAudioAttributes(
                        new AudioAttributes.Builder()
                            .setUsage(C.USAGE_MEDIA)
                            .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE)
                            .build(),
                        true);
                    exoPlayer.setVolume(1f);

                    // Set the player on the PlayerView
                    if (playerView != null) {
                        playerView.setPlayer(exoPlayer);
                        ensureVideoSurfaceAttached();
                    }
                    setWebViewObscured(true);

                    // Set up ExoPlayer listener for playback state changes and errors
                    exoPlayer.addListener(new Player.Listener() {
                        @Override
                        public void onPlaybackStateChanged(int playbackState) {
                            if (playbackState == Player.STATE_READY) {
                                ensureVideoSurfaceAttached();
                                if (currentStreamUrl != null
                                        && currentStreamUrl.contains("/api/mov/stream")
                                        && activeCacheDataSourceFactory != null
                                        && currentStreamUrl.toLowerCase().contains(".mkv")) {
                                    prewarmMatroskaIndexTail(
                                            currentStreamUrl,
                                            activeCacheDataSourceFactory);
                                }
                                if (exoPlayer.getCurrentTracks() != null) {
                                    captureLastWorkingAudioSelection(exoPlayer.getCurrentTracks());
                                }
                            }
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
                                ensureVideoSurfaceAttached();
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
                                            if (isSelected) {
                                                updateHdrModeFromVideoFormat(format);
                                            }
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
                            
                            autoSelectPreferredAudioTrack(tracks);

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
                            
                            boolean codecError = error.errorCode == PlaybackException.ERROR_CODE_DECODER_INIT_FAILED
                                    || error.errorCode == PlaybackException.ERROR_CODE_DECODER_QUERY_FAILED
                                    || error.errorCode == PlaybackException.ERROR_CODE_DECODING_FAILED;
                            if (codecError) {
                                errorMessage = "Codec not supported: " + errorMessage;
                                Log.e(TAG, "Codec error detected - audio/video codec may not be supported on this device");
                                if (userLockedAudioTrack && lastWorkingAudioGroupIdx >= 0) {
                                    String failedName = selectedAudioTrackIndex >= 0
                                            && selectedAudioTrackIndex < audioTrackButtons.size()
                                            ? audioTrackButtons.get(selectedAudioTrackIndex).getText().toString()
                                            : "selected track";
                                    revertToLastWorkingAudioTrack(failedName);
                                }
                            } else if (error.errorCode == PlaybackException.ERROR_CODE_PARSING_CONTAINER_MALFORMED) {
                                errorMessage = "Codec not supported: " + errorMessage;
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
                    List<MediaSource> playlist = new ArrayList<>();
                    if (ugoosDevice && introUrl != null && !introUrl.isEmpty()) {
                        MediaSource introSource = buildSimpleProgressiveMediaSource(introUrl);
                        if (introSource != null) {
                            playlist.add(introSource);
                            Log.i(TAG, "Ugoos DV intro queued before movie: " + introUrl);
                        }
                    }
                    playlist.add(mediaSource);
                    if (playlist.size() > 1) {
                        exoPlayer.setMediaSources(playlist);
                    } else {
                        exoPlayer.setMediaSource(mediaSource);
                    }
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
            exoPlayer.setVolume(1f);
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
                performSeek(position, "plugin_seekTo");
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

        // ExoPlayer must be accessed on the main thread
        getActivity().runOnUiThread(() -> {
            try {
                long position = exoPlayer.getCurrentPosition();
                JSObject ret = new JSObject();
                ret.put("position", position / 1000.0); // Convert milliseconds to seconds
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Error getting current position: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void getDuration(PluginCall call) {
        if (exoPlayer == null) {
            call.reject("ExoPlayer not initialized");
            return;
        }

        // ExoPlayer must be accessed on the main thread
        getActivity().runOnUiThread(() -> {
            try {
                long duration = exoPlayer.getDuration();
                JSObject ret = new JSObject();
                ret.put("duration", duration / 1000.0); // Convert milliseconds to seconds
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Error getting duration: " + e.getMessage());
            }
        });
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
if (!isShowingAudioTrackList && audioTrackListContainer != null && audioTrackListContainer.getVisibility() == View.VISIBLE) {
                android.util.Log.d("ExoPlayerPlugin", "Hiding audio track list because controls are being shown (not showing audio list)");
                audioTrackListContainer.setVisibility(View.GONE);
            } else if (isShowingAudioTrackList) {
                android.util.Log.d("ExoPlayerPlugin", "NOT hiding audio track list in showControls - isShowingAudioTrackList flag is true");
            }
            if (!isShowingSubtitleTrackList
                    && subtitleTrackListContainer != null
                    && subtitleTrackListContainer.getVisibility() == View.VISIBLE) {
                subtitleTrackListContainer.setVisibility(View.GONE);
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
if (!isShowingAudioTrackList && audioTrackListContainer != null && audioTrackListContainer.getVisibility() == View.VISIBLE) {
                        android.util.Log.d("ExoPlayerPlugin", "Hiding audio track list because controls are being hidden (not showing audio list)");
                        audioTrackListContainer.setVisibility(View.GONE);
} else if (isShowingAudioTrackList) {
                        android.util.Log.d("ExoPlayerPlugin", "NOT hiding audio track list - isShowingAudioTrackList flag is true");
                    }
                    if (!isShowingSubtitleTrackList
                            && subtitleTrackListContainer != null
                            && subtitleTrackListContainer.getVisibility() == View.VISIBLE) {
                        subtitleTrackListContainer.setVisibility(View.GONE);
                    }
                    
                    // Only re-request focus on containerView if audio list is NOT visible
                    // If audio list is visible, let the track buttons keep focus
                    if (!isShowingAudioTrackList
                            && !isShowingSubtitleTrackList
                            && containerView != null) {
containerView.post(() -> {
                            if (containerView != null) {
                                containerView.requestFocus();
}
                        });
                        android.util.Log.d("ExoPlayerPlugin", "Controls hidden - visibility: GONE, re-requested focus on containerView");
                    } else if (isShowingAudioTrackList) {
                        android.util.Log.d("ExoPlayerPlugin", "NOT re-requesting focus on containerView - audio list is visible, buttons should keep focus");
                    }

                    if (!isShowingSubtitleTrackList
                            && subtitleTrackListContainer != null
                            && subtitleTrackListContainer.getVisibility() == View.VISIBLE) {
                        subtitleTrackListContainer.setVisibility(View.GONE);
                    }
                })
                .start();
        });

        if (call != null) call.resolve();
    }

    @PluginMethod
    public void isAudioTrackListVisible(PluginCall call) {
        boolean visible = isShowingAudioTrackList
                || (audioTrackListContainer != null
                && audioTrackListContainer.getVisibility() == View.VISIBLE);
        JSObject ret = new JSObject();
        ret.put("visible", visible);
        call.resolve(ret);
    }

    @PluginMethod
    public void isSubtitleTrackListVisible(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("visible", isSubtitleTrackListVisible());
        call.resolve(ret);
    }

    @PluginMethod
    public void navigateControls(PluginCall call) {
        String direction = call.getString("direction", "up");
        
        if (controlsView == null) {
            if (call != null) call.resolve();
            return;
        }

        getActivity().runOnUiThread(() -> {
            View targetView = null;
            View currentFocus = getActivity().getCurrentFocus();
            
            // Check if audio track list is visible - if so, navigate within the list
            boolean audioListVisible = isShowingAudioTrackList
                    || (audioTrackListContainer != null
                    && audioTrackListContainer.getVisibility() == View.VISIBLE);

            if (!controlsVisible && !audioListVisible) {
                if (call != null) call.resolve();
                return;
            }
if (audioListVisible && !audioTrackButtons.isEmpty()) {
                int currentTrackIndex = resolveAudioTrackListFocusIndex(currentFocus);
                String dir = direction.toLowerCase();
if ("left".equals(dir) || "back".equals(dir)) {
                    hideAudioTrackList();
                    if (audioTrackBtn != null) {
                        audioTrackBtn.requestFocus();
                    }
                    if (call != null) call.resolve();
                    return;
                }

                if ("enter".equals(dir)) {
                    Button trackButton = audioTrackButtons.get(currentTrackIndex);
                    trackButton.performClick();
                    if (call != null) call.resolve();
                    return;
                }

                int newIndex = currentTrackIndex;
                if ("up".equals(dir) && currentTrackIndex > 0) {
                    newIndex = currentTrackIndex - 1;
                } else if ("down".equals(dir) && currentTrackIndex < audioTrackButtons.size() - 1) {
                    newIndex = currentTrackIndex + 1;
                } else if ("right".equals(dir) && currentTrackIndex < audioTrackButtons.size() - 1) {
                    newIndex = currentTrackIndex + 1;
                }

                if (newIndex != currentTrackIndex) {
                    highlightAudioTrackAtIndex(newIndex);
                }
                if (call != null) call.resolve();
                return;
            } else {
                // Navigate main controls (existing logic)
                // Check if seek bar has focus first
                if (seekBar != null && seekBar == currentFocus) {
                    // Currently on seek bar
                    switch (direction.toLowerCase()) {
                        case "down":
                            // Navigate down from seek bar to play/pause button (center button)
                            if (playPauseBtn != null) {
                                targetView = playPauseBtn;
                            }
                            break;
                        case "left":
                        case "right":
                            // Move seek bar thumb (same behavior as remote) - don't seek until Enter is pressed
                            if (seekBar != null && exoPlayer != null) {
                                long duration = exoPlayer.getDuration();
                                
                                if (duration > 0) {
                                    // Start seeking mode if not already seeking
                                    if (!isSeeking) {
                                        isSeeking = true;
                                        seekStartTime = System.currentTimeMillis();
                                        wasPlayingBeforeSeek = exoPlayer.isPlaying();
                                        stopTimeUpdates();
                                        
                                        // Prevent controls from auto-hiding while seeking
                                        if (controlsHideHandler != null) {
                                            controlsHideHandler.removeCallbacksAndMessages(null);
                                        }
                                        
                                        // Pause playback while user is navigating (if playing)
                                        if (exoPlayer.isPlaying()) {
                                            exoPlayer.pause();
                                            isPaused = true;
                                            if (playPauseBtn != null) {
                                                playPauseBtn.setImageResource(android.R.drawable.ic_media_play);
                                            }
                                        }
                                    }
                                    
                                    // Get current seek bar progress
                                    int currentProgress = seekBar.getProgress();
                                    int maxProgress = seekBar.getMax(); // Should be 10000
                                    
                                    // Move by approximately 1% of the range (same as Android SeekBar default behavior)
                                    int increment = Math.max(1, maxProgress / 100); // ~1% of max
                                    int newProgress;
                                    
                                    if (direction.toLowerCase().equals("left")) {
                                        // Move backward
                                        newProgress = Math.max(0, currentProgress - increment);
                                    } else {
                                        // Move forward
                                        newProgress = Math.min(maxProgress, currentProgress + increment);
                                    }
                                    
                                    // Update seek bar progress (but don't seek yet - wait for Enter)
                                    seekBar.setProgress(newProgress);
                                }
                            }
                            resetControlsHideTimer();
                            if (call != null) call.resolve();
                            return;
                        case "enter":
                            // Perform the seek when Enter is pressed (same as remote behavior)
                            if (seekBar != null && exoPlayer != null && isSeeking) {
                                int finalProgress = seekBar.getProgress();
                                long duration = exoPlayer.getDuration();
                                
                                if (duration > 0) {
                                    long seekPosition = (long) (duration * finalProgress / 10000.0);
                                    lastSeekTime = System.currentTimeMillis();
                                    performSeek(seekPosition, "navigate_enter");
                                    resumePlaybackAfterSeekIfNeeded();
                                    
                                    // Reset seeking state
                                    isSeeking = false;
                                    seekStartTime = 0;
                                    
                                    // Restart time updates
                                    startTimeUpdates();
                                }
                            }
                            resetControlsHideTimer();
                            if (call != null) call.resolve();
                            return;
                        case "up":
                            // Already at top, stay on seek bar
                            resetControlsHideTimer();
                            if (call != null) call.resolve();
                            return;
                    }
                } else if (currentFocus != null) {
                    // On a button or other control
                    int currentId = currentFocus.getId();
                    
                    // Define button order (left to right)
                    int[] buttonOrder = {
                        R.id.skipBack30Btn,
                        R.id.skipBack15Btn,
                        R.id.playPauseBtn,
                        R.id.skipForward15Btn,
                        R.id.skipForward30Btn,
                        R.id.audioTrackBtn
                    };
                    
                    // Find current button index
                    int currentIndex = -1;
                    for (int i = 0; i < buttonOrder.length; i++) {
                        if (currentId == buttonOrder[i]) {
                            currentIndex = i;
                            break;
                        }
                    }
if (currentIndex >= 0) {
                        switch (direction.toLowerCase()) {
                            case "left":
                                if (currentIndex > 0) {
                                    targetView = controlsView.findViewById(buttonOrder[currentIndex - 1]);
                                }
                                break;
                            case "right":
                                if (currentIndex < buttonOrder.length - 1) {
                                    targetView = controlsView.findViewById(buttonOrder[currentIndex + 1]);
                                }
                                break;
                            case "up":
                                // Navigate up to seek bar
                                if (seekBar != null && seekBar.getVisibility() == View.VISIBLE) {
                                    targetView = seekBar;
                                }
                                break;
                            case "down":
                                // Navigate down to bottom row buttons if visible, otherwise stay on current button
                                // Check for bottom row buttons (skipIntroBtn, nextEpisodeBtn)
                                if (skipIntroBtn != null && skipIntroBtn.getVisibility() == View.VISIBLE) {
                                    targetView = skipIntroBtn;
                                } else if (nextEpisodeBtn != null && nextEpisodeBtn.getVisibility() == View.VISIBLE) {
                                    targetView = nextEpisodeBtn;
                                }
                                break;
                            case "enter":
                                // Trigger click on currently focused button
                                if (currentFocus.isClickable()) {
                                    currentFocus.performClick();
}
                                resetControlsHideTimer();
                                if (call != null) call.resolve();
                                return;
                        }
                    } else {
                        // No button has focus, focus the first one (or playPauseBtn)
                        if (playPauseBtn != null) {
                            targetView = playPauseBtn;
                        } else if (buttonOrder.length > 0) {
                            targetView = controlsView.findViewById(buttonOrder[0]);
                        }
                    }
                } else {
                    // No focus at all, focus the play/pause button
                    if (playPauseBtn != null) {
                        targetView = playPauseBtn;
                    }
                }
            }
            
            // Request focus on target view
            if (targetView != null && targetView.getVisibility() == View.VISIBLE) {
                boolean focusResult = targetView.requestFocus();
                if (audioListVisible && audioTrackButtons.contains(targetView)) {
                    scrollAudioTrackIntoView(targetView);
                }
} else {
}
            
            // Reset controls timer
            resetControlsHideTimer();
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
            releaseExoPlayer();
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
if (videoUrl == null || videoUrl.isEmpty()) {
                call.reject("Video URL is required");
                return;
            }

            // Check if Zidoo player is installed
            PackageManager pm = getContext().getPackageManager();
// Method 1: Check for com.zidoo.poster package (we know this exists on Z9X Pro)
            boolean isZidooDevice = false;
            try {
                pm.getPackageInfo("com.zidoo.poster", 0);
                isZidooDevice = true;
} catch (PackageManager.NameNotFoundException e) {
}
            
            // Method 2: Try queryIntentActivities (for Activities that handle the Intent)
            if (!isZidooDevice) {
                Intent testIntent = new Intent("com.zidoo.player.action.VIDEO_PLAY");
                java.util.List<android.content.pm.ResolveInfo> activityHandlers = pm.queryIntentActivities(testIntent, 0);
isZidooDevice = activityHandlers != null && !activityHandlers.isEmpty();
            }
            
            // Method 3: Try queryBroadcastReceivers (for BroadcastReceivers that handle the Intent)
            if (!isZidooDevice) {
                Intent testIntent = new Intent("com.zidoo.player.action.VIDEO_PLAY");
                java.util.List<android.content.pm.ResolveInfo> broadcastHandlers = pm.queryBroadcastReceivers(testIntent, 0);
isZidooDevice = broadcastHandlers != null && !broadcastHandlers.isEmpty();
            }
if (!isZidooDevice) {
// Fallback: Try generic video player Intent (let Android choose the best player)
try {
                    Intent intent = new Intent(Intent.ACTION_VIEW);
                    intent.setDataAndType(Uri.parse(videoUrl), "video/*");
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    
                    // Check if any app can handle this Intent
                    if (intent.resolveActivity(pm) != null) {
getActivity().startActivity(intent);
                        
                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        ret.put("fallback", true);
                        call.resolve(ret);
                        return;
                    } else {
call.reject("Zidoo player is not installed and no video player app found");
                        return;
                    }
                } catch (Exception e) {
call.reject("Zidoo player is not installed and failed to launch fallback player: " + e.getMessage());
                    return;
                }
            }
            
            try {
                // Check if videoUrl is an HTTP URL - Zidoo needs file paths, not HTTP URLs
                boolean isHttpUrl = videoUrl.startsWith("http://") || videoUrl.startsWith("https://");
if (isHttpUrl) {
call.reject("Zidoo player requires a file path, not an HTTP URL. The server should provide the file path for Zidoo devices.");
                    return;
                }
                
                // Option 1: Launch Zidoo's File Manager or file browser to open the file
                // This allows Zidoo's File Manager to handle the file and launch the native player
                // NOTE: We don't check if the file exists because our app is sandboxed and cannot
                // see system mount points (/mnt/*), USB drives, or SMB/NFS mounts. Zidoo's native
                // player can see these paths, so we trust the path and let Zidoo validate it.
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
// Check if path is on a system mount point that regular apps can't access
                // Paths like /mnt/*, /storage/*, etc. are only accessible to system apps
                boolean isSystemMountPath = videoUrl.startsWith("/mnt/") || 
                                           videoUrl.startsWith("/storage/") ||
                                           videoUrl.startsWith("/sdcard/");
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
// Filter out com.zidoo.poster (Poster Wall) from the list
                    if (resolveList != null && !resolveList.isEmpty()) {
                        // Find an app that's NOT Poster Wall
                        android.content.pm.ResolveInfo selectedApp = null;
                        for (android.content.pm.ResolveInfo info : resolveList) {
                            if (info.activityInfo != null && !info.activityInfo.packageName.equals("com.zidoo.poster")) {
                                selectedApp = info;
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
JSObject ret = new JSObject();
                                    ret.put("success", true);
                                    call.resolve(ret);
                                    return;
                                }
                            } catch (Exception e) {
}
                        }
                    }
                } else {
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
getActivity().startActivity(chooser);
                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        call.resolve(ret);
                        return;
                    }
                    } catch (Exception e) {
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
if (viewIntent.resolveActivity(pm) != null) {
                                getActivity().startActivity(viewIntent);
JSObject ret = new JSObject();
                                ret.put("success", true);
                                ret.put("message", "Media Center opened. Please select " + fileName + " to play.");
                                ret.put("directory", directoryPath);
                                ret.put("fileName", fileName);
                                call.resolve(ret);
                                return;
                            } else {
}
                        } catch (Exception e) {
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
getActivity().startActivity(mediaCenterIntent);
JSObject ret = new JSObject();
                                ret.put("success", true);
                                ret.put("message", "Media Center opened. Please select " + fileName + " to play.");
                                ret.put("directory", directoryPath);
                                ret.put("fileName", fileName);
                                call.resolve(ret);
                                return;
                            }
                        } catch (Exception e) {
}
                    } else {
}
                } catch (Exception e) {
}
// Return failure - we tried everything
                JSObject ret = new JSObject();
                ret.put("success", false);
                ret.put("filePath", videoUrl);
                call.resolve(ret);
            } catch (Exception e) {
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
        releaseExoPlayer();
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

