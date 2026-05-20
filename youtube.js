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

function displayTestPopUp(response) {
  const div = document.createElement('div');

  div.classList.add('note');

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
  var date = null;

  date = document.createElement('div');
  date.classList.add('date');

  date.innerHTML = `
    <div>
      <div class="date">${epochTimestamp.toDateString()}</div>
    </div>
  `

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
        <div class="content">
          <header>
            <div class="details">
              <a class="modal-profile-button" data-micromodal-trigger="modal-profile" href="#"><span class="username">${username}</span></a>
            </div>
            <a class="modal-profile-button" data-micromodal-trigger="modal-profile" href="#"><div class="pubkey">${response._npub}</div></a>
          </header>
        </div>
      </div>

            <div class="content">
        <div class="created_at"><time data-tippy="${epochTimestamp.toUTCString()}" datetime="${epochTimestamp}">${(epochTimestamp.getHours() < 10 ? '0' : '') + epochTimestamp.getHours()}:${(epochTimestamp.getMinutes() < 10 ? '0' : '') + epochTimestamp.getMinutes()}</time></div>
        <div class="caption">`

      innerHTML += `
      ${linkifyAndEmbed(message.replace(/\n/g, '<br />'))}
        </div>
        <footer></footer>
      </div>
    </div>
  `

  div.innerHTML = innerHTML;

  var author = div.querySelector('.author');
  author.dataset.npub = response._npub;
  author.dataset.username = username;
  author.dataset.avatar = avatarURL;
  author.dataset.banner = bannerURL;
  author.dataset.pubkey = response.pubkey;
  if (response._author !== undefined) {
    author.dataset.content = JSON.stringify(authorContent);
    author.dataset.raw = JSON.stringify(response._author);
  }

  var links = div.querySelectorAll(".author a");
  links.forEach(i => {
    i.addEventListener('click', (e) => updateProfileModal(e));
  });

  tippy('time', {
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
  div.querySelector('footer').prepend(link)
  return div
}

exportFunction(displayTestPopUp, window, {
  defineAs: "displayTestPopUp",
});
