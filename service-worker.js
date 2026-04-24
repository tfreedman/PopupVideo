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
var getPopUps = null;

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getNostrKeys") {
    sendResponse({privkey: self._privkey, pubkey: self.pubkey, npub: self.NostrTools.nip19.npubEncode(self.pubkey)});
  } else if (message.action === "getRelays") {
    sendResponse(getRelays());
  } else if (message.action === "getUsers") {
    sendResponse(self.users);
  } else if (message.action === "getPopUps") {
    sendResponse(getPopUps());
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

var pubkey;
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
        if (value['pubkey'] == self.pubkey) {
          displayProfile(self.pubkey);
        }
        db.run("INSERT INTO notes (id, created_at, pubkey, kind, note) VALUES (?, ?, ?, ?, ?)", [value['id'], value['created_at'], value['pubkey'], value['kind'], note]);
        dirty = true;
        console.log('Adding ' + value['pubkey'] + ' to self.users...');
      } else {
        if (existing_note[0].values[0][0] < value['created_at']) {
          console.log('Updating ' + value['id'] + ' into Notes DB...');
          self.users[value['pubkey']] = value;
          if (value['pubkey'] == self.pubkey) {
            displayProfile(self.pubkey);
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
      db.run("INSERT OR IGNORE INTO notes (id, created_at, pubkey, kind, note) VALUES (?, ?, ?, ?, ?)", [value['id'], value['created_at'], value['pubkey'], value['kind'], note]);

      // Update the room's timestamp on each message received
      db.run("UPDATE toasts SET created_at = MAX(created_at, ?) WHERE id = ?", [value['created_at'], parent]);

      // Mark a room as read if the message we just received came from us
      if (value['pubkey'] == self.pubkey) {
        console.log('updating read indicator of ' + parent + ' to ' + value['created_at']);
        db.run("UPDATE toasts SET read_at = MAX(read_at, ?) WHERE id = ?", [value['created_at'], parent]);
      }

      dirty = true;
      console.log('Adding ' + value['id'] + ' to notes');
    } else if (value['kind'] == 30078 && value["pubkey"] == self.pubkey) { // NIP-78 - arbitrary custom app data
      var existing_timestamp = 0;

      var stmt = db.prepare("SELECT * FROM notes WHERE pubkey = $pubkey AND kind = 30078");
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

  var h = self.pool.subscribeMany(
    self.relays,[
      filter
    ],
    {
      onevent(event) {
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

  function onlyUnique(value, index, array) {
    return array.indexOf(value) === index;
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
        if (event.pubkey == self.pubkey) {
          displayProfile(self.pubkey);
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
            self.hasFinishedLoading = true;
          }
        },
        onclose() {
          toggleConnectionState(false);
        }
      }
    )
  }

  self.getPopUps = function() {
    var popups = [];
    var users = {}
    var stmt = db.prepare("SELECT * FROM notes WHERE kind = 0");
    while(stmt.step()) {
      const row = stmt.getAsObject();
      var event = JSON.parse(row.note);
      users[event.pubkey] = event;
    }

    //stmt = db.prepare("SELECT * FROM toasts WHERE kind = 42 AND url = $url ORDER BY created_at DESC");
    stmt = db.prepare("SELECT * FROM toasts WHERE kind = 42 ORDER BY created_at DESC");
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
      popups.push(row);
    }

    return popups;
  }
});
