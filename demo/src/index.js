import { Mp3Decoder } from "../../lib/index.js";
import { FUPCMPlayer } from "./pcm_player.js";
import { connect } from './websocket_connection.js';

let audioPlayer;

const mp3Decoder = new Mp3Decoder({
    wasmUrl: 'public/LameDecoder.wasm',
    pcm_output(chunk, opts) {
        const length = chunk.length;
        const channels = chunk.channels;
        const result = new Int16Array(length * channels);
        chunk.copyTo(result);
        audioPlayer.feed(result);
    },
    info_callback({sampleRate, numsChannels}) {
        if(!audioPlayer) {
            audioPlayer = new FUPCMPlayer({
                encoding: '16bitInt',
                channels: numsChannels,
                sampleRate,
            });
        } 
    }
});

const playBtn = document.getElementById('play');
playBtn.onclick = async function(event) {
    await mp3Decoder.initialize();
    mp3Decoder.configure();
    // const res = await fetch('public/media/tests_streamp3_data_stereo.mp3');
    // const buffer = await res.arrayBuffer();
    // mp3Decoder.decode(buffer);
   
    connect({
        onData(data) {
            mp3Decoder.decode(data);
        },
        onComplete() {
            if(audioPlayer) {
                audioPlayer.setRequestStop();
            }
        }
    })
}