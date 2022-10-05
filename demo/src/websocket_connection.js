export const connect = function({onData, onComplete}) {
    const host = location.origin.replace(/^http/, 'ws');
    const web_socket = new WebSocket(host);
    web_socket.binaryType = 'arraybuffer';

    web_socket.onmessage = function(event) {
        if(typeof event.data === 'string') {
            const received_json = JSON.parse(event.data);

            if(typeof received_json.streaming_is_done !== 'undefined') {
                if(received_json.streaming_is_done === 'yes') {
                    onComplete();
                }
            }
        } else if(event.data instanceof ArrayBuffer) {
            onData(event.data);
        }
    };

    web_socket.onopen = function(event) {
        web_socket.send(JSON.stringify({
            transmit_chunksize: 500,
            requested_action: 'stream_audio_to_client',
            requested_source:  'tests_streamp3_data_stereo.mp3',
        }));
    };
}