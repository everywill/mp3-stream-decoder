# mp3-stream-decoder
A webassembly-empowered decoder for mp3, especially for streaming huge ones.

### How to use
```
import { Mp3Decoder } from "/src/index.js";

const mp3Decoder = new Mp3Decoder({
    wasmUrl: 'public/LameDecoder.wasm',
    pcm_output(chunk, opts) {
        const length = chunk.length;
        const channels = chunk.channels;
        const result = new Int16Array(length * channels);
        chunk.copyTo(result);
        // now you can feed data to your pcm-player
        // audioPlayer.feed(result);
    },
    info_callback({sampleRate, numsChannels}) {
        // your can construct your pcm-player based on information provided by this callback
    }
});

await mp3Decoder.initialize();   // init and load wasm
mp3Decoder.configure(); 

mp3Decoder.decode(data);  // stream your data to mp3Decoder, then you can get decoded pcm from pcm_output callback
```