window.pubkey = null;
window.privkey = null;
window.npub = null;
window.users = {};

var enableEmoji = false;
if (enableEmoji) {
  var showEmoji = false;
  function toggleEmojiWindow(event) {
    if (showEmoji) {
      document.querySelector('#emoji-picker').style.visibility = 'hidden';
    } else {
      document.querySelector('#emoji-picker').style.visibility = 'visible';
    }

    showEmoji = !showEmoji;
  }

  document.querySelector('body').addEventListener("click", event => {
    // Get parent element and check if click happened outside parent only
    const parent = document.querySelector("#emoji-picker");
    if (showEmoji && !parent.contains(event.target)) {
      toggleEmojiWindow(event);
    }
  });
}

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

function updateProfileModal(event) {
  var p = event.target.closest(".modal-profile-button");

  parent = document.querySelector('#modal-profile .profile');
  parent.innerHTML = '';

  var hasUsername = false;
  var hasPicture = false;

  if (p.dataset.content !== "") {
    var profile = JSON.parse(p.dataset.content);
    if (profile.name !== undefined) {
      document.querySelector('#modal-profile #modal-profile-title').innerHTML = profile.name;
      hasUsername = true;
    }
    if (profile.displayName !== undefined) {
      document.querySelector('#modal-profile #modal-profile-title').innerHTML = profile.displayName;
      hasUsername = true;
    }
    if (profile.website !== undefined) {
      const website = document.createElement('a');
      website.innerHTML = profile.website;
      website.href = profile.website;
      website.classList.add('website');
      parent.appendChild(website);
    }
    if (profile.about !== undefined) {
      const about = document.createElement('p');
      about.innerHTML = profile.about;
      about.classList.add('about');
      parent.appendChild(about);
    }
    if (profile.banner !== undefined) {
      document.querySelector('#modal-profile .banner').style.backgroundImage = "url('" + profile.banner + "')";
    }
    if (profile.picture !== undefined) {
      document.querySelector('#modal-profile .avatar img').src = profile.picture;
      hasPicture = true;
    }
  }
  if (!hasPicture) {
    document.querySelector('#modal-profile .avatar img').src = hashicon(pubKey).toDataURL();
    document.querySelector('#modal-profile .avatar img').classList.add('hashicon');
  }
  if (!hasUsername) {
    document.querySelector('#modal-profile #modal-profile-title').innerHTML = 'Unknown';
  }

  document.querySelector('#modal-profile .pubkey').innerHTML = p.dataset.npub;
  MicroModal.close('modal-popup');
  MicroModal.show('modal-profile');
}

function createProfilePopUp() {
  var div = document.createElement("div");
  div.classList.add('modal');
  div.classList.add('micromodal-slide');
  div.id = "modal-profile";
  div.ariaHidden = "true";
  div.innerHTML = `
    <div class="modal__overlay" tabindex="-1" data-micromodal-close>
      <div class="modal__container" role="dialog" aria-modal="true" aria-labelledby="modal-profile-title">
        <header class="modal__header">
          <div></div>
          <button class="modal__close" aria-label="Close modal" data-micromodal-close></button>
        </header>
        <main class="modal__content" id="modal-profile-content">
          <div class="banner">
            <div class="avatar">
              <img src="" />
            </div>
          </div>
          <h1 class="modal__title" id="modal-profile-title"></h1>
          <p class="pubkey"></p>
          <div class="profile">
          </div>
        </main>
      </div>
    </div>
  `;
  document.querySelector('body').appendChild(div);
}

function createPopUpPopUp() {
  var div = document.createElement("div");
  div.classList.add('modal');
  div.classList.add('micromodal-slide');
  div.id = "modal-popup";
  div.ariaHidden = "true";
  div.innerHTML = `
    <div class="modal__overlay" tabindex="-1" data-micromodal-close>
      <div class="modal__container" role="dialog" aria-modal="true" aria-labelledby="modal-popup-title">
        <header class="modal__header">
          <h1 class="modal__title" id="modal-popup-title">
            PopUps
          </h1>
          <button class="modal__close" aria-label="Close modal" data-micromodal-close></button>
        </header>
        <main class="modal__content" id="modal-popup-content">
        </main>
      </div>
    </div>
  `;
  document.querySelector('body').appendChild(div);
}

function createNewPopUpPopUp() {
  var div = document.createElement("div");
  div.classList.add('modal');
  div.classList.add('micromodal-slide');
  div.id = "modal-new-popup";
  div.ariaHidden = "true";
  div.innerHTML = `
    <div class="modal__overlay" tabindex="-1" data-micromodal-close>
      <div class="modal__container" role="dialog" aria-modal="true" aria-labelledby="modal-new-popup-title">
        <header class="modal__header">
          <h1 class="modal__title" id="modal-new-popup-title">
            New PopUp
          </h1>
          <button class="modal__close" aria-label="Close modal" data-micromodal-close></button>
        </header>
        <main class="modal__content" id="modal-new-popup-content">
        </main>
      </div>
    </div>
  `;
  document.querySelector('body').appendChild(div);
  newNote(document.querySelector('#modal-new-popup-content'), null);
}

function createInfoPopUp() {
  var div = document.createElement("div");
  div.classList.add('modal');
  div.classList.add('micromodal-slide');
  div.id = "modal-info";
  div.ariaHidden = "true";
  div.innerHTML = `
    <div class="modal__overlay" tabindex="-1" data-micromodal-close>
      <div class="modal__container" role="dialog" aria-modal="true" aria-labelledby="modal-info-title">
        <header class="modal__header">
          <h1 class="modal__title" id="modal-info-title">
            Info
          </h1>
          <button class="modal__close" aria-label="Close modal" data-micromodal-close></button>
        </header>
        <main class="modal__content" id="modal-info-content">
          <h2></h2>
          <p>PopUp Video is a decentralized Nostr app that lets you comment on top of YouTube videos, using the Nostr protocol. The browser extension draws comments on top of YouTube videos if there are any notes for the video you're watching.</p>
          <p>For privacy reasons, PopUp Video scrapes all PopUps from the relays you're connected to, stores them in your browser, and then filters based on the exact video ID you're looking at to avoid leaking your browser history.</p>

          <h2>PopUps</h2>
          <p>A PopUp is defined as a kind 1 event, with tags <em>[['r', "https://www.youtube.com/watch?v=XXXXXXX"], ['t', 'popupvideo'], ['name', 'Video Name']]</em>. </p>

          <p>PopUp Video does not implement NIP-07, and it is unclear if it's possible to ever be compatible with extensions like nos2x.</p>
        </main>
      </div>
    </div>
  </div>`;
  document.querySelector('body').appendChild(div);
}


function createAccountPopUp() {
  var div = document.createElement("div");
  div.classList.add('modal');
  div.classList.add('micromodal-slide');
  div.id = "modal-account";
  div.ariaHidden = "true";

 var avatarURL = browser.runtime.getURL("icons/circle-user.svg"); // Firefox
//  var avatarURL = chrome.extension.getURL("icons/circle-user.svg"); // Chrome

  div.innerHTML = `
    <div class="modal__overlay" tabindex="-1" data-micromodal-close>
      <div class="modal__container" role="dialog" aria-modal="true" aria-labelledby="modal-account-title">
        <header class="modal__header">
          <h1 class="modal__title" id="modal-account-title">
            Account
          </h1>
          <button class="modal__close" aria-label="Close modal" data-micromodal-close></button>
        </header>
        <main class="modal__content" id="modal-account-content">
          <div>
            <h2>Profile</h2>
            <div id="profile">
              <form>
                <img class="avatar" src="${avatarURL}" />

                <div class="field">
                  <label for="name">Name:</label>
                  <input name="name" value="" type="text" class="input" />
                </div>
                <div class="field">
                  <label for="display_name">Display Name:</label>
                  <input name="display_name" value="" type="text" class="input" />
                </div>
                <div class="field">
                  <label for="about">About:</label>
                  <textarea name="about" value="" type="text" class="input"></textarea>
                </div>
                <div class="field">
                  <label for="website">Website:</label>
                  <input name="website" value="" type="url" class="input" />
                </div>

                <div class="banner-upload-group">
                  <label for="banner">Banner:</label>
                  <br />
                  <button type="button" class="banner-upload active">From a File</button>
                  <button type="button" class="banner-url">From a URL</button>
                  <br />

                  <div class="field upload active">
                    <label for="file">File (PNG/JPG/WebP): <span class="banner-message"></span></label>
                    <input name="file" type="file" accept="image/png, image/jpeg, image/webp" />
                  </div>

                  <div class="field url hidden">
                    <label for="banner">URL:</label>
                    <input name="banner" value="" type="url" class="input" />
                  </div>
                </div>

                <div class="picture-upload-group">
                  <label for="picture">Picture:</label>
                  <br />
                  <button type="button" class="picture-upload active">From a File</button>
                  <button type="button" class="picture-url">From a URL</button>
                  <br />

                  <div class="field upload active">
                    <label for="file">File (PNG/JPG/WebP): <span class="picture-message"></span></label>
                    <input name="file" type="file" accept="image/png, image/jpeg, image/webp" />
                  </div>

                  <div class="field url hidden">
                    <label for="picture">URL:</label>
                    <input name="picture" value="" type="url" class="input" />
                  </div>
                </div>

                <button type="submit"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M129.9 292.5C143.2 199.5 223.3 128 320 128C373 128 421 149.5 455.8 184.2C456 184.4 456.2 184.6 456.4 184.8L464 192L416.1 192C398.4 192 384.1 206.3 384.1 224C384.1 241.7 398.4 256 416.1 256L544.1 256C561.8 256 576.1 241.7 576.1 224L576.1 96C576.1 78.3 561.8 64 544.1 64C526.4 64 512.1 78.3 512.1 96L512.1 149.4L500.8 138.7C454.5 92.6 390.5 64 320 64C191 64 84.3 159.4 66.6 283.5C64.1 301 76.2 317.2 93.7 319.7C111.2 322.2 127.4 310 129.9 292.6zM573.4 356.5C575.9 339 563.7 322.8 546.3 320.3C528.9 317.8 512.6 330 510.1 347.4C496.8 440.4 416.7 511.9 320 511.9C267 511.9 219 490.4 184.2 455.7C184 455.5 183.8 455.3 183.6 455.1L176 447.9L223.9 447.9C241.6 447.9 255.9 433.6 255.9 415.9C255.9 398.2 241.6 383.9 223.9 383.9L96 384C87.5 384 79.3 387.4 73.3 393.5C67.3 399.6 63.9 407.7 64 416.3L65 543.3C65.1 561 79.6 575.2 97.3 575C115 574.8 129.2 560.4 129 542.7L128.6 491.2L139.3 501.3C185.6 547.4 249.5 576 320 576C449 576 555.7 480.6 573.4 356.5z"/></svg> Update</button>
              </form>
            </div>
          </div>

          <div>
            <h2>Keys</h2>
            <div id="keys">
              <form>
                <div class="field">
                  <label for="privkey">Private Key:</label>
                  <input name="privkey" type="text" class="input" />
                </div>

                <div class="field">
                  <label for="pubkey">Public Key:</label>
                  <input name="pubkey" type="text" class="input" />
                </div>

                <div class="field">
                  <label for="npub">npub:</label>
                  <input name="npub" type="text" class="input" />
                </div>
                <div class="edit-container">
                  <button type="button" class="edit"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--!Font Awesome Free v7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M471.6 21.7c-21.9-21.9-57.3-21.9-79.2 0L368 46.1 465.9 144 490.3 119.6c21.9-21.9 21.9-57.3 0-79.2L471.6 21.7zm-299.2 220c-6.1 6.1-10.8 13.6-13.5 21.9l-29.6 88.8c-2.9 8.6-.6 18.1 5.8 24.6s15.9 8.7 24.6 5.8l88.8-29.6c8.2-2.7 15.7-7.4 21.9-13.5L432 177.9 334.1 80 172.4 241.7zM96 64C43 64 0 107 0 160L0 416c0 53 43 96 96 96l256 0c53 0 96-43 96-96l0-96c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 96c0 17.7-14.3 32-32 32L96 448c-17.7 0-32-14.3-32-32l0-256c0-17.7 14.3-32 32-32l96 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L96 64z"/></svg> Edit</button>
                </div>
                <div class="submit-container">
                  <button type="button" class="update"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M129.9 292.5C143.2 199.5 223.3 128 320 128C373 128 421 149.5 455.8 184.2C456 184.4 456.2 184.6 456.4 184.8L464 192L416.1 192C398.4 192 384.1 206.3 384.1 224C384.1 241.7 398.4 256 416.1 256L544.1 256C561.8 256 576.1 241.7 576.1 224L576.1 96C576.1 78.3 561.8 64 544.1 64C526.4 64 512.1 78.3 512.1 96L512.1 149.4L500.8 138.7C454.5 92.6 390.5 64 320 64C191 64 84.3 159.4 66.6 283.5C64.1 301 76.2 317.2 93.7 319.7C111.2 322.2 127.4 310 129.9 292.6zM573.4 356.5C575.9 339 563.7 322.8 546.3 320.3C528.9 317.8 512.6 330 510.1 347.4C496.8 440.4 416.7 511.9 320 511.9C267 511.9 219 490.4 184.2 455.7C184 455.5 183.8 455.3 183.6 455.1L176 447.9L223.9 447.9C241.6 447.9 255.9 433.6 255.9 415.9C255.9 398.2 241.6 383.9 223.9 383.9L96 384C87.5 384 79.3 387.4 73.3 393.5C67.3 399.6 63.9 407.7 64 416.3L65 543.3C65.1 561 79.6 575.2 97.3 575C115 574.8 129.2 560.4 129 542.7L128.6 491.2L139.3 501.3C185.6 547.4 249.5 576 320 576C449 576 555.7 480.6 573.4 356.5z"/></svg> Update</button>
                  <button type="button" class="cancel"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><!--!Font Awesome Free v7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M55.1 73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L147.2 256 9.9 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192.5 301.3 329.9 438.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.8 256 375.1 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192.5 210.7 55.1 73.4z"/></svg> Cancel</button>
                </div>
              </form>
            </div>

            <h2>Relays</h2>
            <div id="relays">
              <form>
                <p><em class="message"></em></p>
                <div class="relays"></div>
              </form>
            </div>
          </div>

        </main>
      </div>
    </div>
  </div>`;

  document.querySelector('body').appendChild(div);

  document.querySelector('#modal-account .picture-upload-group input[type="file"]').addEventListener('change', (e) => {
    const files = document.querySelector('#modal-account .picture-upload-group input[type="file"]').files;
    const message = document.querySelector('#modal-account .picture-upload-group .picture-message');
    const urlBox = document.querySelector('#modal-account .picture-upload-group input[name="picture"]');

    if (files.length > 0) {
      signNoteForFileUpload(files, message, 'avatar', urlBox);
    }
  });

  document.querySelector('#modal-account .banner-upload-group input[type="file"]').addEventListener('change', (e) => {
    const files = document.querySelector('#modal-account .banner-upload-group input[type="file"]').files;
    const message = document.querySelector('#modal-account .banner-upload-group .banner-message');
    const urlBox = document.querySelector('#modal-account .banner-upload-group input[name="banner"]');

    if (files.length > 0) {
      signNoteForFileUpload(files, message, 'banner', urlBox);
    }
  });

  function editKeys() {
    document.querySelector('#keys .edit-container').style.display = 'none'
    document.querySelector('#keys .submit-container').style.display = 'block';
    document.querySelector('#keys input[name="privkey"]').disabled = false;
  }

  function cancelUpdateKeys() {
    browser.runtime.sendMessage({ action: "decodeNostrKeys", keys: window.privkey}, response => {
      sk = Uint8Array.from(response.data);
      document.querySelector('#keys input[name="privkey"]').value = window.privkey;
      document.querySelector('#keys input[name="privkey"]').disabled = true;
      document.querySelector('#keys .edit-container').style.display = 'block'
      document.querySelector('#keys .submit-container').style.display = 'none';
    });
  }

  function updateKeys() {
    try { // Basic validation - if we can generate an npub from the input, it's a valid key
      browser.runtime.sendMessage({ action: "decodeNostrKeys", keys: document.querySelector('#keys input[name="privkey"]').value}, response => {
        if (response.data) {
          document.querySelector('#keys .edit-container').style.display = 'block'
          document.querySelector('#keys .submit-container').style.display = 'none';

          browser.runtime.sendMessage({ action: "setNostrKeys" }, response => {
            window.privkey = response.privkey;
            window.pubkey = response.pubkey;
            window.npub = response.npub;
            document.querySelector('#keys input[name="privkey"]').value = window.privkey;
            document.querySelector('#keys input[name="privkey"]').disabled = true;
            displayProfile(window.pubkey, response.profile);
            window.location.reload();
          });

        }
      });
    } catch (e) {
      alert('Invalid nsec');
    }
  }

  function validateProfile(event) {
    event.preventDefault();

    var data = event.target.parentElement.parentElement;

    if (data.checkValidity()) {
      data.querySelector('#modal-account button[type="submit"]').disabled = false;
    } else {
      data.querySelector('#modal-account button[type="submit"]').disabled = true;
    }
  }

  document.querySelectorAll('#profile .picture-upload-group > button[type="button"]').forEach(button => {
    button.addEventListener("click", event => {
      if (event.target.classList.contains('picture-upload')) {
        document.querySelector('#profile .picture-upload-group .picture-upload').classList.add('active')
        document.querySelector('#profile .picture-upload-group .picture-url').classList.remove('active')
        document.querySelector('#profile .picture-upload-group .upload').classList.remove('hidden')
        document.querySelector('#profile .picture-upload-group .url').classList.add('hidden')
      } else {
        document.querySelector('#profile .picture-upload-group .picture-url').classList.add('active')
        document.querySelector('#profile .picture-upload-group .picture-upload').classList.remove('active')
        document.querySelector('#profile .picture-upload-group .url').classList.remove('hidden')
        document.querySelector('#profile .picture-upload-group .upload').classList.add('hidden')
      }
    });
  });

  document.querySelectorAll('#profile .banner-upload-group > button[type="button"]').forEach(button => {
    button.addEventListener("click", event => {
      if (event.target.classList.contains('banner-upload')) {
        document.querySelector('#modal-account .banner-upload-group .banner-upload').classList.add('active')
        document.querySelector('#modal-account .banner-upload-group .banner-url').classList.remove('active')
        document.querySelector('#modal-account .banner-upload-group .upload').classList.remove('hidden')
        document.querySelector('#modal-account .banner-upload-group .url').classList.add('hidden')
      } else {
        document.querySelector('#modal-account .banner-upload-group .banner-url').classList.add('active')
        document.querySelector('#modal-account .banner-upload-group .banner-upload').classList.remove('active')
        document.querySelector('#modal-account .banner-upload-group .url').classList.remove('hidden')
        document.querySelector('#modal-account .banner-upload-group .upload').classList.add('hidden')
      }
    });
  });

  document.querySelectorAll("#modal-account form input, #modal-account form textarea").forEach(i => {
    i.addEventListener('keyup', (e) => validateProfile(e));
  });

  document.querySelector('#keys .edit').addEventListener('click', editKeys);
  document.querySelector('#keys .cancel').addEventListener('click', cancelUpdateKeys);
  document.querySelector('#keys .update').addEventListener('click', updateKeys);
}

function modalInitialization() {
  MicroModal.init({
    awaitCloseAnimation: true
  });
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

function updateProfile(event) {
  if (event !== undefined) {
    event.preventDefault();
  }
  var content = {};
  var container = document.querySelector('#modal-account-content');
  var name = container.querySelector('input[name="name"]').value;
  var displayName = container.querySelector('input[name="display_name"]').value;
  var website = container.querySelector('input[name="website"]').value;
  var banner = container.querySelector('input[name="banner"]').value;
  var picture = container.querySelector('input[name="picture"]').value;
  var about = container.querySelector('textarea[name="about"]').value;

  if (name.length > 0) {content.name = name}
  if (displayName.length > 0) {content.displayName = displayName}
  if (website.length > 0) {content.website = website}
  if (banner.length > 0) {content.banner = banner}
  if (picture.length > 0) {content.picture = picture}
  if (about.length > 0) {content.about = about}

  var e = {
    created_at: Math.floor(Date.now() / 1000),
    kind: 0,
    tags: [],
    content: JSON.stringify(content)
  }

  browser.runtime.sendMessage({ action: "signNote", event: e, privkey: document.querySelector('#keys input[name="privkey"]').value }, response => {
    console.log('Received signed note back from service worker: ' + JSON.stringify(response));

    browser.runtime.sendMessage({ action: "uploadNote", note: response}, r => {
      console.log("Sent (kind 0)" + JSON.stringify(r));
      MicroModal.close('modal-account');
    });
  });
}

function displayRelays(relays, isDebuggingEnabled) {
  if (isDebuggingEnabled === true) {
    document.querySelector('#modal-account #relays .message').innerHTML = 'Overriding relays for debugging purposes';
  }
  const div = document.createElement('div');
  relays.forEach((relay) => {
    div.innerHTML += `
      <div class="field">
        <label for="relay[]">Relay</label>
        <input class="input relay" name="relay[]" disabled value="${relay}" type="text" />
      </div>
    `
  });

  document.querySelector('#modal-account .relays').innerHTML = div.innerHTML;
}

waitForEl("#movie_player").then(() => {
  var popupVideo = document.createElement("div");
  popupVideo.id = 'popup-video';
  document.querySelector('#movie_player').appendChild(popupVideo);

  if (enableEmoji) {
    var emojiPicker = document.createElement("div");
    emojiPicker.id = 'emoji-picker';
    document.querySelector('body').appendChild(emojiPicker);

    const pickerOptions = { onEmojiSelect: function(e){document.querySelector('textarea').value += e.native; console.log(e);}, previewPosition: 'none'}
    const picker = new EmojiMart.Picker(pickerOptions)
    if (document.querySelector('#emoji-picker').childNodes.length == 0) {
      document.querySelector('#emoji-picker').appendChild(picker);
    }
  }

  //var updateUIInterval = window.setInterval(function(){updateUI(document.querySelector('#popup-video'))}, 100);
  //var updateUIInterval = window.setInterval(function(){displayTestPopUp({})}, 100);

  var testObject = {
    "id": "01b4c3c35cad980fc10b5625fc3cded40d77b51e685027efed3a3a7e443bc563",
    "created_at": 1778958605,
    "domain": "www.youtube.com",
    "url": "https://www.youtube.com/watch?v=V9t7b-fiY1k",
    "pubkey": "6aa6095ffffc3aa101003a3097f06f44d2633d40a1f0e643122f59ab426cf337",
    "kind": 1,
    "note": "{\"content\":\"123456\",\"created_at\":1778958605,\"id\":\"01b4c3c35cad980fc10b5625fc3cded40d77b51e685027efed3a3a7e443bc563\",\"kind\":1,\"pubkey\":\"6aa6095ffffc3aa101003a3097f06f44d2633d40a1f0e643122f59ab426cf337\",\"sig\":\"dee32eaefe93997d369311da54926b17f88b23d7c099d16c9cbbd27b959ef2bdca9513090e69391884a1838424d2d1a8c7b672e733e2a0728d0b07df190d9502\",\"tags\":[[\"r\",\"https://www.youtube.com/watch?v=V9t7b-fiY1k\"],[\"t\",\"popupvideo\"],[\"name\",\"Lonely Rolling Star (Unused Version) - Katamari Damacy\"]]}",
    "favourite": 0,
    "read_at": 0,
    "_author": {
      "content": "{\"name\":\"Albedo\",\"displayName\":\"Albedo\",\"picture\":\"https://nostr.tylerfreedman.com/uploads/npub1d2nqjhlllsa2zqgq8gcf0ur0gnfxx02q58cwvscj9av6ksnv7vmsnu8ml7/avatar\"}",
      "created_at": 1778967134,
      "id": "2b74a22f6b97ed9fc9bc49ee9edbd074d0eee2e0f8d5e3960cd8e2733e69ab66",
      "kind": 0,
      "pubkey": "6aa6095ffffc3aa101003a3097f06f44d2633d40a1f0e643122f59ab426cf337",
      "sig": "506befcc024f2cc56d81c5473d6b844646139552f3d206a4ebefcd9bf05a1e1c1413d2a742954267a7e53b012d25fb541f5d9708dc342a6505045b5687d8b06b",
      "tags": []
    },
    "_npub": "npub1d2nqjhlllsa2zqgq8gcf0ur0gnfxx02q58cwvscj9av6ksnv7vmsnu8ml7"
  }

  document.querySelector('#popup-video').appendChild(displayTestPopUp(testObject));

  if (document.querySelector('#center .modal-account-button') === null) {
    createAccountPopUp();
    var account = document.createElement("a");
    account.dataset.tippy = "Account";
    account.classList.add("pvbutton");
    account.classList.add("modal-account-button");

    account.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M463 448.2C440.9 409.8 399.4 384 352 384L288 384C240.6 384 199.1 409.8 177 448.2C212.2 487.4 263.2 512 320 512C376.8 512 427.8 487.3 463 448.2zM64 320C64 178.6 178.6 64 320 64C461.4 64 576 178.6 576 320C576 461.4 461.4 576 320 576C178.6 576 64 461.4 64 320zM320 336C359.8 336 392 303.8 392 264C392 224.2 359.8 192 320 192C280.2 192 248 224.2 248 264C248 303.8 280.2 336 320 336z"/></svg>';
    account.dataset.micromodalTrigger = "modal-account";
    if (document.querySelector('#center') !== null) {
      document.querySelector('#center').appendChild(account);
    }
  }


  if (document.querySelector('#center .modal-info-button') === null) {
    createInfoPopUp();
    var info = document.createElement("a");
    info.dataset.tippy = "Info";
    info.classList.add("pvbutton");
    info.classList.add('modal-info-button');
    info.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--!Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336l24 0 0-64-24 0c-13.3 0-24-10.7-24-24s10.7-24 24-24l48 0c13.3 0 24 10.7 24 24l0 88 8 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-80 0c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"/></svg>';
    info.dataset.micromodalTrigger = "modal-info";
    if (document.querySelector('#center') !== null) {
      document.querySelector('#center').appendChild(info);
    }
  }


  if (document.querySelector('#center .modal-new-popup-button') === null) {
    createNewPopUpPopUp();
    var newPopUp = document.createElement("a");
    newPopUp.dataset.tippy = "New";
    newPopUp.classList.add("pvbutton");
    newPopUp.classList.add('modal-new-popup-button');
    newPopUp.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M256 512a256 256 0 1 0 0-512 256 256 0 1 0 0 512zM232 344l0-64-64 0c-13.3 0-24-10.7-24-24s10.7-24 24-24l64 0 0-64c0-13.3 10.7-24 24-24s24 10.7 24 24l0 64 64 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-64 0 0 64c0 13.3-10.7 24-24 24s-24-10.7-24-24z"/></svg>'
    newPopUp.dataset.micromodalTrigger = "modal-new-popup";
    if (document.querySelector('#center') !== null) {
      document.querySelector('#center').appendChild(newPopUp);
    }
  }

  if (document.querySelector('#center .modal-profile-button') === null) {
    createProfilePopUp();
  }

  if (document.querySelector('#center .modal-popup-button') === null) {
    createPopUpPopUp();
    var popup = document.createElement("a");
    popup.dataset.tippy = "PopUps";
    popup.classList.add('modal-popup-button');
    popup.classList.add("pvbutton");

//    popup.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M40 48C26.7 48 16 58.7 16 72l0 48c0 13.3 10.7 24 24 24l48 0c13.3 0 24-10.7 24-24l0-48c0-13.3-10.7-24-24-24L40 48zM192 64c-17.7 0-32 14.3-32 32s14.3 32 32 32l288 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L192 64zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32l288 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-288 0zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32l288 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-288 0zM16 232l0 48c0 13.3 10.7 24 24 24l48 0c13.3 0 24-10.7 24-24l0-48c0-13.3-10.7-24-24-24l-48 0c-13.3 0-24 10.7-24 24zM40 368c-13.3 0-24 10.7-24 24l0 48c0 13.3 10.7 24 24 24l48 0c13.3 0 24-10.7 24-24l0-48c0-13.3-10.7-24-24-24l-48 0z"/></svg>';
    popup.innerHTML = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12ZM16 9V7H8V9H16ZM8 17V15H16V17H8ZM16 11H8V13H16V11Z" /></svg>';
    popup.dataset.micromodalTrigger = "modal-popup";
    if (document.querySelector('#center') !== null) {
      document.querySelector('#center').appendChild(popup);
    }

    popup.onclick = function(event) {
      browser.runtime.sendMessage({ action: "getPopUps" }, response => {
        displayPopUps(response);
      });
    }
  }

  modalInitialization();

  tippy('#center > a.pvbutton', {
    content: (reference) => reference.dataset.tippy
  });

  browser.runtime.sendMessage({ action: "getNostrKeys" }, response => {
    window.privkey = response.privkey;
    window.pubkey = response.pubkey;
    window.npub = response.npub;
    document.querySelector('#keys input[name="privkey"]').value = window.privkey;
    document.querySelector('#keys input[name="privkey"]').disabled = true;
    displayProfile(window.pubkey, response.profile);
  });

  browser.runtime.sendMessage({ action: "getProfile" }, response => {
    displayProfile(window.pubkey, response.profile);
  });

  browser.runtime.sendMessage({ action: "getRelays" }, response => {
    window.relays = response.relays;
    displayRelays(response.relays, response.debugging);
  });

  browser.runtime.sendMessage({ action: "getUsers" }, response => {
    window.users = response.users;
  });
});

function displayProfile(pubkey, event) {
  console.log(event);
  if (pubkey !== undefined) {
    document.querySelector('#keys input[name="pubkey"]').value = pubkey;
    document.querySelector('#keys input[name="pubkey"]').disabled = true;
    document.querySelector('#keys input[name="npub"]').value = window.npub;
    document.querySelector('#keys input[name="npub"]').disabled = true;

    document.querySelector('#modal-account-content button[type="submit"]').addEventListener('click', updateProfile);

    if (event != undefined) {
      console.log("There's profile data!");
      var profile = JSON.parse(event.content);
      if (profile.name !== undefined) {
        document.querySelector('#modal-account-content input[name="name"]').value = profile.name;
      }
      if (profile.displayName !== undefined) {
        document.querySelector('#modal-account-content input[name="display_name"]').value = profile.displayName;
      }
      if (profile.website !== undefined) {
        document.querySelector('#modal-account-content input[name="website"]').value = profile.website;
      }
      if (profile.about !== undefined) {
        document.querySelector('#modal-account-content textarea[name="about"]').value = profile.about;
      }
      if (profile.banner !== undefined) {
        document.querySelector('#modal-account-content input[name="banner"]').value = profile.banner;
      }
      if (profile.picture !== undefined) {
        document.querySelector('#modal-account-content input[name="picture"]').value = profile.picture;
        if (document.querySelector('#modal-account-content input[name="picture"]').value !== "") {
          document.querySelector('#modal-account-content .avatar').src = document.querySelector('#profile input[name="picture"]').value
          //document.querySelector('#topbar nav .avatar').src = document.querySelector('#profile input[name="picture"]').value FIXME
        } else {
          document.querySelector('#modal-account-content .avatar').src = 'circle-user.svg'
          //document.querySelector('#topbar nav .avatar').src = 'circle-user.svg' FIXME
        }
      }
      console.log(event);
    } else {
      console.log("No profile data :(");
    }
  }
}

async function sha256FromBlob(blob) {
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function uploadFile(formData, message, urlBox, note) {
  try {
    message.classList.remove('error');
    message.classList.remove('success');

    const response = await fetch('https://nostr.tylerfreedman.com/api/upload', {
      method: 'POST',
      headers: {
        "Authorization": "Nostr " + base64url_encode(note)
      },
      body: formData,
    });

    if (response.ok) {
      let responseText = await response.text();
      console.log('Received: ' + responseText);
      urlBox.value = responseText;
      message.textContent = ' ';
      message.classList.add('success');
    } else {
      message.textContent = ' ';
      message.classList.add('error');
    }
  } catch (error) {
    message.textContent = 'An error occurred while uploading.';
    message.className = 'message error';
  }
}

const signNoteForFileUpload = async(files, message, kind, urlBox) => {
  const formData = new FormData();
  formData.append('file', files[0]);
  formData.append('kind', kind);

  var hash = sha256FromBlob(files[0]).then(hash => {
    console.log('hash: ' + hash);
    formData.append('X-SHA-256', hash);

    var tags = [["t","upload"], ["expiration", (Math.floor(Date.now() / 1000) + 60).toString()], ["x", hash]];
    var e = {created_at: Math.floor(Date.now() / 1000), kind: 24242, tags: tags, content: ""};

    browser.runtime.sendMessage({ action: "signNote", event: e, privkey: document.querySelector('#keys input[name="privkey"]').value }, response => {
      console.log('Received signed note back from service worker: ' + JSON.stringify(response));

      uploadFile(formData, message, urlBox, JSON.stringify(response));
    });
  });
};

function getReplyAuthor(elem) {
  do elem = elem.previousElementSibling;
  while (!elem.classList.contains("author"));
  return {username: elem.querySelector(".username").textContent, pubkey: elem.querySelector(".pubkey").textContent, avatar: elem.querySelector(".avatar").innerHTML};
}

function validateToast(event, depth) {
  if (depth == 1) {
    var data = event.target.parentElement;
  } else {
    var data = event.target.parentElement.parentElement;
  }

  if (window.mode == "PopUpVideo") {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (data.checkValidity()) {
        data.requestSubmit();
      }
    } else {
      // Do nothing
    }
  }
}

function randomBytes(bytesLength = 32) {
  if (crypto && typeof crypto.getRandomValues === "function") {
    return crypto.getRandomValues(new Uint8Array(bytesLength));
  }
  throw new Error("crypto.getRandomValues must be defined");
}

// This technically handles notes and toasts
function newNoteSubmit(event) {
  event.preventDefault();

  var data = event.target;

  var url = null;
  if (document.querySelector('#watch7-content meta[itemprop="url"]') !== null) {
    url = document.querySelector('#watch7-content meta[itemprop="url"]').content;
  } else {
    url = window.location.href;
  }

  var name = null;
  if (document.querySelector('#watch7-content meta[itemprop="name"]') !== null) {
    name = document.querySelector('#watch7-content meta[itemprop="name"]').content;
  }


  var e = {created_at: Math.floor(Date.now() / 1000), kind: 1, tags: [['r', url], ['t', 'popupvideo'], ['name', name]], content: data.message.value};

  console.log('event: ' + e);
  var privkey = document.querySelector('#keys input[name="privkey"]').value;
  console.log('privkey: ' + privkey);

  browser.runtime.sendMessage({ action: "signNote", event: e, privkey: privkey }, response => {
    console.log('Received signed note back from service worker:');
    console.log(response);

    browser.runtime.sendMessage({ action: "uploadNote", note: response}, r => {
      if (data) {
        data.reset();
      }
    });
  });
}

function displayPopUp(response) {
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

function displayPopUps(response) {
  document.querySelector('#modal-popup-content').innerHTML = '';
  for (const element of response) {
    document.querySelector('#modal-popup-content').appendChild(displayPopUp(element));
  }
}

function newNote(node, params) {
  const div = document.createElement('div');
  div.classList.add('toast-new');

  var url = '';
  var eTags = [];

  if (params && params.eTags !== undefined) {
    // This is a reply
    eTags = params.eTags;
  }

  var renderEtags = true;

  var innerHTML = `
    <div>
      <div class="content">
        <form class="toast-new-form" autocomplete="off" action="">
          <div class="middle">
            <textarea required minlength="1" name="message" placeholder="Send a message..."></textarea>
            <a style="display: none" id="show-emoji-picker-button"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--!Font Awesome Free v7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M464 256a208 208 0 1 0 -416 0 208 208 0 1 0 416 0zM0 256a256 256 0 1 1 512 0 256 256 0 1 1 -512 0zm177.3 63.4C192.3 335 218.4 352 256 352s63.7-17 78.7-32.6c9.2-9.6 24.4-9.9 33.9-.7s9.9 24.4 .7 33.9c-22.1 23-60 47.4-113.3 47.4s-91.2-24.4-113.3-47.4c-9.2-9.6-8.9-24.8 .7-33.9s24.8-8.9 33.9 .7zM144 208a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zm192-32a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"/></svg></a>
          </div>
          <button type="submit" class="toast-submit-button"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><!--!Font Awesome Free v7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M536.4-26.3c9.8-3.5 20.6-1 28 6.3s9.8 18.2 6.3 28l-178 496.9c-5 13.9-18.1 23.1-32.8 23.1-14.2 0-27-8.6-32.3-21.7l-64.2-158c-4.5-11-2.5-23.6 5.2-32.6l94.5-112.4c5.1-6.1 4.7-15-.9-20.6s-14.6-6-20.6-.9L229.2 276.1c-9.1 7.6-21.6 9.6-32.6 5.2L38.1 216.8c-13.1-5.3-21.7-18.1-21.7-32.3 0-14.7 9.2-27.8 23.1-32.8l496.9-178z"/></svg> Send</button>
        </form>
      </div>
    </div>
  `

  div.innerHTML = innerHTML;

  if (enableEmoji) {
    document.querySelector('#show-emoji-picker-button').addEventListener('click', function(event) {event.stopPropagation(); toggleEmojiWindow(event)});
  }

  var textarea = div.querySelector("textarea");
  textarea.addEventListener('keydown', (e) => validateToast(e, 2));

  var form = div.querySelector("form");
  form.addEventListener('submit', (e) => newNoteSubmit(e));

  node.append(div);
}
