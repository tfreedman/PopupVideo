browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "hi") {
    sendResponse({ message: "hello!" });
  }
});

function syncDatabase() {
  var dbstr = toBinString(window.db.export());
  window.localStorage.setItem(window.mode + ".sqlite", dbstr);
}

function exportSettings() {
  var settings = new Object();
  if (window.mode == "PopUpVideo") {
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
  // NIP07 unsupported
  var convoKey = window.NostrTools.nip44.getConversationKey(window.NostrTools.nip19.decode(localStorage.getItem('privkey')).data, window.pubKey);
  var ciphertext = window.NostrTools.nip44.v2.encrypt(JSON.stringify(settings), convoKey, randomBytes(32));
  var e = {created_at: Math.floor(Date.now() / 1000), kind: 30078, tags: [['d', window.mode]], content: ciphertext};
  var note = window.NostrTools.finalizeEvent(e, Uint8Array.from(window.NostrTools.nip19.decode(localStorage.getItem('privkey')).data))
  console.log("signed note without nip07: " + note);
  uploadNote(null, note, null);
}

function importSettings(note) {
  // This function imports a plaintext note. If you have an encrypted note, it has to be decrypted upstream.
  settings = JSON.parse(JSON.parse(note)['content']);
  created_at = JSON.parse(note)['created_at'];

  console.log('attempting to import settings: ');
  console.log(settings);

  if (window.mode == "PopUpVideo") {
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
