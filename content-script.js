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
  if (document.querySelector('#movie_player') !== null) {
    return document.querySelector("#movie_player").getCurrentTime();
  } else {
    return null;
  }
}
exportFunction(getCurrentTime, window, {
  defineAs: "getCurrentTime",
});

function getDuration() {
  try {
    return document.querySelector("#movie_player").getDuration();
  }
  catch (e) {
    return 0.0;
  }
}
exportFunction(getDuration, window, {
  defineAs: "getDuration",
});

function updateUI(div) {
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

var popupVideo = document.createElement("div");
popupVideo.id = 'popup-video';
document.body.appendChild(popupVideo);


document.addEventListener("DOMContentLoaded", (event) => {
  console.log('Loading...');
  var popupVideo = document.querySelector("#popup-video");
  var updateUIInterval = window.setInterval(function(){updateUI(popupVideo)}, 500);
});
