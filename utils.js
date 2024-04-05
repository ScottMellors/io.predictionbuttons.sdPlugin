let DEBUG = true;

var DestinationEnum = Object.freeze({ "HARDWARE_AND_SOFTWARE": 0, "HARDWARE_ONLY": 1, "SOFTWARE_ONLY": 2 })

// Save global settings
function saveGlobalSettings(context) {
    if (websocket) {
        const json = {
            'event': 'setGlobalSettings',
            'context': context,
            'payload': globalSettings
        };
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

function setImage(context, imageName) {

    //convert to base64img
    var canvas = document.createElement('CANVAS');
    var ctx = canvas.getContext('2d');
    var img = new Image;
    img.crossOrigin = 'Anonymous';
    img.onload = function () {
        canvas.height = img.height;
        canvas.width = img.width;
        //ctx.rotate(vRotate*Math.PI/180);
        ctx.drawImage(img, vPosX, vPosY);
        var dataURL = canvas.toDataURL(outputFormat || 'image/png');

        var json = {
            'event': 'setImage',
            'context': context,
            'payload': {
                'image': dataURL,
                'target': 0
            }
        };
        websocket.send(JSON.stringify(json));
    };

    img.src = imageName;
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

// Load the localizations - CHEERS HUE LIGHTS
function getLocalization(inLanguage, inCallback) {
    var url = inLanguage + '.json';
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);

    xhr.onload = function () {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            try {
                data = JSON.parse(xhr.responseText);
                var localization = data['Localization'];
                inCallback(true, localization);
            }
            catch (e) {
                inCallback(false, 'Localizations is not a valid json.');
            }
        }
        else {
            inCallback(false, 'Could not load the localizations.');
        }
    };

    xhr.onerror = function () {
        inCallback(false, 'An error occurred while loading the localizations.');
    };

    xhr.ontimeout = function () {
        inCallback(false, 'Localization timed out.');
    };

    xhr.send();
}

function setAuthState(context, authState) {
    var json = {
        "event": "setState",
        "context": context,
        "payload": {
            "state": authState ? 0 : 1
        }
    };

    websocket.send(JSON.stringify(json));
}

function setOutcomeState(context, stateNum) {
    var json = {
        "event": "setState",
        "context": context,
        "payload": {
            "state": stateNum
        }
    };

    websocket.send(JSON.stringify(json));
}

function logToFile(message) {

    if (DEBUG) {
        console.log(message);
    }

    if (context) {
        var json = {
            "event": "logMessage",
            "payload": {
                "message": message
            }
        };

        websocket.send(JSON.stringify(json));
    }
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