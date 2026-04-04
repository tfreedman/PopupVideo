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
  document.querySelector('#movie_player').appendChild(popupVideo);

  var updateUIInterval = window.setInterval(function(){updateUI(document.querySelector('#popup-video'))}, 100);
});


browser.runtime.sendMessage({ action: "hi" }, response => {
  console.log(response);
});
