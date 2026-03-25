function getPlayerState() {
  if (document.querySelector('#movie_player').classList.contains('paused-mode')) {
    return 'paused';
  } else if (document.querySelector('#movie_player').classList.contains('playing-mode')) {
    return 'playing';
  } else {
    return 'stopped';
  }
}
exportFunction(getPlayerState, window, {
  defineAs: "getPlayerState",
});

function getVideoId() {
  return document.querySelector('#watch7-content meta[itemprop="identifier"]').content;
}
exportFunction(getVideoId, window, {
  defineAs: "getVideoId",
});

function getPlayerWidth() {
  return document.querySelector('#movie_player').clientWidth;
}
exportFunction(getPlayerWidth, window, {
  defineAs: "getPlayerWidth",
});

function getPlayerHeight() {
  return document.querySelector('#movie_player').clientHeight;
}
exportFunction(getPlayerHeight, window, {
  defineAs: "getPlayerHeight",
});

function getCurrentTime() {
  const video = document.querySelector('.video-stream');
  if (video !== undefined) {
    return video.currentTime;
  } else {
    return null;
  }
}
exportFunction(getCurrentTime, window, {
  defineAs: "getCurrentTime",
});

function getDuration() {
  return document.querySelector(".video-stream").duration
}
exportFunction(getDuration, window, {
  defineAs: "getDuration",
});

function updateUI(div) {
// https://stackoverflow.com/questions/65586000/keep-youtube-controls-always-visible

/*
  const container = document.querySelector('#movie_player')
  container.classList.remove('ytp-autohide')

  // Getting played time
  const video = document.querySelector('.video-stream')
  const hours = Math.floor(video.currentTime / 3600)
  let minutes = Math.floor(video.currentTime / 60) - (hours * 3600)
  let seconds = Math.round(video.currentTime % 60)
  if(seconds < 10){ seconds = `0${seconds}` }
  if(hours > 0 && minutes < 10){ minutes = `0${minutes}` }

  // Displaying played time
  const timeDisplay = document.querySelector('.ytp-time-current')
  timeDisplay.innerText = `${(hours > 0 ? `${hours}:` : '')}${minutes}:${seconds}`

  // Progress bar
  const percentagePlayed = video.currentTime / video.duration
  const progressBar = document.querySelector('.ytp-play-progress')
  progressBar.style = `left: 0px; transform: scaleX(${percentagePlayed})`

  // Buffered bar
  const percentageBuffered = video.buffered.end(0) / video.duration
  const bufferedBar = document.querySelector('.ytp-load-progress')
  bufferedBar.style = `left: 0px; transform: scaleX(${percentageBuffered})`
*/

  try {
    div.innerHTML = `
    playerState: <span class="playerState">${getPlayerState()}</span> -
    videoId: <span class="video-id">${getVideoId()}</span> - 
    width: <span class="playerWidth">${getPlayerWidth()}</span> - 
    height: <span class="playerHeight">${getPlayerHeight()}</span> - 
    currentTime: <span class="current-time">${getCurrentTime()}</span> - 
    duration: <span class="duration">${getDuration()}</span> -
    `;
    console.log('Hello!');
  } catch (e) {
    console.log("Error!");
    console.log(e);
  }
}
exportFunction(updateUI, window, {
  defineAs: "updateUI",
});

document.addEventListener("DOMContentLoaded", (event) => {
/*  var popupVideo = document.createElement("div");
  popupVideo.id = 'popup-video';
  document.body.appendChild(popupVideo);

  console.log('Loading...');


  console.log("DOM fully loaded and parsed");
  document.querySelector('video').addEventListener('loadstart', videoOnReadyListener);
*/
});

function videoOnReadyListener() {
//  var popupVideo = document.querySelector("#popup-video");
//  var updateUIInterval = window.setInterval(function(){updateUI(popupVideo)}, 500);
}

function waitForEl(el) {
  return new Promise((resolve, reject) => {
    const intervalId = setInterval(() => {
      if (document.querySelector(el)) {
        clearInterval(intervalId);
        resolve();
      }
    }, 500);
  });
}

waitForEl("#movie_player").then(() => {
  var popupVideo = document.createElement("div");
  popupVideo.id = 'popup-video';
  document.body.appendChild(popupVideo);

  var updateUIInterval = window.setInterval(function(){updateUI(document.querySelector('#popup-video'))}, 500);
});
