// This is the extension proper, the event page.  We've taken most
// functionality out from it. What remains is code to sound the alarm,
// display notifications, and obtain sector maps from JSON files
// installed with the extension.

import prepareOffscreen from "./prepoffscr.js";

console.log("svcworker loaded");

// We set an initial value for config here because, in this particular page, we
// have no guarantee that onConfigurationReady will be called with a full
// config.  The very first time the extension runs, it'll be called with an
// empty 'items', then onInstall will complete and trigger
// onConfigurationChange. These defaults will then be overwritten with sensible
// values anyway, but we need config to have the properties by the time
// onConfigurationChange is called, because of the logic in that function.
const config = { muteAlarm: null, alarmSound: null };

// The collection of alarm-triggering pages currently open, see alarm stuff
// below.
const connections = [];

let audio, currentSoundId, notificationTimer;

console.log("svcworker starting");
chrome.storage.onChanged.addListener(onConfigurationChange);
chrome.runtime.onInstalled.addListener(onInstalled);
chrome.runtime.onMessage.addListener(onMessage);
chrome.runtime.onConnect.addListener(onConnect);

chrome.storage.local.get(["muteAlarm", "alarmSound"]).then(finishConfiguration);

console.log("svcworker started");

function finishConfiguration(items) {
  console.log("svcworker finish config", items);
  for (const key in items) {
    config[key] = items[key];
  }
  updateAlarmState();
}

function onConfigurationChange(changes, area) {
  console.log("svcworker onConfigurationChange", changes, area);

  if (area !== "local") {
    return;
  }

  let updated = false;
  for (const key in changes) {
    if (config.hasOwnProperty(key)) {
      config[key] = changes[key].newValue;
      updated = true;
    }
  }

  if (updated) {
    updateAlarmState();
  } else {
    // If alliance QLs are disabled, fix the configuration. XXX I'm not sure
    // doing this here is the best idea, why are we not doing this in
    // options.js?
    const items = {};
    let save = false;

    {
      const change = changes["allianceQLsArtemisEnabled"];
      if (change && !change.newValue) {
        items.allianceQLsArtemis = [];
        items.allianceQLsArtemisMTime = 0;
        save = true;
      }
    }

    {
      const change = changes["allianceQLsOrionEnabled"];
      if (change && !change.newValue) {
        items.allianceQLsOrion = [];
        items.allianceQLsOrionMTime = 0;
        save = true;
      }
    }

    {
      const change = changes["allianceQLsArtemisEnabled"];
      if (change && !change.newValue) {
        items.allianceQLsPegasus = [];
        items.allianceQLsPegasusMTime = 0;
        save = true;
      }
    }

    if (save) {
      chrome.storage.local.set(items);
    }
  }
}

function onMessage(request, sender, sendResponse) {
  console.log("svcworker onMessage", request, sender);
  let asyncResponse = false;

  if (sender.tab) {
    // Show the page action for all tabs sending us messages. This
    // is slightly iffy but hey, it works.
    showAction(sender.tab.id);
  }

  if (request.hasOwnProperty("requestMap")) {
    getMap(request.requestMap).then(sendResponse);
    asyncResponse = true;
  } else if (request.hasOwnProperty("desktopNotification")) {
    if (request.desktopNotification) {
      showDesktopNotification(
        request.title || "Meanwhile, in Pardus...",
        request.desktopNotification,
        request.timeout,
      );
      sendResponse(true);
    } else {
      clearDesktopNotification();
      sendResponse(false);
    }
  }

  return asyncResponse;
}

const NORMAL_ACTION_ICON = {
  16: "icons/16.png",
  24: "icons/24.png",
  32: "icons/32.png",
};
const MUTED_ACTION_ICON = {
  16: "icons/16mute.png",
  24: "icons/24mute.png",
  32: "icons/32mute.png",
};

function showAction(tabId) {
  let icon;
  if (config && config.muteAlarm) {
    icon = MUTED_ACTION_ICON;
  } else {
    icon = NORMAL_ACTION_ICON;
  }
  chrome.action.setIcon({ path: icon, tabId: tabId });
  // chrome.action.show(tabId) enable?
}

async function getMap(sectorName) {
  const map = `map/${sectorName[0]}/${sectorName.replace(" ", "_")}.json`;
  const url = chrome.runtime.getURL(map);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`no map for ${sectorName}`);
  }
  const text = await response.text();
  return JSON.parse(text);
}

// Alarm stuff.
//
// There are three type of pages that can request the alarm to ring: (1) the
// popup page, when the user clicks on "test alarm; (2) the options page, also
// when the user clicks on "test alarm"; and (3) the message frame in any and
// Pardus tab, when we have an actual COMBAT etc. But there is just one alarm:
// no matter how many Pardus tabs are open, nor whether popup or options are
// being shown, there is just one audio sample to start or stop.
//
// The way we do this is with long-lived ports. Any page that can request an
// alarm opens a port connection, handled by this worker, and specifies through
// messages on its port whether it wants to turn on the alarm. The alarm sounds
// if at least one port requests it.
//
// This takes care of the case when one of the pages goes away: user closed the
// popup, closed the tab, whatever. This causes the port to disconnect, and we
// can monitor that to stop the alarm if appropriate.

function onConnect(port) {
  console.log("svcworker onConnect");
  const connection = {
    // the ID of the port
    port: port,
    // whether this port wants the alarm on
    alarm: false,
    // whether this port wants a notification when the alarm goes on and off
    watchAlarm: false,
  };
  const messageListener = function (message) {
    onPortMessage(connection, message);
  };
  const disconnectListener = function () {
    onPortDisconnect(connection);
  };

  connections.push(connection);
  port.onMessage.addListener(messageListener);
  port.onDisconnect.addListener(disconnectListener);
  console.log(
    "svcworker added connection",
    connection,
    `talking to ${connections.length} ports`,
  );
}

function onPortMessage(connection, message) {
  console.log("svcworker onPortMessage", connection, message);
  for (const key in message) {
    switch (key) {
      case "alarm":
        connection.alarm = !!message.alarm;
        updateAlarmState();
        break;
      case "watchAlarm":
        // assignment, not comparison:
        connection.watchAlarm = !!message.watchAlarm;
        if (connection.watchAlarm) {
          // and give it an immediate update
          var state =
            audio && audio.readyState == 4 && !audio.paused ? true : false;
          connection.port.postMessage({ alarmState: state });
        }
    }
  }
}

function onPortDisconnect(connection) {
  console.log("scvworker onPortDisconnect", connection);
  var index = connections.indexOf(connection);
  if (index !== -1) {
    connections.splice(index, 1);
    console.log(
      "svcworker removed connection",
      connection,
      `talking to ${connections.length} ports`,
    );
  }
  updateAlarmState();
}

async function updateAlarmState() {
  const wanted = alarmWanted();
  console.log(`svcworker pinging offscreen: wanted = ${wanted}`);
  if (wanted) {
    await prepareOffscreen();
    const state = await chrome.runtime.sendMessage({
      target: "offscreen",
      play: config.alarmSound,
    });
    console.log(`svcworker: alarm is now ${state}`);
  } else {
    try {
      // Post a message to shut up.
      await chrome.runtime.sendMessage({
        target: "offscreen",
        play: null,
      });
    } catch (x) {
      // This happens when no one was listening. We don't care, if the offscreen
      // document wasn't open, the alarm is not ringing anyway.
    }
  }
}

// This function turns the alarm on and off as needed. Old messy ancient
// version, remove XXX
function updateAlarmStateOld() {
  if (alarmWanted()) {
    // Bring the noise
    if (audio) {
      if (currentSoundId == config.alarmSound) {
        if (audio.readyState == 4) {
          if (audio.paused) {
            audio.play();
            postAlarmState(true);
          }
          // else do nothing, we were already playing
        }
        // else do nothing, the canplay listener will call us again.
      } else {
        // We need to change the sound id
        setAlarmSound();
      }
    } else {
      // No audio yet, create it
      audio = new Audio();
      audio.loop = true;
      audio.addEventListener("canplaythrough", onAudioCanPlayThrough);
      setAlarmSound();
      // and return now. the canplay listener will call us again.
    }
  } else {
    // Shut it
    if (audio && audio.readyState == 4 && !audio.paused) {
      audio.pause();
      audio.currentTime = 0;
      postAlarmState(false);
    }
    // otherwise do nothing, the alarm isn't playing
  }
}

function onAudioCanPlayThrough() {
  updateAlarmState();
}

// Figure out whether the alarm should be playing now.
function alarmWanted() {
  if (!config.muteAlarm) {
    for (var i = 0, end = connections.length; i < end; i++)
      if (connections[i].alarm) return true;
  }
  return false;
}

// This is always called when audio already exists, we make sure of that.
function setAlarmSound() {
  var soundId = config.alarmSound;

  audio.src = "sounds/" + soundId + ".ogg";
  currentSoundId = soundId;
}

function postAlarmState(state) {
  var message = { alarmState: state };
  for (var i = 0, end = connections.length; i < end; i++) {
    var connection = connections[i];
    if (connection.watchAlarm) {
      connection.port.postMessage(message);
    }
  }
}

function showDesktopNotification(title, text, timeout) {
  var options = {
    type: "basic",
    title: title,
    message: text,
    iconUrl: "icons/48.png",
  };

  if (notificationTimer) {
    window.clearTimeout(notificationTimer);
    notificationTimer = undefined;
  }

  if (timeout > 0 && timeout < 20000) {
    notificationTimer = window.setTimeout(onNotificationExpired, timeout);
  }

  chrome.notifications.clear("pardus-sweetener", function () {});
  chrome.notifications.create("pardus-sweetener", options, function () {});
}

function clearDesktopNotification() {
  if (notificationTimer) {
    window.clearTimeout(notificationTimer);
    notificationTimer = undefined;
  }

  chrome.notifications.clear("pardus-sweetener", function () {});
}

function onNotificationExpired() {
  notificationTimer = undefined;
  chrome.notifications.clear("pardus-sweetener", function () {});
}

function onInstalled(details) {
  if (details.reason === "install") {
    setDefaultConfig().then(() =>
      console.log("Pardus Sweetener installed its default configuration"),
    );
  } else {
    console.log(`ignored install notification for ${details.reason}`);
  }
}

async function setDefaultConfig() {
  const cfg = {
    alarmAlly: false,
    alarmCombat: true,
    alarmInfo: false,
    alarmMission: false,
    alarmPayment: false,
    alarmPM: false,
    alarmSound: "timex",
    alarmTrade: false,
    alarmWarning: false,
    allianceQLsArtemis: [],
    allianceQLsArtemisEnabled: true,
    allianceQLsArtemisMTime: 0,
    allianceQLsOrion: [],
    allianceQLsOrionEnabled: true,
    allianceQLsOrionMTime: 0,
    allianceQLsPegasus: [],
    allianceQLsPegasusEnabled: true,
    allianceQLsPegasusMTime: 0,
    artemisOnlineList: "",
    artemisOnlineListEnabled: false,
    autobots: false,
    autobotsArtemisPoints: 0,
    autobotsArtemisPreset: 0,
    autobotsArtemisStrength: 36,
    autobotsOrionPoints: 0,
    autobotsOrionPreset: 0,
    autobotsOrionStrength: 36,
    autobotsPegasusPoints: 0,
    autobotsPegasusPreset: 0,
    autobotsPegasusStrength: 36,
    clockAP: true,
    clockB: true,
    clockD: true,
    clockE: false,
    clockL: false,
    clockN: false,
    clockP: true,
    clockR: false,
    clockS: true,
    clockStim: true,
    clockUTC: false,
    clockZ: false,
    desktopAlly: true,
    desktopCombat: true,
    desktopInfo: false,
    desktopMission: false,
    desktopPayment: false,
    desktopPM: true,
    desktopTrade: false,
    desktopWarning: false,
    displayDamage: true,
    fitAmbushRounds: true,
    miniMap: true,
    miniMapPlacement: "topright",
    missionDisplay: true,
    muteAlarm: false,
    navBlackMarketLink: true,
    navBountyBoardLink: false,
    navBulletinBoardLink: true,
    navCrewQuartersLink: false,
    navFlyCloseLink: true,
    navHackLink: true,
    navigationCoordinates: false,
    navShipLinks: true,
    navShipyardLink: false,
    navWeaponLink: true,
    orionOnlineList: "",
    orionOnlineListEnabled: false,
    overrideAmbushRounds: false,
    pathfindingEnabled: true,
    pegasusOnlineList: "",
    pegasusOnlineListEnabled: false,
    personalQLArtemis: "",
    personalQLArtemisEnabled: false,
    personalQLOrion: "",
    personalQLOrionEnabled: false,
    personalQLPegasus: "",
    personalQLPegasusEnabled: false,
    pvbMissileAutoAll: true,
    pvmHighestRounds: false,
    pvmMissileAutoAll: false,
    pvpHighestRounds: true,
    pvpMissileAutoAll: true,
    sendmsgShowAlliance: true,
  };

  await chrome.storage.local.clear();
  await chrome.storage.local.set(cfg);
}
