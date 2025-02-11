// This is the extension's background script. It contains code to sound the
// alarm, display notifications, and obtain sector maps from JSON files
// installed with the extension.

import Alarm from "./alarm.js";

let alarm = new Alarm();

// Minimal default config. Will be overwritten with sensible values.
const config = { muteAlarm: null, alarmSound: null };

// The collection of alarm-triggering pages currently open, see alarm stuff
// below.
const connections = [];

// Is the alarm ringing right now?
let alarmRinging = false;

let notificationTimer;

chrome.storage.onChanged.addListener(onConfigurationChange);
chrome.runtime.onInstalled.addListener(onInstalled);
chrome.runtime.onMessage.addListener(onMessage);
chrome.runtime.onConnect.addListener(onConnect);

chrome.storage.local.get(["muteAlarm", "alarmSound"]).then((items) => {
  for (const key in items) {
    config[key] = items[key];
  }
  setIcon();
  setAlarm();
});

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

function setIcon() {
  const icon = config.muteAlarm ? MUTED_ACTION_ICON : NORMAL_ACTION_ICON;
  chrome.tabs.query({ url: "*://*.pardus.at/*" }).then((tabs) => {
    for (const tab of tabs) {
      chrome.pageAction.setIcon({ tabId: tab.id, path: icon });
    }
  });
}

function onConfigurationChange(changes, area) {
  if (area !== "local") return;

  let updateAlarm = false;

  {
    const change = changes.muteAlarm;
    if (change) {
      if (config.muteAlarm !== change.newValue) {
        config.muteAlarm = change.newValue;
        setIcon();
        updateAlarm = true;
      }
    }
  }

  {
    const change = changes.alarmSound;
    if (change) {
      if (config.alarmSound !== change.newValue) {
        config.alarmSound = change.newValue;
        updateAlarm = true;
      }
    }
  }

  if (updateAlarm) {
    setAlarm();
    return;
  }

  // If alliance QLs are disabled, fix the configuration. XXX I'm not sure
  // doing this here is the best idea, why are we not doing this in
  // options.js?
  const items = {};
  let save = false;

  {
    const change = changes.allianceQLsArtemisEnabled;
    if (change && !change.newValue) {
      items.allianceQLsArtemis = [];
      items.allianceQLsArtemisMTime = 0;
      save = true;
    }
  }

  {
    const change = changes.allianceQLsOrionEnabled;
    if (change && !change.newValue) {
      items.allianceQLsOrion = [];
      items.allianceQLsOrionMTime = 0;
      save = true;
    }
  }

  {
    const change = changes.allianceQLsArtemisEnabled;
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

// This worker listens for messages from runtime with property `target` set to
// `"worker"`. Other messages are ignored.

function onMessage(request, sender, sendResponse) {
  if (request.target !== "worker") {
    console.debug("bg IGNORING message", request);
    return;
  }

  if (request.requestMap !== undefined) {
    getMap(request.requestMap).then(sendResponse);
    return true;
  }

  if (request.desktopNotification !== undefined) {
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
}

function onPortMessage(connection, message) {
  for (const key in message) {
    switch (key) {
      case "alarm":
        connection.alarm = !!message.alarm;
        setAlarm();
        break;
      case "watchAlarm":
        connection.watchAlarm = !!message.watchAlarm;
        if (connection.watchAlarm) {
          connection.port.postMessage({ alarmState: alarmRinging });
        }
    }
  }
}

function onPortDisconnect(connection) {
  var index = connections.indexOf(connection);
  if (index !== -1) {
    connections.splice(index, 1);
  }
  setAlarm();
}

// The Firefox implementation of the audio alarm is short and sane: just tell
// the instance of Alarm whether to start or stop.
async function setAlarm() {
  const rq = alarmWanted() ? config.alarmSound : null;
  const state = await alarm.play(rq);
  alarmRinging = !!state;
  postAlarmState(state);
}

// Figure out whether the alarm should be playing now.
function alarmWanted() {
  if (!config.muteAlarm) {
    for (var i = 0, end = connections.length; i < end; i++)
      if (connections[i].alarm) return true;
  }
  return false;
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
    clearTimeout(notificationTimer);
    notificationTimer = undefined;
  }

  if (timeout > 0 && timeout < 20000) {
    notificationTimer = setTimeout(onNotificationExpired, timeout);
  }

  chrome.notifications.clear("pardus-sweetener", function () {});
  chrome.notifications.create("pardus-sweetener", options, function () {});
}

function clearDesktopNotification() {
  if (notificationTimer) {
    clearTimeout(notificationTimer);
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
      console.debug("Pardus Sweetener installed its default configuration"),
    );
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
