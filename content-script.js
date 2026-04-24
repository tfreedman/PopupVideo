window.pubkey = null;
window.privkey = null;
window.npub = null;
window.users = {};

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

function updateProfileModal(event, pubKey) {
  parent = document.querySelector('#modal-profile .profile');
  parent.innerHTML = '';

  var hasUsername = false;
  var hasPicture = false;

  if (window.users[pubKey] !== undefined) {
    var profile = JSON.parse(window.users[pubKey].content);
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
      window.profile = profile;
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

  document.querySelector('#modal-profile .pubkey').innerHTML = window.npub;
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
          <div>PopUps</div>
          <button class="modal__close" aria-label="Close modal" data-micromodal-close></button>
        </header>
        <main class="modal__content" id="modal-popup-content">
        </main>
      </div>
    </div>
  `;
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
    sk = Uint8Array.from(window.NostrTools.nip19.decode(window.privkey).data);
    document.querySelector('#keys input[name="privkey"]').value = window.privkey;
    document.querySelector('#keys input[name="privkey"]').disabled = true;
    document.querySelector('#keys .edit-container').style.display = 'block'
    document.querySelector('#keys .submit-container').style.display = 'none';
  }

  function updateKeys() {
    try { // Basic validation - if we can generate an npub from the input, it's a valid key
      if (window.NostrTools.nip19.decode(document.querySelector('#keys input[name="privkey"]').value).data) {
        storage.local.set("privkey", document.querySelector('#keys input[name="privkey"]').value);
        storage.local.set("version", 0); // This will mismatch with the existing DB version, causing it to be blown away on reload
        document.querySelector('#keys .edit-container').style.display = 'block'
        document.querySelector('#keys .submit-container').style.display = 'none';
        window.location.reload();
      }
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

    // NIP07 unsupported
    var event = window.NostrTools.finalizeEvent(e, Uint8Array.from(window.NostrTools.nip19.decode(window.privkey).data))
    console.log("signed event without nip07: " + event);
    uploadProfileEvent(event);
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

  var updateUIInterval = window.setInterval(function(){updateUI(document.querySelector('#popup-video'))}, 100);


  if (document.querySelector('#center .modal-account-button') === null) {
    createAccountPopUp();
    var account = document.createElement("a");
    account.innerHTML = '<span><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M463 448.2C440.9 409.8 399.4 384 352 384L288 384C240.6 384 199.1 409.8 177 448.2C212.2 487.4 263.2 512 320 512C376.8 512 427.8 487.3 463 448.2zM64 320C64 178.6 178.6 64 320 64C461.4 64 576 178.6 576 320C576 461.4 461.4 576 320 576C178.6 576 64 461.4 64 320zM320 336C359.8 336 392 303.8 392 264C392 224.2 359.8 192 320 192C280.2 192 248 224.2 248 264C248 303.8 280.2 336 320 336z"/></svg> Account</span>';
    account.classList.add('modal-account-button');
    account.dataset.micromodalTrigger = "modal-account";
    document.querySelector('#center').appendChild(account);
  }

  if (document.querySelector('#center .modal-profile-button') === null) {
    createProfilePopUp();
    var profile = document.createElement("a");
    profile.innerHTML = '<span><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M463 448.2C440.9 409.8 399.4 384 352 384L288 384C240.6 384 199.1 409.8 177 448.2C212.2 487.4 263.2 512 320 512C376.8 512 427.8 487.3 463 448.2zM64 320C64 178.6 178.6 64 320 64C461.4 64 576 178.6 576 320C576 461.4 461.4 576 320 576C178.6 576 64 461.4 64 320zM320 336C359.8 336 392 303.8 392 264C392 224.2 359.8 192 320 192C280.2 192 248 224.2 248 264C248 303.8 280.2 336 320 336z"/></svg> Profile</span>';
    profile.classList.add('modal-profile-button');
    profile.dataset.micromodalTrigger = "modal-profile";
    document.querySelector('#center').appendChild(profile);
  }


  if (document.querySelector('#center .modal-popup-button') === null) {
    createPopUpPopUp();
    var popup = document.createElement("a");
    popup.innerHTML = '<span><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M40 48C26.7 48 16 58.7 16 72l0 48c0 13.3 10.7 24 24 24l48 0c13.3 0 24-10.7 24-24l0-48c0-13.3-10.7-24-24-24L40 48zM192 64c-17.7 0-32 14.3-32 32s14.3 32 32 32l288 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L192 64zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32l288 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-288 0zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32l288 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-288 0zM16 232l0 48c0 13.3 10.7 24 24 24l48 0c13.3 0 24-10.7 24-24l0-48c0-13.3-10.7-24-24-24l-48 0c-13.3 0-24 10.7-24 24zM40 368c-13.3 0-24 10.7-24 24l0 48c0 13.3 10.7 24 24 24l48 0c13.3 0 24-10.7 24-24l0-48c0-13.3-10.7-24-24-24l-48 0z"/></svg> PopUps</span>';
    popup.classList.add('modal-popup-button');
    popup.dataset.micromodalTrigger = "modal-popup";
    document.querySelector('#center').appendChild(popup);
  }

  modalInitialization();

  // Test code
  browser.runtime.sendMessage({ action: "getNostrKeys" }, response => {
    window.privkey = response.privkey;
    window.pubkey = response.pubkey;
    window.npub = response.npub;
    document.querySelector('#keys input[name="privkey"]').value = window.privkey;
    document.querySelector('#keys input[name="privkey"]').disabled = true;
    displayProfile(window.pubkey);
  });

  browser.runtime.sendMessage({ action: "getPopUps" }, response => {
    displayPopUps(response);
  });

  browser.runtime.sendMessage({ action: "getRelays" }, response => {
    window.relays = response.relays;
    displayRelays(response.relays, response.debugging);
  });

  browser.runtime.sendMessage({ action: "getUsers" }, response => {
    window.users = response.users;
  });
});

function displayProfile(pubKey) {
  if (pubKey !== undefined) {
    window.pubKey = pubKey;
    document.querySelector('#keys input[name="pubkey"]').value = pubKey;
    document.querySelector('#keys input[name="pubkey"]').disabled = true;
    document.querySelector('#keys input[name="npub"]').value = window.npub;
    document.querySelector('#keys input[name="npub"]').disabled = true;

    document.querySelector('#modal-account-content button[type="submit"]').addEventListener('click', updateProfile);

    if (window.users[pubKey] !== undefined) {
      console.log("There's profile data!");
      var profile = JSON.parse(window.users[pubKey].content);
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
      console.log(users[pubKey]);
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

    // NIP07 unsupported
    var note = window.NostrTools.finalizeEvent(e, Uint8Array.from(window.NostrTools.nip19.decode(window.privkey).data));
    console.log("signed note without nip07: " + JSON.stringify(note));
    uploadFile(formData, message, urlBox, JSON.stringify(note));
  });
};

function uploadProfileEvent(note) {
  console.log("Sending " + JSON.stringify(note));
  Promise.any(window.pool.publish(relays, note)).then(relay => {
    console.log("Uploaded kind 0 event")
    window.importToast(note, window.hasFinishedLoading);
    MicroModal.close('modal-account');
  });
}

tippy('.right > a', {
  content: (reference) => reference.dataset.tippy
});


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

  // If you're replying to a note with a global reply box, the tags from the quoted note can be found in the global reply-details div
  // If you're replying to a note with a local reply box,  the tags from the quoted note are already in the local form
  if (event.target.querySelectorAll(".reply-details .tags input[name='e']").length > 0) {
    var e = event.target.querySelectorAll(".reply-details .tags input[name='e']");
  } else {
    var e = event.target.querySelectorAll("input[name='e']");
  }

  if (data.url.value != "") {
    // Root Note
    if (window.mode == "Toastr") { // Root toasts exist for specific URLs
      var e = {created_at: Math.floor(Date.now() / 1000), kind: 1, tags: [['r', data.url.value], ['t', 'toastr'], ['subject', data.title.value]], content: data.title.value};
    } else if (window.mode == "PopUpVideo") { // Channels can map to domain names, but there's no validations
      var e = {created_at: Math.floor(Date.now() / 1000), kind: 40, tags: [['r', data.url.value], ['t', 'popupvideo']], content: JSON.stringify({'name': data.url.value})};
    }
  } else if (e[0] && (e[0].dataset.marker == "reply" || e[0].dataset.marker == "root")) {
    // Reply
    var tags = [];
    e.forEach((el) => {
      tags.push(['e', el.dataset.eventId, el.dataset.relayUrl, el.dataset.marker, el.dataset.pubkey]);
    });
    console.log('tags: ' + tags);
    var e = {created_at: Math.floor(Date.now() / 1000), kind: 42, tags: tags, content: data.message.value};
  }

  // NIP07 unsupported
  var note = window.NostrTools.finalizeEvent(e, Uint8Array.from(window.NostrTools.nip19.decode(storage.local.get('privkey')).data))
  console.log("signed note without nip07: " + note);
  uploadNote(data, note, data.parentElement.parentElement.parentElement);
}

function uploadNote(data, note, parent) {
  console.log("Sending " + JSON.stringify(note));
  Promise.any(window.pool.publish(relays, note)).then(relay => {
    // When we upload a note, normally we'd have to keep track of state.
    // If there are no messages, we'd have to remove the message asking you to be the first.
    // We'd also have to update the number of messages, etc. Or, we can cheat and just re-render everything.

    var isToast = false;
    if (window.mode == "PopUpVideo") {
      if (note["kind"] == 40) {
        note["tags"].forEach((tag) => {
          if (tag[0] == "t" && tag[1].toLowerCase().startsWith('popupvideo')) {
            isToast = true;
          }
        });
      }
    }

    if (isToast) {
      window.importToast(note, window.hasFinishedLoading);
    } else {
      window.importNote(note, window.hasFinishedLoading); // if the page has finished loading, save the DB in response to any change.
    }

    if (window.mode == "PopUpVideo") {
      if (!isToast && note["kind"] != 30078)  {
        document.querySelector('#container').scrollTo({left: 0, top: document.querySelector('#container').scrollHeight, behavior: "smooth"});
      }
    }
    if (data) {
      data.reset();
    }
  });
}

function displayPopUp(response) {
  const div = document.createElement('div');

  div.classList.add('note');

  div.id = response.id;

  var imageClass = '';

  if (data.avatarURL === null) {
    data.avatarURL = hashicon(data.pubkey).toDataURL();
    imageClass = 'hashicon';
  }

  var epochTimestamp = new Date(0);
  epochTimestamp.setUTCSeconds(data.created_at);

  var date = null;

  date = document.createElement('div');
  date.classList.add('date');

  date.innerHTML = `
    <div>
      <div class="date">${epochTimestamp.toDateString()}</div>
    </div>
  `

  var author = null;

  if (showUser == '') {
    author = document.createElement('div');
    author.classList.add('author');
    author.innerHTML = `
      <div>
        <a class="modal-profile-button" data-micromodal-trigger="modal-profile" href="#">
          <div class="avatar">
            <img src="${data.avatarURL}" class="${imageClass}"/>
          </div>
        </a>
        <div class="content">
          <header>
            <div class="details">
              <a class="modal-profile-button" data-micromodal-trigger="modal-profile" href="#"><span class="username">${data.username}</span></a>
            </div>
            <a class="modal-profile-button" data-micromodal-trigger="modal-profile" href="#"><div class="pubkey">${window.NostrTools.nip19.npubEncode(data.pubkey)}</div></a>
          </header>
        </div>
      </div>
    `

    var links = author.querySelectorAll("a");
    links.forEach(i => {
      i.addEventListener('click', (e) => updateProfileModal(e, data.pubkey));
    });
  }

  var innerHTML = `
    <div>
      <div class="content">
        <div class="created_at" style="${showTime}"><time data-tippy="${epochTimestamp.toUTCString()}" datetime="${epochTimestamp}">${(epochTimestamp.getHours() < 10 ? '0' : '') + epochTimestamp.getHours()}:${(epochTimestamp.getMinutes() < 10 ? '0' : '') + epochTimestamp.getMinutes()}</time></div>
        <div class="caption">`

      if (isReply && referencedNote !== undefined) {
        var replyUsername = 'Unknown';
        var replyAvatarURL = null;
        var imageClass = '';

        if (params.users[referencedNote.pubkey]) {
          var replyUser = JSON.parse(params.users[referencedNote.pubkey].content);
          if (typeof replyUser.picture !== 'undefined') {
            replyAvatarURL = replyUser.picture;
          }
          if (typeof replyUser.name !== 'undefined') {
            replyUsername = replyUser.name;
          }
        }
        if (replyAvatarURL === null) {
          replyAvatarURL = hashicon(referencedNote.pubkey).toDataURL();
          imageClass = 'hashicon';
        }

        innerHTML += `
          <div class="context">
            <div class="avatar">
              <img src="${replyAvatarURL}" class="${imageClass}"/>
            </div>
            <span class="username">${replyUsername}</span> <span class="pubkey">(${window.NostrTools.nip19.npubEncode(referencedNote.pubkey)})</span>
            <br /><a class="reply-context">${referencedNote.content.replace(/\n/g, '<br />')}</a>
          </div>`
      }

      innerHTML += `
      ${linkifyAndEmbed(data.message.replace(/\n/g, '<br />'))}
        </div>
        <footer></footer>
        <div class="tags hidden">
          ${eTagString}
        </div>
      </div>
    </div>
  `

  div.innerHTML = innerHTML;

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

  link.innerHTML = '<img src="code.svg" alt="Copy Raw" />';
  div.querySelector('footer').prepend(link)
  return div
}

function displayPopUps(response) {
  document.querySelector('#modal-popup-content').innerHTML = '';
  document.querySelector('#modal-popup-content').appendChild(displayPopUp(response));
}

function newNote(node, params) {
  const div = document.createElement('div');
  div.classList.add('toast-new');

  var url = '';
  var eTags = [];

  if (params.eTags !== undefined) {
    // This is a reply
    eTags = params.eTags;
  }

  var renderEtags = true;

  var innerHTML = `
    <div>
      <div class="content">
        <form class="toast-new-form" autocomplete="off" action="">
          <div class="middle">
            <div class="reply-details hidden">
              <div class="tags"></div>
              <button type="button" class="valid reply-cancel">×</button>
              <p class="heading"></p>
              <div class="context">
                <div class="avatar"></div>
                <span class="username"></span> <span class="pubkey"></span>
                <br />
                <div class="content"></div>
              </div>
            </div>

            <input type="hidden" name="url" value="${url}" placeholder="URL" />
          `
            renderEtags && eTags.forEach(function (tag, index) {
              innerHTML += `
            <input type="hidden" name="e" data-event-id="${tag[1]}" data-relay-url="${tag[2]}" data-marker="${tag[3]}" data-pubkey="${tag[4]}" />
          `
            })

         innerHTML += `
            <textarea required minlength="1" name="message" placeholder="Send a message..."></textarea>
            <a id="show-emoji-picker-button"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--!Font Awesome Free v7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M464 256a208 208 0 1 0 -416 0 208 208 0 1 0 416 0zM0 256a256 256 0 1 1 512 0 256 256 0 1 1 -512 0zm177.3 63.4C192.3 335 218.4 352 256 352s63.7-17 78.7-32.6c9.2-9.6 24.4-9.9 33.9-.7s9.9 24.4 .7 33.9c-22.1 23-60 47.4-113.3 47.4s-91.2-24.4-113.3-47.4c-9.2-9.6-8.9-24.8 .7-33.9s24.8-8.9 33.9 .7zM144 208a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zm192-32a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"/></svg></a>
          </div>
          <button type="submit" class="toast-submit-button"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><!--!Font Awesome Free v7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M536.4-26.3c9.8-3.5 20.6-1 28 6.3s9.8 18.2 6.3 28l-178 496.9c-5 13.9-18.1 23.1-32.8 23.1-14.2 0-27-8.6-32.3-21.7l-64.2-158c-4.5-11-2.5-23.6 5.2-32.6l94.5-112.4c5.1-6.1 4.7-15-.9-20.6s-14.6-6-20.6-.9L229.2 276.1c-9.1 7.6-21.6 9.6-32.6 5.2L38.1 216.8c-13.1-5.3-21.7-18.1-21.7-32.3 0-14.7 9.2-27.8 23.1-32.8l496.9-178z"/></svg> Send</button>
        </form>
      </div>
    </div>
  `

  div.innerHTML = innerHTML;

  var textarea = div.querySelector("textarea");
  textarea.addEventListener('keydown', (e) => validateToast(e, 2));

  var form = div.querySelector("form");
  form.addEventListener('submit', (e) => newNoteSubmit(e));

  node.append(div);
}
