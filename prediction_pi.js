let globalSettings = {};
let actionInfo = {};
let websocket = null;
let pluginAction = null;
let pluginUUID;

let boilerplateOutcomes = ["YES", "NO", "MAYBE", "YES", "NO", "MAYBE", "YES", "NO", "MAYBE", "YES"];
let activeOutcomes = undefined;

let state;

let server = "https://channel-points-tool.com";

function getOrGenState() {

    if (!state) {
        //generate unique id
        state = generateString();
    }

    return state;
}

function generateString(length = 8) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');

    let outString = '';

    for (let i = 0; i < length; i++) {
        outString += chars[Math.floor(Math.random() * chars.length)];
    }

    return outString;
}

let authCheckTimer;
let authCheckStartTime;

function loadAuthWindow() {
    state = getOrGenState();
    window.open(`https://id.twitch.tv/oauth2/authorize?response_type=code&client_id=dx2y2z4epfd3ycn9oho1dnucnd7ou5&redirect_uri=${server}/streamdeck-auth-complete&scope=channel:manage:predictions&state=${state}`, "_blank");

    //start listening
    if (!authCheckTimer) {
        authCheckStartTime = new Date();
        authCheckStartTime.setMinutes(authCheckStartTime.getMinutes() + 5);

        authCheckTimer = setInterval(() => {
            if (Date.now() > authCheckStartTime) {
                clearInterval(authCheckTimer);
                return;
            }

            fetch(`${server}/streamdeck-auth-check/${state}`).then(async (response) => {
                let body = await response.json();

                //if not undefined, store keys, cancel timer
                if (response.status == 200) {
                    if (!body.accessToken || !body.refreshToken) {
                        clearInterval(authCheckTimer);
                        return;
                    }

                    globalSettings.broadcasterAccessToken = body.accessToken;
                    globalSettings.broadcasterRefreshToken = body.refreshToken;

                    fetch("https://id.twitch.tv/oauth2/validate", {
                        headers: {
                            Authorization: "Bearer " + globalSettings.broadcasterAccessToken,
                            "Client-Id": "dx2y2z4epfd3ycn9oho1dnucnd7ou5",
                            "Content-Type": "application/json"
                        }
                    }).then((response) => {
                        if (!response.ok) {
                            logToFile(pluginUUID, "validate - Did not auth - bad response");
                        } else {
                            response.json().then((body) => {
                                globalSettings.broadcasterId = body.user_id;
                                saveGlobalSettings(pluginUUID);
                            });
                        }
                    }).catch((error) => {
                        logToFile(pluginUUID, "Did not auth - " + error);
                    });

                    saveGlobalSettings(pluginUUID);

                    clearInterval(authCheckTimer);

                    state = undefined;
                }
            }).catch(e => {
                logToFile(pluginUUID, e);
                clearInterval(authCheckTimer);

                state = undefined;
            });
        }, 5000);
    }
}

function checkAuth() {

    if (globalSettings.broadcasterAccessToken) {
        //send request to server
        fetch("https://id.twitch.tv/oauth2/validate", {
            headers: {
                Authorization: "Bearer " + globalSettings.broadcasterAccessToken,
                "Client-Id": "dx2y2z4epfd3ycn9oho1dnucnd7ou5",
                "Content-Type": "application/json"
            }
        }).then((response) => {
            if (!response.ok) {
                logToFile(pluginUUID, "Checkauth() - Did not auth - bad response");

                throw new Error('DidNotAuth');
            } else {
                FFFFFF
                response.json().then((_) => {
                    //show success dialog
                    let successWindow = window.open();
                    successWindow.document.write("<span style=\"color: #FFFFFF;\">Successfully Authenticated, you're ready to go! <br /><br /> You can now close this window and get on with the predictions. <br /><br /> Got any suggestions or questions? Check the <a style=\"color: #FFFFFF;\" href=\"https://discordapp.com/invite/S67P7UH\" target=\"_blank\">Discord</a>.</span>");
                });
            }
        }).catch((error) => {
            logToFile(pluginUUID, "Did not auth");
            sendValueToPlugin("showError", "");

            //show error dialog
            let errorWindow = window.open();
            errorWindow.document.write(`<span style="color: #FFFFFF;">Oh no. The provided access token didn't authenticate for some reason.  <br /><br /> REASON: ${error}  <br /><br />If you require help, check over at the <a style="color: #FFFFFF;" href="https://discordapp.com/invite/S67P7UH" target="_blank">GhostlyTuna discord</a> for assistance!</span>`);
        });
    } else {
        logToFile(pluginUUID, "Did not auth - no broadcasterAccessToken");
        sendValueToPlugin("showError", "");

        //show error dialog
        let errorWindow = window.open();
        errorWindow.document.write(`<span style="color: #FFFFFF;">Oh no. The provided access token didn't authenticate for some reason.  <br /><br /> REASON: NO CREDS <br /><br />If you require help, check over at the <a style="color: #FFFFFF;" href="https://discordapp.com/invite/S67P7UH" target="_blank">GhostlyTuna discord</a> for assistance!</span>`);
    }
}

let instance;

function PI(inLanguage) {
    // Init PI
    instance = this;

    // Public localizations for the UI
    this.localization = {};

    // Load the localizations
    getLocalization(inLanguage, function (inStatus, inLocalization) {
        if (inStatus) {
            // Save public localization
            instance.localization = inLocalization['PI'];

            // Localize the PI
            instance.localize();
        } else {
            logToFile(pluginUUID, inLocalization);
        }
    });

    // Localize the UI
    this.localize = function () {
        // Check if localizations were loaded
        if (instance.localization == null) {
            return;
        }

        // Localize the Auth
        document.getElementById('get_started_heading').innerHTML = instance.localization['GetStarted'];
        document.getElementById('twitch_auth_heading').innerHTML = instance.localization['TwitchAuthTitle'];
        document.getElementById('twitch_auth_para_1').innerHTML = instance.localization['TwitchAuthDesc1'];
        document.getElementById('twitch_auth_para_2').innerHTML = instance.localization['TwitchAuthDesc2'];
        document.getElementById('twitch_auth_para_3').innerHTML = instance.localization['TwitchAuthDesc3'];
        document.getElementById('twitch_auth_para_4').innerHTML = instance.localization['TwitchAuthDesc4'];
        document.getElementById('get_access_token_button').innerHTML = instance.localization['GetAccessTokenCTA'];
        document.getElementById('access_token_heading').innerHTML = instance.localization['AccessToken'];
        document.getElementById('refresh_token_heading').innerHTML = instance.localization['RefreshToken'];
        document.getElementById('check_auth_heading').innerHTML = instance.localization['CheckAuth'];
        document.getElementById('check_auth_heading').innerHTML = instance.localization['CheckAuthButton'];

        // Prediction Settings
        document.getElementById('prediction_settings_title').innerHTML = instance.localization['PredictionSettings'];
        document.getElementById('prediction_title').value = instance.localization['ExamplePredictionTitle'];
        document.getElementById('prediction_title_label').innerHTML = instance.localization['PredictionTitle'];
        document.getElementById('prediction_outcome_1_title').innerHTML = instance.localization['PredictionOutcome1'];
        document.getElementById('prediction_outcome_2_title').innerHTML = instance.localization['PredictionOutcome2'];
        document.getElementById('prediction_outcome_1').value = instance.localization['ExamplePredictionOutcome1'];
        document.getElementById('prediction_outcome_2').value = instance.localization['ExamplePredictionOutcome2'];
        document.getElementById('prediction_duration_title').innerHTML = instance.localization['PredictionDuration'];

        document.getElementById('extra_outcomes_title').innerHTML = instance.localization['ExtraOutcomesLabel'];
        document.getElementById('addOutcomesButton').innerHTML = instance.localization['ExtraOutcomesButtonLabel'];

        // Profile Swap
        document.getElementById('manual_layout').innerHTML = instance.localization['ManualLayout'];
        document.getElementById('swap_to_subview_title').innerHTML = instance.localization['SwapToSubview'];
        document.getElementById('swap_to_subview_checkbox').innerHTML = "<span></span>" + instance.localization['SwapToSubview'];

        //outcome label
        document.getElementById('confirm_outcome_label').innerHTML = instance.localization['ConfirmOutcome'];
    };
}

function connectElgatoStreamDeckSocket(inPort, inUUID, inRegisterEvent, inInfo, inActionInfo) {
    pluginUUID = inUUID;
    // please note: the incoming arguments are of type STRING, so
    // in case of the inActionInfo, we must parse it into JSON first
    actionInfo = JSON.parse(inActionInfo); // cache the info
    websocket = new WebSocket('ws://localhost:' + inPort);

    var info = JSON.parse(inInfo);

    // Retrieve language
    var language = info['application']['language'];

    PI(language);

    // if connection was established, the websocket sends
    // an 'onopen' event, where we need to register our PI
    websocket.onopen = function () {
        let json = {
            event: inRegisterEvent,
            uuid: pluginUUID
        };
        // register property inspector to Stream Deck
        websocket.send(JSON.stringify(json));

        let settingsJson = {
            'event': 'getGlobalSettings',
            'context': pluginUUID
        };

        websocket.send(JSON.stringify(settingsJson));

        if (actionInfo.action == "io.predictionbuttons.confirmoutcomecustom") {
            setVisibilityOfClassItems("outcome", "flex");
            document.getElementById("outcome_select_div").style.visibility = "flex";

            //set outcome select from settings
            document.getElementById("outcome_select").value = actionInfo.payload.settings.outcomeNumber || 0;

        } else if (actionInfo.action == "io.predictionbuttons.start") {
            setVisibilityOfClassItems("start", "flex");

            let savedPredictionTitle = actionInfo.payload.settings.predictionTitle;

            activeOutcomes = actionInfo.payload.settings.outcomes || ["YES", "NO"];

            for (let i = 1; i <= activeOutcomes.length; i++) {
                let outcome = activeOutcomes[i - 1];

                //if > 2, build widget, insert data
                if (i > 2) {
                    addOutcome(i);
                    document.getElementById(`prediction_outcome_${i}`).value = outcome || boilerplateOutcomes[i - 1];

                } else {
                    document.getElementById(`prediction_outcome_${i}`).value = outcome || boilerplateOutcomes[i - 1];

                }
            }

            if (activeOutcomes.length >= 10) {
                //disable button
                document.getElementById("addOutcomesButton").disabled = true;
            } else {
                document.getElementById("addOutcomesButton").disabled = false;
            }

            let savedDuration = actionInfo.payload.settings.duration;
            let savedProfileSwap = actionInfo.payload.settings.profileSwap || true;

            //load settings
            document.getElementById('prediction_title').value = savedPredictionTitle || "Will I RIP?";
            document.getElementById('prediction_duration').value = savedDuration || 120;
            document.getElementById('profileSwap').checked = savedProfileSwap;
        } else {
            setVisibilityOfClassItems("sdpi-heading", "none");
            setVisibilityOfClassItems("sdpi-item", "none");
        }
    };

    websocket.onmessage = function (evt) {
        // Received message from Stream Deck
        let subJsonObj = JSON.parse(evt.data);
        let event = subJsonObj.event;
        let jsonPayload = subJsonObj.payload || {};

        if (event === "didReceiveGlobalSettings") {
            globalSettings = jsonPayload.settings;
        }
    };
}

async function refreshTokenPI() {
    if (globalSettings.broadcasterRefreshToken) {
        let newAccessToken = await refreshAccessToken(globalSettings.broadcasterRefreshToken);

        if (newAccessToken) {
            globalSettings.broadcasterAccessToken = newAccessToken;
            saveGlobalSettings(pluginUUID);
        } else {
            logToFile(pluginUUID, "broadcasterRefreshToken refresh failed");
        }
    } else {
        logToFile(pluginUUID, "broadcasterRefreshToken not found");
    }
}

function addOutcome(pos) {
    //get current outcomes length
    if (activeOutcomes.length <= 10) {

        let newWidget = document.createElement("div");
        newWidget.classList.add("sdpi-item");

        //localise widget
        if (pos == undefined) {
            activeOutcomes.push(boilerplateOutcomes[activeOutcomes.length]);
        }

        let outcomeInput = document.createElement("input");
        outcomeInput.classList.add("sdpi-item-value");
        outcomeInput.id = `prediction_outcome_${pos || activeOutcomes.length - 1}`;
        outcomeInput.setAttribute("type", "text");
        outcomeInput.addEventListener('change', function () {
            sendValueToPlugin('predictionUpdate', pos || activeOutcomes.length);
        }, false);
        outcomeInput.setAttribute("value", activeOutcomes[pos || activeOutcomes.length - 1]);

        let outcomeLabel = document.createElement("div");
        outcomeLabel.classList.add("sdpi-item-label");
        outcomeLabel.innerHTML = (instance.localization['PredictionOutcome'] ?? "Prediction Outcome ") + (pos || activeOutcomes.length);

        newWidget.appendChild(outcomeLabel);
        newWidget.appendChild(outcomeInput);

        let outcomesDiv = document.getElementById("moreOutcomesDiv");
        outcomesDiv.appendChild(newWidget);

        //ensure values are updated
        if (!pos) {
            sendValueToPlugin('predictionUpdate', '');
        }

        if (activeOutcomes.length == 10) {
            //disable button
            document.getElementById("addOutcomesButton").disabled = true;
        } else {
            document.getElementById("addOutcomesButton").disabled = false;
        }
    }
}

function setVisibilityOfClassItems(className, display) {
    let ele = document.getElementsByClassName(className);
    for (let i = 0; i < ele.length; i++) {
        ele[i].style.display = display;
    }
}

// our method to pass values to the plugin
function sendValueToPlugin(type, value) {
    if (websocket) {

        let payload = {};

        //Need to do a sanity check on outcomes, delete any elements are length 0

        if (type == "predictionUpdate") {

            if (typeof value == 'number') {
                //update positing with contents

                let updatedValue = document.getElementById(`prediction_outcome_${value}`)?.value.trim() || "";

                if (updatedValue == "") {

                    if (activeOutcomes.length > 2) {
                        //empty extra outcomes
                        document.getElementById("moreOutcomesDiv").innerHTML = "";
                    }

                    //delete pos
                    activeOutcomes.splice(value - 1, 1);

                    //redraw if over two?
                    if (activeOutcomes.length > 2) {
                        for (let i = 3; i <= activeOutcomes.length; i++) {
                            let outcome = activeOutcomes[i - 1];

                            addOutcome(i);
                            document.getElementById(`prediction_outcome_${i}`).value = outcome || boilerplateOutcomes[i - 1];
                        }
                    }

                } else {
                    //update
                    activeOutcomes[value - 1] = document.getElementById(`prediction_outcome_${value}`).value;
                }

            }

            payload["predictionTitle"] = document.getElementById("prediction_title").value;
            payload["outcomes"] = activeOutcomes;
            payload["duration"] = document.getElementById("prediction_duration").value;
            payload["profileSwap"] = document.getElementById("profileSwap").checked;
        } else if (type == "authUpdate") {
            payload = value;
        } else if (type == "outcomeUpdate") {
            //get value from field
            payload["outcomeValue"] = document.getElementById("outcome_select").value;
        } else if (type == "showError") {
            payload["show"] = "error";
        }

        const json = {
            "action": actionInfo['action'],
            "event": "sendToPlugin",
            "context": pluginUUID,
            "payload": payload
        };
        websocket.send(JSON.stringify(json));
    }
}