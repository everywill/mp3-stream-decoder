#include <emscripten/bind.h>
#include <emscripten.h>
#include <lame.h>

using namespace emscripten;

typedef unsigned char uint8_t;

extern "C" {
  extern void pcm_write_polyfill(int pcm_lbuffer, int pcm_rbuffer, int pcm_size, int channel_count);
  EMSCRIPTEN_KEEPALIVE
  void pcm_write(short* pcm_lbuffer, short* pcm_rbuffer, int pcm_size, int channel_count) {
    pcm_write_polyfill((int)pcm_lbuffer, (int)pcm_rbuffer, pcm_size, channel_count);
  }
}

class Mp3Decoder {
public:
    Mp3Decoder() {}

    void configure() {
        decoder_handle = hip_decode_init();
    }

    int decode_header(int data_ptr, int data_size) {
        uint8_t* header = (uint8_t*)data_ptr;
        uint8_t version_code = (header[1] & 0b00011000) >> 3;
        uint8_t layer_code = (header[1] & 0b00000110) >> 1;
        int bit_rate_code = (header[2] & 0b11110000) >> 4;
        int sample_rate_code = (header[2] & 0b00001100) >> 2;
        uint8_t padding_code = (header[2] & 0b00000010) >> 1;
        uint8_t channel_code = (header[3] & 0b11000000) >> 6;

        if(layer_code != 1) {
            // invalid mp3 layer
            return -1;
        }
        int version; // mp3g version (0=mpeg-2, 1=mpeg-1, 2=mpeg-2.5)
        if(version_code >> 1) {
            version = version_code & 1;
        } else {
            version = 2;
        }

        bit_rate = lame_get_bitrate(version, bit_rate_code) * 1000;
        sample_rate = lame_get_samplerate(version, sample_rate_code);
        is_padded = (bool) padding_code;
        if(channel_code == 0b11) {
            num_channels = 1;
        } else {
            num_channels = 2;
        }

        if(version == 1) {
            frame_size = 1152;
        } else {
            frame_size = 576;
        }
        frame_size = bit_rate * frame_size /(8 * sample_rate) ;
        if(is_padded) {
            frame_size += 1;
        }

        return 1;
    }

    int decode_frame(int data_ptr, int frame_size) {
        uint8_t* mp3_buffer = (uint8_t*)data_ptr;
        int size = hip_decode1(decoder_handle, mp3_buffer, frame_size, pcm_lbuffer, pcm_rbuffer);
        
        if(size > 0) {
            pcm_write(pcm_lbuffer, pcm_rbuffer, size, num_channels);
        }

        return size;
    }

    int get_frame_size() {
        return frame_size;
    }

    int get_sample_rate() {
        return sample_rate;
    }

    int get_num_channels() {
        return num_channels;
    }

private:
    hip_t decoder_handle;
    int bit_rate;
    int sample_rate;
    int num_channels;
    bool is_padded;
    int frame_size;
    short pcm_lbuffer[65536] = {0};
    short pcm_rbuffer[65536] = {0}; 
};

EMSCRIPTEN_BINDINGS(encoder_module) {
     class_<Mp3Decoder>("Mp3Decoder")
        .constructor<>()
        .function("configure", &Mp3Decoder::configure)
        .function("decode_header", &Mp3Decoder::decode_header)
        .function("decode_frame", &Mp3Decoder::decode_frame)
        .function("get_frame_size", &Mp3Decoder::get_frame_size)
        .function("get_sample_rate", &Mp3Decoder::get_sample_rate)
        .function("get_num_channels", &Mp3Decoder::get_num_channels)
        ;
}