package com.adaptivestreaming.app;

import android.content.Context;
import android.util.Log;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.exoplayer.audio.AudioCapabilities;

/**
 * Android 9 on Ugoos often omits TrueHD/DTS-HD from {@link AudioCapabilities} even when HDMI
 * passthrough is enabled in system settings. ExoPlayer then decodes to PCM (losing Atmos) or stays
 * silent. Supply merged capabilities so {@link androidx.media3.exoplayer.audio.DefaultAudioSink} uses
 * {@code OUTPUT_MODE_PASSTHROUGH} for lossless HDMI bitstreams.
 */
final class UgoosAudioPassthroughHelper {
    private static final String TAG = "UgoosAudioPassthrough";

    private UgoosAudioPassthroughHelper() {}

    static AudioAttributes movieAudioAttributes() {
        return new AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE)
            .build();
    }

    @SuppressWarnings("deprecation")
    static AudioCapabilities buildPassthroughCapabilities(Context context) {
        AudioAttributes attrs = movieAudioAttributes();
        AudioCapabilities reported = AudioCapabilities.getCapabilities(context, attrs, null);

        if (reported.supportsEncoding(C.ENCODING_DOLBY_TRUEHD)
                && reported.supportsEncoding(C.ENCODING_E_AC3)) {
            Log.i(TAG, "Using system AudioCapabilities (TrueHD + E-AC3 reported)");
            return reported;
        }

        Log.i(
            TAG,
            "Augmenting AudioCapabilities for HDMI passthrough"
                + " (enable TrueHD/DTS-HD in Ugoos Sound > Digital Audio Format > Manual)");
        return new AudioCapabilities(
            new int[] {
                C.ENCODING_PCM_16BIT,
                C.ENCODING_AC3,
                C.ENCODING_E_AC3,
                C.ENCODING_E_AC3_JOC,
                C.ENCODING_DOLBY_TRUEHD,
                C.ENCODING_DTS,
                C.ENCODING_DTS_HD,
            },
            /* maxChannelCount= */ 8);
    }
}
