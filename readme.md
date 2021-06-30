# Twitch Chat Prediction Buttons - Elgato Streamdeck Plugin

This is a plugin for the Elgato Streamdeck enabling users to setup repeatable predictions and control them at their finger tips.

## How it works

Using TwitchCodeGenerator, users add an access code from the generator and can then setup predictions etc. When a prediction is initiated, the user is directed to a subview where they can directly control a prediction.

## Updating the beta app

When you want to update this plugin while in this beta phase, you will need to remove it from your plugin list, but has to be done from the Elgato/plugins folder in **C:\Users\YOURUSERNAME\AppData\Roaming\Elgato\StreamDeck\Plugins** or for Mac Users **~/Library/Application Support/com.elgato.StreamDeck/Plugins/**. Just delete the *io.predictionbuttons.sdPlugin* and restart the app before updating.

## To Do List

- Device profiles for mobile, XL and mini.
- Translations
- Better art
- Countdown indicator

## How can you help?

Got one of the devices listed above? We need profiles for those devices to switch to, may cause issues initially. You can do this by creating a new profile, adding the prediction buttons in a layout similar to this layout:![Elgato Streamdeck App showing a grid with the buttons laid out](https://i.imgur.com/RmmYWpV.png) Back button, cancel prediction button, lock button on one row, followed by outcomes 1 and 2 buttons below. Then exporting the profile, naming it appropriately and submitting a pull request on here.

- [ ] PredictionUiXL.streamDeckProfile
- [ ] PredictionUIMini.streamDeckProfile
- [x] PredictionUIMobile.streamDeckProfile

---

Translations - Will make a guide soon tm.

## Contact

[Twitch](twitch.tv/ghostlytuna)
[Twitter](twitter.com/ghostlytuna)
[Discord](https://discordapp.com/invite/S67P7UH)

