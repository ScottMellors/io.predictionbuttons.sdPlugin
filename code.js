let globalSettings = {};

let websocket = null;
let pluginUUID = null;
let gotGlobalSettings = false;
let devices;

let currentlyBusy = false;

function connectElgatoStreamDeckSocket(inPort, inPluginUUID, inRegisterEvent, inInfo) {
    pluginUUID = inPluginUUID;

    devices = JSON.parse(inInfo).devices.reduce(function (map, obj) {
        map[obj.id] = obj;
        return map;
    }, {});

    // Open the web socket
    websocket = new WebSocket("ws://localhost:" + inPort);

    function registerPlugin(inPluginUUID) {
        let json = {
            "event": inRegisterEvent,
            "uuid": inPluginUUID
        };

        websocket.send(JSON.stringify(json));
    };

    websocket.onopen = function () {
        // WebSocket is connected, send message
        registerPlugin(pluginUUID);
    };

    websocket.onmessage = function (evt) {
        // Received message from Stream Deck
        let jsonObj = JSON.parse(evt.data);
        let event = jsonObj["event"];
        let action = jsonObj["action"];
        let context = jsonObj["context"];
        let jsonPayload = jsonObj["payload"] || {};
        let settings = jsonPayload["settings"] || {};
        let device = jsonObj["device"];

        if (event == "keyDown") {
            let settings = jsonPayload["settings"];
            let coordinates = jsonPayload["coordinates"];
            let userDesiredState = jsonPayload["userDesiredState"];

            //get correct variable for id
            let actionType = action.replace("io.predictionbuttons.", "");
            let actionObj = onKeyDownActionSet[actionType];
            if (actionObj) {
                actionObj.onKeyDown(context, settings, coordinates, userDesiredState, device);
            }

        } else if (event == "keyUp") {
            let settings = jsonPayload["settings"];
            let coordinates = jsonPayload["coordinates"];
            let userDesiredState = jsonPayload["userDesiredState"];
            if (action == "io.predictionbuttons.start") {
                startAction.onKeyUp(context, settings, coordinates, userDesiredState);
            }
        } else if (event == "willAppear") {
            settings = jsonPayload["settings"];
            let coordinates = jsonPayload["coordinates"];

            switch (action) {
                case "io.predictionbuttons.start":
                    requestGlobalSettings(pluginUUID);
                    break;
                default:
                    //get correct variable for id
                    let actionType = action.replace("io.predictionbuttons.", "");

                    let actionObj = willAppearActionSet[actionType];
                    if (actionObj) {
                        actionObj.onWillAppear(context, settings, coordinates, device);
                    }
                    break;
            }
        } else if (event == "sendToPlugin") {
            if (jsonPayload.hasOwnProperty("outcomeValue")) {
                settings.outcomeNumber = jsonPayload.outcomeValue;
                setSettings(context, settings);
            } else if (jsonPayload.hasOwnProperty("predictionTitle")) {
                settings.predictionTitle = jsonPayload.predictionTitle;
                settings.outcomes = jsonPayload.outcomes;
                settings.duration = jsonPayload.duration;
                settings.profileSwap = jsonPayload.profileSwap;

                setSettings(context, settings);
            } else if (jsonPayload.hasOwnProperty("show")) {
                showError();
            }
        } else if (event == "didReceiveGlobalSettings") {
            logToFile("didReceiveGlobalSettings");
            gotGlobalSettings = true;
            globalSettings = jsonPayload.settings;
        }
    };

    websocket.onclose = function () {
        // Websocket is closed
    };
};

//Auth

function recentlyAuthorised() {
    if (globalSettings.expires_in == null) {
        return false;
    }

    let expiryDate = new Date(globalSettings.expires_in);
    logToFile("176 - " + expiryDate.toTimeString() + " " + new Date(Date.now()) + " " + expiryDate.getTime() + " " + Date.now());

    if (expiryDate.getTime() > Date.now()) {
        return true;
    } else {
        return false;
    }
}

function checkAuthAndContinue(actionName, context, defaultPng, action) {
    if (currentlyBusy == true) {
        logToFile(`203 - ${actionName} - Currently Busy`);
        return;
    } else if (gotGlobalSettings) {
        logToFile(`202 - ${actionName} - Not busy, got globals`);
        if (recentlyAuthorised() == true) {
            logToFile(`211 - ${actionName} - recently Auth'd`);
            action.call();
        } else {
            logToFile(`218 - ${actionName} - not recently Auth'd`);
            if (!globalSettings.broadcasterAccessToken) {
                setAuthState(context, false);
            } else {
                updateButtonBusyState(context, true, defaultPng);

                fetch("https://id.twitch.tv/oauth2/validate", {
                    headers: {
                        Authorization: "Bearer " + globalSettings.broadcasterAccessToken,
                        "Client-Id": "dx2y2z4epfd3ycn9oho1dnucnd7ou5",
                        "Content-Type": "application/json"
                    }
                }).then(async (response) => {
                    if (!response.ok) {
                        //Do reauth flow iwht refresh token
                        if (globalSettings.broadcasterRefreshToken) {
                            logToFile(`213 - ${actionName} - ${response.status} ${response.statusText}`);

                            let success = await refreshToken();

                            if (success == true) {
                                updateButtonBusyState(context, false, defaultPng);
                                //do continue
                                action.call();
                            } else {
                                updateButtonBusyState(context, false, defaultPng);

                                //alert
                                showError(context);
                                setAuthState(context, false);
                            }
                        } else {
                            updateButtonBusyState(context, false, defaultPng);

                            //show error
                            logToFile(`234 - ${actionName} - ${response.status} ${response.statusText}`);
                            setAuthState(context, false);
                        }
                    } else {
                        updateButtonBusyState(context, false, defaultPng);
                        setAuthState(context, true);
                        action.call();
                    }
                }).catch((error) => {
                    updateButtonBusyState(context, false, defaultPng);

                    logToFile(`286 - ${actionName} - ${error}`);
                    setAuthState(context, false);
                });
            }
        }
    } else {
        logToFile(`299  - ${actionName} - Something terrible has happened.`);
        setAuthState(context, true);
    }
}

async function refreshToken() {
    let authd = false;
    if (globalSettings.broadcasterRefreshToken) {
        logToFile("Refreshing token with " + globalSettings.broadcasterRefreshToken + " " + globalSettings.lastUpdated);
        let tokens = await refreshAccessToken(globalSettings.broadcasterRefreshToken);

        if (tokens.accessToken && tokens.refreshToken && tokens.expires_in) {
            authd = true;

            logToFile("got new tokens - " + tokens.accessToken + " - " + tokens.refreshToken + " - " + tokens.expires_in);
            globalSettings.broadcasterAccessToken = tokens.accessToken;
            globalSettings.broadcasterRefreshToken = tokens.refreshToken;
            globalSettings.expires_in = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();
            globalSettings.lastUpdated = new Date(Date.now()).toISOString();

            saveGlobalSettings(pluginUUID);
        } else {
            logToFile("broadcasterRefreshToken refresh failed - missing values");
            authd = false;
        }
    } else {
        logToFile("broadcasterRefreshToken not found");
        authd = false;
    }

    setAuthState(pluginUUID, authd);
    return authd;
}

//API Actions

//TODO could build this into the settings to save time/effort?
function generateOutcomes(settings) {
    let outcomesObj = [];

    if (!settings.outcomes) {
        settings.outcomes = ["YES", "NO"];
    }

    settings.outcomes.forEach(outcome => {
        outcomesObj.push({ "title": outcome });
    });
    return outcomesObj;
}

function createPrediction(context, settings, deviceId, outcomesObj) {
    //continue to create;
    fetch("https://api.twitch.tv/helix/predictions", {
        body: JSON.stringify({
            "broadcaster_id": globalSettings.broadcasterId,
            "title": settings.predictionTitle ?? "Will I RIP?",
            "outcomes": outcomesObj,
            "prediction_window": settings.duration ?? 120
        }),
        headers: {
            Authorization: "Bearer " + globalSettings.broadcasterAccessToken,
            "Client-Id": "dx2y2z4epfd3ycn9oho1dnucnd7ou5",
            "Content-Type": "application/json"
        },
        method: "POST"
    }).then((response) => {
        if (response.ok) {

            response.json().then((body) => {
                //get prediction id
                globalSettings.activePredictionId = body.data[0].id;

                //Store outcomes, not individual ID's
                globalSettings.activeOutcomes = body.data[0].outcomes;

                globalSettings.activePredictionState = "ACTIVE";

                saveGlobalSettings(pluginUUID);

                //transition to new profile screen
                if (settings.profileSwap != false) {
                    loadCorrectProfile(pluginUUID, devices[deviceId]);
                }
            });
        } else {
            showError(context);
        }
    }).catch((reason) => {
        showError(context);
        logToFile(reason);
    });
}

function fireOffPrediction(context, settings, deviceId) {
    logToFile("111 " + globalSettings.expires_in + " " + globalSettings.lastUpdated);

    fetch("https://api.twitch.tv/helix/predictions?" + new URLSearchParams({
        "broadcaster_id": globalSettings.broadcasterId,
    }), {
        headers: {
            Authorization: "Bearer " + globalSettings.broadcasterAccessToken,
            "Client-Id": "dx2y2z4epfd3ycn9oho1dnucnd7ou5",
            "Content-Type": "application/json"
        }
    }).then(response => {
        if (!response.ok) {
            logToFile("315 - " + response.status);
            throw new Error(response.status);
        } else {

            if (!response.ok) {
                logToFile("fireOffPrediction - Response not ok - " + response.status + " - " + response.statusText);
                showError(context);
            } else {

                response.json().then((body) => {
                    let outcomesObj = generateOutcomes(settings);

                    if (body.data) {
                        let lastPredictionData = body.data;
                        let lastPrediction = lastPredictionData[0];
                        if (lastPrediction.status === "ACTIVE" || lastPrediction.status === "LOCKED") {
                            logToFile("145 - Prediction active - " + lastPrediction.status);

                            if (lastPrediction.id != globalSettings.activePredictionId) {
                                //resume remote started prediction
                                globalSettings.activePredictionId = lastPrediction.id;
                                globalSettings.activeOutcomes = lastPrediction.outcomes;
                                globalSettings.activePredictionState = lastPrediction.status;
                            }

                            saveGlobalSettings(pluginUUID);

                            if (settings.profileSwap != false) {
                                loadCorrectProfile(pluginUUID, devices[deviceId]);
                            }
                        } else {
                            logToFile("144 - No active Prediction");
                            createPrediction(context, settings, deviceId, outcomesObj);
                        }
                    } else {
                        logToFile("143 - body.data = " + body);
                        createPrediction(context, settings, deviceId, outcomesObj);
                    }
                }).catch((e) => {
                    logToFile("142" + e);
                    showError(context);
                });
            }
        }
    }).catch((e) => {
        logToFile("141" + e);
        showError(context);
    });
}

function doConfirmAction(outcomeNumber, context, settings, deviceId) {
    if (outcomeNumber < globalSettings.activeOutcomes.length) {
        fetch("https://api.twitch.tv/helix/predictions", {
            method: "PATCH",
            body: JSON.stringify({
                "broadcaster_id": globalSettings.broadcasterId,
                "id": globalSettings.activePredictionId,
                "status": "RESOLVED",
                "winning_outcome_id": globalSettings.activeOutcomes[outcomeNumber].id
            }),
            headers: {
                Authorization: "Bearer " + globalSettings.broadcasterAccessToken,
                "Client-Id": "dx2y2z4epfd3ycn9oho1dnucnd7ou5",
                "Content-Type": "application/json"
            }
        }).then(response => {
            if (!response.ok) {
                throw new Error(response.status);
            } else {
                //clean up settings
                globalSettings.activePredictionId = undefined;
                globalSettings.activeOutcomes = undefined;

                saveGlobalSettings(pluginUUID);

                //go back to default profile
                returnToProfile(pluginUUID, devices[deviceId]);
            }
        }
        ).catch((error) => {
            logToFile(error);
            showError(context);
        });
    }
}

function doCancelAction(context, deviceId) {
    fetch("https://api.twitch.tv/helix/predictions", {
        method: "PATCH",
        body: JSON.stringify({
            "broadcaster_id": globalSettings.broadcasterId,
            "id": globalSettings.activePredictionId,
            "status": "CANCELED"
        }),
        headers: {
            Authorization: "Bearer " + globalSettings.broadcasterAccessToken,
            "Client-Id": "dx2y2z4epfd3ycn9oho1dnucnd7ou5",
            "Content-Type": "application/json"
        }
    }).then(response => {
        if (!response.ok) {
            throw new Error(response.status);
        } else {
            //clean up settings
            globalSettings.activePredictionId = undefined;
            globalSettings.activeOutcomes = undefined;
            globalSettings.activePredictionState = undefined;

            saveGlobalSettings(pluginUUID);

            //go back to default profile
            returnToProfile(pluginUUID, devices[deviceId]);
        }
    }
    ).catch((error) => {
        logToFile(error);
        showError(context);
    });
}

function doLockAction(context) {
    if (globalSettings.activePredictionState === "ACTIVE") {
        fetch("https://api.twitch.tv/helix/predictions", {
            method: "PATCH",
            body: JSON.stringify({
                "broadcaster_id": globalSettings.broadcasterId,
                "id": globalSettings.activePredictionId,
                "status": "LOCKED"
            }),
            headers: {
                Authorization: "Bearer " + globalSettings.broadcasterAccessToken,
                "Client-Id": "dx2y2z4epfd3ycn9oho1dnucnd7ou5",
                "Content-Type": "application/json"
            }
        }).then(response => {
            if (!response.ok) {
                throw new Error(response.status);
            } else {
                response.json().then((_) => {
                    setLockState(context, true);
                });
            }
        }
        ).catch((error) => {
            logToFile(error);
            showError(context);
        });
    } else {
        showError(context);
    }
}

//Action Tools

//TODO need to support other SKU's
function loadCorrectProfile(context, device) {
    switch (device.type) {
        case 3:
            loadProfile(context, device, "PredictionUiMobile");
            break;
        case 2:
            loadProfile(context, device, "PredictionUiXL");
            break;
        case 1:
            loadProfile(context, device, "PredictionUiMini");
            break;
        case 0:
            loadProfile(context, device, "PredictionUi");
            break;
        default:
            logToFile("Device type not found! - " + device.type);
            break;
    }
}

function getOutcomeNumberFromCoords(coordinates, deviceId) {
    let outcomeNumber = 1;
    let deviceType = devices[deviceId].type;

    if (deviceType === 1) {
        //streamdeck mini

        //USes custom buttons
    } else if (deviceType === 2) {
        //XL Layout
        switch (coordinates.row) {
            case 1:
                outcomeNumber = coordinates.column - 3;
                break;

            case 2:
                outcomeNumber = (coordinates.column - 3) + 4;
                break

            case 3:
                outcomeNumber = (coordinates.column - 4) + 8;
                break;
        }
    } else {
        //normal layout should suffice?
        outcomeNumber = (coordinates.row == 1 ? 0 : 5) + coordinates.column;
    }

    return outcomeNumber;
}

function updateButtonBusyState(context, busyUpdate, defaultPng) {
    currentlyBusy = busyUpdate;
    if (busyUpdate == true) {
        setImage(context, "art/predictionicons_wait.png");
    } else if (busyUpdate == false) {
        setImage(context, defaultPng);
    } else {
        logToFile("busyUpdate not booly - " + busyUpdate);
    }
}

//Actions
let startAction = {
    type: "io.predictionbuttons.start",
    onKeyDown: function (context, settings, coordinates, userDesiredState, deviceId) {
        checkAuthAndContinue("startAction", context, "art/predictionicons_start.png", () => { fireOffPrediction(context, settings, deviceId); })
    },

    onKeyUp: function (context, settings, coordinates, userDesiredState) {
        if (!globalSettings.broadcasterAccessToken) {
            setAuthState(context, false);
        } else {
            setAuthState(context, true);
        }
    },
    onWillAppear: function (context, settings, coordinates, deviceId) {
        updateButtonBusyState(context, false);
    }
}

let outcomeCustomAction = {
    type: "io.predictionbuttons.confirmOutcomeCustom",
    onKeyDown: function (context, settings, coordinates, userDesiredState, deviceId) {
        checkAuthAndContinue("outcomeCustomAction", context, "art/predictionicons_outcome.png", () => {
            doConfirmAction(settings.outcomeNumber || 0, context, settings, deviceId);
        });
    },
    onWillAppear: function (context, settings, coordinates, deviceId) {
        updateButtonBusyState(context, false);

        let outcomeNumber = settings.outcomeNumber || 0;
        //check auth state, set state false if failed
        if (gotGlobalSettings && outcomeNumber < globalSettings.activeOutcomes.length) {
            let adjustedTitle = globalSettings.activeOutcomes[outcomeNumber].title.replace(/ /g, "\n");
            //set the label with outcome text
            setOutcomeState(context, 0);
            setTitle(context, adjustedTitle);
        } else {
            setOutcomeState(context, 1);
            setTitle(context, "");
        }
    }
};

let outcomeAction = {
    type: "io.predictionbuttons.confirmOutcome",
    onKeyDown: function (context, settings, coordinates, userDesiredState, deviceId) {
        checkAuthAndContinue("outcomeAction", context, "art/predictionicons_outcome.png", () => {
            doConfirmAction(getOutcomeNumberFromCoords(coordinates, deviceId), context, settings, deviceId);
        });
    },
    onWillAppear: function (context, settings, coordinates, deviceId) {
        updateButtonBusyState(context, false);

        let outcomeNumber = getOutcomeNumberFromCoords(coordinates, deviceId);
        //check auth state, set state false if failed
        if (gotGlobalSettings && outcomeNumber < globalSettings.activeOutcomes.length) {
            let adjustedTitle = globalSettings.activeOutcomes[outcomeNumber].title.replace(/ /g, "\n");
            //set the label with outcome text
            setOutcomeState(context, 0);
            setTitle(context, adjustedTitle);
        } else {
            setOutcomeState(context, 1);
            setTitle(context, "");
        }
    }
};

let cancelAction = {
    type: "io.predictionbuttons.cancel",
    onKeyDown: function (context, settings, coordinates, userDesiredState, deviceId) {
        checkAuthAndContinue("cancelAction", context, "art/predictionicons_cancel.png", () => {
            doCancelAction(context, deviceId);
        });
    },
    onWillAppear: function (context, settings, coordinates, deviceId) {
        updateButtonBusyState(context, false);
    }
};

let exitAction = {
    type: "io.predictionbuttons.exit",
    onKeyDown: function (context, settings, coordinates, userDesiredState, deviceId) {
        returnToProfile(pluginUUID, devices[deviceId]);
    }
};

let lockAction = {
    type: "io.predictionbuttons.lock",
    onKeyDown: function (context, settings, coordinates, userDesiredState, device) {
        //Check for if already locked
        if (globalSettings.activePredictionState === "ACTIVE") {
            //update button state
            checkAuthAndContinue("lockAction", context, globalSettings.activePredictionState === "ACTIVE" ? "art/predictionicons_unlocked.png" : "art/predictionicons_locked.png", () => {
                doLockAction(context);
            });
        }
    },
    onWillAppear: function (context, settings, coordinates, deviceId) {
        updateButtonBusyState(context, false);

        let currentLockState = (globalSettings.activePredictionState === "ACTIVE" ? false : true);
        setLockState(context, currentLockState);
    }
}

//Action Sets
let willAppearActionSet = {
    "lock": lockAction, "confirmoutcome": outcomeAction, "confirmoutcomecustom": outcomeCustomAction, "start": startAction, "cancel": cancelAction,
};

let onKeyDownActionSet = {
    "lock": lockAction, "start": startAction, "cancel": cancelAction, "exit": exitAction, "confirmoutcomecustom": outcomeCustomAction, "confirmoutcome": outcomeAction
};