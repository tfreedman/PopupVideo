async function writeClipboardText(text) {
  if (text === undefined) {
    text = "<blank>";
  }

  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    console.error(error.message);
  }
}

exportFunction(writeClipboardText, window, {
  defineAs: "writeClipboardText",
});

function getPlayerState() {
  if (document.querySelector('#movie_player').classList.contains('paused-mode')) {
    return 'paused';
  } else if (document.querySelector('#movie_player').classList.contains('unstarted-mode')) {
    return 'unstarted';
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
  if (document.querySelector('#watch7-content meta[itemprop="identifier"]') !== null) {
    return document.querySelector('#watch7-content meta[itemprop="identifier"]').content;
  }
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

function renderPopUp(response) {
  const div = document.createElement('div');

  div.classList.add('popup');

  div.id = response.id;

  var imageClass = '';


  var username = 'Unknown';
  var avatarURL;
  var bannerURL;

  if (response._author !== undefined) {
    var author = response._author;
    var authorContent = JSON.parse(author.content);

    if (authorContent && authorContent.picture) {
      avatarURL = authorContent.picture;
    } else {
      avatarURL = hashicon(response.pubkey).toDataURL();
      imageClass = 'hashicon';
    }

    if (authorContent && authorContent.banner) {
      bannerURL = authorContent.banner;
    }

    if (authorContent && authorContent.displayName) {
      username = authorContent.displayName;
    }
  } else {
    avatarURL = hashicon(response.pubkey).toDataURL();
    imageClass = 'hashicon';
  }

  var epochTimestamp = new Date(0);
  epochTimestamp.setUTCSeconds(response.created_at);

  var note = JSON.parse(response.note);
  var message = note.content;

  var innerHTML = `
    <div>
      <div class="author">
        <a class="modal-profile-button" data-micromodal-trigger="modal-profile" href="#">
          <div class="avatar">
            <img src="${avatarURL}" class="${imageClass}"/>
          </div>
        </a>
      </div>

      <div class="content">
        <header>
          <img src="${hashicon(response.pubkey).toDataURL()}" class="hicon" /> 
          <a class="modal-profile-button" data-micromodal-trigger="modal-profile" href="#"><span class="username">${username}</span></a>
          <span class="empty"></span>
        </header>
        <section>
          <div class="caption">`

        innerHTML += `
        ${linkifyAndEmbed(message.replace(/\n/g, '<br />'))}
          </div>
        </section>
        <footer>
        </footer>
      </div>
    </div>
  `

  div.innerHTML = innerHTML;

  var author = div.querySelectorAll('.modal-profile-button');
  author.forEach(i => {
    i.dataset.npub = response._npub;
    i.dataset.username = username;
    i.dataset.avatar = avatarURL;
    i.dataset.banner = bannerURL;
    i.dataset.pubkey = response.pubkey;
    if (response._author !== undefined) {
      i.dataset.content = JSON.stringify(authorContent);
      i.dataset.raw = JSON.stringify(response._author);
    }
  });

  var hicon = div.querySelector('.hicon');

  tippy(hicon, {
    content: "<span style='font-size: 10px'>" + response._npub + "</span>",
    allowHTML: true
  });

  hicon.onclick = function(event) {
    event.preventDefault();
    console.log(response._npub);
    writeClipboardText(response._npub);
  }

  var links = div.querySelectorAll(".modal-profile-button");
  links.forEach(i => {
    i.addEventListener('click', (e) => updateProfileModal(e));
  });


  const time = document.createElement('a');
  time.classList.add('created_at');
  time.dataset.tippy = epochTimestamp.toUTCString();
  time.datetime = epochTimestamp;
  time.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M464 256a208 208 0 1 1 -416 0 208 208 0 1 1 416 0zM0 256a256 256 0 1 0 512 0 256 256 0 1 0 -512 0zM232 120l0 136c0 8 4 15.5 10.7 20l96 64c11 7.4 25.9 4.4 33.3-6.7s4.4-25.9-6.7-33.3L280 243.2 280 120c0-13.3-10.7-24-24-24s-24 10.7-24 24z"/></svg>';
  div.querySelector('header').append(time)

  tippy(time, {
    content: (reference) => reference.dataset.tippy
  });


  const link = document.createElement('a');
  link.classList.add('raw');

  tippy(link, {
    content: 'Copy to Clipboard'
  });

  link.onclick = function(event) {
    event.preventDefault();
    console.log(note);
    writeClipboardText(JSON.stringify(note));
  }

  link.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512"><!--!Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M392.8 1.2c-17-4.9-34.7 5-39.6 22l-128 448c-4.9 17 5 34.7 22 39.6s34.7-5 39.6-22l128-448c4.9-17-5-34.7-22-39.6zm80.6 120.1c-12.5 12.5-12.5 32.8 0 45.3L562.7 256l-89.4 89.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l112-112c12.5-12.5 12.5-32.8 0-45.3l-112-112c-12.5-12.5-32.8-12.5-45.3 0zm-306.7 0c-12.5-12.5-32.8-12.5-45.3 0l-112 112c-12.5 12.5-12.5 32.8 0 45.3l112 112c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256l89.4-89.4c12.5-12.5 12.5-32.8 0-45.3z"/></svg>';
  div.querySelector('header').append(link)
  return div
}

exportFunction(renderPopUp, window, {
  defineAs: "renderPopUp",
});
