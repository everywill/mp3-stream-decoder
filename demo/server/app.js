const path = require('path');

const stream_audio_server = function() {
    const working_dir = path.join(__dirname, '/');
    const working_app = path.join(working_dir, 'local_app');
    const app_obj = require(working_app);
    app_obj.launch_server(working_dir);
}();
