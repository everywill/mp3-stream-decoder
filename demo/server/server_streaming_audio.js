const fs = require('fs');
const path = require('path');

const server_streaming_audio = (function () {
    let media_dir = undefined;
    const set_media_dir = function(given_media_dir) {
        media_dir = given_media_dir;
    };
    exports.set_media_dir = set_media_dir;

    const streaming_is_done = function(curr_ws) {
        const streaming_is_done_msg = {
            streaming_is_done: 'yes',
        };

        curr_ws.send(JSON.stringify(streaming_is_done_msg), {binary: false, mask: false});
    };

    function stream_file_into_socket() {
        let read_stream;

        const do_stream = function(requested_input_filename, received_json, curr_ws) {
            fs.stat(requested_input_filename, function(error, stat) {
                if(error) {
                    throw error;
                }

                const BUFFER_SIZE_STREAMING = received_json.transmit_chunksize;

                read_stream = fs.createReadStream(requested_input_filename, {
                    flags: 'r',
                    mode: '0666',
                    start: 0,
                });

                const read_from_stream  = function(socket_conn) {
                    let curr_buffer;
                    let stream_chunk = new Uint8Array(BUFFER_SIZE_STREAMING);
                    while((curr_buffer = read_stream.read(BUFFER_SIZE_STREAMING))) {
                        let temp_chunk = new Uint8Array(curr_buffer);
                        stream_chunk.set(temp_chunk);
                        if(temp_chunk.length < stream_chunk.length) {
                            let pad_index = temp_chunk.length;
                            const pad_max = stream_chunk.length;
                            for(; pad_index<pad_max; pad_index += 1) {
                                stream_chunk[pad_index] = 0;
                            }
                        }

                        socket_conn.send(stream_chunk.buffer, {binary: true, mask: false});
                    }
                };

                read_stream.on('readable', function() {
                    read_from_stream(curr_ws);
                });

                read_stream.on('end', function() {
                    streaming_is_done(curr_ws);
                });
            });

            
        };
        const init_stream = function(media_dir, received_json, curr_ws, media_filename) {
            const requested_input_filename = path.join(__dirname, media_dir, media_filename);

            if(!fs.existsSync(requested_input_filename)) {
                console.error('requested file does not exist');
            }

            do_stream(requested_input_filename, received_json, curr_ws);
        }
        return {
            init_stream,
        }
    }

    const file_manager = (function() {
        let curr_stream_session = undefined;
        let media_filename = undefined;
        return {
            read_file_pop_buffer_stream_back_to_client_async: function(received_json, curr_ws) {
                media_filename = received_json.requested_source;
                curr_stream_session = stream_file_into_socket();
                curr_stream_session.init_stream(media_dir, received_json, curr_ws, media_filename);
            }
        };
    })();

    const route_msg = function(received_json, curr_ws) {
        const requested_action = received_json.requested_action;
        switch(requested_action) {
            case 'stream_audio_to_client': {
                const random_delay = (800 * Math.random());
                setTimeout(function() {
                    file_manager.read_file_pop_buffer_stream_back_to_client_async(received_json, curr_ws);
                }, random_delay);
            }
        }
    }
    exports.route_msg = route_msg;
}());