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

function toggleConnectionState(state) {
  if (state && window.isConnected !== true) {
    window.isConnected = true;
    console.log('Connected to Nostr!');
  } else if (!state && window.isConnected !== false) {
    window.isConnected = false;
    console.log('Disconnected from Nostr');
  }
}

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
      document.getElementById('search-bar').value = window.NostrTools.nip19.noteEncode(note["id"]);
      history.pushState({hash: note["id"], title: document.title}, '', '#' + note["id"]);
    } else {
      window.importNote(note, window.hasFinishedLoading); // if the page has finished loading, save the DB in response to any change.
    }

    if (window.mode == "PopUpVideo") {
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
    if (window.mode == "PopUpVideo") {
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

function randomBytes(bytesLength = 32) {
  if (crypto && typeof crypto.getRandomValues === "function") {
    return crypto.getRandomValues(new Uint8Array(bytesLength));
  }
  throw new Error("crypto.getRandomValues must be defined");
}

MicroModal.init({
  awaitCloseAnimation: true
});
