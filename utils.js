var DestinationEnum = Object.freeze({ "HARDWARE_AND_SOFTWARE": 0, "HARDWARE_ONLY": 1, "SOFTWARE_ONLY": 2 })

// Save global settings
function saveGlobalSettings(context) {
    if (websocket) {
        const json = {
            'event': 'setGlobalSettings',
            'context': context,
            'payload': globalSettings
        };

        console.log("SAVING " + JSON.stringify(globalSettings) + " " + context);

        websocket.send(JSON.stringify(json));
    }
}

function returnToProfile(pluginUUID, device) {
    if (websocket) {
        var json = {
            "event": "switchToProfile",
            "context": pluginUUID,
            "device": device.id,
            "payload": {}
        };

        websocket.send(JSON.stringify(json));
    }
}

function loadProfile(pluginUUID, device, profile) {
    if (websocket) {
        var json = {
            "event": "switchToProfile",
            "context": pluginUUID,
            "device": device.id,
            "payload": {
                "profile": profile
            }
        };

        websocket.send(JSON.stringify(json));
    }
}

// Request global settings for the plugin
function requestGlobalSettings(pluginUUID) {
    if (websocket) {
        var json = {
            'event': 'getGlobalSettings',
            'context': pluginUUID
        };

        console.log("requestin " + pluginUUID);

        websocket.send(JSON.stringify(json));
    }
}

function setSettings(context, settings) {
    if (websocket) {
        var json = {
            "event": "setSettings",
            "context": context,
            "payload": settings
        };

        websocket.send(JSON.stringify(json));
    }
}

function getSettings(context) {
    var json = {
        "event": "getSettings",
        "context": context
    };

    websocket.send(JSON.stringify(json));
}

function setTitle(context, value) {
    var json = {
        "event": "setTitle",
        "context": context,
        "payload": {
            "title": value,
            "target": DestinationEnum.HARDWARE_AND_SOFTWARE
        }
    };

    websocket.send(JSON.stringify(json));
}

function showError(context) {
    var json = {
        "event": "showAlert",
        "context": context,
    };

    websocket.send(JSON.stringify(json));
}

function setLockState(context, lockState) {
    var json = {
        "event": "setState",
        "context": context,
        "payload": {
            "state": lockState ? 1 : 0
        }
    };

    websocket.send(JSON.stringify(json));
}

function startDurationTimer(context, duration) {
    locktimer = setTimeout(() => {
        globalSettings.activePredictionState = "LOCKED";
        setLockState(context, true);
        locktimer = undefined;
    }, duration * 1000);
}
