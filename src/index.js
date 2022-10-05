import LameDecoder from '../bin/webassembly_Release/LameDecoder.js';
import { loadWasm } from './utils.js';

class WasmLoader {
    module
    async LoadWasm() {
        return loadWasm(this.wasmUrl)
            .then(wasmBinary => LameDecoder({
                instantiateWasm: (imports, successCallback) => {
                    imports.env.pcm_write_polyfill = (pcm_lbuffer, pcm_rbuffer, pcm_size, number_channels) => {
                        this.pcm_output({
                            copyTo: (dest) => {
                                const lbuffer_base = pcm_lbuffer / 2;
                                const rbuffer_base = pcm_rbuffer / 2;
                                if(number_channels === 1) {
                                    for(let i = 0; i < pcm_size; i++) {
                                        dest[i] = this.module.HEAP16[lbuffer_base + i];
                                    }
                                } else if(number_channels === 2) {
                                    for(let i = 0; i < pcm_size; i++) {
                                        dest[i*2] = this.module.HEAP16[lbuffer_base + i];
                                        dest[i*2 + 1] = this.module.HEAP16[rbuffer_base + i];
                                    }
                                }
                            },
                            length: pcm_size,
                            channels: number_channels
                        }, {});
                    };
                    WebAssembly.instantiate(new Uint8Array(wasmBinary), imports)
                        .then(function(output) {
                            successCallback(output.instance);
                        });
                }
            })).then(module => {
                this.module = module;
                return this.module;
            });
    }
}

export const lameDecoderWasmLoader = new WasmLoader();

export class Mp3Decoder {
    constructor(options) {
        this.wasmCtx = lameDecoderWasmLoader;
        this.wasmCtx.wasmUrl = options.wasmUrl;
        this.wasmCtx.pcm_output = options.pcm_output;
        this.audioinfo_callback = options.info_callback;
        this._decode_state = 0; // 0: waiting header; 1: waiting frame
        this._head = 0;
        this.buffer = new Uint8Array(0);
    }

    async initialize() {
        await this.wasmCtx.LoadWasm();
    }

    configure() {
        this.decoder = new this.wasmCtx.module.Mp3Decoder();
        this.decoder.configure();
    }

    decode(arraybuffer) {
        this.appendBuffer(arraybuffer);
        const totalLength = this.buffer.length;
        while(this._head<totalLength) {
            
            while(this.buffer[this._head] !== 0b11111111 || (this.buffer[this._head+1] >> 5) != 0b111) {
                this._head += 1;
                if(this._head >= totalLength) {
                    return;
                }
            }
            let ptr = this.wasmCtx.module._malloc(4);
            this.wasmCtx.module.HEAPU8.set(this.buffer.subarray(this._head, this._head+4), ptr);
            this.decoder.decode_header(ptr, 4);
            const frameSize = this.decoder.get_frame_size();
            if(this._head + frameSize > this.buffer.length) {
                break;
            }
            const sampleRate = this.decoder.get_sample_rate();
            const numsChannels = this.decoder.get_num_channels();
            this.audioinfo_callback && this.audioinfo_callback({
                sampleRate,
                numsChannels,
            });
            this.wasmCtx.module._free(ptr);

            ptr = this.wasmCtx.module._malloc(frameSize);
            this.wasmCtx.module.HEAPU8.set(this.buffer.subarray(this._head, this._head+frameSize), ptr);
            this.decoder.decode_frame(ptr, frameSize);
            this.wasmCtx.module._free(ptr);

            this._head += frameSize;
        }
    }

    appendBuffer(arraybuffer) {
        const length = arraybuffer.byteLength;
        const tmp = new Uint8Array(length + this.buffer.byteLength);
        tmp.set(this.buffer);
        tmp.set(new Uint8Array(arraybuffer), this.buffer.byteLength);
        this.buffer = tmp;
    }
}
