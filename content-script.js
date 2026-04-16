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


  createAccountPopUp();

  var account = document.createElement("a");
  account.innerHTML = '<span><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M463 448.2C440.9 409.8 399.4 384 352 384L288 384C240.6 384 199.1 409.8 177 448.2C212.2 487.4 263.2 512 320 512C376.8 512 427.8 487.3 463 448.2zM64 320C64 178.6 178.6 64 320 64C461.4 64 576 178.6 576 320C576 461.4 461.4 576 320 576C178.6 576 64 461.4 64 320zM320 336C359.8 336 392 303.8 392 264C392 224.2 359.8 192 320 192C280.2 192 248 224.2 248 264C248 303.8 280.2 336 320 336z"/></svg> Account</span>';
  account.classList.add('modal-account-button');
  account.dataset.micromodalTrigger = "modal-account";
  document.querySelector('#center').appendChild(account);

  modalInitialization();

  // Test code
  browser.runtime.sendMessage({ action: "getNostrKeys" }, response => {
    console.log(response);
  });

  browser.runtime.sendMessage({ action: "getRelays" }, response => {
    window.relays = response.relays;
    displayRelays(response.relays, response.debugging);
  });
});
