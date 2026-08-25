package com.adaptivestreaming.app;



import android.content.Context;

import android.os.Handler;

import androidx.annotation.Nullable;

import androidx.media3.common.util.UnstableApi;

import androidx.media3.exoplayer.DefaultRenderersFactory;

import androidx.media3.exoplayer.audio.AudioSink;

import androidx.media3.exoplayer.audio.DefaultAudioSink;



@UnstableApi

final class UgoosRenderersFactory extends DefaultRenderersFactory {

    UgoosRenderersFactory(Context context) {

        super(context);

        // Prefer MediaCodec passthrough over FFmpeg PCM decode (preserves TrueHD Atmos metadata).

        setExtensionRendererMode(EXTENSION_RENDERER_MODE_ON);

    }



    @Override

    @Nullable

    @SuppressWarnings("deprecation")

    protected AudioSink buildAudioSink(

            Context context,

            boolean enableFloatOutput,

            boolean enableAudioTrackPlaybackParams) {

        return new DefaultAudioSink.Builder()

            .setAudioCapabilities(UgoosAudioPassthroughHelper.buildPassthroughCapabilities(context))

            .setEnableFloatOutput(enableFloatOutput)

            .setEnableAudioTrackPlaybackParams(enableAudioTrackPlaybackParams)

            .build();

    }

}

