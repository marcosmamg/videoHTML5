'use strict';

// window.isSecureContext could be used for Chrome
var isSecureOrigin = location.protocol === 'https:' ||
location.hostname === 'localhost';
if (!isSecureOrigin) {
  alert('getUserMedia() must be run from a secure origin: HTTPS or localhost.' +
    '\n\nChanging protocol to HTTPS');
  location.protocol = 'HTTPS';
}

/* globals MediaRecorder */
var mediaSource;
var mediaRecorder;
var recordedBlobs;
var sourceBuffer;
var recording = false;
var timeRecorded = 0;
var intervalTimer;
var recordedSize = 0;

var constraints = {
  audio: true,
  video: {width: {exact: 720}, height: {exact: 480}}
};

var videoElement = document.querySelector('#videoSetup');
var audioInputSelect = document.querySelector('select#audioSource');
var audioOutputSelect = document.querySelector('select#audioOutput');
var videoSelect = document.querySelector('select#videoSource');
var selectors = [audioInputSelect, audioOutputSelect, videoSelect];

var gumVideo = document.querySelector('video#gum');
var recordedVideo = document.querySelector('video#recorded');

function handleSuccess(stream) {  
  window.stream = stream;
  if (window.URL) {
    gumVideo.src = window.URL.createObjectURL(stream);
  } else {
    gumVideo.src = stream;
  }
  
  mediaSource = new MediaSource();
  mediaSource.addEventListener('sourceopen', handleSourceOpen, false);
  
}

function handleError(error) {
  fallback(error);
}

function fallback(e) {
  document.getElementById("videoContainer").style.display="none";
  document.getElementById("defaultVideo").style.display="block";
}

function handleSourceOpen(event) {
  document.writeln('SSSSSS');
  console.log('MediaSource opened');
  sourceBuffer = mediaSource.addSourceBuffer('video/webm; codecs="vp8"');
  document.getElementById("closesVideoRecorder").style.display = "none";
  console.log('Source buffer: ', sourceBuffer);
}

if (!navigator.getUserMedia) {
  fallback();
} else {
  navigator.mediaDevices.getUserMedia(constraints).
    then(handleSuccess).catch(fallback);
}

recordedVideo.addEventListener('error', function(ev) {
  console.error('MediaRecording.recordedMedia.error()');
  alert('Your browser can not play\n\n' + recordedVideo.src
    + '\n\n media clip. event: ' + JSON.stringify(ev));
}, true);

function handleDataAvailable(event) {
  if (event.data && event.data.size > 0) {
    recordedBlobs.push(event.data);
    recordedSize += event.data.size;
  }
}

function handleStop(event) {
  console.log('Recorder stopped: ', event);
}

function toggleRecording() {
  if (!recording) {    
    recording = true;   
    //recordedVideo.pause();
    startRecording();
    document.getElementById("recorderButton").style.backgroundColor = "red";
  } else {
    recording = false;   
    stopRecording();     
    document.getElementById("recorderButton").style.backgroundColor = "";
  }
}

function startRecording() {
  recordedBlobs = [];
  recordedSize = 0;
  var options = {mimeType: 'video/webm;codecs=vp9'};
  if (!MediaRecorder.isTypeSupported(options.mimeType)) {
    console.log(options.mimeType + ' is not Supported');
    options = {mimeType: 'video/webm;codecs=vp8'};
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      console.log(options.mimeType + ' is not Supported');
      options = {mimeType: 'video/webm'};
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.log(options.mimeType + ' is not Supported');
        options = {mimeType: ''};
      }
    }
  }
  try {
    mediaRecorder = new MediaRecorder(window.stream, options);
  } catch (e) {
    console.error('Exception while creating MediaRecorder: ' + e);
    alert('Exception while creating MediaRecorder: '
      + e + '. mimeType: ' + options.mimeType);
    return;
  }
  console.log('Created MediaRecorder', mediaRecorder, 'with options', options);
  mediaRecorder.onstop = handleStop;
  mediaRecorder.ondataavailable = handleDataAvailable;
  mediaRecorder.start(10); // collect 10ms of data
  console.log('MediaRecorder started', mediaRecorder);
  
  var now = new Date();
  timeRecorded = now.getTime();
  
  intervalTimer = setInterval(function(){ 
    var now = new Date();
    var diff = now - timeRecorded;
    var secs = parseInt(diff/1000, 10);
    var mins = parseInt(secs/60, 10);
    secs = parseInt((diff - mins * 60*1000)/1000, 10)
  
    document.getElementById("timer").innerHTML = mins + ":" + secs;
    if(recordedSize >= 29360128) /* Aprox 14 MB*/
    {
      stopRecording(); 
    }
  }, 1000);
  document.getElementById("timer").style.display = "block";
}

function stopRecording() {
  mediaRecorder.stop();
  hideVideoRecorder();
  play();
  console.log('Recorded Blobs: ', recordedBlobs);
  recordedVideo.controls = true;
  timeRecorded = 0;
  clearInterval(intervalTimer);
  document.getElementById("timer").style.display = "none";
}

function play() {
  var superBuffer = new Blob(recordedBlobs, {type: 'video/webm'});
  recordedVideo.src = window.URL.createObjectURL(superBuffer);
}

function download() {
  var blob = new Blob(recordedBlobs, {type: 'video/webm'});
  var url = window.URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = 'test.webm';
  document.body.appendChild(a);
  a.click();
  setTimeout(function() {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
}

function hideVideoRecorder(){
  document.getElementById("recorderButton").style.display = "none";
  document.getElementById("closesVideoRecorder").style.display = "block";
  gumVideo.style.display = "none";
  recordedVideo.style.display = "block";
}

function showVideoRecorder(){
  recordedVideo.style.display = "none";
  document.getElementById("closesVideoRecorder").style.display = "none";
  document.getElementById("recorderButton").style.display = "block";
  gumVideo.style.display = "block";
  recordedVideo.pause();
}
