var lockTimer;
var globalSettings = {};

var websocket = null;
var pluginUUID = null;
var gotGlobalSettings = false;
var devices;

function loadOutcomeButtons() {
    //get counter of outcome object
    let outcomes = globalSettings.activeOutcomes;

    //foreach pop a new item in the row
}

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
            console.log("Device type not found! - " + device.type);
            break;
    }
}

function createPrediction(context, settings, deviceId) {
    //continue to create;
    fetch("https://api.twitch.tv/helix/predictions", {
        body: JSON.stringify({
            "broadcaster_id": globalSettings.broadcasterId,
            "title": settings.predictionTitle ?? "Will I RIP?",
            "outcomes": [{ "title": settings.outcome1 ?? "YES" },
            { "title": settings.outcome2 ?? "NO" }], //DOes not accept more than two atm!
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

                globalSettings.activeOutcome1Id = body.data[0].outcomes[0].id; //REMOVE THIS
                globalSettings.activeOutcome2Id = body.data[0].outcomes[1].id; //REMOVE THIS

                //Store outcomes, not individual ID's
                globalSettings.activeOutcomes = body.data[0].outcomes;

                globalSettings.activePredictionState = "ACTIVE";

                startDurationTimer(context, settings.duration ?? 120);

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
        console.log(reason);
    });
}

function connectElgatoStreamDeckSocket(inPort, inPluginUUID, inRegisterEvent, inInfo) {
    pluginUUID = inPluginUUID;

    devices = JSON.parse(inInfo).devices.reduce(function (map, obj) {
        map[obj.id] = obj;
        return map;
    }, {});

    // Open the web socket
    websocket = new WebSocket("ws://localhost:" + inPort);

    function registerPlugin(inPluginUUID) {
        var json = {
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
        var jsonObj = JSON.parse(evt.data);
        var event = jsonObj["event"];
        var action = jsonObj["action"];
        var context = jsonObj["context"];
        var jsonPayload = jsonObj["payload"] || {};
        var settings = jsonPayload["settings"] || {};
        var device = jsonObj["device"];

        if (event == "keyDown") {
            var settings = jsonPayload["settings"];
            var coordinates = jsonPayload["coordinates"];
            var userDesiredState = jsonPayload["userDesiredState"];
            if (action == "io.predictionbuttons.start") {
                startAction.onKeyDown(context, settings, coordinates, userDesiredState, device);
            } else if (action == "io.predictionbuttons.cancel") {
                cancelAction.onKeyDown(context, settings, coordinates, userDesiredState, device);
            } else if (action == "io.predictionbuttons.exit") {
                exitAction.onKeyDown(context, settings, coordinates, userDesiredState);
            } else if (action == "io.predictionbuttons.confirmoutcome1") {
                outcome1Action.onKeyDown(context, settings, coordinates, userDesiredState, device);
            } else if (action == "io.predictionbuttons.confirmoutcome2") {
                outcome2Action.onKeyDown(context, settings, coordinates, userDesiredState, device);
            } else if (action == "io.predictionbuttons.lock") {
                lockAction.onkeydown(context, settings, coordinates, userDesiredState);
            }
        } else if (event == "keyUp") {
            var settings = jsonPayload["settings"];
            var coordinates = jsonPayload["coordinates"];
            var userDesiredState = jsonPayload["userDesiredState"];
            if (action == "io.predictionbuttons.start") {
                startAction.onKeyUp(context, settings, coordinates, userDesiredState);
            }
        } else if (event == "willAppear") {
            settings = jsonPayload["settings"];
            var coordinates = jsonPayload["coordinates"];
            if (action == "io.predictionbuttons.start") {
                requestGlobalSettings(pluginUUID);
                startAction.onWillAppear(context, settings, coordinates);
            } else if (action == "io.predictionbuttons.lock") {
                lockAction.onWillAppear(context, settings, coordinates);
            }
        } else if (event == "sendToPlugin") {
            if (jsonPayload.hasOwnProperty("predictionTitle")) {
                settings.predictionTitle = jsonPayload.predictionTitle;
                //settings.outcome1 = jsonPayload.outcome1;
                //settings.outcome2 = jsonPayload.outcome2;
                settings.outcomes = jsonPayload.outcomes;
                settings.duration = jsonPayload.duration;
                settings.profileSwap = jsonPayload.profileSwap;

                setSettings(context, settings);
            } else if (jsonPayload.hasOwnProperty("broadcasterId")) {
                globalSettings.broadcasterId = jsonPayload.broadcasterId;
                globalSettings.broadcasterAccessToken = jsonPayload.broadcasterAccessToken;

                saveGlobalSettings(pluginUUID);
            } else if (jsonPayload.hasOwnProperty("show")) {
                showError();
            }
        } else if (event == "didReceiveGlobalSettings") {
            gotGlobalSettings = true;
            globalSettings = jsonPayload.settings;
        }
    };

    websocket.onclose = function () {
        // Websocket is closed
    };
};

//Actions
var startAction = {
    type: "io.predictionbuttons.start",

    onKeyDown: function (context, settings, coordinates, userDesiredState, deviceId) {

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
                throw new Error(response.status);
            } else {
                response.json().then((body) => {
                    if (body.data) {
                        var lastPredictionData = body.data;
                        var lastPrediction = lastPredictionData[0];
                        if (lastPrediction.status === "ACTIVE" || lastPrediction.status === "LOCKED") {

                            if (lastPrediction.id != globalSettings.activePredictionId) {
                                //resume remote started prediction
                                globalSettings.activePredictionId = lastPrediction.id;
                                globalSettings.activeOutcome1Id = lastPrediction.outcomes[0].id;
                                globalSettings.activeOutcome2Id = lastPrediction.outcomes[1].id;
                                globalSettings.activePredictionState = lastPrediction.status;
                            }

                            saveGlobalSettings(pluginUUID);

                            if (settings.profileSwap != false) {
                                loadCorrectProfile(pluginUUID, devices[deviceId]);
                            }
                        } else {
                            createPrediction(context, settings, deviceId);
                        }
                    } else {
                        createPrediction(context, settings, deviceId);
                    }
                });
            }
        }).catch((e) => {
            showError(context);
        });
    },

    onKeyUp: function (context, settings, coordinates, userDesiredState) {
        if (!globalSettings.broadcasterAccessToken) {
            setAuthState(context, false);
        } else {
            setAuthState(context, true);
        }
    },

    onWillAppear: function (context, settings, coordinates) {
        //check auth state, set state false if failed
        if (gotGlobalSettings) {
            if (!globalSettings.broadcasterAccessToken) {
                setAuthState(context, false);
            } else {
                //check auth state
                fetch("https://id.twitch.tv/oauth2/validate", {
                    headers: {
                        Authorization: "Bearer " + globalSettings.broadcasterAccessToken,
                        "Client-Id": "dx2y2z4epfd3ycn9oho1dnucnd7ou5",
                        "Content-Type": "application/json"
                    }
                }).then((response) => {
                    if (!response.ok) {
                        throw new Error(response.status);
                    } else {
                        setAuthState(context, true);
                    }
                }).catch((error) => {
                    console.log(error);
                    setAuthState(context, false);
                });
            }
        } else {
            setAuthState(context, true);
        }
    }
}

var outcome1Action = {
    type: "io.predictionbuttons.confirmOutcome1",
    onKeyDown: function (context, settings, coordinates, userDesiredState, deviceId) {

        fetch("https://api.twitch.tv/helix/predictions", {
            method: "PATCH",
            body: JSON.stringify({
                "broadcaster_id": globalSettings.broadcasterId,
                "id": globalSettings.activePredictionId,
                "status": "RESOLVED",
                "winning_outcome_id": globalSettings.activeOutcome1Id
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
                globalSettings.activeOutcome1Id = undefined;
                globalSettings.activeOutcome2Id = undefined;

                saveGlobalSettings(pluginUUID);

                //go back to default profile
                returnToProfile(pluginUUID, devices[deviceId]);
            }
        }
        ).catch((error) => {
            console.log(error);
            showError(context);
        });
    }
};

var outcome2Action = {
    type: "io.predictionbuttons.confirmOutcome2",
    onKeyDown: function (context, settings, coordinates, userDesiredState, deviceId) {
        fetch("https://api.twitch.tv/helix/predictions", {
            method: "PATCH",
            body: JSON.stringify({
                "broadcaster_id": globalSettings.broadcasterId,
                "id": globalSettings.activePredictionId,
                "status": "RESOLVED",
                "winning_outcome_id": globalSettings.activeOutcome2Id
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
                globalSettings.activeOutcome1Id = undefined;
                globalSettings.activeOutcome2Id = undefined;

                saveGlobalSettings(pluginUUID);

                //go back to default profile
                returnToProfile(pluginUUID, devices[deviceId]);
            }
        }
        ).catch((error) => {
            console.log(error);
            showError(context);
        });
    }
};

var cancelAction = {
    type: "io.predictionbuttons.cancel",
    onKeyDown: function (context, settings, coordinates, userDesiredState, deviceId) {
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

                if (lockTimer) {
                    clearTimeout(lockTimer);
                    lockTimer = undefined;
                }

                //clean up settings
                globalSettings.activePredictionId = undefined;
                globalSettings.activeOutcome1Id = undefined;
                globalSettings.activeOutcome2Id = undefined;
                globalSettings.activePredictionState = undefined;

                saveGlobalSettings(pluginUUID);

                //go back to default profile
                returnToProfile(pluginUUID, devices[deviceId]);
            }
        }
        ).catch((error) => {
            console.log(error);
            showError(context);
        });
    }
};

var exitAction = {
    type: "io.predictionbuttons.exit",
    onKeyDown: function (context, settings, coordinates, userDesiredState) {
        returnToProfile(pluginUUID, device);
    }
};

var lockAction = {
    type: "io.predictionbuttons.lock",
    onkeydown: function (context, settings, coordinates, userDesiredState) {
        //update button state
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
                    response.json().then((body) => {
                        setLockState(context, true);
                    });
                }
            }
            ).catch((error) => {
                console.log(error);
                showError(context);
            });
        } else {
            showError(context);
        }
    },
    onWillAppear: function (context, settings, coordinates) {
        var currentLockState = (globalSettings.activePredictionState === "ACTIVE" ? false : true);
        setLockState(context, currentLockState);
    }
}