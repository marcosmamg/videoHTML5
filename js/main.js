'use strict';

if (!navigator.getUserMedia) {
    fallback();
}
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

// Global variables for GoogleAuth object, auth status.
var uploadedFile;

/* globals MediaRecorder */
var mediaSource;
var mediaRecorder;
var recordedBlobs;
var sourceBuffer;
var recording = false;
var timeRecorded = 0;
var intervalTimer;
var recordedSize = 0;

var gumVideo = document.querySelector('.videoRecorder video');
var recordedVideo = document.querySelector('.videoPreview video');
var maxTime = 0;

function handleSuccess(stream) {
  var mediaHelper = new MediaHelper();
  window.stream = stream;
  if (mediaHelper.getURL()) {
    gumVideo.src = mediaHelper.getURL().createObjectURL(stream);
  } else {
    gumVideo.src = stream;
  }
  
  mediaSource = new MediaSource();
  mediaSource.addEventListener('sourceopen', handleSourceOpen, false);
  
  videoPlayer.showRecorder();
  
}

function handleError(error) {
  fallback();
}

function fallback(e) {
  $("#videoSettings").addClass("hidden");
  $(".videoRecorder").addClass("hidden");
}

function handleSourceOpen(event) {
  sourceBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="vp9"');
}

///////////////
var stream;

// Call handleAuthClick function when user clicks on "Authorize" button.
  $("#select-file-button").on("click", function (e) {
    $("#select-file").click();
  });

  $(".uploadFile").on("click", function (e) {
    //defineRequest();
  });
  
  $("#select-file").on("change", function (e) {
    var mediaHelper = new MediaHelper();
    uploadedFile = $("#select-file").prop("files")[0];
    
    if(mediaHelper.getAcceptedUploadFileTypes().indexOf(uploadedFile.type)==-1)
    {
      alert("File format not supported : '" + uploadedFile.type + "'");
    } 
    else 
    {
      if(mediaHelper.getURL())
      {
        $("#previewUploadedVideo").css("display","block").attr("src", mediaHelper.getURL().createObjectURL(uploadedFile));
      }
    }
  });

  $(".displayResolution").on("click", function(e) { 
    var mediaHelper = new MediaHelper();
    e.preventDefault(); 
    e.stopPropagation(); 
    
    getMedia(mediaHelper.getVideoSettings()[$(e.target).data("name")]);

  } );

  function getMedia(constraints) {
    if (stream) {
      stream.getTracks().forEach(function(track) {
        track.stop();
      });
    }
  
    navigator.mediaDevices.getUserMedia(constraints).
              then(handleSuccess).
              catch(fallback);
  };

function handleDataAvailable(event) {
  if (event.data && event.data.size > 0) {
    recordedBlobs.push(event.data);
    recordedSize += event.data.size;
  }
}

function handleStop(event) {
  console.log('Recorder stopped: ', event);
}

function VideoPlayer(videoRecorder, videoPreview, settings) {
  this.recordedSize = 0;
  this.timeRecorded = 0;
  this.intervalTimer = 0;
  
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
  this.closeButton.on("click", this.showRecorder.bind(this));
  this.preview.on("error", function(ev) { alert('Your browser can not play\n\n' + ev.target.src + '\n\n media clip. event: ' + JSON.stringify(ev)); });
  
  this.mediaHelper = new MediaHelper();
}

VideoPlayer.prototype.toggleRecording = function(e) {
    if (!recording) {
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

VideoPlayer.prototype.updateTimer = function() {
  var now = new Date();
  var diff = now - this.timeRecorded;
  var secs = parseInt(diff/1000, 10);
  var mins = parseInt(secs/60, 10);
  secs = parseInt((diff - mins * 60000)/1000, 10)
    
  this.timer.html(this.mediaHelper.formatTime(mins) + ":" + this.mediaHelper.formatTime(secs));
  if(mins >= maxTime)
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
//  document.getElementById("recorderButton").style.backgroundColor = "red";
}

VideoPlayer.prototype.stopTimer = function() {
  this.timeRecorded = 0;
  clearInterval(this.intervalTimer);
  
  this.timer.addClass("hidden");
  this.toggleButton.css("background-color", "");
  this.settings.removeClass("hidden");
}

VideoPlayer.prototype.initializeMediaRecorder = function()
{
  var options = this.mediaHelper.getMimeCodec();
  
  try {
    mediaRecorder = new MediaRecorder(window.stream, options);
  } catch (e) {
    alert('Exception while creating MediaRecorder: ' + e + '. mimeType: ' + options.mimeType);
    return;
  }
  
  mediaRecorder.onstop = handleStop;
  mediaRecorder.ondataavailable = handleDataAvailable;
  mediaRecorder.start(10); // collect 10ms of data
}

VideoPlayer.prototype.startRecording = function() {
  recordedBlobs = [];
  recording = true;
  this.recordedSize = 0;
  this.initializeMediaRecorder();
  this.startTimer();
}

VideoPlayer.prototype.stopRecording = function() {
  mediaRecorder.stop();
  recording = false;
  
  this.stopTimer();
  this.playPreview();
  this.showPreview();
}

VideoPlayer.prototype.isReadyToRecord = function()
{
  maxTime = document.getElementById("maxTimeToRecord").value;
  if (maxTime == "")
  {
    alert("Select max time to record");
    return false;
  }
  return true;
}

VideoPlayer.prototype.playPreview = function() {
  var superBuffer = new Blob(recordedBlobs, {type: 'video/mp4'});
  this.preview.get(0).src = this.mediaHelper.getURL().createObjectURL(superBuffer);
  this.preview.get(0).controls = true;
}

VideoPlayer.prototype.showRecorder = function(){
  this.recorder.get(0).play();
  this.preview.get(0).pause();
  
  this.settings.removeClass("hidden");
  this.videoRecorder.removeClass("hidden");

  this.videoPreview.addClass("hidden");
}

VideoPlayer.prototype.showPreview = function() {
  this.recorder.get(0).pause();
  this.preview.get(0).play();
  
  this.videoPreview.removeClass("hidden");
  
  this.settings.addClass("hidden");
  this.videoRecorder.addClass("hidden");
}

var videoPlayer = new VideoPlayer($(".videoRecorder"), 
                                  $(".videoPreview"), 
                                  $("#videoSettings"));


'use strict';
var app = angular.module('fileUpload', ['ngFileUpload']);
app.controller('MyCtrl', ['$scope', '$http', '$timeout', '$compile', 'Upload', function ($scope, $http, $timeout, $compile, Upload) {
  
  function generateFile () {
    var blob = new Blob(recordedBlobs, {type: 'video/mp4'});
    var file = new File([blob], 'filename.mp4', {
        type: 'video/mp4'
    });
    console.log(file);
    return file;
  };
  
  $scope.uploadS3 = function() {
    var file = generateFile();
    file.upload = Upload.upload({
      url: 'https://videowisp.s3.amazonaws.com/',
      method: 'POST',
      data: {
        key: file.name,
        acl: 'public-read',
        policy: 'eyAiZXhwaXJhdGlvbiI6ICIyMDIwLTEyLTMwVDEyOjAwOjAwLjAwMFoiLAogICJjb25kaXRpb25zIjogWwogICAgeyJidWNrZXQiOiAidmlkZW93aXNwIn0sCiAgICBbInN0YXJ0cy13aXRoIiwgIiRrZXkiLCAiIl0sCiAgICB7ImFjbCI6ICJwdWJsaWMtcmVhZCJ9LCAgICAKICAgIFsic3RhcnRzLXdpdGgiLCAiJENvbnRlbnQtVHlwZSIsICIiXSwKICAgIHsieC1hbXotbWV0YS11dWlkIjogIjE0MzY1MTIzNjUxMjc0In0sCiAgICB7IngtYW16LXNlcnZlci1zaWRlLWVuY3J5cHRpb24iOiAiQUVTMjU2In0sCiAgICBbInN0YXJ0cy13aXRoIiwgIiR4LWFtei1tZXRhLXRhZyIsICIiXSwKICAgIHsieC1hbXotY3JlZGVudGlhbCI6ICJBS0lBSjJNRTVRUFBJSDRSNktTQS8yMDE3MDgzMS91cy1lYXN0LTIvczMvYXdzNF9yZXF1ZXN0In0sCiAgICB7IngtYW16LWFsZ29yaXRobSI6ICJBV1M0LUhNQUMtU0hBMjU2In0sCiAgICB7IngtYW16LWRhdGUiOiAiMjAxNzA4MzFUMDAwMDAwWiIgfQogIF0KfQ==',
        'X-Amz-Signature': 'o7rU9oK3Js+3/YEmDPaJQzeJ36g=',
        'X-Amz-Credential' : 'AKIAJ2ME5QPPIH4R6KSA/20170831/us-east-2/s3/aws4_request',
        'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
        'X-Amz-Date': '20170831T000000Z',
        "Content-Type": '',
        file: file,
        filename: 'test.mp4',
        file: file
      }
    });

    file.upload.then(function (response) {
      $timeout(function () {
        file.result = response.data;
        console.log(file.result);
      });
    }, function (response) {
      if (response.status > 0)
        $scope.errorMsg = response.status + ': ' + response.data;
        console.log($scope.errorMsg);
    });

    file.upload.progress(function (evt) {
      file.progress = Math.min(100, parseInt(100.0 * evt.loaded / evt.total));
    });
  };
}]);