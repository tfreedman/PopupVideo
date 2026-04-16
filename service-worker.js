self.mode = "PopUpVideo";

var storage = browser.storage; // Add chrome support later
var version = 0; // The version of this script

var _privkey;
var _settings = 0;
var _version;
var _database;

const readLocalStorage = async (key) => {
  return new Promise((resolve, reject) => {
    browser.storage.local.get([key], function (result) {
      if (result[key] === undefined) {
        reject();
      } else {
        resolve(result[key]);
      }
    });
  });
};

var pubKey;

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getNostrKeys") {
    sendResponse({private: _privkey, public: self.pubKey});
  } else if (message.action === "getRelays") {
    sendResponse(getRelays());
  } else if (message.action === "getUsers") {
    sendResponse(self.users);
  }
});


var users = {};
self.settings = 0;
self.hasFinishedLoading = false;
self.db = null;

self.pool = null;
self.isConnected = false;

function toggleConnectionState(state) {
  if (state && self.isConnected !== true) {
    self.isConnected = true;
    console.log('Connected to Nostr!');
  } else if (!state && self.isConnected !== false) {
    self.isConnected = false;
    console.log('Disconnected from Nostr');
  }
}

function getRelays() {
  var default_relays = ["wss://relay.toastr.net", "wss://purplepag.es", "wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net"];
  var relays = [];
  var overrideRelays = true;

  if (overrideRelays) {
    var relays = ["wss://toastr.tylerfreedman.com", "wss://purplepag.es"];
  } else {
    relays = relays.concat(default_relays);
  }
  return {relays: relays, debugging: overrideRelays};
}

async function readDBToVariables() {
  try {
    _privkey = await readLocalStorage("privkey");
  } catch(e) {
    _privkey = null;
  }

  try {
    _settings = await readLocalStorage("settings");
  } catch(e) {
    _settings = null;
  }

  try {
    _version = await readLocalStorage("version");
  } catch(e) {
    _version = null;
  }

  try {
    _database = await readLocalStorage("database");
  } catch(e) {
    _database = null;
  }
}
readDBToVariables();

var pubKey;
var snd = new Audio("/pop.mp3");
self.lastDrawMode = null;

config = {
  locateFile: filename => `${filename}`
}

function syncDatabase() {
  var dbstr = toBinString(self.db.export());
  storage.local.set({database: dbstr});
}

function exportSettings() {
  var settings = new Object();
  // This currently only exports favourites and alerts

  // Favourites

  settings["toasts"] = [];
  var stmt = self.db.prepare("SELECT * FROM toasts");

  while(stmt.step()) {
    const row = stmt.getAsObject();
    if (row.favourite) {
      settings["toasts"].push({id: row.id, favourite: true})
    }
  }

  // Alerts

  settings["alerts"] = [];
  var stmt = self.db.prepare("SELECT * FROM alerts");

  while(stmt.step()) {
    const row = stmt.getAsObject();
    if (row.read) {
      settings["alerts"].push({id: row.id, read: true})
    }
  }

  console.log(JSON.stringify(settings));
  // NIP07 unsupported
  var convoKey = self.NostrTools.nip44.getConversationKey(self.NostrTools.nip19.decode(_privkey).data, self.pubKey);
  var ciphertext = self.NostrTools.nip44.v2.encrypt(JSON.stringify(settings), convoKey, randomBytes(32));
  var e = {created_at: Math.floor(Date.now() / 1000), kind: 30078, tags: [['d', self.mode]], content: ciphertext};
  var note = self.NostrTools.finalizeEvent(e, Uint8Array.from(self.NostrTools.nip19.decode(_privkey).data));
  console.log("signed note without nip07: " + note);
  uploadNote(null, note, null);
}

function importSettings(note) {
  // This function imports a plaintext note. If you have an encrypted note, it has to be decrypted upstream.
  settings = JSON.parse(JSON.parse(note)['content']);
  created_at = JSON.parse(note)['created_at'];

  console.log('attempting to import settings: ');
  console.log(settings);

  // This currently only imports favourites and alerts

  // Favourites
  Object.keys(settings["toasts"]).forEach(key => {
    var toast = settings["toasts"][key];
    var stmt = self.db.prepare("SELECT * FROM toasts WHERE id = $id");
    stmt.bind({$id: toast.id});
    var result = null;
    while(stmt.step()) {
      result = toast.id;
      console.log('setting favourite on toast ' + toast.id);
      self.db.run("UPDATE toasts SET favourite = ? WHERE id = ?", [toast.favourite, toast.id]);
    }
    if (result === null) {
      console.log('No match for ' + toast.id + ' in toasts table');
    }
  });

  // Alerts
  Object.keys(settings["alerts"]).forEach(key => {
    var note = settings["alerts"][key];
    var stmt = db.prepare("SELECT * FROM alerts WHERE id = $id");
    stmt.bind({$id: note.id});
    var result = null;
    while(stmt.step()) {
      result = note.id;
      console.log('setting read on alert ' + note.id);
      db.run("UPDATE alerts SET read = ? WHERE id = ?", [note.read, note.id]);
    }
    if (result === null) {
      console.log('No match for ' + note.id + ' in alerts table');
    }
  });
  // TODO: redraw UI so that the settings that were imported are actually visible

  // We don't want to re-import the settings we just exported, so we make sure the app thinks
  // the current settings are newer by adding 1 to the timestamp
  storage.local.set({settings: JSON.stringify(created_at + 1)});
  self.settings = note['created_at'] + 1;

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

initSqlJs(config).then(function(SQL){
  self.importToast = function(value, immediateWrite) {
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

    // just use the room name as the raw value
    var url = rValue // is this actually used anywhere?;
    var domain = JSON.parse(value["content"])["name"].toLowerCase();

    console.log('Inserting ' + value['id'] + ' - (' + domain + ') into Toasts DB...');
    db.run("INSERT OR IGNORE INTO toasts (id, created_at, domain, url, pubkey, kind, note, favourite, read_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [value['id'], value['created_at'], domain, taggedUrl, value['pubkey'], value['kind'], note, false, 0]);

    if (immediateWrite) {
      syncDatabase();
    }
  }

  self.importNote = function(value, immediateWrite) {
    var dirty = false;
    var note = JSON.stringify(value);
    if (value['kind'] == 0) {
      var existing_note = db.exec("SELECT created_at FROM notes WHERE pubkey = ? AND kind = 0", [value['pubkey']])
      if (existing_note.length == 0) {
        console.log('Inserting ' + value['id'] + ' into Notes DB...');
        self.users[value['pubkey']] = value;
        if (value['pubkey'] == self.pubKey) {
          displayProfile(self.pubKey);
        }
        db.run("INSERT INTO notes (id, created_at, pubkey, kind, note) VALUES (?, ?, ?, ?, ?)", [value['id'], value['created_at'], value['pubkey'], value['kind'], note]);
        dirty = true;
        console.log('Adding ' + value['pubkey'] + ' to self.users...');
      } else {
        if (existing_note[0].values[0][0] < value['created_at']) {
          console.log('Updating ' + value['id'] + ' into Notes DB...');
          self.users[value['pubkey']] = value;
          if (value['pubkey'] == self.pubKey) {
            displayProfile(self.pubKey);
          }
          db.exec("UPDATE notes SET id = ?, created_at = ?, kind = ?, note = ? WHERE pubkey = ? AND kind = 0", [value['id'], value['created_at'], value['kind'], note, value['pubkey']]);
          dirty = true;
          console.log('Adding ' + value['pubkey'] + ' to self.users...');
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
          if (tag[4] && tag[4] == self.pubKey && value["pubkey"] != self.pubKey && tag[3] != "root") {
            shouldAlert = true;
          }
        }

        // if the p Tag refers to us
        // AND we didn't write the event

        if (tag[0] == "p") {
          if (tag[1] == self.pubKey && value["pubkey"] != self.pubKey) {
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
      if (value['pubkey'] == self.pubKey) {
        console.log('updating read indicator of ' + parent + ' to ' + value['created_at']);
        db.run("UPDATE toasts SET read_at = MAX(read_at, ?) WHERE id = ?", [value['created_at'], parent]);
      }

      dirty = true;
      console.log('Adding ' + value['id'] + ' to notes');
    } else if (value['kind'] == 30078 && value["pubkey"] == self.pubKey) { // NIP-78 - arbitrary custom app data
      var existing_timestamp = 0;

      var stmt = db.prepare("SELECT * FROM notes WHERE pubkey = $pubkey AND kind = 30078");
      stmt.bind({$pubkey: self.pubKey});

      while(stmt.step()) {
        const row = stmt.getAsObject();
        var existing_timestamp = row.created_at;
      }

      var okayToImport = false;
      value["tags"].forEach((tag) => {
        if (tag[0] == "d" && tag[1] == self.mode) { // Only import settings from this specific application
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
          if (value['created_at'] < JSON.parse(_settings)) {
            console.log('importing setting - time delta = ' + JSON.parse(_settings) - value['created_at'])

            // Notes are encrypted using NIP-44. We need to first decrypt it, then parse it.
            // NIP07 unsupported
            var convoKey = self.NostrTools.nip44.getConversationKey(self.NostrTools.nip19.decode(_privkey).data, self.pubKey);
            var plaintext = self.NostrTools.nip44.v2.decrypt(value['content'], convoKey);
            value['content'] = plaintext;
            importSettings(JSON.stringify(value));
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

  var dbVersion = _version;
  var dbstr = _database;

  if (dbstr && dbVersion !== null && dbVersion == self.version) {
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
  storage.local.set({database: dbstr});
  storage.local.set({version: self.version});
  storage.local.set({settings: JSON.stringify(0)});

  self.browserExtension = true;

  console.log("Cached Notes: " + db.exec("SELECT COUNT(*) FROM notes")[0].values[0][0]);
  console.log("Cached Toasts: " + db.exec("SELECT COUNT(*) FROM toasts WHERE kind = 1")[0].values[0][0]);

  // Start Nostr connections
  var sk = _privkey;
  var pk;

  if (sk === null) {
    _privkey = self.NostrTools.nip19.nsecEncode(self.NostrTools.generateSecretKey());
    storage.local.set({privkey: _privkey});
  }
  sk = Uint8Array.from(self.NostrTools.nip19.decode(_privkey).data);
  self.pubkey = self.NostrTools.getPublicKey(sk);
  self.pool = new self.NostrTools.SimplePool({enableReconnect: true, enablePing: true})
  self.relays = getRelays().relays;
  var dirty = false;

  if (pk) {
    //displayProfile(pk); #FIXME
  }

  var filter;
  var kind;
  kind = 40;
  filter = {kinds: [kind], '#t': ["yakclub", "trollbox"], since: 1750046400}

  console.log('ohai');
  console.log(self.relays);
  console.log(filter);
  console.log(self.pool);

  var h = self.pool.subscribeMany(
    self.relays,[
      filter
    ],
    {
      onevent(event) {
        console.log('hello!');
        toggleConnectionState(true);
        if (event && event.pubkey && event.content && event.kind == 40 && self.NostrTools.verifyEvent(event, event.pubkey) && event.created_at > 1750046400) {
          importToast(event, self.hasFinishedLoading); // if the page has finished loading, save the DB in response to any change.
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

    var stmt = self.db.prepare("SELECT * FROM toasts WHERE kind = 40");
    kind = 42; // children of channel messages are actually kind 42
    //var obj = document.querySelector('#yak');
    while(stmt.step()) {
      const row = stmt.getAsObject();
      var event = JSON.parse(row.note);
      filters.push({kinds: [42], '#e': [event.id]});
    }

    self.filters = filters;
    console.log('filters: '+ filters.toString());

    var h = self.pool.subscribeMany(
      self.relays, filters,
      {
        onevent(event) {
          toggleConnectionState(true);
          if (event && event.pubkey && event.content && event.kind == kind && self.NostrTools.verifyEvent(event, event.pubkey)) {
            importNote(event, self.hasFinishedLoading); // if the page has finished loading, save the DB in response to any change.

            if (self.hasFinishedLoading) { // Trigger a redraw if this is after the initial load...
              // Only redraw rooms we're actually in if a new message comes in - otherwise, just ignore it.
              var weShouldRedraw = false;
              if (document.getElementById('search-bar').value.startsWith('note')) {
                var activeRoom = self.NostrTools.nip19.decode(document.getElementById('search-bar').value).data;

               event["tags"].forEach((tag) => {
                  if (tag[0] == "e" && tag[3] && tag[3] == 'root' && tag[1] == activeRoom) {
                    weShouldRedraw = true;
                  }
                });
              }

              if (weShouldRedraw) {
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

  /* var alertsLink = document.querySelector('a#alertsLink');
  alertsLink.onclick = function(event) {
    event.preventDefault();

    // Draw first, then update the database to mark everything as read
    drawToasts(document.querySelector('#alerts .toasts-container'), self.users, "alerts");

    var stmt = self.db.exec("UPDATE alerts SET read = true WHERE read = false");

    updateAlertsIndicator();
    syncDatabase();
  } FIXME */

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
    var stmt = self.db.prepare("SELECT * FROM toasts WHERE id = $id");
    stmt.bind({$id: id});
    while(stmt.step()) {
      var toast = stmt.getAsObject();
      self.db.run("UPDATE toasts SET favourite = ? WHERE id = ?", [!toast.favourite, id]);
    }
    syncDatabase();
    exportSettings();
  }

  function markToastAsRead(id) {
    self.db.run("UPDATE toasts SET read_at = ? WHERE id = ?", [Math.floor(Date.now() / 1000), self.NostrTools.nip19.decode(id)["data"]]);
    syncDatabase();
  }

  function fetchAuthorInfo() {
    var userPubkeys = [];
    var dirty = false;

    // Get the public keys of everyone who's written a toast
    var stmt = db.prepare("SELECT * FROM toasts WHERE kind = 40");

    while(stmt.step()) {
      const row = stmt.getAsObject();
      var event = JSON.parse(row.note);
      userPubkeys.push(event.pubkey);
    }

    // Get the public keys of everyone who's written a note
    var stmt = db.prepare("SELECT * FROM notes WHERE kind = 42");
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
      if (self.users[event.pubkey] === undefined) {
        self.users[event.pubkey] = event;
        if (event.pubkey == self.pubKey) {
          displayProfile(self.pubKey);
        }
      }
    }


    var h = self.pool.subscribeMany(
      self.relays,[
        {kinds: [0], authors: userPubkeys}
      ],
      {
        onevent(event) {
          toggleConnectionState(true);

          if (event && event.pubkey && event.kind == 0) {
            importNote(event, self.hasFinishedLoading); // if the page has finished loading, save the DB in response to any change.
            dirty = true;
          }
        },
        oneose() {
          if (dirty) {
            syncDatabase();
          }
          if (!self.hasFinishedLoading) {
            if (!self.browserExtension) {
              updateAlertsIndicator(); // If there are new alerts, update the UI to show them
              document.querySelectorAll('.post-boot').forEach((i) => {
                i.classList.remove('post-boot');
              });

              // Draw the new toast UI
              newToast(document.querySelector('#newToastContainer'), {url: ''});

              // Ready to draw page contents - has someone attempted a search (via the URL slug) ?
              if (self.location.hash) {
                document.getElementById('search-bar').value = self.location.hash.substring(1, self.location.hash.length)
              } else {
                // Fragment doesn't exist
              }

              if (document.getElementById('search-bar').value == "") { // If yes
                searchResults(document.getElementById('search-bar').value);
              } else { // If no.
                searchResults(document.getElementById('search-bar').value);
              }
            }
            self.hasFinishedLoading = true;
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
      self.alerts = alerts;
    }

    console.log("Drawing Toasts! - Mode = " + mode);
    try {
      container.querySelector('.toasts-loading').classList.add("active");
      container.querySelector('.toasts').innerHTML = '';
      if (self.lastDrawMode != mode) {
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

      stmt = db.prepare("SELECT * FROM toasts WHERE kind = 40 AND domain LIKE $domain ORDER BY created_at DESC");
      emptyMsg = "Sorry, there are no channels named " + mode.substring(7);
      var closeMatchMsg = "Not what you're looking for?";
      pageTitle = 'Search Results'
      pageSubTitle = 'Room name: ' + mode.substring(7);
      var isExactMatch = false;

      stmt.bind({$domain: '%' + mode.substring(7).toLowerCase() + '%'});

      shouldShowHeadings = true;
      shouldShowMessages = false;

    } else if (mode == "recent") {
      stmt = db.prepare("SELECT * FROM toasts WHERE kind = 40 ORDER BY created_at DESC");
      emptyMsg = "Sorry, there are no channels";
      pageTitle = 'Channels'
      pageSubTitle = '';
      showFilters = true;

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
      stmt = db.prepare("SELECT * FROM toasts WHERE kind = 40 AND pubkey = $pubkey ORDER BY created_at DESC");
      console.log("Filtering to profile " + mode.substring(8));
      var pubkey = self.NostrTools.nip19.decode(mode.substring(8)).data;
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

      emptyMsg = "Sorry, there are no channels from profile " + mode.substring(8) + ' (' + pubkey + ')';
      pageTitle = 'Channels from ' + username;

      pageSubTitle = mode.substring(8);
    } else if (mode.startsWith("toast")) {
      stmt = db.prepare("SELECT * FROM toasts WHERE kind = 40 AND id = $id ORDER BY created_at DESC");

      var query = mode.split('-')[1];

      console.log("Filtering to toast " + query);

      if (query.startsWith("note")) {
        var id = self.NostrTools.nip19.decode(query).data;
      } else if (query.startsWith('nevent')) {
        var id = self.NostrTools.nip19.decode(query).data.id;
      }

      stmt.bind({$id: id});

      shouldShowHeadings = false;
      shouldShowMessages = true;

      var row;

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

      stmt = db.prepare("SELECT * FROM notes WHERE kind = 42 AND id <> $id AND note LIKE $noteid ORDER BY created_at ASC");
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

      if (mode.startsWith('domain') && !isExactMatch) {
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

        var ccStmt = db.prepare("SELECT COUNT(*) FROM notes WHERE kind = 42 AND id <> $id AND note LIKE $noteid");
        var pStmt = db.prepare("SELECT COUNT(DISTINCT pubkey) FROM notes WHERE kind = 42 AND id <> $id AND note LIKE $noteid");
        pStmt.bind({$id: event.id, $noteid: '%' + event.id + '%'});

        var isParticipantStmt = db.prepare("SELECT COUNT(*) FROM notes WHERE kind = 42 AND id <> $id AND note LIKE $noteid AND pubkey = $pubkey");
        isParticipantStmt.bind({$id: event.id, $noteid: '%' + event.id + '%', $pubkey: self.pubKey});

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

        var isCreator = (event.pubkey == self.pubKey);

        if (isCreator) {
          article.classList.add('creator');
        }

        // var lastUpdatedTimestamp = new Date(0);
        // lastUpdatedTimestamp.setUTCSeconds(event.created_at);
        // <span class="middot">&middot;</span> ${lastUpdatedTimestamp}
        ccStmt.bind({$id: event.id, $noteid: '%' + event.id + '%'});

        if (ccStmt.step()) {var messagesCount = ccStmt.getAsObject()["COUNT(*)"]}
        var messagesString = '';

        if (messagesCount != 1) {
          messagesString = 'messages';
        } else {
          messagesString = 'message';
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

        var roomName = 'Unknown';

        try {
          roomName = JSON.parse(event.content)["name"];
        } catch (e) {
          roomName = event.content + ' *';
        }
        var innerHTML = `<a class="favourites">${favouriteIcon}</a> <h2><a class="title">${roomName}</a></h2>
        <p><a class="messages"></a> <span class="middot">&middot;</span> <span class="participants">${participantsCount} ${participantsString}</span></p>
        `
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
        messagesLink.href = '#' + self.NostrTools.nip19.noteEncode(event.id);
        messagesLink.dataset.id = self.NostrTools.nip19.noteEncode(event.id);

        var titleLink = article.querySelector('a.title');
        titleLink.onclick = messagesLink.onclick;
        titleLink.href = '#' + self.NostrTools.nip19.noteEncode(event.id);
        titleLink.dataset.id = self.NostrTools.nip19.noteEncode(event.id);

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

          submitterLink.href = '#' + self.NostrTools.nip19.npubEncode(event.pubkey);
          submitterLink.dataset.pubkey = self.NostrTools.nip19.npubEncode(event.pubkey);
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
        newNote(children, {eTags: eTags});
        drawToasts(container.querySelector('.toasts'), knownUsers, "messages-" + event.id);

        console.log('mode:' + container.querySelector('.toasts').children.length);

        var classFilter = '';
        classFilter = '.note';

        if (!document.querySelector('.toasts ' + classFilter) && mode.startsWith('toast-')) {
          // Add text if there are currently no messages.
          showEmptyMessage = true;
          emptyMsg = 'no messages (yet) - why not be the first to write one?'
        }
      }
    }

    if (pageTitle !== undefined) {
      document.querySelector('h1#title').innerHTML = pageTitle;
      document.title = 'PopUp Video - ' + pageTitle;

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
      if (showEmptyMessage || (mode.startsWith('domain-') && !isExactMatch)) {
        var actionMsg = 'Create';
        // If a room similar to the one we were looking for exists, display the 'close match' message
        // typeof closeMatchMsg !== 'undefined' is basically equivalent to (mode.startsWith('domain-'))
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
        if (mode.startsWith('url-') || (mode.startsWith('domain-'))) {
          var newItem = `<form class="toast-new-form" autocomplete="off" action="">
            <input type="hidden" name="url" value="${mode.substring(7)}" placeholder="Room or domain name" required="">
            <button type="submit" class="toast-submit-button">${actionMsg}</button>
          </form>`;

          container.querySelector('.toasts-empty').innerHTML += '<br />' + newItem;

          var emptyToast = container.querySelector('.toasts-empty')
          emptyToast.addEventListener('submit', (e) => newNoteSubmit(e));

          var emptyInput = container.querySelector('.toasts-empty input')
          emptyInput.addEventListener('keydown', (e) => validateToast(e, 1));
        }

        container.querySelector('.toasts-empty').classList.add("active");
      } else {
        container.querySelector('.toasts-empty').innerHTML = '';
        container.querySelector('.toasts-empty').classList.remove("active");
      }
      if (mode.startsWith('toast-') && self.lastDrawMode != mode) {
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
    submitText = "Create";

    const div = document.createElement('div');
    div.classList.add('toast-new');

    var innerHTML = `
      <div>
        <img class="avatar" src="${avatarURL}" />
        <div class="content">
          <form class="toast-new-form" autocomplete="off" action="">`

          innerHTML += `<input type="text" name="url" value="" placeholder="Room or domain name" required></input>`

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

    div.innerHTML = innerHTML;

    var textarea = div.querySelector("textarea");
    textarea.addEventListener('keydown', (e) => validateToast(e, 2));
    textarea.addEventListener('input', (e) => resizeTextArea(e));

    var form = div.querySelector("form");
    form.addEventListener('submit', (e) => newNoteSubmit(e));

    var cancelButton = div.querySelector(".reply-cancel");
    cancelButton.addEventListener('click', (e) => deleteReplyContent(e));

    node.append(div);
  }
});
