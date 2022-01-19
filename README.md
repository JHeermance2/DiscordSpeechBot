# DiscordSpeechBot
A speech-to-text bot for discord written in NodeJS.


## Heroku
If you don't have a linux server/machine then you can use Heroku for hosting your bot 24/7 and it's free.
Under "Resources" tab, use the "worker" deno type, and not the "web" one. You will need to configure the "Config Vars" under "Settings" tab, these are the environment variables from the settings section below.

Tutorial: https://dev.to/codr/discord-ears-bot-on-heroku-4606

## Installation
You need nodeJS version 12+ with npm on your machine.

## Settings
Create a (free) discord bot and obtain the API credentials (Bot Token).
Here's an easy tutorial: https://www.writebots.com/discord-bot-token/
Note: Give your bot enough permissions or simply grant it Administrator rights.

Create a (free) WitAI account and obtain the API credentials (Server Access Token): https://wit.ai/

Rename the file `settings-sample.json` to `settings.json` and enter the obtained API credentials:
```
{
    "discord_token": "your_token",
    "wit_ai_token": "your_token"
}
```

If you are using Digitalocean Apps, Heroku or another service you can also use Environment Variables instead of a settings file. Configure these with the appropriate values:
```
DISCORD_TOK
WITAPIKEY
```

## Running

Execute the following in your shell or prompt:
```
node index.js
```

Use [PM2](https://www.npmjs.com/package/pm2) to keep the bot running 24/7, it will also restart the bot in case of a crash or on memory limits (2GB default):
```
pm2 start ecosystem.config.js
```

## Usage
By now you have a discord server, the DiscordSpeechBot is running and is a part of your server.
Make sure your server has a text and voice channel.

1. Enter one of your voice channels.
2. In one of your text channels type: `!join`
3. Type `!help` for a list of commands.

Examples:

```
!play https://www.youtube.com/watch?v=vK1YiArMDfg
!play red hot chili peppers californication
!list
!skip
```

### Voice commands

When the bot is inside a voice channel it listens to all speech and tries to transcribe it to text.

### Notes: 
- Each user talks to a separate channel, the bot hears every user separately, and will transcribe each user, tagging each transcribed line.
- Only when your user picture turns green in the voice channel will the bot receive your audio.
- A long pause interrupts the audio input.
- (WitAI only) The duration of a single audio input is limited to between 1 and 20 seconds, longer and shorter audio is not transcribed. generally, the break in speech for breathing is enough separation to give the bot enough time to process.


## Language
WitAI supports over 120 languages (https://wit.ai/faq), however only one language can be used at a time.
If you're not speaking English on Discord, then change your default language on WitAI under "settings" for your app.

You can also change the language using the following bot command:

```
!lang <code>

!lang en     for English
!lang es     for Spanish
!lang ru     for Russian
...

The bot should reply with a success message.

<code> should be an ISO 639-1 language code (2 digits):
https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
```

### Speech-To-Text

By default WitAI's free API is used for voice recognition / transcription. But you can easily integrate any other API into the bot. You can use Google's Speech-to-Text API as follows:

1. Open `index.js`, inside the function `transcribe(file)` make sure that `transcribe_gspeech` is being used and the other one(s) are disabled.
2. You may want to adjust the `languageCode` value if you're speaking a non-English language.
3. Enable Google Speech API here: https://console.cloud.google.com/apis/library/speech.googleapis.com
4. Create a new Service Account (or use your existing one): https://console.cloud.google.com/apis/credentials
5. Create a new Service Account Key (or use existing) and download the json file.
6. Put the json file inside your bot directory and rename it to `gspeech_key.json`.


