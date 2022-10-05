const unlockAudioContext = (audioCtx) => {
    window.audioCtx = audioCtx;
    if (audioCtx.state !== "suspended") return
    const b = document.body;
    const events = ["touchstart", "touchend", "mousedown", "keydown"]
    events.forEach((e) => b.addEventListener(e, unlock, false))
    function unlock() {
        audioCtx.resume().then(clean)
    }
    function clean() {
        // audioCtx.suspend().then(() => {})
        events.forEach((e) => b.removeEventListener(e, unlock))
    }
}

export function FUPCMPlayer(option) {
    this.init(option);
}

FUPCMPlayer.prototype.init = function(option) {
    var defaults = {
        encoding: '16bitInt',
        channels: 1,
        sampleRate: 16000,
    };
    this.option = Object.assign({}, defaults, option);
    this.flush = this.flush.bind(this);
    this.maxValue = this.getMaxValue();
    this.typedArray = this.getTypedArray();
    this.playingBufferNode = null;
    this.scheduledBufferNode = null;
    this.createContext();
    this.resetState();
};

FUPCMPlayer.prototype.getMaxValue = function () {
    var encodings = {
        '8bitInt': 128,
        '16bitInt': 32768,
        '32bitInt': 2147483648,
        '32bitFloat': 1
    }

    return encodings[this.option.encoding] ? encodings[this.option.encoding] : encodings['16bitInt'];
};

FUPCMPlayer.prototype.getTypedArray = function () {
    var typedArrays = {
        '8bitInt': Int8Array,
        '16bitInt': Int16Array,
        '32bitInt': Int32Array,
        '32bitFloat': Float32Array
    }

    return typedArrays[this.option.encoding] ? typedArrays[this.option.encoding] : typedArrays['16bitInt'];
};

FUPCMPlayer.prototype.createContext = function() {
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // context needs to be resumed on iOS and Safari (or it will stay in "suspended" state)
    this.audioCtx.resume();
    this.audioCtx.onstatechange = () => console.log('audioCtx.state', this.audioCtx.state);   // if you want to see "Running" state in console and be happy about it
    unlockAudioContext(this.audioCtx);

    this.gainNode = this.audioCtx.createGain();
    this.gainNode.gain.value = 1;
    this.gainNode.connect(this.audioCtx.destination);
    this.startTime = this.audioCtx.currentTime;
};

FUPCMPlayer.prototype.resetState = function() {
    this.playingStartTime = -1;
    this.lastGotTimestamp = 0;
    this.samples = new Float32Array();
    this.timeout = undefined;
    this.flag_request_stop = false;
    this.startTime = 0;
}

FUPCMPlayer.prototype.isTypedArray = function(data) {
    return (data.byteLength && data.buffer && data.buffer.constructor == ArrayBuffer);
};

FUPCMPlayer.prototype.feed = function(data) {
    if (!this.isTypedArray(data)) return;
    data = this.getFormatedValue(data);
    var tmp = new Float32Array(this.samples.length + data.length);
    tmp.set(this.samples, 0);
    tmp.set(data, this.samples.length);
    this.samples = tmp;
    if(!this.timeout) {
        this.flush();
    } else {
    }
};

FUPCMPlayer.prototype.getFormatedValue = function(data) {
    var data = new this.typedArray(data.buffer),
        float32 = new Float32Array(data.length),
        i;

    for (i = 0; i < data.length; i++) {
        float32[i] = data[i] / this.maxValue;
    }
    return float32;
};

FUPCMPlayer.prototype.volume = function(volume) {
    this.gainNode.gain.value = volume;
};

FUPCMPlayer.prototype.destroy = function() {
    if (this.interval) {
        clearInterval(this.interval);
    }
    this.samples = null;
    this.audioCtx.close();
    this.audioCtx = null;
};

FUPCMPlayer.prototype.getTimestamp = function(elapsedMs) {
    if(this.playingStartTime >= 0) {
        if(!elapsedMs) {
            return this.audioCtx.currentTime - this.playingStartTime;
        }
        const ret = this.lastGotTimestamp;
        this.lastGotTimestamp += elapsedMs / 1000;
        return ret;
    }
    return 0;
}

FUPCMPlayer.prototype.setRequestStop = function() {
    this.flag_request_stop = true;
}

FUPCMPlayer.prototype.setOnEnd = function(cb) {
    this.onEnd = cb;
}

FUPCMPlayer.prototype.interrupt = function(cb) {
    this.scheduledBufferNode && this.scheduledBufferNode.stop(0);
    this.playingBufferNode && this.playingBufferNode.stop(0);
    this.ensuredClearTimeout();
    this.resetState();
    this.flag_request_stop = false;
}

// (即时超过超时时间也)确保会触发
FUPCMPlayer.prototype.ensuredSetTimeout = (function() {
    let startTimestamp;
    return function(fn, timeout) {
        startTimestamp = performance.now();
        const checker = (timestamp) => {
            if(timestamp - startTimestamp >= timeout) {
                this.timeout = undefined;
                fn();
            } else {
                this.timeout = requestAnimationFrame(checker);
            }
        }
        this.timeout = requestAnimationFrame(checker);
    }
})();

FUPCMPlayer.prototype.ensuredClearTimeout = function() {
    if(this.timeout) {
        cancelAnimationFrame(this.timeout);
        this.timeout = undefined;
    }
}

FUPCMPlayer.prototype.flush = function() {
    if (!this.samples.length) return;
    var bufferSource = this.audioCtx.createBufferSource(),
        length = this.samples.length / this.option.channels,
        audioBuffer = this.audioCtx.createBuffer(this.option.channels, length, this.option.sampleRate),
        audioData,
        channel,
        offset,
        i,
        decrement;

    for (channel = 0; channel < this.option.channels; channel++) {
        audioData = audioBuffer.getChannelData(channel);
        offset = channel;
        decrement = 50;
        for (i = 0; i < length; i++) {
            audioData[i] = this.samples[offset];
            /* fadein */
            if (i < 50) {
                audioData[i] =  (audioData[i] * i) / 50;
            }
            /* fadeout*/
            if (i >= (length - 51)) {
                audioData[i] =  (audioData[i] * decrement--) / 50;
            }
            offset += this.option.channels;
        }
    }
    if (this.startTime < this.audioCtx.currentTime) {
        this.startTime = this.audioCtx.currentTime;
    }
    this.samples = new Float32Array();
    
    bufferSource.buffer = audioBuffer;
    bufferSource.connect(this.gainNode);

    bufferSource.start(this.startTime);
    this.playingBufferNode = this.scheduledBufferNode;
    this.scheduledBufferNode = bufferSource;
    if(this.playingStartTime < 0) {
        this.playingStartTime = this.startTime;
    }
    this.startTime += audioBuffer.duration;
    
    if(!this.flag_request_stop) {
        const nextTimeGap = (this.startTime - this.audioCtx.currentTime)*1000;
        this.ensuredSetTimeout(this.flush, nextTimeGap - 50);
    } else {
        this.flag_request_stop = false;
        bufferSource.onended = () => {
            this.resetState();
            this.onEnd && this.onEnd();
        }
    }
};
