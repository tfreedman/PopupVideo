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
  try {
    div.innerHTML = `
    playerState: <span class="playerState">${getPlayerState()}</span> -
    videoId: <span class="video-id">${getVideoId()}</span> - 
    width: <span class="playerWidth">${getPlayerWidth()}</span> - 
    height: <span class="playerHeight">${getPlayerHeight()}</span> - 
    currentTime: <span class="current-time">${getCurrentTime()}</span> - 
    duration: <span class="duration">${getDuration()}</span> -
    `;
  } catch (e) {
    console.log(e);
  }
}
exportFunction(updateUI, window, {
  defineAs: "updateUI",
});
