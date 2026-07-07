self.mode = "PopUpVideo";

var storage = browser.storage; // Add chrome support later
var version = 0; // The version of this script

var _privkey = null;
var _settings = 0;
var _version;
var _database;
// _variables come from the database

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

var pubkey = null;
var getPopUps = null;
var relays = null;

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getNostrKeys") {
    sendResponse({privkey: self._privkey, pubkey: self.pubkey, npub: self.NostrTools.nip19.npubEncode(self.pubkey), profile: getProfile(self.pubkey)}); // sw ok
  } else if (message.action === "setNostrKeys") {
    sendResponse(setNostrKeys(message.privkey)); // sw ok
  } else if (message.action === "getRelays") {
    sendResponse(getRelays()); // sw ok
  } else if (message.action === "getProfile") {
    sendResponse({profile: getProfile(self.pubkey)}); // sw ok
  } else if (message.action === "getPopUps") {
    sendResponse(getPopUps()); // sw ok
  } else if (message.action === "signNote") {
    sendResponse(signNote(message.event, message.privkey)); // sw ok
  } else if (message.action === "uploadNote") {
    sendResponse(uploadNote(message.note)); // sw ok
  } else if (message.action === "decodeNostrKeys") {
    sendResponse(self.NostrTools.nip19.decode(message.keys)); // sw ok
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
    var relays = ["wss://relay.popup.video"];
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

config = {
  locateFile: filename => `${filename}`
}

function syncDatabase() {
  if (self.db !== null) {
    console.log('Syncing Database...');
    var dbstr = toBinString(self.db.export());
    storage.local.set({database: dbstr});
  } else {
    console.log('self.db is null?');
  }
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
  var convoKey = self.NostrTools.nip44.getConversationKey(self.NostrTools.nip19.decode(_privkey).data, self.pubkey);
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
    var stmt = self.db.prepare("SELECT * FROM alerts WHERE id = $id");
    stmt.bind({$id: note.id});
    var result = null;
    while(stmt.step()) {
      result = note.id;
      console.log('setting read on alert ' + note.id);
      self.db.run("UPDATE alerts SET read = ? WHERE id = ?", [note.read, note.id]);
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
      }
    });

    const url = new URL(taggedUrl);
    var domain = url.hostname.toLowerCase();

    console.log('Inserting ' + value['id'] + ' - (' + domain + ') into Toasts DB...');
    self.db.run("INSERT OR IGNORE INTO toasts (id, created_at, domain, url, pubkey, kind, note, favourite, read_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [value['id'], value['created_at'], domain, taggedUrl, value['pubkey'], value['kind'], note, false, 0]);

    if (immediateWrite) {
      syncDatabase();
    }
  }

  self.importNote = function(value, immediateWrite) {
    var dirty = false;
    var note = JSON.stringify(value);
    if (value['kind'] == 0) {
      var existing_note = self.db.exec("SELECT created_at FROM notes WHERE pubkey = ? AND kind = 0", [value['pubkey']])
      if (existing_note.length == 0) {
        console.log('Inserting ' + value['id'] + ' into Notes DB...');
        self.users[value['pubkey']] = value;
        self.db.run("INSERT INTO notes (id, created_at, pubkey, kind, note) VALUES (?, ?, ?, ?, ?)", [value['id'], value['created_at'], value['pubkey'], value['kind'], note]);
        dirty = true;
        console.log('Adding ' + value['pubkey'] + ' to self.users...');
      } else {
        if (existing_note[0].values[0][0] < value['created_at']) {
          console.log('Updating ' + value['id'] + ' into Notes DB...');
          self.users[value['pubkey']] = value;
          self.db.exec("UPDATE notes SET id = ?, created_at = ?, kind = ?, note = ? WHERE pubkey = ? AND kind = 0", [value['id'], value['created_at'], value['kind'], note, value['pubkey']]);
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
          if (tag[4] && tag[4] == self.pubkey && value["pubkey"] != self.pubkey && tag[3] != "root") {
            shouldAlert = true;
          }
        }

        // if the p Tag refers to us
        // AND we didn't write the event

        if (tag[0] == "p") {
          if (tag[1] == self.pubkey && value["pubkey"] != self.pubkey) {
            shouldAlert = true;
          }
        }
      });

      console.log('Inserting ' + value['id'] + ' into Notes DB...');
      self.db.run("INSERT OR IGNORE INTO notes (id, created_at, pubkey, kind, note) VALUES (?, ?, ?, ?, ?)", [value['id'], value['created_at'], value['pubkey'], value['kind'], note]);

      // Update the room's timestamp on each message received
      self.db.run("UPDATE toasts SET created_at = MAX(created_at, ?) WHERE id = ?", [value['created_at'], parent]);

      // Mark a room as read if the message we just received came from us
      if (value['pubkey'] == self.pubkey) {
        console.log('updating read indicator of ' + parent + ' to ' + value['created_at']);
        self.db.run("UPDATE toasts SET read_at = MAX(read_at, ?) WHERE id = ?", [value['created_at'], parent]);
      }

      dirty = true;
      console.log('Adding ' + value['id'] + ' to notes');
    } else if (value['kind'] == 30078 && value["pubkey"] == self.pubkey) { // NIP-78 - arbitrary custom app data
      var existing_timestamp = 0;

      var stmt = self.db.prepare("SELECT * FROM notes WHERE pubkey = $pubkey AND kind = 30078");
      stmt.bind({$pubkey: self.pubkey});

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
          self.db.run("INSERT INTO notes (id, created_at, pubkey, kind, note) VALUES (?, ?, ?, ?, ?)", [value['id'], value['created_at'], value['pubkey'], value['kind'], note]);
          dirty = true;
        } else if (existing_timestamp < value['created_at']) {
          console.log('Updating ' + value['id'] + ' into Notes DB...');
          self.db.run("UPDATE notes SET id = ?, created_at = ?, kind = ?, note = ? WHERE pubkey = ? AND created_at < ? AND kind = 30078", [value['id'], value['created_at'], value['kind'], note, value['pubkey'], value['created_at']]);
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
            var convoKey = self.NostrTools.nip44.getConversationKey(self.NostrTools.nip19.decode(_privkey).data, self.pubkey);
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

  self.init = function() {
    var dbVersion = _version;
    var dbstr = _database;

    if (dbstr && dbVersion !== null && dbVersion == self.version) {
      console.log("Loading existing database - version numbers match");
      self.db = new SQL.Database(toBinArray(dbstr));
    } else {
      console.log("Database version mismatch or undefined - creating a new DB");
      self.db = new SQL.Database();
      self.db.run("CREATE TABLE IF NOT EXISTS toasts (id TEXT NOT NULL PRIMARY KEY, created_at INTEGER NOT NULL, domain TEXT NOT NULL, url TEXT NOT NULL, pubkey TEXT NOT NULL, kind INTEGER NOT NULL, note TEXT NOT NULL, favourite BOOLEAN NOT NULL, read_at INTEGER NOT NULL);");
      self.db.run("CREATE TABLE IF NOT EXISTS notes (id TEXT NOT NULL PRIMARY KEY, created_at INTEGER NOT NULL, pubkey TEXT NOT NULL, kind INTEGER NOT NULL, note TEXT NOT NULL);");
      self.db.run("CREATE INDEX idx_toasts_domain ON toasts (domain);")
    }

    var dbstr = toBinString(self.db.export());
    storage.local.set({database: dbstr});
    storage.local.set({version: self.version});
    storage.local.set({settings: JSON.stringify(0)});

    self.browserExtension = true;

    console.log("Cached Notes: " + self.db.exec("SELECT COUNT(*) FROM notes")[0].values[0][0]);
    console.log("Cached Toasts: " + self.db.exec("SELECT COUNT(*) FROM toasts WHERE kind = 1")[0].values[0][0]);

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

    var filter;
    var kind;
    kind = 1;
    filter = {kinds: [kind], '#t': ["popupvideo"], since: 1750046400}

    var h = self.pool.subscribeMany(
      self.relays,[
        filter
      ],
      {
        onevent(event) {
          toggleConnectionState(true);
          if (event && event.pubkey && event.content && event.kind == 1 && self.NostrTools.verifyEvent(event, event.pubkey) && event.created_at > 1750046400) {
            // All good for Nostr - but is it a valid PopUp Video note?

            var valid = false;

            event["tags"].forEach((tag) => {
              if (tag[0] == "timestamp") {
                if (typeof tag[1] !== 'undefined' && Number(tag[1])) {
                  valid = true;
                }
              }
            });

            if (valid) {
              importToast(event, self.hasFinishedLoading); // if the page has finished loading, save the DB in response to any change.
              dirty = true;
            }
          }
        },
        oneose() {
          if (dirty) {
            syncDatabase();
          }
          console.log('EOSE on popups - Calling fetchAuthorInfo...');
          fetchAuthorInfo();
        },
        onclose() {
          toggleConnectionState(false);
        }
      }
    )
  }

  init();

  function onlyUnique(value, index, array) {
    return array.indexOf(value) === index;
  }

  function fetchAuthorInfo() {
    var userPubkeys = [];
    var dirty = false;

    // Get the public keys of everyone who's written a toast
    var stmt = self.db.prepare("SELECT * FROM toasts WHERE kind = 1");

    while(stmt.step()) {
      const row = stmt.getAsObject();
      var event = JSON.parse(row.note);
      userPubkeys.push(event.pubkey);
    }

    // Suppress duplicate authors
    userPubkeys = userPubkeys.filter(onlyUnique);

    console.log("userPubkeys: " + userPubkeys);

    // Fetch all known authors from the database, and load their profiles into memory
    var stmt = self.db.prepare("SELECT * FROM notes WHERE kind = 0");
    while(stmt.step()) {
      const row = stmt.getAsObject();
      var event = JSON.parse(row.note);

      // Load the rows from the DB first before loading from the network
      if (self.users[event.pubkey] === undefined) {
        self.users[event.pubkey] = event;
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
            self.hasFinishedLoading = true;
          }
        },
        onclose() {
          toggleConnectionState(false);
        }
      }
    )
  }

  self.signNote = function(event, privkey) {
    console.log('Hello from signNote!');
    console.log(self.NostrTools.finalizeEvent(event, Uint8Array.from(self.NostrTools.nip19.decode(privkey).data)));
    return self.NostrTools.finalizeEvent(event, Uint8Array.from(self.NostrTools.nip19.decode(privkey).data));
  }

  self.uploadNote = function(note) {
    console.log("Sending " + JSON.stringify(note));
    if (self.pool == null) {
      init();
      console.log('self.relays:');
      console.log(self.relays);
    } else {
      console.log('self.pool:')
      console.log(self.pool);
      console.log('self.relays:');
      console.log(self.relays);
    }
    Promise.any(self.pool.publish(self.relays, note)).then(relay => {
      // When we upload a note, normally we'd have to keep track of state.
      // If there are no messages, we'd have to remove the message asking you to be the first.
      // We'd also have to update the number of messages, etc. Or, we can cheat and just re-render everything.

      var isToast = false;
      if (note["kind"] == 1) {
        note["tags"].forEach((tag) => {
          if (tag[0] == "t" && tag[1].toLowerCase().startsWith('popupvideo')) {
            isToast = true;
          }
        });
      }

      if (isToast) {
        self.importToast(note);
      } else {
        self.importNote(note);
      }

      return true;
    });
    return note;
  }

  self.setNostrKeys = function(privkey) {
    storage.local.set({privkey: privkey});
    storage.local.set({version: 0}); // This will mismatch with the existing DB version, causing it to be blown away on reload
    init();
    return {privkey: self._privkey, pubkey: self.pubkey, npub: self.NostrTools.nip19.npubEncode(self.pubkey)};
  }


  self.getProfile = function() {
    if (self.db == null) {
      init();
    }
    var stmt = self.db.prepare("SELECT * FROM notes WHERE kind = 0");
    var dbok = (self.db != null);
    while(stmt.step()) {
      const row = stmt.getAsObject();
      var event = JSON.parse(row.note);

      if (event.pubkey == self.pubkey) {
        return {event: event, dbok: dbok}
      }
    }
    return {event: null, dbok: dbok}
  }

  self.getPopUps = function() {
    if (self.db == null) {
      init();
    }

    var popups = [];
    var users = {}
    var stmt = self.db.prepare("SELECT * FROM notes WHERE kind = 0");
    while(stmt.step()) {
      const row = stmt.getAsObject();
      var event = JSON.parse(row.note);
      users[event.pubkey] = event;
    }

    stmt = self.db.prepare("SELECT * FROM toasts WHERE kind = 1 ORDER BY created_at DESC"); // Ignore URL or Domain for now
    //stmt = self.db.prepare("SELECT * FROM toasts WHERE kind = 1 AND url = $url ORDER BY created_at DESC");
    //stmt = self.db.prepare("SELECT * FROM notes WHERE kind = 42 ORDER BY created_at DESC");
    //stmt.bind({$url: mode.substring(4)});

    var row;

    while(true) {
      if (stmt.step()) {
        row = stmt.getAsObject();
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

      // Copy all of the e Tags from the references in the parent post
      event["tags"].forEach((tag) => {
        if (tag[0] == "e") {
          parent = tag[1];
        }
      });

      //if (parent != mode.substring(8)) {
      if (false) {
        continue; // Cancel rendering if the parent isn't actually an exact match.
      }

      row._author = users[row.pubkey];
      row._npub = self.NostrTools.nip19.npubEncode(row.pubkey);

      popups.push(row);
    }

    return popups;
  }
});
