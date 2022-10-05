const server_streaming_audio = require('./server_streaming_audio.js');
const WebSocketServer = require('ws').Server;
const http = require('http');
const express = require('express');
const cfg = require('./config');
const port = process.env.PORT || 8888;

const launch_server = function(working_dir) {
    const app = express();
    const media_dir = cfg.media_dir;
    server_streaming_audio.set_media_dir(media_dir);

    app.use(express.static(working_dir));
    const server = http.createServer(app);

    server.listen(port);

    var wss = new WebSocketServer({
        server,
    });

    wss.on('error', function(error) {
        console.error("ERROR - fault on WebSocketServer");
    });

    wss.on("connection", function(ws) {
        console.log('websocket connected');
        ws.on("message", function(received_data) {
            let received_json;
            try {
                received_json = JSON.parse(received_data);
            } catch(error) {
                const error_msg = "ERROR - received NON JSON message -->" + error + + "<--" + "received_data: " + received_data;
                console.error(error_msg);
                return;
            }

            server_streaming_audio.route_msg(received_json, ws);
        });

        ws.on("error", function(event) {
            const error_msg = "ERROR on error:" + event;
            console.error(error_msg);
        });

        ws.on("close", function() {
            console.log("websocket connect close");
        });
    });
}
exports.launch_server = launch_server;