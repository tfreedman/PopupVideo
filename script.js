window.mode = "PopUpVideo";
var users = {};
window.pool = null;
window.version = 6;
window.settings = 0;
window.hasFinishedLoading = false;
window.isConnected = false;
var pubKey;
var snd = new Audio("/pop.mp3");
window.lastDrawMode = null;

tippy('.right > a, #search', {
  content: (reference) => reference.dataset.tippy
});

document.querySelector('#search').addEventListener("click", toggleSearchBox)
document.querySelector('#xmark').addEventListener("click", toggleSearchBox)

var formInputs = document.querySelectorAll("#profile form input, #profile form textarea");

formInputs.forEach(i => {
  i.addEventListener('keyup', (e) => validateProfile(e));
});

toggleSearchBox();

function toggleConnectionState(state) {
  if (state && window.isConnected !== true) {
    window.isConnected = true;
    console.log('Connected to Nostr!');
  } else if (!state && window.isConnected !== false) {
    window.isConnected = false;
    console.log('Disconnected from Nostr');
  }
}

config = {
  locateFile: filename => `${filename}`
}

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

function syncDatabase() {
  var dbstr = toBinString(window.db.export());
  window.localStorage.setItem(window.mode + ".sqlite", dbstr);
}

function exportSettings() {
  var settings = new Object();
  if (window.mode == "YakClub") {
    // This currently only exports favourites and alerts

    // Favourites

    settings["toasts"] = [];
    var stmt = window.db.prepare("SELECT * FROM toasts");

    while(stmt.step()) {
      const row = stmt.getAsObject();
      if (row.favourite) {
        settings["toasts"].push({id: row.id, favourite: true})
      }
    }

    // Alerts

    settings["alerts"] = [];
    var stmt = window.db.prepare("SELECT * FROM alerts");

    while(stmt.step()) {
      const row = stmt.getAsObject();
      if (row.read) {
        settings["alerts"].push({id: row.id, read: true})
      }
    }
  }

  console.log(JSON.stringify(settings));
  if (typeof window.nostr !== 'undefined') {
    // NIP07 supported
    window.nostr.nip44.encrypt(window.pubKey, JSON.stringify(settings)).then(ciphertext => {
      var e = {created_at: Math.floor(Date.now() / 1000), kind: 30078, tags: [['d', window.mode]], content: ciphertext};
      window.nostr.signEvent(e).then(note => {
        console.log("signed note via nip07: " + note);
        uploadNote(null, note, null);
      })
    })
  } else {
    // NIP07 unsupported
    var convoKey = window.NostrTools.nip44.getConversationKey(window.NostrTools.nip19.decode(localStorage.getItem('privkey')).data, window.pubKey);
    var ciphertext = window.NostrTools.nip44.v2.encrypt(JSON.stringify(settings), convoKey, randomBytes(32));
    var e = {created_at: Math.floor(Date.now() / 1000), kind: 30078, tags: [['d', window.mode]], content: ciphertext};
    var note = window.NostrTools.finalizeEvent(e, Uint8Array.from(window.NostrTools.nip19.decode(localStorage.getItem('privkey')).data))
    console.log("signed note without nip07: " + note);
    uploadNote(null, note, null);
  }
}

function importSettings(note) {
  // This function imports a plaintext note. If you have an encrypted note, it has to be decrypted upstream.
  settings = JSON.parse(JSON.parse(note)['content']);
  created_at = JSON.parse(note)['created_at'];

  console.log('attempting to import settings: ');
  console.log(settings);

  if (window.mode == "YakClub") {
    // This currently only imports favourites and alerts

    // Favourites
    Object.keys(settings["toasts"]).forEach(key => {
      var toast = settings["toasts"][key];
      var stmt = window.db.prepare("SELECT * FROM toasts WHERE id = $id");
      stmt.bind({$id: toast.id});
      var result = null;
      while(stmt.step()) {
        result = toast.id;
        console.log('setting favourite on toast ' + toast.id);
        window.db.run("UPDATE toasts SET favourite = ? WHERE id = ?", [toast.favourite, toast.id]);
      }
      if (result === null) {
        console.log('No match for ' + toast.id + ' in toasts table');
      }
    });

    // Alerts
    Object.keys(settings["alerts"]).forEach(key => {
      var note = settings["alerts"][key];
      var stmt = window.db.prepare("SELECT * FROM alerts WHERE id = $id");
      stmt.bind({$id: note.id});
      var result = null;
      while(stmt.step()) {
        result = note.id;
        console.log('setting read on alert ' + note.id);
        window.db.run("UPDATE alerts SET read = ? WHERE id = ?", [note.read, note.id]);
      }
      if (result === null) {
        console.log('No match for ' + note.id + ' in alerts table');
      }
    });

  }
  // TODO: redraw UI so that the settings that were imported are actually visible

  // We don't want to re-import the settings we just exported, so we make sure the app thinks
  // the current settings are newer by adding 1 to the timestamp
  window.localStorage.setItem("settings", JSON.stringify(created_at + 1));
  window.settings = note['created_at'] + 1;

  syncDatabase();
}

function toBinArray(str) {
  var l = str.length,
    arr = new Uint8Array(l);
  for (var i = 0; i < l; i++) arr[i] = str.charCodeAt(i);
  return arr;
}

function toBinString(arr) {
  var uarr = new Uint8Array(arr);
  var strings = [], chunksize = 0xffff;
  // There is a maximum stack size. We cannot call String.fromCharCode with as many arguments as we want
  for (var i = 0; i * chunksize < uarr.length; i++) {
    strings.push(String.fromCharCode.apply(null, uarr.subarray(i * chunksize, (i + 1) * chunksize)));
  }
  return strings.join('');
}

function getRelays() {
  var default_relays = ["wss://relay.toastr.net", "wss://purplepag.es", "wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net"];
  var relays = [];
  var override_relays = true;

  if (override_relays) {
    var relays = ["wss://toastr.tylerfreedman.com", "wss://purplepag.es"];
    document.querySelector('#modal-account #relays .message').innerHTML = 'Overriding NIP-07 Relays for debugging purposes';
  } else {
    if (typeof window.nostr !== 'undefined') {
      // Detected NIP-07 support
      document.querySelector('#modal-account #relays .message').innerHTML = 'Retrieving relays via NIP-07';
      window.nostr.getRelays().then(r => {
        for (const [key, value] of Object.entries(r)) {
          relays.push(key);
        }
        displayRelays(relays);
      })
    } else {
      relays = relays.concat(default_relays);
    }
  }
  displayRelays(relays);
  return relays;
}

function displayRelays(relays) {
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

function editKeys() {
  updateProfile(); // dunno why this was here originally, but let's not break it for now
  document.querySelector('#keys .edit-container').style.display = 'none'
  document.querySelector('#keys .submit-container').style.display = 'block';
  document.querySelector('#keys input[name="privkey"]').disabled = false;
}

function cancelUpdateKeys() {
  sk = Uint8Array.from(window.NostrTools.nip19.decode(localStorage.getItem('privkey')).data);
  document.querySelector('#keys input[name="privkey"]').value = localStorage.getItem('privkey');
  document.querySelector('#keys input[name="privkey"]').disabled = true;
  document.querySelector('#keys .edit-container').style.display = 'block'
  document.querySelector('#keys .submit-container').style.display = 'none';
}

function updateKeys() {
  try { // Basic validation - if we can generate an npub from the input, it's a valid key
    if (window.NostrTools.nip19.decode(document.querySelector('#keys input[name="privkey"]').value).data) {
      localStorage.setItem("privkey", document.querySelector('#keys input[name="privkey"]').value);
      window.localStorage.setItem("version", 0); // This will mismatch with the existing DB version, causing it to be blown away on reload
      document.querySelector('#keys .edit-container').style.display = 'block'
      document.querySelector('#keys .submit-container').style.display = 'none';
      window.location.reload();
    }
  } catch (e) {
    alert('Invalid nsec');
  }
}

document.querySelector('#keys .edit').addEventListener('click', editKeys);
document.querySelector('#keys .cancel').addEventListener('click', cancelUpdateKeys);
document.querySelector('#keys .update').addEventListener('click', updateKeys);

function displayProfile(pubKey) {
  if (pubKey !== undefined) {
    window.pubKey = pubKey;
    document.querySelector('#keys input[name="pubkey"]').value = pubKey;
    document.querySelector('#keys input[name="pubkey"]').disabled = true;
    document.querySelector('#keys input[name="npub"]').value = window.NostrTools.nip19.npubEncode(pubKey);
    document.querySelector('#keys input[name="npub"]').disabled = true;

    document.querySelector('#profile button[type="submit"]').addEventListener('click', updateProfile);

    if (window.users[pubKey] !== undefined) {
      console.log("There's profile data!");
      var profile = JSON.parse(window.users[pubKey].content);
      if (profile.name !== undefined) {
        document.querySelector('#profile input[name="name"]').value = profile.name;
      }
      if (profile.displayName !== undefined) {
        document.querySelector('#profile input[name="display_name"]').value = profile.displayName;
      }
      if (profile.website !== undefined) {
        document.querySelector('#profile input[name="website"]').value = profile.website;
      }
      if (profile.about !== undefined) {
        document.querySelector('#profile textarea[name="about"]').value = profile.about;
      }
      if (profile.banner !== undefined) {
        document.querySelector('#profile input[name="banner"]').value = profile.banner;
      }
      if (profile.picture !== undefined) {
        document.querySelector('#profile input[name="picture"]').value = profile.picture;
        if (document.querySelector('#profile input[name="picture"]').value !== "") {
          document.querySelector('#profile .avatar').src = document.querySelector('#profile input[name="picture"]').value
          document.querySelector('#topbar nav .avatar').src = document.querySelector('#profile input[name="picture"]').value
        } else {
          document.querySelector('#profile .avatar').src = 'circle-user.svg'
          document.querySelector('#topbar nav .avatar').src = 'circle-user.svg'
        }
      }
      console.log(users[pubKey]);
    } else {
      console.log("No profile data :(");
    }
  }
}

function getReplyAuthor(elem) {
  do elem = elem.previousElementSibling;
  while (!elem.classList.contains("author"));
  return {username: elem.querySelector(".username").textContent, pubkey: elem.querySelector(".pubkey").textContent, avatar: elem.querySelector(".avatar").innerHTML};
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
      document.querySelector('#profile .banner-upload-group .banner-upload').classList.add('active')
      document.querySelector('#profile .banner-upload-group .banner-url').classList.remove('active')
      document.querySelector('#profile .banner-upload-group .upload').classList.remove('hidden')
      document.querySelector('#profile .banner-upload-group .url').classList.add('hidden')
    } else {
      document.querySelector('#profile .banner-upload-group .banner-url').classList.add('active')
      document.querySelector('#profile .banner-upload-group .banner-upload').classList.remove('active')
      document.querySelector('#profile .banner-upload-group .url').classList.remove('hidden')
      document.querySelector('#profile .banner-upload-group .upload').classList.add('hidden')
    }
  });
});

document.querySelector('#profile .picture-upload-group input[type="file"]').addEventListener('change', (e) => {
  const files = document.querySelector('#profile .picture-upload-group input[type="file"]').files;
  const message = document.querySelector('#profile .picture-upload-group .picture-message');
  const urlBox = document.querySelector('#profile .picture-upload-group input[name="picture"]');

  if (files.length > 0) {
    signNoteForFileUpload(files, message, 'avatar', urlBox);
  }
});

document.querySelector('#profile .banner-upload-group input[type="file"]').addEventListener('change', (e) => {
  const files = document.querySelector('#profile .banner-upload-group input[type="file"]').files;
  const message = document.querySelector('#profile .banner-upload-group .banner-message');
  const urlBox = document.querySelector('#profile .banner-upload-group input[name="banner"]');

  if (files.length > 0) {
    signNoteForFileUpload(files, message, 'banner', urlBox);
  }
});

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
      message.textContent = '✅';
      message.classList.add('success');
    } else {
      message.textContent = '❌';
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

    if (typeof window.nostr !== 'undefined') {
      // NIP07 supported
      window.nostr.signEvent(e).then(note => {
        console.log("signed note via nip07: " + note.toString());
        uploadFile(formData, message, urlBox, JSON.stringify(note));
      })
    } else {
      // NIP07 unsupported
      var note = window.NostrTools.finalizeEvent(e, Uint8Array.from(window.NostrTools.nip19.decode(localStorage.getItem('privkey')).data));
      console.log("signed note without nip07: " + JSON.stringify(note));
      uploadFile(formData, message, urlBox, JSON.stringify(note));
    }
  });
};

function updateProfile(event) {
  if (event !== undefined) {
    event.preventDefault();
  }
  var content = {};
  var container = document.querySelector('#profile');
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

  if (typeof window.nostr !== 'undefined') {
    // NIP07 supported
    window.nostr.signEvent(e).then(event => {
      console.log("signed event via nip07: " + event);
      uploadProfileEvent(event);
    })
  } else {
  // NIP07 unsupported
    var event = window.NostrTools.finalizeEvent(e, Uint8Array.from(window.NostrTools.nip19.decode(localStorage.getItem('privkey')).data))
    console.log("signed event without nip07: " + event);
    uploadProfileEvent(event);
  }
}

function uploadProfileEvent(note) {
  console.log("Sending " + JSON.stringify(note));
  Promise.any(window.pool.publish(relays, note)).then(relay => {
    console.log("Uploaded kind 0 event")
    window.importToast(note, window.hasFinishedLoading);
    MicroModal.close('modal-account');
  });
}

function resizeTextArea(event) {
  if (event) {
    event.target.style.height = '';
    event.target.style.height = event.target.scrollHeight + 'px';
  }

  var computedHeight = document.querySelector('footer#footer').scrollHeight;
  if (computedHeight > 89) {
    var newHeight = (216 + computedHeight);
    document.querySelector('#container').style.height = `calc(100dvh - ${newHeight}px)`;
  } else {
    document.querySelector('#container').style.height = `calc(100dvh - 305px)`;
  }
}

function validateToast(event, depth) {
  if (depth == 1) {
    var data = event.target.parentElement;
  } else {
    var data = event.target.parentElement.parentElement;
  }

  if (window.mode == "Toastr") {
    //Do nothing
  } else if (window.mode == "PopUpVideo") {
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

function validateProfile(event) {
  event.preventDefault();

  var data = event.target.parentElement.parentElement;

  if (data.checkValidity()) {
    data.querySelector('#profile button[type="submit"]').disabled = false;
  } else {
    data.querySelector('#profile button[type="submit"]').disabled = true;
  }
}


function deleteReplyContent(event) {
  event.originalTarget.parentElement.querySelector('.heading').innerHTML = '';
  event.originalTarget.parentElement.querySelector('.username').innerHTML = '';
  event.originalTarget.parentElement.querySelector('.content').innerHTML = '';
  event.originalTarget.parentElement.querySelector('.tags').innerHTML = '';
  event.originalTarget.parentElement.classList.add('hidden');
  resizeTextArea();
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

  if (typeof window.nostr !== 'undefined') {
    // NIP07 supported
    window.nostr.signEvent(e).then(note => {
      console.log("signed note via nip07: " + note);
      uploadNote(data, note, data.parentElement.parentElement.parentElement);
    })
  } else {
  // NIP07 unsupported
    var note = window.NostrTools.finalizeEvent(e, Uint8Array.from(window.NostrTools.nip19.decode(localStorage.getItem('privkey')).data))
    console.log("signed note without nip07: " + note);
    uploadNote(data, note, data.parentElement.parentElement.parentElement);
  }
}

function uploadNote(data, note, parent) {
  console.log("Sending " + JSON.stringify(note));
  Promise.any(window.pool.publish(relays, note)).then(relay => {
    // When we upload a note, normally we'd have to keep track of state.
    // If there are no messages, we'd have to remove the message asking you to be the first.
    // We'd also have to update the number of messages, etc. Or, we can cheat and just re-render everything.

    var isToast = false;
    if (window.mode == "Toastr") {
      note["tags"].forEach((tag) => {
        if (tag[0] == "t" && tag[1].toLowerCase().startsWith('toastr')) {
          isToast = true;
        }
      });
    } else if (window.mode == "PopUpVideo") {
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
      document.getElementById('search-bar').value = window.NostrTools.nip19.noteEncode(note["id"]);
      history.pushState({hash: note["id"], title: document.title}, '', '#' + note["id"]);
    } else {
      window.importNote(note, window.hasFinishedLoading); // if the page has finished loading, save the DB in response to any change.
    }

    if (window.mode == "Toastr") {
      searchResults(document.getElementById('search-bar').value);
    } else if (window.mode == "PopUpVideo") {
      searchResults(document.getElementById('search-bar').value);
      if (!isToast && note["kind"] != 30078)  {
        document.querySelector('#container').scrollTo({left: 0, top: document.querySelector('#container').scrollHeight, behavior: "smooth"});
      }
    }
    if (data) {
      data.reset();
    }
  });
}
//TODO: remove users
function displayToast(parent, data, note, params) {
  const div = document.createElement('div');

  var root = null;
  var hash = null;
  var eTags = [];
  var isReply = false;
  var inReplyTo;
  var marker;
  note["tags"].forEach((tag) => {
    if (tag[0] == "e") {
      eTags.push(tag);
      if (tag[3] && tag[3] == 'root') {
        root = tag[1];
        marker = 'reply'; // If there's a root e tag defined, mark it as a reply instead.
      }
      if (tag[3] && tag[3] == 'reply') {
        inReplyTo = tag[1];
        isReply = true;
      }
    }
  });
  if (note) {
    eTags.push(['e', note.id, '', marker, note.pubkey])
  }

  // When we render a note that happens to be a reply, we embed the context from the referenced note
  // Only the last reply counts - if that note was also a reply, we ignore it.
  if (isReply) {
    stmt = window.db.prepare("SELECT * FROM notes WHERE id = $id");
    stmt.bind({$id: inReplyTo});

    var referencedNote;
    while(true) {
      if (stmt.step()) {
        row = stmt.getAsObject();
        referencedNote = JSON.parse(row.note);
      } else {
        break;
      }
    }
  }

  if (root) {
    hash = window.NostrTools.nip19.noteEncode(root) + "-" + window.NostrTools.nip19.noteEncode(note["id"]);
  } else {
    hash = window.NostrTools.nip19.noteEncode(note["id"])
  }

  div.classList.add('note');

  div.id = hash;

  if (document.getElementById('search-bar').value == hash) {
    div.classList.add('highlight');
  }

  var epoch_timestamp = new Date(0);
  epoch_timestamp.setUTCSeconds(data.created_at);

  var imageClass = '';

  if (data.avatarURL === null) {
    data.avatarURL = hashicon(data.pubkey).toDataURL();
    imageClass = 'hashicon';
  }

  var eTagString = '';
  eTags.forEach(function (tag, index) {
    eTagString += `<input type="hidden" name="e" data-event-id="${tag[1]}" data-relay-url="${tag[2]}" data-marker="${tag[3]}" data-pubkey="${tag[4]}" />`
  })

  // If a note was written by the same user, we can skip displaying their npub / username again - necessary in chat mode
  var showUser = '';
  if (params.lastPubkey == data.pubkey) {
    showUser = 'hidden';
  }

  // If a note was written within a short timespan of the previous note, we can skip displaying the timestamp.
  var showTime = '';
  if (params.lastTimestamp + 1 > data.created_at) {
    showTime = 'opacity: 0';
    showUser = '';
  }

  var lastTimestampDate = new Date(0);
  lastTimestampDate.setUTCSeconds(params.lastTimestamp)

  var epochTimestamp = new Date(0);
  epochTimestamp.setUTCSeconds(data.created_at);

  var date = null;

  if (lastTimestampDate.toDateString() != epochTimestamp.toDateString()) {
    date = document.createElement('div');
    date.classList.add('date');

    var epochTimestamp = new Date(0);
    epochTimestamp.setUTCSeconds(data.created_at);

    date.innerHTML = `
      <div>
        <div class="date">${epochTimestamp.toDateString()}</div>
      </div>
    `
  }

  if (params.read && params.read == false) {
    div.classList.add('unread');
  } else if (params.read && params.read == true) {
    div.classList.add('read')
  }

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

    if (params.read && params.read == false) {
      author.classList.add('unread');
    } else if (params.read && params.read == true) {
      author.classList.add('read')
    }

    var links = author.querySelectorAll("a");
    links.forEach(i => {
      i.addEventListener('click', (e) => updateProfileModal(e, data.pubkey));
    });
  }

  var innerHTML = `
    <div>
      <div class="content">
        <div class="created_at" style="${showTime}"><time data-tippy="${epochTimestamp.toUTCString()}" datetime="${epoch_timestamp}">${(epochTimestamp.getHours() < 10 ? '0' : '') + epochTimestamp.getHours()}:${(epochTimestamp.getMinutes() < 10 ? '0' : '') + epochTimestamp.getMinutes()}</time></div>
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

  const permalink = document.createElement('a');
  permalink.innerHTML = '<img src="link.svg" alt="Permalink" />';

  tippy(permalink, {
    content: 'Permalink'
  });

  permalink.onclick = function(event) {
    event.preventDefault();

    location.hash = '#' + hash;

    Array.from(document.querySelectorAll('.highlight')).forEach(
      (el) => el.classList.remove('highlight')
    );

    div.classList.add('highlight');
  }


  // If we're looking at an alert on the alerts page, we need a jump-to-context button
  if (params.mode == "alerts") {
    const expand = document.createElement('a');
    expand.innerHTML = '<img src="expand.svg" alt="View Context" />';

    tippy(expand, {
      content: 'View Context'
    });

    expand.onclick = function(event) {
      event.preventDefault();

      document.getElementById('search-bar').value = hash;
      searchResults(document.getElementById('search-bar').value);

      location.hash = '#' + hash;

      Array.from(document.querySelectorAll('.highlight')).forEach(
        (el) => el.classList.remove('highlight')
      );

      div.classList.add('highlight');
    }
    div.querySelector('footer').prepend(expand)
  }


  const reply = document.createElement('a');
  reply.innerHTML = '<img src="reply.svg" alt="Reply" />';

  tippy(reply, {
    content: 'Reply'
  });

  reply.onclick = function() {
    if (window.mode == "Toastr") {
      var form = this.parentElement.parentElement.parentElement.nextSibling.querySelector('& > .toast-new');
    } else if (window.mode == "PopUpVideo") {
      var form = document.querySelector('#footer .toast-new-form');
      form.querySelector('.reply-details .heading').innerHTML = 'Replying to:';

      var replyAuthor = getReplyAuthor(this.parentElement.parentElement.parentElement.parentElement);
      form.querySelector('.reply-details .username').innerHTML = replyAuthor.username;
      form.querySelector('.reply-details .pubkey').innerHTML = replyAuthor.pubkey;
      form.querySelector('.reply-details .avatar').innerHTML = replyAuthor.avatar;

      form.querySelector('.reply-details .content').innerHTML = this.parentElement.parentElement.querySelector('.content .caption').innerHTML;
      form.querySelector('.reply-details .tags').innerHTML = this.parentElement.parentElement.querySelector('.content .tags').innerHTML;
      form.querySelector('.reply-details').classList.remove('hidden');
      resizeTextArea();
      document.querySelector('#yak').scrollIntoView({ block: 'end',  behavior: 'smooth' });
    }
  }

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
  div.querySelector('footer').prepend(reply)
  div.querySelector('footer').prepend(permalink)

  if (isReply && referencedNote !== undefined) {
    const replyContext = div.querySelector('.reply-context');
    replyContext.onclick = function(event) {
      document.querySelector('#' + window.NostrTools.nip19.noteEncode(root) + '-' + window.NostrTools.nip19.noteEncode(referencedNote.id)).scrollIntoView();
    }
  }

  if (date !== null) {
    parent.appendChild(date);
  }

  // Chat messages display the author above the post, to allow for multiple posts from one person in a row.
  if (author !== null) {
    parent.appendChild(author);
  }

  parent.appendChild(div)
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

initSqlJs(config).then(function(SQL){
  window.importToast = function(value, immediateWrite) {
    var note = JSON.stringify(value);

    var taggedUrl = '';
    var rValue = '';
    value["tags"].forEach((tag) => {
      if (tag[0] == "r") {
        if (tag[1].toLowerCase().startsWith('http')) {
          taggedUrl = tag[1];
        }
        rValue = tag[1];
      }
    });

    if (window.mode == "Toastr") {
      const url = new URL(taggedUrl);
      var domain = url.hostname.toLowerCase();
    } else if (window.mode == "PopUpVideo") {
      // just use the room name as the raw value
      var url = rValue // is this actually used anywhere?;
      var domain = JSON.parse(value["content"])["name"].toLowerCase();
    }

    console.log('Inserting ' + value['id'] + ' - (' + domain + ') into Toasts DB...');
    db.run("INSERT OR IGNORE INTO toasts (id, created_at, domain, url, pubkey, kind, note, favourite, read_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [value['id'], value['created_at'], domain, taggedUrl, value['pubkey'], value['kind'], note, false, 0]);

    if (immediateWrite) {
      syncDatabase();
    }
  }

  window.importNote = function(value, immediateWrite) {
    var dirty = false;
    var note = JSON.stringify(value);
    if (value['kind'] == 0) {
      var existing_note = db.exec("SELECT created_at FROM notes WHERE pubkey = ? AND kind = 0", [value['pubkey']])
      if (existing_note.length == 0) {
        console.log('Inserting ' + value['id'] + ' into Notes DB...');
        window.users[value['pubkey']] = value;
        if (value['pubkey'] == window.pubKey) {
          displayProfile(window.pubKey);
        }
        db.run("INSERT INTO notes (id, created_at, pubkey, kind, note) VALUES (?, ?, ?, ?, ?)", [value['id'], value['created_at'], value['pubkey'], value['kind'], note]);
        dirty = true;
        console.log('Adding ' + value['pubkey'] + ' to window.users...');
      } else {
        if (existing_note[0].values[0][0] < value['created_at']) {
          console.log('Updating ' + value['id'] + ' into Notes DB...');
          window.users[value['pubkey']] = value;
          if (value['pubkey'] == window.pubKey) {
            displayProfile(window.pubKey);
          }
          db.exec("UPDATE notes SET id = ?, created_at = ?, kind = ?, note = ? WHERE pubkey = ? AND kind = 0", [value['id'], value['created_at'], value['kind'], note, value['pubkey']]);
          dirty = true;
          console.log('Adding ' + value['pubkey'] + ' to window.users...');
        } else {
          console.log("Received an older kind 0 event than what's already in the database");
        }
      }
    } else if (value['kind'] == 42) {
      // Confirm it isn't a toast...
      var isToast = false;
      value["tags"].forEach((tag) => {
        if (tag[0] == "t" && tag[1].toLowerCase().startsWith('toastr')) {
          console.log("This is a toast - rejecting from Notes DB")
          isToast = true;
        }
      });

      if (isToast) {
        return
      }

      var parent = '';
      var shouldAlert = false;
      // The time a room was created is mostly irrelevant - we need the time the last message in the room was received.
      // Every time we get a chat message, figure out what room it belongs to, and update that room's timestamp

      value["tags"].forEach((tag) => {
        if (tag[0] == "e") {
          if (tag[3] == "root") {
            parent = tag[1];
          }

          // if the e Tag refers to an event we wrote
          // AND we didn't write the event
          // AND it isn't a root e Tag, because we don't care about rooms we created
          if (tag[4] && tag[4] == window.pubKey && value["pubkey"] != window.pubKey && tag[3] != "root") {
            shouldAlert = true;
          }
        }

        // if the p Tag refers to us
        // AND we didn't write the event

        if (tag[0] == "p") {
          if (tag[1] == window.pubKey && value["pubkey"] != window.pubKey) {
            shouldAlert = true;
          }
        }
      });

      console.log('Inserting ' + value['id'] + ' into Notes DB...');
      db.run("INSERT OR IGNORE INTO notes (id, created_at, pubkey, kind, note) VALUES (?, ?, ?, ?, ?)", [value['id'], value['created_at'], value['pubkey'], value['kind'], note]);

      if (shouldAlert) {
        db.run("INSERT OR IGNORE INTO alerts (id, created_at, pubkey, note, read) VALUES (?, ?, ?, ?, ?)", [value['id'], value['created_at'], value['pubkey'], note, false]);
        updateAlertsIndicator();
      }

      // Update the room's timestamp on each message received
      db.run("UPDATE toasts SET created_at = MAX(created_at, ?) WHERE id = ?", [value['created_at'], parent]);

      // Mark a room as read if the message we just received came from us
      if (value['pubkey'] == window.pubKey) {
        console.log('updating read indicator of ' + parent + ' to ' + value['created_at']);
        db.run("UPDATE toasts SET read_at = MAX(read_at, ?) WHERE id = ?", [value['created_at'], parent]);
      }

      dirty = true;
      console.log('Adding ' + value['id'] + ' to notes');
    } else if (value['kind'] == 30078 && value["pubkey"] == window.pubKey) { // NIP-78 - arbitrary custom app data
      var existing_timestamp = 0;

      var stmt = db.prepare("SELECT * FROM notes WHERE pubkey = $pubkey AND kind = 30078");
      stmt.bind({$pubkey: window.pubKey});

      while(stmt.step()) {
        const row = stmt.getAsObject();
        var existing_timestamp = row.created_at;
      }

      var okayToImport = false;
      value["tags"].forEach((tag) => {
        if (tag[0] == "d" && tag[1] == window.mode) { // Only import settings from this specific application
          okayToImport = true;
        }
      });

      if (okayToImport) {
        if (existing_timestamp === 0) {
          console.log('Inserting ' + value['id'] + ' into Notes DB...');
          db.run("INSERT INTO notes (id, created_at, pubkey, kind, note) VALUES (?, ?, ?, ?, ?)", [value['id'], value['created_at'], value['pubkey'], value['kind'], note]);
          dirty = true;
        } else if (existing_timestamp < value['created_at']) {
          console.log('Updating ' + value['id'] + ' into Notes DB...');
          db.run("UPDATE notes SET id = ?, created_at = ?, kind = ?, note = ? WHERE pubkey = ? AND created_at < ? AND kind = 30078", [value['id'], value['created_at'], value['kind'], note, value['pubkey'], value['created_at']]);
          dirty = true;
        } else {
          console.log('not importing settings - this event is older than ' + existing_timestamp)
        }
        if (dirty) {
          // Parse the settings inside the note, and import them into the DB
          if (value['created_at'] < JSON.parse(window.localStorage.getItem("settings"))) {
            console.log('importing setting - time delta = ' + JSON.parse(window.localStorage.getItem("settings")) - value['created_at'])

            // Notes are encrypted using NIP-44. We need to first decrypt it, then parse it.
            if (typeof window.nostr !== 'undefined') {
              // NIP07 supported
              window.nostr.nip44.decrypt(window.pubKey, value['content']).then(plaintext => {
                value['content'] = plaintext;
                importSettings(JSON.stringify(value));
              })
            } else {
              // NIP07 unsupported
              var convoKey = window.NostrTools.nip44.getConversationKey(window.NostrTools.nip19.decode(localStorage.getItem('privkey')).data, window.pubKey);
              var plaintext = window.NostrTools.nip44.v2.decrypt(value['content'], convoKey);
              value['content'] = plaintext;
              importSettings(JSON.stringify(value));
            }
          } else {
            console.log('not importing settings older than the currently applied set');
          }
        }
      }
    } else {
      console.log('Not inserting ' + value['id'] + ' into Notes DB - not a valid kind 0 event'); // Worry about non-kind 0 stuff later
    }
    if (dirty && immediateWrite) {
      syncDatabase();
    }
  }

  var dbVersion = window.localStorage.getItem("version");
  var dbstr = window.localStorage.getItem(window.mode + ".sqlite");

  if (dbstr && dbVersion !== null && dbVersion == window.version) {
    console.log("Loading existing database - version numbers match");
    var db = new SQL.Database(toBinArray(dbstr));
  } else {
    console.log("Database version mismatch or undefined - creating a new DB");
    var db = new SQL.Database();
    db.run("CREATE TABLE IF NOT EXISTS toasts (id TEXT NOT NULL PRIMARY KEY, created_at INTEGER NOT NULL, domain TEXT NOT NULL, url TEXT NOT NULL, pubkey TEXT NOT NULL, kind INTEGER NOT NULL, note TEXT NOT NULL, favourite BOOLEAN NOT NULL, read_at INTEGER NOT NULL);");
    db.run("CREATE TABLE IF NOT EXISTS notes (id TEXT NOT NULL PRIMARY KEY, created_at INTEGER NOT NULL, pubkey TEXT NOT NULL, kind INTEGER NOT NULL, note TEXT NOT NULL);");
    db.run("CREATE TABLE IF NOT EXISTS alerts (id TEXT NOT NULL PRIMARY KEY, created_at INTEGER NOT NULL, pubkey TEXT NOT NULL, note TEXT NOT NULL, read BOOLEAN NOT NULL);");
    db.run("CREATE INDEX idx_toasts_domain ON toasts (domain);")
  }

  var dbstr = toBinString(db.export());
  window.localStorage.setItem(window.mode + ".sqlite", dbstr);
  window.localStorage.setItem("version", window.version);
  window.localStorage.setItem("settings", JSON.stringify(0));
  window.db = db;

  if (typeof chrome !== "undefined" && typeof chrome.tabs !== "undefined") {
    // Chrome Extension
    window.browserExtension = true;

    document.querySelector('body').classList.add('extension');

    chrome.tabs.onActivated.addListener( function(activeInfo){
      chrome.tabs.get(activeInfo.tabId, function(tab){
        setExtensionURL(tab.url);
      });
    });

    chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
      if (tab.active && change.url) {
        setExtensionURL(change.url);
      }
    });

    chrome.tabs.query({
      active: true,
      currentWindow: true
    }, function(tabs) {
      setExtensionURL(tabs[0].url);
    });
  }


  if (typeof browser !== "undefined" && typeof browser.tabs !== "undefined") {
    // Firefox Extension
    window.browserExtension = true;

    browser.tabs.onActivated.addListener( function(activeInfo){
      browser.tabs.get(activeInfo.tabId, function(tab){
        setExtensionIcon(tab, tab.url);
      });
    });

    browser.tabs.onUpdated.addListener((tabId, change, tab) => {
      if (tab.active && change.url) {
        setExtensionIcon(tab, change.url);
      }
    });

    browser.tabs.query({
      active: true,
      currentWindow: true
    }, function(tabs) {
      setExtensionURL(tabs[0].url);
    });
  } else {
    // Not a browser extension
    window.browserExtension = false;
  }

  console.log("Cached Notes: " + db.exec("SELECT COUNT(*) FROM notes")[0].values[0][0]);
  console.log("Cached Toasts: " + db.exec("SELECT COUNT(*) FROM toasts WHERE kind = 1")[0].values[0][0]);

  // Start Nostr connections
  var sk = localStorage.getItem('privkey');
  var pk;

  if (typeof window.nostr !== 'undefined') {
    // Detected NIP-07 support
    document.querySelector('#keys input[name="privkey"]').value = "NIP-07 supported - using browser keys";
    document.querySelector('#keys input[name="privkey"]').disabled = true;
    document.querySelector('#keys .edit-container').style.display = 'none';
    window.nostr.getPublicKey().then(pubKey => {
      displayProfile(pubKey);
      return pubKey;
    })
    document.querySelector('#keys button').disabled = true;
  } else if (sk === null) {
    document.querySelector('#keys input[name="privkey"]').value = window.NostrTools.nip19.nsecEncode(window.NostrTools.generateSecretKey());
    localStorage.setItem("privkey", document.querySelector('#keys input[name="privkey"]').value);
    sk = Uint8Array.from(window.NostrTools.nip19.decode(localStorage.getItem('privkey')).data);
    pk = window.NostrTools.getPublicKey(sk);
  } else {
    sk = Uint8Array.from(window.NostrTools.nip19.decode(localStorage.getItem('privkey')).data);
    document.querySelector('#keys input[name="privkey"]').value = localStorage.getItem('privkey');
    pk = window.NostrTools.getPublicKey(sk);
  }

  document.querySelector('#keys input[name="privkey"]').addEventListener("change", function() {
    pk = window.NostrTools.getPublicKey(sk) // `pk` is a hex string
  });

  window.pool = new window.NostrTools.SimplePool({enableReconnect: true, enablePing: true})

  window.relays = getRelays();

  var dirty = false;
  document.querySelector('#keys input[name="privkey"]').disabled = true;

  if (pk) {
    displayProfile(pk);
  }

  var filter;
  var kind;
  if (window.mode == "Toastr") {
    kind = 1;
    filter = {kinds: [kind], '#t': ["toastr"], since: 1750046400};
  } else if (window.mode == "PopUpVideo") {
    kind = 40;
    filter = {kinds: [kind], '#t': ["popupvideo"], since: 1750046400}
  }

  var h = window.pool.subscribeMany(
    relays,[
      filter
    ],
    {
      onevent(event) {
        toggleConnectionState(true);
        if (event && event.pubkey && event.content && event.kind == 40 && window.NostrTools.verifyEvent(event, event.pubkey) && event.created_at > 1750046400) {
          importToast(event, window.hasFinishedLoading); // if the page has finished loading, save the DB in response to any change.
          dirty = true;
        }
      },
      oneose() {
        if (dirty) {
          syncDatabase();
        }
        fetchNotes();
      },
      onclose() {
        toggleConnectionState(false);
      }
    }
  )

  function fetchNotes() {
    var filters = [];
    var kind;

    if (window.mode == "Toastr") {
      var stmt = window.db.prepare("SELECT * FROM toasts WHERE kind = 1");
      kind = 1; // children of toasts are also kind 1
      var obj = window;
    } else if (window.mode == "PopUpVideo") {
      var stmt = window.db.prepare("SELECT * FROM toasts WHERE kind = 40");
      kind = 42; // children of channel messages are actually kind 42
      var obj = document.querySelector('#yak');
    }
    while(stmt.step()) {
      const row = stmt.getAsObject();
      var event = JSON.parse(row.note);
      if (window.mode == "Toastr") {
        filters.push({kinds: [1], '#e': [event.id]});
      } else if (window.mode == "PopUpVideo") {
        filters.push({kinds: [42], '#e': [event.id]});
      }
    }

    window.filters = filters;
    console.log('filters: '+ filters.toString());

    var h = window.pool.subscribeMany(
      relays, filters,
      {
        onevent(event) {
          toggleConnectionState(true);
          if (event && event.pubkey && event.content && event.kind == kind && window.NostrTools.verifyEvent(event, event.pubkey)) {
            importNote(event, window.hasFinishedLoading); // if the page has finished loading, save the DB in response to any change.

            if (window.hasFinishedLoading) { // Trigger a redraw if this is after the initial load...
              if (document.getElementById('search-bar').value == "") { // If yes
                drawToasts(document.querySelector('.toasts-container'), window.users, "recent");
                window.lastDrawMode = "recent";
              } else { // If no.
                // Only redraw rooms we're actually in if a new message comes in - otherwise, just ignore it.
                var weShouldRedraw = false;
                if (document.getElementById('search-bar').value.startsWith('note')) {
                  var activeRoom = window.NostrTools.nip19.decode(document.getElementById('search-bar').value).data;

                  event["tags"].forEach((tag) => {
                    if (tag[0] == "e" && tag[3] && tag[3] == 'root' && tag[1] == activeRoom) {
                      weShouldRedraw = true;
                    }
                  });
                }

                if (weShouldRedraw) {
                  var shouldScroll = false;
                  // If the user is at the bottom of the page, we should scroll down again if a new message is received.
                  if (obj.scrollTop === (obj.scrollHeight - obj.offsetHeight)) {
                    shouldScroll = true;
                  }
                  if (event.pubkey != pubKey) {
                    snd.play(); // play sounds, but only if you didn't send the message
                  }
                  searchResults(document.getElementById('search-bar').value);
                  if (shouldScroll) {
                    if (window.mode == "Toastr") {
                      obj.scrollTo({left: 0, top: obj.scrollHeight, behavior: "smooth"});
                    } else if (window.mode == "PopUpVideo") {
                      document.querySelector('#container').scrollTo({left: 0, top: document.querySelector('#container').scrollHeight});
                    }
                  }
                }
              }
            }
          }
        },
        oneose() {
          console.log('EOSE on notes/messages - Calling fetchAuthorInfo...');
          fetchAuthorInfo();
        },
        onclose() {
          toggleConnectionState(false);
        }
      }
    )
  }

  const searchBar = document.getElementById('search-bar');
  searchBar.value = 'note1ggqp6z236003r40m253j27xy8ptzal0c83lxte8m82unt6ln38qqreegpr'; // open directly into yak.club
  window.searchResults = (searchValue) => {
    var mode = '';
    if (!searchValue || searchValue == "" || searchValue == "https://" || searchValue == "http://") {
      mode = 'recent';
    } else if ((searchValue.startsWith('https://') || searchValue.startsWith('http://')) && (searchValue.split("/").length - 1) > 2) {
      if (window.mode == "Toastr") {
        mode = 'url-' + searchValue;
      } else if (window.mode == "PopUpVideo") {
        // Yak Club only supports one chat room per domain, so URL-mode isn't a thing
        if (searchValue.startsWith('https://')) {
          searchValue = searchValue.substring(8, searchValue.length);
        } else if (searchValue.startsWith('http://')) {
          searchValue = searchValue.substring(7, searchValue.length);
        }
        searchValue = searchValue.split('/')[0]
        mode = 'domain-' + searchValue;
      }
    } else if (searchValue.startsWith('npub')) {
      mode = 'profile-' + searchValue;
    } else if (searchValue.startsWith('note') || searchValue.startsWith('nevent')) {
      mode = 'toast-' + searchValue;
    } else {
      if (searchValue.startsWith('https://')) {
        searchValue = searchValue.substring(8, searchValue.length);
      } else if (searchValue.startsWith('http://')) {
        searchValue = searchValue.substring(7, searchValue.length);
      }
      mode = 'domain-' + searchValue;
    }

    document.querySelectorAll('#topbar nav .right > a.tab').forEach(l => {
      l.classList.remove("active");
    });

    document.querySelector('#logoLink').classList.add("active")
    document.querySelectorAll('#container article').forEach(l => {
      l.style.display = 'none';
    });
    document.querySelector('#yak').style.display = 'block';
    drawToasts(document.querySelector('.toasts-container'), window.users, mode);
    window.lastDrawMode = mode;
    modalInitialization();
  };

  var loadHome = function(event) {
    event.preventDefault();
    history.pushState({hash: ''}, "Home", '#' + '');
    document.getElementById('search-bar').value = '';
    searchResults(document.getElementById('search-bar').value);
  }

  document.querySelectorAll('a#logoLink, #backBtn').forEach(el => {
    el.addEventListener('click', event => loadHome(event))
  });

  var alertsLink = document.querySelector('a#alertsLink');
  alertsLink.onclick = function(event) {
    event.preventDefault();

    // Draw first, then update the database to mark everything as read
    drawToasts(document.querySelector('#alerts .toasts-container'), window.users, "alerts");

    var stmt = window.db.exec("UPDATE alerts SET read = true WHERE read = false");

    updateAlertsIndicator();
    syncDatabase();
  }

  window.addEventListener('popstate', function(event) {
    if (event.state) {
      state = event.state;
      document.title = state.title;
      document.getElementById('search-bar').value = state.hash;
      searchResults(document.getElementById('search-bar').value);
    }
  });

  const debounce = (fn, delay = 1000) => {
    let timerId = null;
    return (...args) => {
      clearTimeout(timerId);
      timerId = setTimeout(() => fn(...args), delay);
    };
  };

  const onInput = debounce(searchResults, 500);
  searchBar.addEventListener("input", (e) => {
    onInput(e.target.value);
  });

  function onlyUnique(value, index, array) {
    return array.indexOf(value) === index;
  }

  function updateAlertsIndicator() {
    var alertsCount = db.exec("SELECT COUNT(*) FROM alerts WHERE read = false")[0].values[0][0];

    if (alertsCount >= 1) {
      console.log(alertsCount + ' - activating indicator');
      document.querySelector('#alertsIndicator').classList.add('active');
    } else {
      console.log(alertsCount + ' - removing indicator');
      document.querySelector('#alertsIndicator').classList.remove('active');
    }
  }

  function toggleFavourite(id) {
    var stmt = window.db.prepare("SELECT * FROM toasts WHERE id = $id");
    stmt.bind({$id: id});
    while(stmt.step()) {
      var toast = stmt.getAsObject();
      window.db.run("UPDATE toasts SET favourite = ? WHERE id = ?", [!toast.favourite, id]);
    }
    syncDatabase();
    exportSettings();
  }

  function markToastAsRead(id) {
    window.db.run("UPDATE toasts SET read_at = ? WHERE id = ?", [Math.floor(Date.now() / 1000), window.NostrTools.nip19.decode(id)["data"]]);
    syncDatabase();
  }

  function fetchAuthorInfo() {
    var userPubkeys = [];
    var dirty = false;

    // Get the public keys of everyone who's written a toast
    if (window.mode == "Toastr") {
      var stmt = db.prepare("SELECT * FROM toasts WHERE kind = 1");
    } else if (window.mode == "PopUpVideo") {
      var stmt = db.prepare("SELECT * FROM toasts WHERE kind = 40");
    }

    while(stmt.step()) {
      const row = stmt.getAsObject();
      var event = JSON.parse(row.note);
      userPubkeys.push(event.pubkey);
    }

    // Get the public keys of everyone who's written a note
    if (window.mode == "Toastr") {
      var stmt = db.prepare("SELECT * FROM notes WHERE kind = 1");
    } else if (window.mode == "PopUpVideo") {
      var stmt = db.prepare("SELECT * FROM notes WHERE kind = 42");
    }
    while(stmt.step()) {
      const row = stmt.getAsObject();
      var event = JSON.parse(row.note);
      userPubkeys.push(event.pubkey)
    }

    // Suppress duplicate authors
    userPubkeys = userPubkeys.filter(onlyUnique);

    console.log("userPubkeys: " + userPubkeys);

    // Fetch all known authors from the database, and load their profiles into memory
    var stmt = db.prepare("SELECT * FROM notes WHERE kind = 0");
    while(stmt.step()) {
      const row = stmt.getAsObject();
      var event = JSON.parse(row.note);

      // Load the rows from the DB first before loading from the network
      if (window.users[event.pubkey] === undefined) {
        window.users[event.pubkey] = event;
        if (event.pubkey == window.pubKey) {
          displayProfile(window.pubKey);
        }
      }
    }


    var h = window.pool.subscribeMany(
      relays,[
        {kinds: [0], authors: userPubkeys}
      ],
      {
        onevent(event) {
          toggleConnectionState(true);

          if (event && event.pubkey && event.kind == 0) {
            importNote(event, window.hasFinishedLoading); // if the page has finished loading, save the DB in response to any change.
            dirty = true;
          }
        },
        oneose() {
          if (dirty) {
            syncDatabase();
          }
          if (!window.hasFinishedLoading) {
            if (!window.browserExtension) {
              updateAlertsIndicator(); // If there are new alerts, update the UI to show them
              document.querySelectorAll('.post-boot').forEach((i) => {
                i.classList.remove('post-boot');
              });

              // Draw the new toast UI
              newToast(document.querySelector('#newToastContainer'), {url: ''});

              // Ready to draw page contents - has someone attempted a search (via the URL slug) ?
              if (window.location.hash) {
                document.getElementById('search-bar').value = window.location.hash.substring(1, window.location.hash.length)
              } else {
                // Fragment doesn't exist
              }

              if (document.getElementById('search-bar').value == "") { // If yes
                searchResults(document.getElementById('search-bar').value);
              } else { // If no.
                searchResults(document.getElementById('search-bar').value);
              }
            }
            window.hasFinishedLoading = true;
          }
        },
        onclose() {
          toggleConnectionState(false);
        }
      }
    )
  }

  function drawToasts(container, knownUsers, mode) {
    var alerts = {};

    if (mode == "alerts") {
      var stmt = db.prepare("SELECT * FROM alerts");
      while(stmt.step()) {
        const row = stmt.getAsObject();
        alerts[row.id] = row.read;
      }
      window.alerts = alerts;
    }

    console.log("Drawing Toasts! - Mode = " + mode);
    try {
      container.querySelector('.toasts-loading').classList.add("active");
      container.querySelector('.toasts').innerHTML = '';
      if (window.lastDrawMode != mode) {
        container.querySelector('.toast-new').remove();
      }
      container.querySelector('.toast-new-button').remove();
    } catch (e) {}

    var users = {}
    var stmt = db.prepare("SELECT * FROM notes WHERE kind = 0");
    while(stmt.step()) {
      const row = stmt.getAsObject();
      var event = JSON.parse(row.note);
      users[event.pubkey] = event;
    }

    if (mode.slice(-1) == '#') {
      mode = mode.substring(0, mode.length - 1);
    }

    var emptyMsg = '';
    var pageTitle;
    var pageSubTitle;
    var shouldShowHeadings = false;
    var shouldShowMessages = false;
    var shouldShowBackButton = false;
    var shouldShowRoomButtons = false;
    var showEmptyMessage = true;
    var showFooter = false;
    var showFilters = false;

    if (mode.startsWith("domain-")) {
      console.log("Filtering to domain name " + mode.substring(7));

      if (window.mode == "Toastr") {
        stmt = db.prepare("SELECT * FROM toasts WHERE kind = 1 AND domain = $domain ORDER BY created_at DESC");
        emptyMsg = "Sorry, there are no toasts for the domain " + mode.substring(7);
        pageTitle = 'Search Results'
        pageSubTitle = 'Domain: ' + mode.substring(7);
      } else if (window.mode == "PopUpVideo") {
        stmt = db.prepare("SELECT * FROM toasts WHERE kind = 40 AND domain LIKE $domain ORDER BY created_at DESC");
        emptyMsg = "Sorry, there are no channels named " + mode.substring(7);
        var closeMatchMsg = "Not what you're looking for?";
        pageTitle = 'Search Results'
        pageSubTitle = 'Room name: ' + mode.substring(7);
        var isExactMatch = false;
      }

      stmt.bind({$domain: '%' + mode.substring(7).toLowerCase() + '%'});

      shouldShowHeadings = true;
      shouldShowMessages = false;

    } else if (mode == "recent") {
      if (window.mode == "Toastr") {
        stmt = db.prepare("SELECT * FROM toasts WHERE kind = 1 ORDER BY created_at DESC");
        emptyMsg = "Sorry, there are no recent toasts";
        pageTitle = 'Recent Toasts'
        pageSubTitle = '';
      } else if (window.mode == "PopUpVideo") {
        stmt = db.prepare("SELECT * FROM toasts WHERE kind = 40 ORDER BY created_at DESC");
        emptyMsg = "Sorry, there are no channels";
        pageTitle = 'Channels'
        pageSubTitle = '';
        showFilters = true;
      }

      shouldShowHeadings = true;
      shouldShowMessages = false;
    } else if (mode == "alerts") {
      var notes = "'" + Object.keys(alerts).join("','") + "'"; // couldn't get prepared statements to work
      stmt = db.prepare("SELECT * FROM notes WHERE id IN (" + notes + ") ORDER BY created_at DESC");

      emptyMsg = "Sorry, there are no alerts";
      pageTitle = 'Alerts'
      pageSubTitle = '';
      showFilters = false;

    } else if (mode.startsWith("url-")) {
      stmt = db.prepare("SELECT * FROM toasts WHERE kind = 1 AND url = $url ORDER BY created_at DESC");
      console.log("Filtering to URL " + mode.substring(4));
      stmt.bind({$url: mode.substring(4)});
      emptyMsg = "Sorry, there are no toasts for URL " + mode.substring(4) + " - why not be the first to write one?";

      shouldShowHeadings = true;
      shouldShowMessages = false;

      pageTitle = 'Search Results'
      pageSubTitle = 'URL: ' + mode.substring(4);
    } else if (mode.startsWith("profile")) {
      if (window.mode == "Toastr") {
        stmt = db.prepare("SELECT * FROM toasts WHERE kind = 1 AND pubkey = $pubkey ORDER BY created_at DESC");
      } else if (window.mode == "PopUpVideo") {
        stmt = db.prepare("SELECT * FROM toasts WHERE kind = 40 AND pubkey = $pubkey ORDER BY created_at DESC");
      }
      console.log("Filtering to profile " + mode.substring(8));
      var pubkey = window.NostrTools.nip19.decode(mode.substring(8)).data;
      stmt.bind({$pubkey: pubkey})

      shouldShowHeadings = true;
      shouldShowMessages = false;

      var username = '';
      if (users[pubkey]) {
        var user = JSON.parse(users[pubkey].content);
        username = user.name;
      }
      else {
        username = 'Unknown';
      }

      if (window.mode == "Toastr") {
        emptyMsg = "Sorry, there are no toasts from profile " + mode.substring(8) + ' (' + pubkey + ')';
        pageTitle = 'Toasts from ' + username;
      } else if (window.mode == "PopUpVideo") {
        emptyMsg = "Sorry, there are no channels from profile " + mode.substring(8) + ' (' + pubkey + ')';
        pageTitle = 'Channels from ' + username;
      }

      pageSubTitle = mode.substring(8);
    } else if (mode.startsWith("toast")) {
      if (window.mode == "Toastr") {
        stmt = db.prepare("SELECT * FROM toasts WHERE kind = 1 AND id = $id ORDER BY created_at DESC");
      } else if (window.mode == "PopUpVideo") {
        stmt = db.prepare("SELECT * FROM toasts WHERE kind = 40 AND id = $id ORDER BY created_at DESC");
      }

      var query = mode.split('-')[1];

      console.log("Filtering to toast " + query);

      if (query.startsWith("note")) {
        var id = window.NostrTools.nip19.decode(query).data;
      } else if (query.startsWith('nevent')) {
        var id = window.NostrTools.nip19.decode(query).data.id;
      }

      stmt.bind({$id: id});

      shouldShowHeadings = false;
      shouldShowMessages = true;

      var row;

      if (window.mode == "Toastr") {
        pageTitle = 'Viewing Thread';
        emptyMsg = "Sorry, there are no toasts corresponding to " + mode.substring(6) + ' (' + id + ')';
      } else if (window.mode == "PopUpVideo") {
        var channelName = 'Unknown';
        while (stmt.step()) {
          row = stmt.getAsObject();
          try {
            channelName = JSON.parse(JSON.parse(row["note"])["content"])["name"];
          } catch (e) { // Ignore it and just use Unknown for now
          }
          showFooter = true;
        }

        pageTitle = channelName;
        emptyMsg = "Sorry, there are no notes corresponding to " + mode.substring(6) + ' (' + id + ')';
      }
      //pageSubTitle = mode.substring(6).split('-')[0];
      shouldShowBackButton = true;
      shouldShowRoomButtons = true;

      var roomButtons = document.querySelector('#room-buttons');
      roomButtons.innerHTML = '';

      const favouritesLink = document.createElement('a');
      favouritesLink.classList.add('favourites');
      favouritesLink.href = '#';
      if (row.favourite) {
        favouritesLink.innerHTML = '✦';
      } else {
        favouritesLink.innerHTML = '✧';
      }

      tippy(favouritesLink, {
        content: 'Favourite'
      });

      favouritesLink.dataset.id = row.id;
      favouritesLink.onclick = function(event) {
        event.preventDefault();
        var result = toggleFavourite(event.target.dataset.id);
        if (result) {
          event.target.innerHTML = '✦';
        } else {
          event.target.innerHTML = '✧';
        }
      }

      const debugLink = document.createElement('a');
      debugLink.classList.add('raw');
      debugLink.href = '#';
      debugLink.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><!--!Font Awesome Free v7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M360.8 1.2c-17-4.9-34.7 5-39.6 22l-128 448c-4.9 17 5 34.7 22 39.6s34.7-5 39.6-22l128-448c4.9-17-5-34.7-22-39.6zm64.6 136.1c-12.5 12.5-12.5 32.8 0 45.3l73.4 73.4-73.4 73.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l96-96c12.5-12.5 12.5-32.8 0-45.3l-96-96c-12.5-12.5-32.8-12.5-45.3 0zm-274.7 0c-12.5-12.5-32.8-12.5-45.3 0l-96 96c-12.5 12.5-12.5 32.8 0 45.3l96 96c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256 150.6 182.6c12.5-12.5 12.5-32.8 0-45.3z"/></svg>';
      debugLink.dataset.id = row.note;

      tippy(debugLink, {
        content: 'Copy to Clipboard'
      });

      debugLink.onclick = function(event) {
        event.preventDefault();
        var note = event.target.dataset.id;
        console.log(note);
        writeClipboardText(note);
      }

      roomButtons.prepend(debugLink);
      roomButtons.prepend(favouritesLink);

    } else if (mode.startsWith("replies-")) {
      shouldShowHeadings = false;
      shouldShowMessages = true;

      console.log('Loading replies for ' + mode.substring(8));
      var dirty = false;
      var replies = [];

      // TODO: rewrite this to not use LIKE, and properly search for replies
      // This is only doable with an index of tags though.
      // {kinds: [1], '#e': [mode.substring(8), "", "root/reply"]}

      if (window.mode == "Toastr") {
        stmt = db.prepare("SELECT * FROM notes WHERE kind = 1 AND id <> $id AND note LIKE $noteid ORDER BY created_at ASC");
      } else if (window.mode == "PopUpVideo") {
        stmt = db.prepare("SELECT * FROM notes WHERE kind = 42 AND id <> $id AND note LIKE $noteid ORDER BY created_at ASC");
      }
      stmt.bind({$id: mode.substring(8), $noteid: '%' + mode.substring(8) + '%'});

      emptyMsg = "";

      // This is called from within a thread - there's no need to set the page title or subtitle
    } else if (mode.startsWith("messages-")) {
      shouldShowHeadings = false;
      shouldShowMessages = false;

      console.log('Loading messages for ' + mode.substring(9));
      var dirty = false;
      var replies = [];

      // TODO: rewrite this to not use LIKE, and properly search for replies
      // This is only doable with an index of tags though.
      // {kinds: [1], '#e': [mode.substring(9), "", "root/reply"]}

      stmt = db.prepare("SELECT * FROM notes WHERE kind = 42 AND note LIKE $noteid ORDER BY created_at ASC");
      stmt.bind({$noteid: '%' + mode.substring(9) + '%'});

      emptyMsg = "";

      // This is called from within a thread - there's no need to set the page title or subtitle
    }

    var row;

    var lastPubkey = null;
    var lastTimestamp = null;

    while(true) {
      if (stmt.step()) {
        row = stmt.getAsObject();
        showEmptyMessage = false;
      } else {
        break;
      }

      var event = JSON.parse(row.note);

      // Our database code currently does not support properly parsing the tag column of Nostr notes,
      // so you can't just ask for 'direct children of note X' - instead, you have to ask for notes
      // that reference X, which might include great-great-grandchildren, or other insane relationships.
      // Then you have to parse every response to the query and actually perform the check by parsing
      // the note directly, and short circuit rendering if it isn't actually what you wanted.

      var parent = '';

      if (mode.startsWith("messages-")) {
        // Copy all of the e Tags from the references in the parent post
        event["tags"].forEach((tag) => {
          if (tag[0] == "e" && tag[3] == "root") {
            parent = tag[1];
          }
        });

        if (parent != mode.substring(9)) {
          continue; // Cancel rendering if the parent isn't actually an exact match.
        }
      }

      if (mode.startsWith("replies-")) {
        // Copy all of the e Tags from the references in the parent post
        event["tags"].forEach((tag) => {
          if (tag[0] == "e") {
            parent = tag[1];
          }
        });

        if (parent != mode.substring(8)) {
          continue; // Cancel rendering if the parent isn't actually an exact match.
        }
      }

      if (window.mode == "PopUpVideo" && mode.startsWith('domain') && !isExactMatch) {
        isExactMatch = JSON.parse(event["content"])["name"].toLowerCase() == mode.substring(7).toLowerCase();
      }

      var username = 'Unknown';
      var avatarURL = null;
      if (users[event.pubkey]) {
        var user = JSON.parse(users[event.pubkey].content);
        if (typeof user.picture !== 'undefined') {
          avatarURL = user.picture;
        }
        if (typeof user.name !== 'undefined') {
          username = user.name;
        }
      }

      if (shouldShowHeadings) {
        var article = document.createElement('div');

        if (window.mode == "Toastr") {
          var ccStmt = db.prepare("SELECT COUNT(*) FROM notes WHERE kind = 1 AND id <> $id AND note LIKE $noteid");
          article.classList.add('toast');
        } else if (window.mode == "PopUpVideo") {
          var ccStmt = db.prepare("SELECT COUNT(*) FROM notes WHERE kind = 42 AND id <> $id AND note LIKE $noteid");
          var pStmt = db.prepare("SELECT COUNT(DISTINCT pubkey) FROM notes WHERE kind = 42 AND id <> $id AND note LIKE $noteid");
          pStmt.bind({$id: event.id, $noteid: '%' + event.id + '%'});

          var isParticipantStmt = db.prepare("SELECT COUNT(*) FROM notes WHERE kind = 42 AND id <> $id AND note LIKE $noteid AND pubkey = $pubkey");
          isParticipantStmt.bind({$id: event.id, $noteid: '%' + event.id + '%', $pubkey: window.pubKey});

          var isParticipant = false;
          if (isParticipantStmt.step()) {var isParticipantCount = isParticipantStmt.getAsObject()["COUNT(*)"]}
          var isParticipant = isParticipantCount > 0;

          var isFavourite = row.favourite;

          article.classList.add('toast');

          // We don't care when a room was created - instead, we're storing the last message's timestamp in there.
          var isUnread = row.created_at > row.read_at;

          if (isUnread) {
            article.classList.add('unread');
          }

          if (isParticipant) {
            article.classList.add('participant');
          }

          if (isFavourite) {
            article.classList.add('favourite')
          }

          var isCreator = (event.pubkey == window.pubKey);

          if (isCreator) {
            article.classList.add('creator');
          }

          // var lastUpdatedTimestamp = new Date(0);
          // lastUpdatedTimestamp.setUTCSeconds(event.created_at);
          // <span class="middot">&middot;</span> ${lastUpdatedTimestamp}
        }
        ccStmt.bind({$id: event.id, $noteid: '%' + event.id + '%'});

        if (ccStmt.step()) {var messagesCount = ccStmt.getAsObject()["COUNT(*)"]}
        var messagesString = '';

        if (window.mode == "Toastr") {
          if (messagesCount != 1) {
            messagesString = 'comments';
          } else {
            messagesString = 'comment';
          }
        } else if (window.mode == "PopUpVideo") {
          if (messagesCount != 1) {
            messagesString = 'messages';
          } else {
            messagesString = 'message';
          }
        }

        var favouriteIcon = '';

        if (row.favourite) {
          favouriteIcon = '✦';
        } else {
          favouriteIcon = '✧';
        }

        var participantsString = '';
        if (pStmt.step()) {var participantsCount = pStmt.getAsObject()["COUNT(DISTINCT pubkey)"]}

        if (participantsCount != 1) {
          participantsString = 'users';
        } else {
          participantsString = 'user';
        }

        var epochTimestamp = new Date(0);
        epochTimestamp.setUTCSeconds(event.created_at);

        if (window.mode == "Toastr") {
          var innerHTML = `<h2><a href="${row.url}">${event.content}</a></h2>
          <p><a class="messages"></a> &middot; ${epochTimestamp.toLocaleString()} <span class="middot">&middot;</span><br /> <a class="domain"></a> &middot; submitted by <a class="submitter"></a> </p>
          `
        } else if (window.mode == "PopUpVideo") {
          var roomName = 'Unknown';

          try {
            roomName = JSON.parse(event.content)["name"];
          } catch (e) {
            roomName = event.content + ' *';
          }
          var innerHTML = `<a class="favourites">${favouriteIcon}</a> <h2><a class="title">${roomName}</a></h2>
          <p><a class="messages"></a> <span class="middot">&middot;</span> <span class="participants">${participantsCount} ${participantsString}</span></p>
          `
        }
        article.innerHTML = innerHTML;
        container.querySelector('.toasts').appendChild(article);

        var favouritesLink = article.querySelector('a.favourites');
        favouritesLink.dataset.id = row.id;
        favouritesLink.onclick = function(event) {
          event.preventDefault();
          var result = toggleFavourite(event.target.dataset.id);
          if (result) {
            favouritesLink.innerHTML = '✦';
          } else {
            favouritesLink.innerHTML = '✧';
          }
          searchResults(document.getElementById('search-bar').value);
        }

        var messagesLink = article.querySelector('a.messages');
        messagesLink.innerHTML = `${messagesCount} ${messagesString}`
        messagesLink.onclick = function(event) {
          event.preventDefault();

          markToastAsRead(event.target.dataset.id);
          document.getElementById('search-bar').value = event.target.dataset.id;
          searchResults(document.getElementById('search-bar').value);
          history.pushState({hash: event.target.dataset.id, title: document.title}, '', '#' + event.target.dataset.id);
        }
        messagesLink.href = '#' + window.NostrTools.nip19.noteEncode(event.id);
        messagesLink.dataset.id = window.NostrTools.nip19.noteEncode(event.id);

        if (window.mode == "PopUpVideo") {
          var titleLink = article.querySelector('a.title');
          titleLink.onclick = messagesLink.onclick;
          titleLink.href = '#' + window.NostrTools.nip19.noteEncode(event.id);
          titleLink.dataset.id = window.NostrTools.nip19.noteEncode(event.id);
        }

        try { // Toastr only
          var domainLink = article.querySelector('a.domain');
          domainLink.innerHTML = `${row.domain}`
          domainLink.onclick = function(event) {
            event.preventDefault();
            document.getElementById('search-bar').value = event.target.dataset.domain;
            searchResults(document.getElementById('search-bar').value);
            history.pushState({hash: event.target.dataset.domain, title: document.title}, '', '#' + event.target.dataset.domain);
          }
          domainLink.href = '#' + row.url;
          domainLink.dataset.domain = row.domain;
          domainLink.dataset.url = row.url;

          var submitterLink = article.querySelector('a.submitter');
          submitterLink.innerHTML = `${username}`
          submitterLink.onclick = function(event) {
            event.preventDefault();
            document.getElementById('search-bar').value = event.target.dataset.pubkey;
            searchResults(document.getElementById('search-bar').value);
            history.pushState({hash: event.target.dataset.pubkey, title: document.title}, '', "#" + event.target.dataset.pubkey);
          }

          submitterLink.href = '#' + window.NostrTools.nip19.npubEncode(event.pubkey);
          submitterLink.dataset.pubkey = window.NostrTools.nip19.npubEncode(event.pubkey);
        } catch {}
      }

      if (!shouldShowHeadings && !mode.startsWith("toast")) {
        // TODO: populate this
        var isReply = false;
        var reply = {};
        displayToast(container.querySelector('.toasts'), {username: username, pubkey: event.pubkey, message: event.content, avatarURL: avatarURL, isReply: isReply, reply: reply, created_at: event.created_at}, event, {lastPubkey: lastPubkey, lastTimestamp: lastTimestamp, users: users, mode: mode, read: alerts[event.id]});
        lastPubkey = event.pubkey;
        lastTimestamp = event.created_at;
      }

      if (shouldShowMessages) {
        // Draw replies

        const children = document.createElement('div');
        children.classList.add('children');

        container.querySelector('.toasts').appendChild(children);

        const toasts = document.createElement('div');
        toasts.classList.add('toasts');
        children.appendChild(toasts);

        var marker = 'root';
        // Copy all of the e Tags from the references in the parent post
        var eTags = [];
        event["tags"].forEach((tag) => {
          if (tag[0] == "e") {
            eTags.push(tag);
            if (tag[3] && tag[3] == 'root') {
              marker = 'reply'; // If there's a root e tag defined, mark it as a reply instead.
            }
          }
        });

        // Add the parent post itself as a reference
        eTags.push(['e', event.id, '', marker, event.pubkey]);
        if (window.mode == "Toastr") {
          newNote(children, {eTags: eTags});
        }
        drawToasts(container.querySelector('.toasts'), knownUsers, "messages-" + event.id);

        console.log('mode:' + container.querySelector('.toasts').children.length);

        var classFilter = '';
        if (window.mode == "Toastr") {
          classFilter = '.toast';
        } else if (window.mode == "PopUpVideo") {
          classFilter = '.note';
        }

        if (!document.querySelector('.toasts ' + classFilter) && mode.startsWith('toast-')) {
          // Add text if there are currently no messages.
          showEmptyMessage = true;
          emptyMsg = 'no messages (yet) - why not be the first to write one?'
        }
      }
    }

    if (pageTitle !== undefined) {
      document.querySelector('h1#title').innerHTML = pageTitle;
      document.title = 'Yak Club - ' + pageTitle;

      if (pageSubTitle !== undefined) {
        document.querySelector('h2#subtitle').innerHTML = pageSubTitle;
        if (showFilters) {
          document.querySelector('h2#subtitle').innerHTML = `<p class="filters"><a href="#" data-filter="all">all</a> <span class="middot">&middot;</span> <a href="#" data-filter="favourite">favourites</a><span class="middot">&middot;</span> <a href="#" data-filter="participant">participated</a> <span class="middot">&middot;</span> <a href="#" data-filter="creator">created</a></p>`

          var links = document.querySelectorAll("h2#subtitle a");
          links.forEach(i => {
            i.addEventListener('click', (e) => filterToasts(e));
          });
        }


      } else {
        document.querySelector('h2#subtitle').innerHTML = '';
      }
    }

    if (shouldShowBackButton) {
      document.querySelector('#backBtn').style.display = 'inline-block';
    } else {
      document.querySelector('#backBtn').style.display = 'none';
    }

    if (shouldShowRoomButtons) {
      document.querySelector('#room-buttons').style.display = 'block';
    } else {
      document.querySelector('#room-buttons').style.display = 'none';
    }

    if (showFooter) {
      document.querySelector('footer#footer').style.display = 'block';
      document.querySelector('#parent').classList.remove('hidden-footer');
    } else {
      document.querySelector('footer#footer').style.display = 'none';
      document.querySelector('#parent').classList.add('hidden-footer');
    }

    try {
      container.querySelector('.toasts-loading').classList.remove("active");
      if (showEmptyMessage || (window.mode == "PopUpVideo" && mode.startsWith('domain-') && !isExactMatch)) {
        var actionMsg = 'Create';
        // If a room similar to the one we were looking for exists, display the 'close match' message
        // typeof closeMatchMsg !== 'undefined' is basically equivalent to (window.mode == "PopUpVideo" && mode.startsWith('domain-'))
        if (typeof closeMatchMsg !== 'undefined' && !showEmptyMessage && !isExactMatch) {
          container.querySelector('.toasts-empty').innerHTML = closeMatchMsg;
          actionMsg = 'Create channel ' + mode.substring(7);
        } else if (typeof closeMatchMsg !== 'undefined' && showEmptyMessage) {
          container.querySelector('.toasts-empty').innerHTML = emptyMsg;
          actionMsg = 'Create channel ' + mode.substring(7);
        } else {
          container.querySelector('.toasts-empty').innerHTML = emptyMsg;
        }

        // Add a button to the empty message that opens the newToast UI
        if (mode.startsWith('url-') || (window.mode == "PopUpVideo" && mode.startsWith('domain-'))) {
          if (window.mode == "Toastr") {
            var newItem = '<button class=\'valid\'>' + actionMsg + '</button>';
            document.querySelector('#newToastContainer input[name="url"]').value = mode.substring(4);
          } else if (window.mode == "PopUpVideo") {
            var newItem = `<form class="toast-new-form" autocomplete="off" action="">
              <input type="hidden" name="url" value="${mode.substring(7)}" placeholder="Room or domain name" required="">
              <button type="submit" class="toast-submit-button">${actionMsg}</button>
            </form>`;
          }

          container.querySelector('.toasts-empty').innerHTML += '<br />' + newItem;

          var emptyToast = container.querySelector('.toasts-empty')
          emptyToast.addEventListener('submit', (e) => newNoteSubmit(e));

          var emptyInput = container.querySelector('.toasts-empty input')
          emptyInput.addEventListener('keydown', (e) => validateToast(e, 1));

          if (window.mode == "Toastr") {
            var emptyButton = container.querySelector('.toasts-empty button')
            emptyButton.addEventListener('click', (e) => document.querySelectorAll("#topbar nav .right > a.tab")[0].click());
          }
        }

        container.querySelector('.toasts-empty').classList.add("active");
      } else {
        container.querySelector('.toasts-empty').innerHTML = '';
        container.querySelector('.toasts-empty').classList.remove("active");
      }
      if (mode.startsWith('toast-') && window.lastDrawMode != mode) {
        document.querySelector('#footer').innerHTML = ''; // remove old forms
        newNote(document.querySelector('#footer'), {eTags: [['e', event.id, '', 'root', event.pubkey]], showButton: true});
      }

      if (document.getElementById('search-bar').value) {
        document.querySelector('#' + document.getElementById('search-bar').value).scrollIntoView();
      }

    } catch (e) {}
  }

  // New Root Posts
  function newToast(node, params) {
    // Grab the profile picture URL from the settings box for the time being
    var avatarURL;
    if (document.querySelector('#profile input[name="picture"]').value !== "") {
      avatarURL = document.querySelector('#profile input[name="picture"]').value
    } else {
      avatarURL = 'circle-user.svg'
    }

    var submitText;
    if (window.mode == "Toastr") {
      submitText = "Toast";
    } else if (window.mode == "PopUpVideo") {
      submitText = "Create";
    }

    const div = document.createElement('div');
    div.classList.add('toast-new');

    var innerHTML = `
      <div>
        <img class="avatar" src="${avatarURL}" />
        <div class="content">
          <form class="toast-new-form" autocomplete="off" action="">`

          if (window.mode == "Toastr") { innerHTML += `
            <input type="url" name="url" value="" placeholder="URL" required></input>
            <input type="text" name="title" placeholder="Write a title..." required></input>
          `} else if (window.mode == "PopUpVideo") { innerHTML += `
            <input type="text" name="url" value="" placeholder="Room or domain name" required></input>
          `}

innerHTML += `<button type="submit" class="toast-submit-button">${submitText}</button>
          </form>
        </div>
      </div>
    `

    div.innerHTML = innerHTML;

    var form = div.querySelector('form');
    form.addEventListener('submit', (e) => newNoteSubmit(e));

    var inputs = div.querySelectorAll("input");
    inputs.forEach(i => {
      i.addEventListener('keydown', (e) => validateToast(e, 1));
    });

    node.append(div);
  }

  // New Messages
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

    const pickerOptions = { onEmojiSelect: function(e){document.querySelector('textarea').value += e.native; console.log(e);}, previewPosition: 'none'}
    const picker = new EmojiMart.Picker(pickerOptions)
    if (document.querySelector('#emoji-picker').childNodes.length == 0) {
      document.querySelector('#emoji-picker').appendChild(picker);
    }

    div.innerHTML = innerHTML;

    var textarea = div.querySelector("textarea");
    textarea.addEventListener('keydown', (e) => validateToast(e, 2));
    textarea.addEventListener('input', (e) => resizeTextArea(e));

    var form = div.querySelector("form");
    form.addEventListener('submit', (e) => newNoteSubmit(e));

    var cancelButton = div.querySelector(".reply-cancel");
    cancelButton.addEventListener('click', (e) => deleteReplyContent(e));

    node.append(div);

    document.querySelector('#show-emoji-picker-button').addEventListener('click', function(event) {event.stopPropagation(); toggleEmojiWindow(event)});
  }
});

document.querySelectorAll('#topbar nav .right > a.tab').forEach(link => {
  link.addEventListener("click", (e) => {
    var num = Array.from(document.querySelectorAll("#topbar nav .right > a.tab")).indexOf(e.currentTarget);
    document.querySelectorAll('#topbar nav .right > a.tab').forEach(l => {
      l.classList.remove("active");
    });
    e.currentTarget.classList.add("active")
    document.querySelectorAll('#container article').forEach(l => {
      l.style.display = 'none';
    });
    document.querySelectorAll('#container article')[num + 2].style.display = 'block';
    document.getElementById('search-bar').value = '';
    return false;
  });
});

function randomBytes(bytesLength = 32) {
  if (crypto && typeof crypto.getRandomValues === "function") {
    return crypto.getRandomValues(new Uint8Array(bytesLength));
  }
  throw new Error("crypto.getRandomValues must be defined");
}

function modalInitialization() {
  MicroModal.init({
    awaitCloseAnimation: true
  });
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

  document.querySelector('#modal-profile .pubkey').innerHTML = window.NostrTools.nip19.npubEncode(pubKey);
}

MicroModal.init({
  awaitCloseAnimation: true
});
