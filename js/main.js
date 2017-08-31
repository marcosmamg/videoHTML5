'use strict';

// window.isSecureContext could be used for Chrome
var isSecureOrigin = location.protocol === 'https:' ||
location.hostname === 'localhost';
if (!isSecureOrigin) {
  alert('getUserMedia() must be run from a secure origin: HTTPS or localhost.' +
    '\n\nChanging protocol to HTTPS');
  location.protocol = 'HTTPS';
}

function MediaHelper() { }

MediaHelper.prototype.getURL = function() { return window.URL || window.webkitURL; }

MediaHelper.prototype.getAcceptedUploadFileTypes = function() { 
  return ['video/mp4', 
          'video/3gpp', 
          'video/quicktime', 
          'video/webm', 
          'video/ogg', 
          'video/avi', 
          'video/mpeg', 
          'video/x-mpeg'];
}

MediaHelper.prototype.getAcceptedMimeCodecs = function() { 
  return ['video/mp4;codecs=vp9',
          'video/mp4;codecs=vp8',
          'video/mp4'];
}

MediaHelper.prototype.getVideoSettings = function() {
  return {
      'vga' : { audio: true, video: {width: {exact: 320}, height: {exact: 240} } },
      'qvga' : { audio: true, video: {width: {exact: 640}, height: {exact: 480} } },
      'hd' : { audio: true, video: {width: {exact: 1280}, height: {exact: 720} } },
      'full-hd' : { audio: true, video: {width: {exact: 1920}, height: {exact: 1080} } }
  };
}

MediaHelper.prototype.formatTime = function(time) {
  if(time < 10) return "0" + time;
  return ""+time;
}

MediaHelper.prototype.getMimeCodec = function()
{
  var mimeCodec =  {mimeType: ''};
  for(var i=0; i < this.getAcceptedMimeCodecs().length && mimeCodec.mimeType.length == 0; i++)
  {
    if (MediaRecorder.isTypeSupported(this.getAcceptedMimeCodecs()[i])) 
    {
      mimeCodec.mimeType = this.getAcceptedMimeCodecs()[i];
    }
  }
  
  return mimeCodec;
}

MediaHelper.prototype.isWebRTCSupported = function() {
  return !!(navigator.getUserMedia || 
            navigator.webkitGetUserMedia ||
            navigator.mozGetUserMedia || 
            navigator.msGetUserMedia);
}

function VideoPlayer(videoRecorder, videoPreview, fileUploader, settings) {
  this.isRecorderEnabled = false;
  this.mediaSource = null;
  this.mediaRecorderInst = null;
  this.recordedBlobs = [];
  this.sourceBuffer = null;
  this.maxDuration = 0;
  
  this.videoRecorderCollectingDataInterval = 10;
  this.stream = null;

  this.recording = false;
  this.timeRecorded = 0;
  this.intervalTimer = 0;
  
  this.fileUploader = fileUploader;
  this.videoRecorder = videoRecorder;
  this.videoPreview = videoPreview;
  this.settings = settings;
  
  this.toggleButton = videoRecorder.find(".recorderButton");
  this.timer = videoRecorder.find(".timer");
  this.recorder = videoRecorder.find("video");
  
  this.closeButton = videoPreview.find(".close");
  this.preview = videoPreview.find("video");
  this.sendVideoButton = videoPreview.find("button");
  
  this.toggleButton.on("click", this.toggleRecording.bind(this));
  this.closeButton.on("click", (e) => { this._setupRecorder(this.recorderSettings); this.hidePreview(); this.showRecorder(); });
  this.preview.on("error", function(ev) { alert('Your browser can not play\n\n' + ev.target.src + '\n\n media clip. event: ' + JSON.stringify(ev)); });
  
  this.mediaHelper = new MediaHelper();
  this.recorderSettings = null;

  this.settings.find(".displayResolution").on("click", (e) => { 
    e.preventDefault(); 
    e.stopPropagation(); 
    
    this.recorderSettings = this.mediaHelper.getVideoSettings()[$(e.target).data("name")];
    
    this._setupRecorder(this.recorderSettings);
  } );
  
  this.fileUploader.find(".uploadButton").on("click", function(e) {
    $(this).siblings("input[type='file']").trigger("click");
  });

  this.fileUploader.find("input[type='file']").on("change", (e) => {
    var uploadedFile = $(e.target).prop("files")[0];
    
    if(this.mediaHelper.getAcceptedUploadFileTypes().indexOf(uploadedFile.type)==-1)
    {
      alert("File format not supported : '" + uploadedFile.type + "'");
    } 
    else 
    {
      if(this.mediaHelper.getURL())
      {
        this.hideRecorder();
        this.isRecorderEnabled = false;
        
        this.preview.attr("src", this.mediaHelper.getURL().createObjectURL(uploadedFile));
        this.showPreview();
      }
    }
  });
  
  this._initialize();
  
  return this;
}

// Compatibility Check
VideoPlayer.prototype._initialize = function() {
  if (!this.mediaHelper.isWebRTCSupported()) {
      this._fallback();
  }
}

// Media Handlers
VideoPlayer.prototype._setupRecorder = function(constraints) {
    if (this.stream) {
        this.stream.getTracks().forEach(function(track) {
          track.stop();
        });
    }
  
    navigator.mediaDevices.getUserMedia(constraints).
              then(this._handleSuccess.bind(this)).
              catch(this._fallback.bind(this));
};

VideoPlayer.prototype._tearRecorder = function() {
    if (this.stream) {
        this.stream.getTracks().forEach(function(track) {
          track.stop();
        });
    }
    
    this.stream = null;
    this.isRecorderEnabled = false;
}

VideoPlayer.prototype._handleSuccess = function(stream) {
  this.isRecorderEnabled = true;
  this.stream = stream;
  if (this.mediaHelper.getURL()) {
    this.recorder.get(0).src = this.mediaHelper.getURL().createObjectURL(stream);
  } else {
    this.recorder.get(0).src = stream;
  }
  
  this.mediaSource = new MediaSource();
  this.mediaSource.addEventListener('sourceopen', 
                               (e) => this.sourceBuffer = this.mediaSource.addSourceBuffer('video/mp4; codecs="vp9"'), 
                               false);
  
  this.showRecorder();
}

VideoPlayer.prototype._fallback = function(e) {
  this.settings.addClass("hidden");
  this.videoRecorder.addClass("hidden");
}

VideoPlayer.prototype.toggleRecording = function(e) {
    if (!this.recording) {
      if(this.isReadyToRecord())
      {
        this.startRecording();            
      }
    } 
    else 
    {
      this.stopRecording();   
    }
  }

VideoPlayer.prototype.initializeMediaRecorder = function()
{
  var options = this.mediaHelper.getMimeCodec();
  
  try {
    this.mediaRecorderInst = new MediaRecorder(this.stream, options);
  } catch (e) {
    alert('Exception while creating MediaRecorder: ' + e + '. mimeType: ' + options.mimeType);
    return;
  }
  
  this.mediaRecorderInst.onstop = (e) => { console.log('Recorder stopped: ', e); }
  this.mediaRecorderInst.ondataavailable = (e) => { 
                                    if (e.data && e.data.size > 0) {
                                      this.recordedBlobs.push(e.data);
                                    }
                                  }
  
  this.mediaRecorderInst.start(this.videoRecorderCollectingDataInterval); // collect 10ms of data
}

VideoPlayer.prototype.startRecording = function() {
  if(this.isRecorderEnabled)
  {
    this.recordedBlobs = [];
    this.recording = true;
    
    this.initializeMediaRecorder();
    this.startTimer();
    this.hidePreview();
    this.showRecorder();    
  }
}

VideoPlayer.prototype.stopRecording = function() {
  if(this.isRecorderEnabled)
  {
    this.mediaRecorderInst.stop();
    this.recording = false;
    
    this.hideRecorder();
    this.stopTimer();
    this.playPreview();
    this.showPreview();    
  }
}


/// Timer Handlers
VideoPlayer.prototype.updateMaxTimeToRecord = function() 
{
  this.maxDuration = 0;
  var maxDuration = this.settings.find("input.maxDuration");
  if(maxDuration.length > 0) {
    this.maxDuration = parseInt(maxDuration.val(), 10);
  } 
}

VideoPlayer.prototype.updateTimer = function() {
  var now = new Date();
  var diff = now - this.timeRecorded;
  var mins = parseInt(diff/60000, 10);
  var secs = parseInt((diff - mins * 60000)/1000, 10)
    
  this.timer.html(this.mediaHelper.formatTime(mins) + ":" + this.mediaHelper.formatTime(secs));
  if(mins >= this.maxDuration)
  {
    this.stopRecording(); 
  }
}

VideoPlayer.prototype.startTimer = function()
{
  this.timer.html("00:00");
  
  var now = new Date();
  this.timeRecorded = now.getTime();
  this.intervalTimer = setInterval(this.updateTimer.bind(this), 1000);
  this.toggleButton.css("background-color", "red");
  this.timer.removeClass("hidden");
}

VideoPlayer.prototype.stopTimer = function() {
  this.timeRecorded = 0;
  clearInterval(this.intervalTimer);
  
  this.timer.addClass("hidden");
  this.toggleButton.css("background-color", "");
  this.settings.removeClass("hidden");
}

/// Recorder Handlers

VideoPlayer.prototype.isReadyToRecord = function()
{
  this.updateMaxTimeToRecord();
  if (this.maxDuration == 0)
  {
    alert("Select max time to record");
    return false;
  }
  return true;
}

VideoPlayer.prototype.showRecorder = function(){
  
  if(this.isRecorderEnabled)
  {
    this.recorder.get(0).play();
    
    this.settings.removeClass("hidden");
    this.videoRecorder.removeClass("hidden");
  }
}

VideoPlayer.prototype.hideRecorder = function() {
  if(this.isRecorderEnabled)
  {
    this.recorder.get(0).pause();
    this._tearRecorder();

    this.settings.addClass("hidden");
    this.videoRecorder.addClass("hidden");
  }
}

/// Preview Handlers

VideoPlayer.prototype.playPreview = function() {
  var superBuffer = new Blob(this.recordedBlobs, {type: 'video/mp4'});
  this.preview.get(0).src = this.mediaHelper.getURL().createObjectURL(superBuffer);
  this.preview.get(0).controls = true;
}


VideoPlayer.prototype.showPreview = function() {
  this.preview.get(0).play();
  this.videoPreview.removeClass("hidden");
}

VideoPlayer.prototype.hidePreview = function(){
  this.preview.get(0).pause();
  this.videoPreview.addClass("hidden");
}



var videoPlayer = new VideoPlayer($(".videoRecorder"), 
                                  $(".videoPreview"), 
                                  $(".fileUpload"),
                                  $(".videoSettings"));
