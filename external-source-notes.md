# External Source Notes

## Sarvam synchronous speech-to-text limit

Source: <https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/rest-api>

The Sarvam Speech-to-Text REST documentation states that synchronous processing is intended for short audio with a maximum duration of **30 seconds**. Its audio-preparation guidance says that longer files should be split into chunks of 30 seconds or less or sent through the batch API, which accepts longer files. The documentation lists WAV, MP3, AAC, FLAC, and OGG as supported formats and recommends 16 kHz mono WAV for best accuracy.

This source explains the observed rejection of Vaani’s 97.64-second long-audio stress fixture and supports the client-side 25-second MediaRecorder cap added during validation.
