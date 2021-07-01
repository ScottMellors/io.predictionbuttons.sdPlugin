let globalSettings = {};
let actionInfo = {};
let websocket = null;
let pluginAction = null;
let uuid;

function loadAuthWindow() {
    window.open("https://twitchtokengenerator.com/quick/2Erw5lcK5B", "_blank");
}

function checkAuth() {
    //get params
    let broadcasterAccessToken = document.getElementById("access_token").value;

    //send request to server
    fetch("https://id.twitch.tv/oauth2/validate", {
        headers: {
            Authorization: "Bearer " + broadcasterAccessToken,
            "Client-Id": "gp762nuuoqcoxypju8c569th9wz7q5",
            "Content-Type": "application/json"
        }
    }).then((response) => {
        if (!response.ok) {
            throw new Error(response.status);
        } else {
            response.json().then((body) => {
                let broadcasterId = body.user_id;

                let authPayload = {};

                authPayload.broadcasterId = broadcasterId;
                authPayload.broadcasterAccessToken = broadcasterAccessToken;

                sendValueToPlugin("authUpdate", authPayload);

                //show success dialog
                let successWindow = window.open();
                successWindow.document.write("<span style=\"color: #FFFFFF;\">Successfully Authenticated, you're ready to go! <br /><br /> You can now close this window and get on with the predictions. <br /><br /> Got any suggestions or questions? Check the <a style=\"color: #FFFFFF;\" href=\"https://discordapp.com/invite/S67P7UH\" target=\"_blank\">Discord</a>.</span>");
            });
        }
    }).catch((error) => {
        console.log("Did not auth");
        sendValueToPlugin("showError", "");

        //show error dialog
        let errorWindow = window.open();
        errorWindow.document.write(`<span style="color: #FFFFFF;">Oh no. The provided access token didn't authenticate for some reason.  <br /><br /> REASON: ${error}  <br /><br />If you require help, check over at the <a style="color: #FFFFFF;" href="https://discordapp.com/invite/S67P7UH" target="_blank">GhostlyTuna discord</a> for assistance!</span>`);
    });
}

function connectElgatoStreamDeckSocket(inPort, inUUID, inRegisterEvent, inInfo, inActionInfo) {
    uuid = inUUID;
    // please note: the incoming arguments are of type STRING, so
    // in case of the inActionInfo, we must parse it into JSON first
    actionInfo = JSON.parse(inActionInfo); // cache the info
    websocket = new WebSocket('ws://localhost:' + inPort);

    // if connection was established, the websocket sends
    // an 'onopen' event, where we need to register our PI
    websocket.onopen = function () {
        let json = {
            event: inRegisterEvent,
            uuid: uuid
        };
        // register property inspector to Stream Deck
        websocket.send(JSON.stringify(json));

        let settingsJson = {
            'event': 'getGlobalSettings',
            'context': uuid
        };

        websocket.send(JSON.stringify(settingsJson));

        if (actionInfo.action == "io.predictionbuttons.start") {
            let savedPredictionTitle = actionInfo.payload.settings.predictionTitle;
            let savedOutcome1 = actionInfo.payload.settings.outcome1;
            let savedOutcome2 = actionInfo.payload.settings.outcome2;
            let savedDuration = actionInfo.payload.settings.duration;
            let savedProfileSwap = actionInfo.payload.settings.profileSwap;

            //load settings
            document.getElementById('prediction_title').value = savedPredictionTitle || "Will I RIP?";
            document.getElementById('prediction_outcome_1').value = savedOutcome1 || "YES";
            document.getElementById('prediction_outcome_2').value = savedOutcome2 || "NO";
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

            //load settings to view
            document.getElementById("access_token").value = globalSettings.broadcasterAccessToken;
        }
    };
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

        if (type == "predictionUpdate") {
            payload["predictionTitle"] = document.getElementById("prediction_title").value;
            payload["outcome1"] = document.getElementById("prediction_outcome_1").value;
            payload["outcome2"] = document.getElementById("prediction_outcome_2").value;
            payload["duration"] = document.getElementById("prediction_duration").value;
            payload["profileSwap"] = document.getElementById("profileSwap").checked;
        } else if (type == "authUpdate") {
            payload = value;
        } else if (type == "showError") {
            payload["show"] = "error";
        }

        const json = {
            "action": actionInfo['action'],
            "event": "sendToPlugin",
            "context": uuid,
            "payload": payload
        };
        websocket.send(JSON.stringify(json));
    }
}