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

// Support
var URL = window.URL || window.webkitURL

// Global variables for GoogleAuth object, auth status.
var GoogleAuth;
var uploadedFile;
var acceptedUploadFileTypes = ['video/mp4', 
                               'video/3gpp', 
                               'video/quicktime', 
                               'video/webm', 
                               'video/ogg', 
                               'video/avi', 
                               'video/mpeg', 
                               'video/x-mpeg']
                               
var acceptedMimeCodecs = ['video/mp4;codecs=vp9',
                          'video/mp4;codecs=vp8',
                          'video/mp4']
                               
var videoSettings = {
  'vga' : { audio: true, video: {width: {exact: 320}, height: {exact: 240} } },
  'qvga' : { audio: true, video: {width: {exact: 640}, height: {exact: 480} } },
  'hd' : { audio: true, video: {width: {exact: 1280}, height: {exact: 720} } },
  'full-hd' : { audio: true, video: {width: {exact: 1920}, height: {exact: 1080} } }
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

var gumVideo = document.querySelector('video#gum');
var recordedVideo = document.querySelector('video#recorded');
var maxTime = 0;

function handleSuccess(stream) {  
  window.stream = stream;
  if (URL) {
    gumVideo.src = URL.createObjectURL(stream);
  } else {
    gumVideo.src = stream;
  }
  
  mediaSource = new MediaSource();
  mediaSource.addEventListener('sourceopen', handleSourceOpen, false);
  
}

function handleError(error) {
  fallback();
}

function fallback(e) {
  document.getElementById("videoSettings").style.display="none";
  document.getElementById("videoContainer").style.display="none";
  document.getElementById("defaultVideo").style.display="block";
}

function handleSourceOpen(event) {
  sourceBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="vp9"');
  document.getElementById("closesVideoRecorder").style.display = "none";
}

///////////////
var stream;

// Call handleAuthClick function when user clicks on "Authorize" button.
  $('button.requestAuthorization').on("click", function(e) {
    handleAuthClick(event);
  }); 
  
  $("#select-file-button").on("click", function (e) {
    $("#select-file").click();
  });

  $(".uploadFile").on("click", function (e) {
    defineRequest();
  });
  
  $("#select-file").on("change", function (e) {
    uploadedFile = $("#select-file").prop("files")[0];
    
    if(acceptedUploadFileTypes.indexOf(uploadedFile.type)==-1)
    {
      alert("File format not supported : '" + uploadedFile.type + "'");
    } 
    else 
    {
      if(URL)
      {
        $("#previewUploadedVideo").css("display","block").attr("src", URL.createObjectURL(uploadedFile));
      }
    }
  });

  $(".displayResolution").on("click", function(e) { 
    e.preventDefault(); 
    e.stopPropagation(); 
    
    getMedia(videoSettings[$(e.target).data("name")]);

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
  
    $("div.videoControls").removeClass("hidden");
  };

//////////////
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

function formatTime(time) {
  if(time < 10)
  {
    return "0" + time;
  }
  return ""+time;
}

function updateTimer() {
  var now = new Date();
  var diff = now - timeRecorded;
  var secs = parseInt(diff/1000, 10);
  var mins = parseInt(secs/60, 10);
  secs = parseInt((diff - mins * 60000)/1000, 10)
    
  $("#timer").html(formatTime(mins) + ":" + formatTime(secs));
  if(mins >= maxTime)
  {
    stopRecording(); 
  }
}

function isReadyToRecord()
{
  maxTime = document.getElementById("maxTimeToRecord").value;
  if (maxTime == "")
  {
    alert("Select max time to record");
    return false;
  }
  return true;
}

function getMimeCodec()
{
  var mimeCodec =  {mimeType: ''};
  for(var i=0; i < acceptedMimeCodecs.length && mimeCodec.mimeType.length == 0; i++)
  {
    if (MediaRecorder.isTypeSupported(acceptedMimeCodecs[i])) 
    {
      mimeCodec.mimeType = acceptedMimeCodecs[i];
    }
  }
  
  return mimeCodec;
}

function toggleRecording() {
  if (!recording) {
    if(isReadyToRecord())
    {
      //recordedVideo.pause();
      startRecording();            
    }
  } 
  else 
  {
    stopRecording();     
  }
}

function startRecording() {
  recordedBlobs = [];
  recordedSize = 0;
  
  var options = getMimeCodec();
  
  try {
    mediaRecorder = new MediaRecorder(window.stream, options);
  } catch (e) {
    console.error('Exception while creating MediaRecorder: ' + e);
    alert('Exception while creating MediaRecorder: '
      + e + '. mimeType: ' + options.mimeType);
    return;
  }
  
  mediaRecorder.onstop = handleStop;
  mediaRecorder.ondataavailable = handleDataAvailable;
  mediaRecorder.start(10); // collect 10ms of data

  document.getElementById("recorderButton").style.backgroundColor = "red";
  document.getElementById("videoSettings").style.display = "none";
  var now = new Date();
  
  timeRecorded = now.getTime();
  recording = true;   
  intervalTimer = setInterval(updateTimer, 1000);
  document.getElementById("timer").style.display = "block";
}

function stopRecording() {
  mediaRecorder.stop();
  hideVideoRecorder();
  play();
  
  recordedVideo.controls = true;
  timeRecorded = 0;
  clearInterval(intervalTimer);
  document.getElementById("timer").style.display = "none";
  document.getElementById("recorderButton").style.backgroundColor = "";
  document.getElementById("videoSettings").style.display = "block";
  recording = false;   
}

function play() {
  var superBuffer = new Blob(recordedBlobs, {type: 'video/mp4'});
  recordedVideo.src = window.URL.createObjectURL(superBuffer);
}

function generateFile() {
  var blob = new Blob(recordedBlobs, {type: 'video/mp4'});
  var file = new File([blob], 'filename.mp4', { type: 'video/mp4' });
  selectedFile = file;
}

function hideVideoRecorder(){
  $("div.videoControls").addClass("hidden");
  $("#closesVideoRecorder").removeClass("hidden");
  gumVideo.style.display = "none";
  recordedVideo.style.display = "block";
}

function showVideoRecorder(){
  $("#closesVideoRecorder").addClass("hidden");
  $("div.videoControls").removeClass("hidden");
  recordedVideo.style.display = "none";
  gumVideo.style.display = "block";
  recordedVideo.pause();
}

 /***** START BOILERPLATE CODE: Load client library, authorize user. *****/

  /**
   * Load the API's client and auth2 modules.
   * Call the initClient function after the modules load.
   */
  function handleClientLoad() {
    gapi.load('client:auth2', initClient);
  }

  function initClient() {
    // Initialize the gapi.client object, which app uses to make API requests.
    // Get API key and client ID from API Console.
    // 'scope' field specifies space-delimited list of access scopes

    gapi.client.init({
        'clientId': '850224418417-8ld9go3o2hnelifesan9rk3iba3h2afo.apps.googleusercontent.com',
        'discoveryDocs': ['https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest'],
        'scope': 'https://www.googleapis.com/auth/youtube.force-ssl https://www.googleapis.com/auth/youtubepartner'
    }).then(function () {
      GoogleAuth = gapi.auth2.getAuthInstance();

      // Listen for sign-in state changes.
      GoogleAuth.isSignedIn.listen(updateSigninStatus);

      // Handle initial sign-in state. (Determine if user is already signed in.)
      setSigninStatus();
    });
  }

  function handleAuthClick(event) {
    // Sign user in after click on auth button.
    GoogleAuth.signIn();
  }

  function setSigninStatus() {
    var user = GoogleAuth.currentUser.get();
    var isAuthorized = user.hasGrantedScopes('https://www.googleapis.com/auth/youtube.force-ssl https://www.googleapis.com/auth/youtubepartner');
    // Toggle button text and displayed statement based on current auth status.
    if (isAuthorized) {
      $(".requestAuthorization").css("display", "none");
      //defineRequest();
    }
  }

  function updateSigninStatus(isSignedIn) {
    setSigninStatus();
  }

  function createResource(properties) {
    var resource = {};
    var normalizedProps = properties;
    for (var p in properties) {
      var value = properties[p];
      if (p && p.substr(-2, 2) == '[]') {
        var adjustedName = p.replace('[]', '');
        if (value) {
          normalizedProps[adjustedName] = value.split(',');
        }
        delete normalizedProps[p];
      }
    }
    for (var p in normalizedProps) {
      // Leave properties that don't have values out of inserted resource.
      if (normalizedProps.hasOwnProperty(p) && normalizedProps[p]) {
        var propArray = p.split('.');
        var ref = resource;
        for (var pa = 0; pa < propArray.length; pa++) {
          var key = propArray[pa];
          if (pa == propArray.length - 1) {
            ref[key] = normalizedProps[p];
          } else {
            ref = ref[key] = ref[key] || {};
          }
        }
      };
    }
    return resource;
  }

  function removeEmptyParams(params) {
    for (var p in params) {
      if (!params[p] || params[p] == 'undefined') {
        delete params[p];
      }
    }
    return params;
  }

  function executeRequest(request) {
    request.execute(function(response) {
      console.log(response);
    });
  }

  function buildApiRequest(requestMethod, path, params, properties) {
    params = removeEmptyParams(params);
    var request;
    if (properties) {
      var resource = createResource(properties);
      request = gapi.client.request({
          'body': resource,
          'method': requestMethod,
          'path': path,
          'params': params
      });
    } else {
      request = gapi.client.request({
          'method': requestMethod,
          'path': path,
          'params': params
      });
    }
    executeRequest(request);
  }

/**
   * Retrieve the access token for the currently authorized user.
   */
  function getAccessToken(event) {
    return GoogleAuth.currentUser.get().getAuthResponse(true).access_token;
  }

  /**
   * Helper for implementing retries with backoff. Initial retry
   * delay is 1 second, increasing by 2x (+jitter) for subsequent retries
   *
   * @constructor
   */
  var RetryHandler = function() {
    this.interval = 1000; // Start at one second
    this.maxInterval = 60 * 1000; // Don't wait longer than a minute 
  };

  /**
   * Invoke the function after waiting
   *
   * @param {function} fn Function to invoke
   */
  RetryHandler.prototype.retry = function(fn) {
    setTimeout(fn, this.interval);
    this.interval = this.nextInterval_();
  };

  /**
   * Reset the counter (e.g. after successful request.)
   */
  RetryHandler.prototype.reset = function() {
    this.interval = 1000;
  };

  /**
   * Calculate the next wait time.
   * @return {number} Next wait interval, in milliseconds
   *
   * @private
   */
  RetryHandler.prototype.nextInterval_ = function() {
    var interval = this.interval * 2 + this.getRandomInt_(0, 1000);
    return Math.min(interval, this.maxInterval);
  };

  /**
   * Get a random int in the range of min to max. Used to add jitter to wait times.
   *
   * @param {number} min Lower bounds
   * @param {number} max Upper bounds
   * @private
   */
  RetryHandler.prototype.getRandomInt_ = function(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
  };

  /**
   * Helper class for resumable uploads using XHR/CORS. Can upload any
   * Blob-like item, whether files or in-memory constructs.
   *
   * @example
   * var content = new Blob(["Hello world"], {"type": "text/plain"});
   * var uploader = new MediaUploader({
   *   file: content,
   *   token: accessToken,
   *   onComplete: function(data) { ... }
   *   onError: function(data) { ... }
   * });
   * uploader.upload();
   *
   * @constructor
   * @param {object} options Hash of options
   * @param {string} options.token Access token
   * @param {blob} options.file Blob-like item to upload
   * @param {string} [options.fileId] ID of file if replacing
   * @param {object} [options.params] Additional query parameters
   * @param {string} [options.contentType] Content-type, if overriding the
   *    type of the blob.
   * @param {object} [options.metadata] File metadata
   * @param {function} [options.onComplete] Callback for when upload is complete
   * @param {function} [options.onProgress] Callback for status of in-progress
   *    upload
   * @param {function} [options.onError] Callback if upload fails
   */
  var MediaUploader = function(options) {
    var noop = function() {};
    this.file = options.file;
    this.contentType = options.contentType || this.file.type || 'application/octet-stream';
    this.metadata = options.metadata || {
      'title': this.file.name,
      'mimeType': this.contentType
    };
    this.token = options.token;
    this.onComplete = options.onComplete || noop;
    this.onProgress = options.onProgress || noop;
    this.onError = options.onError || noop;
    this.offset = options.offset || 0;
    this.chunkSize = options.chunkSize || 0;
    this.retryHandler = new RetryHandler();

    this.url = options.url;
    if (!this.url) {
      var params = options.params || {};
      params.uploadType = 'resumable';
      this.url = this.buildUrl_(options.fileId, params, options.baseUrl);
    }
    this.httpMethod = options.fileId ? 'PUT' : 'POST';
  };

  /**
   * Initiate the upload.
   */
  MediaUploader.prototype.upload = function() {
    var self = this;
    var xhr = new XMLHttpRequest();

    xhr.open(this.httpMethod, this.url, true);
    xhr.setRequestHeader('Authorization', 'Bearer ' + this.token);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('X-Upload-Content-Length', this.file.size);
    xhr.setRequestHeader('X-Upload-Content-Type', this.contentType);

    xhr.onload = function(e) {
      if (e.target.status < 400) {
        var location = e.target.getResponseHeader('Location');
        this.url = location;
        this.sendFile_();
      } else {
        this.onUploadError_(e);
      }
    }.bind(this);
    xhr.onerror = this.onUploadError_.bind(this);
    xhr.send(JSON.stringify(this.metadata));
  };

  /**
   * Send the actual file content.
   *
   * @private
   */
  MediaUploader.prototype.sendFile_ = function() {
    var content = this.file;
    var end = this.file.size;

    if (this.offset || this.chunkSize) {
      // Only slice the file if we're either resuming or uploading in chunks
      if (this.chunkSize) {
        end = Math.min(this.offset + this.chunkSize, this.file.size);
      }
      content = content.slice(this.offset, end);
    }

    var xhr = new XMLHttpRequest();
    xhr.open('PUT', this.url, true);
    xhr.setRequestHeader('Content-Type', this.contentType);
    xhr.setRequestHeader('Content-Range', 'bytes ' + this.offset + '-' + (end - 1) + '/' + this.file.size);
    xhr.setRequestHeader('X-Upload-Content-Type', this.file.type);
    if (xhr.upload) {
      xhr.upload.addEventListener('progress', this.onProgress);
    }
    xhr.onload = this.onContentUploadSuccess_.bind(this);
    xhr.onerror = this.onContentUploadError_.bind(this);
    xhr.send(content);
  };

  /**
   * Query for the state of the file for resumption.
   *
   * @private
   */
  MediaUploader.prototype.resume_ = function() {
    var xhr = new XMLHttpRequest();
    xhr.open('PUT', this.url, true);
    xhr.setRequestHeader('Content-Range', 'bytes */' + this.file.size);
    xhr.setRequestHeader('X-Upload-Content-Type', this.file.type);
    if (xhr.upload) {
      xhr.upload.addEventListener('progress', this.onProgress);
    }
    xhr.onload = this.onContentUploadSuccess_.bind(this);
    xhr.onerror = this.onContentUploadError_.bind(this);
    xhr.send();
  };

  /**
   * Extract the last saved range if available in the request.
   *
   * @param {XMLHttpRequest} xhr Request object
   */
  MediaUploader.prototype.extractRange_ = function(xhr) {
    var range = xhr.getResponseHeader('Range');
    if (range) {
      this.offset = parseInt(range.match(/\d+/g).pop(), 10) + 1;
    }
  };

  /**
   * Handle successful responses for uploads. Depending on the context,
   * may continue with uploading the next chunk of the file or, if complete,
   * invokes the caller's callback.
   *
   * @private
   * @param {object} e XHR event
   */
  MediaUploader.prototype.onContentUploadSuccess_ = function(e) {
    if (e.target.status == 200 || e.target.status == 201) {
      this.onComplete(e.target.response);
    } else if (e.target.status == 308) {
      this.extractRange_(e.target);
      this.retryHandler.reset();
      this.sendFile_();
    }
  };

  /**
   * Handles errors for uploads. Either retries or aborts depending
   * on the error.
   *
   * @private
   * @param {object} e XHR event
   */
  MediaUploader.prototype.onContentUploadError_ = function(e) {
    if (e.target.status && e.target.status < 500) {
      this.onError(e.target.response);
    } else {
      this.retryHandler.retry(this.resume_.bind(this));
    }
  };

  /**
   * Handles errors for the initial request.
   *
   * @private
   * @param {object} e XHR event
   */
  MediaUploader.prototype.onUploadError_ = function(e) {
    this.onError(e.target.response); // TODO - Retries for initial upload
  };

  /**
   * Construct a query string from a hash/object
   *
   * @private
   * @param {object} [params] Key/value pairs for query string
   * @return {string} query string
   */
  MediaUploader.prototype.buildQuery_ = function(params) {
    params = params || {};
    return Object.keys(params).map(function(key) {
      return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
    }).join('&');
  };

  /**
   * Build the upload URL
   *
   * @private
   * @param {string} [id] File ID if replacing
   * @param {object} [params] Query parameters
   * @return {string} URL
   */
  MediaUploader.prototype.buildUrl_ = function(id, params, baseUrl) {
    var url = baseUrl;
    if (id) {
      url += id;
    }
    var query = this.buildQuery_(params);
    if (query) {
      url += '?' + query;
    }
    return url;
  };
  /***** END BOILERPLATE CODE *****/

  
  function defineRequest() {
        generateFile();
        var metadata = createResource({'snippet.categoryId': '22',
                 'snippet.defaultLanguage': '',
                 'snippet.description': 'Description of uploaded video.',
                 'snippet.tags[]': '',
                 'snippet.title': 'Test video upload',
                 'status.embeddable': '',
                 'status.license': '',
                 'status.privacyStatus': 'private',
                 'status.publicStatsViewable': ''
      });
    var token = getAccessToken();
    if (!token) {
      alert("You need to authorize the request to proceed.");
      return;
    }

    if (!selectedFile) {
      ////alert("You need to select a file to proceed.");
      return;
    }
    var params = {'part': 'snippet,status'};

    var uploader = new MediaUploader({
        baseUrl: 'https://www.googleapis.com/upload/youtube/v3/videos',
        file: selectedFile,
        token: token,
        metadata: metadata,
        params: params,
        onError: function(data) {
          var message = data;
          try {
            var errorResponse = JSON.parse(data);
            message = errorResponse.error.message;
          } finally {
            alert(message);
          }
        }.bind(this),
        onProgress: function(data) {
          var currentTime = Date.now();
          console.log('Progress: ' + data.loaded + ' bytes loaded out of ' + data.total);
          var totalBytes = data.total;
        }.bind(this),
        onComplete: function(data) {
          var uploadResponse = JSON.parse(data);
          console.log('Upload complete for video ' + uploadResponse.id);
        }.bind(this)
      });

    uploader.upload();
    showVideoRecorder();
  }