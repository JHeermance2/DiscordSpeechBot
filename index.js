//////////////////////////////////////////
//////////////// LOGGING /////////////////
//////////////////////////////////////////

function getCurrentDateString() {
    return (new Date()).toISOString() + ' ::';
}
__originalLog = console.log;
console.log = function () {
    var args = [].slice.call(arguments);
    __originalLog.apply(console.log, [getCurrentDateString()].concat(args));
};

//////////////////////////////////////////
//////////////// GLOBAL //////////////////
//////////////////////////////////////////

const fs = require('fs');
const util = require('util');
const path = require('path');
const request = require('request');
const { Readable } = require('stream');

//////////////////////////////////////////
///////////////// VARIA //////////////////
//////////////////////////////////////////

function necessary_dirs() {
    if (!fs.existsSync('./data/')) {
        fs.mkdirSync('./data/');
    }
}
necessary_dirs()

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function convert_audio(input) {
    try {
        // stereo to mono channel
        const data = new Int16Array(input)
        const ndata = new Int16Array(data.length / 2)
        for (let i = 0, j = 0; i < data.length; i += 4) {
            ndata[j++] = data[i]
            ndata[j++] = data[i + 1]
        }
        return Buffer.from(ndata);
    } catch (e) {
        console.log(e)
        console.log('convert_audio: ' + e)
        throw e;
    }
}

//////////////////////////////////////////
//////////////// CONFIG //////////////////
//////////////////////////////////////////

const SETTINGS_FILE = 'settings.json';

let DISCORD_TOK = null;
let WITAPIKEY = null;

function loadConfig() {
    if (fs.existsSync(SETTINGS_FILE)) {
        const CFG_DATA = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
        DISCORD_TOK = CFG_DATA.discord_token;
        WITAPIKEY = CFG_DATA.wit_ai_token;
    } else {
        DISCORD_TOK = process.env.DISCORD_TOK;
        WITAPIKEY = process.env.WITAPIKEY;
    }
    if (!DISCORD_TOK || !WITAPIKEY)
        throw 'Failed loading, missing API keys!'

}

loadConfig()

const https = require('https')

function restartApp() {
    const options = {
        hostname: 'stt-restarter.herokuapp.com',
        path: '/restart',
        method: 'GET'
    }

    const req = https.request(options, (res) => {
        let body = ''
        res.on('data', (chunk) => {
            body += chunk
        });
        res.on('end', function () {
            cb(JSON.parse(body))
        })
    })

    req.on('error', (error) => {
        console.error(error)
        cb(null)
    })
    req.end()
}


function listWitAIApps(cb) {
    const options = {
        hostname: 'api.wit.ai',
        port: 443,
        path: '/apps?offset=0&limit=100',
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + WITAPIKEY,
        },
    }

    const req = https.request(options, (res) => {
        res.setEncoding('utf8');
        let body = ''
        res.on('data', (chunk) => {
            body += chunk
        });
        res.on('end', function () {
            cb(JSON.parse(body))
        })
    })

    req.on('error', (error) => {
        console.error(error)
        cb(null)
    })
    req.end()
}

function updateWitAIAppLang(appID, lang, cb) {
    const options = {
        hostname: 'api.wit.ai',
        port: 443,
        path: '/apps/' + appID,
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + WITAPIKEY,
        },
    }
    const data = JSON.stringify({
        lang
    })

    const req = https.request(options, (res) => {
        res.setEncoding('utf8');
        let body = ''
        res.on('data', (chunk) => {
            body += chunk
        });
        res.on('end', function () {
            cb(JSON.parse(body))
        })
    })
    req.on('error', (error) => {
        console.error(error)
        cb(null)
    })
    req.write(data)
    req.end()
}

//////////////////////////////////////////
//////////////////////////////////////////
//////////////////////////////////////////


const Discord = require('discord.js')
const DISCORD_MSG_LIMIT = 2000;
const discordClient = new Discord.Client()
discordClient.on('ready', () => {
    console.log(`Logged in as ${discordClient.user.tag}!`)
})
discordClient.login(DISCORD_TOK)

const PREFIX = '!';
const _CMD_HELP = PREFIX + 'help';
const _CMD_JOIN = PREFIX + 'join';
const _CMD_LEAVE = PREFIX + 'leave';
const _CMD_DEBUG = PREFIX + 'debug';
const _CMD_TEST = PREFIX + 'hello';
const _CMD_LANG = PREFIX + 'lang';
const _CMD_MIRROR = PREFIX + 'mirror';
const _CMD_RESTART = PREFIX + 'restart';

const guildMap = new Map();

discordClient.on('message', async (msg) => {
    try {
        if (!('guild' in msg) || !msg.guild) return; // prevent private messages to bot
        const mapKey = msg.guild.id;
        if (msg.content.trim().toLowerCase() == _CMD_JOIN) {
            if (!msg.member.voice.channelID) {
                msg.reply('Error: please join a voice channel first.')
            } else {
                if (!guildMap.has(mapKey))
                    await connect(msg, mapKey)
                else
                    msg.reply('Already connected')
            }
        } else if (msg.content.trim().toLowerCase() == _CMD_LEAVE) {
            if (guildMap.has(mapKey)) {
                let val = guildMap.get(mapKey);
                if (val.voice_Channel) val.voice_Channel.leave()
                if (val.voice_Connection) val.voice_Connection.disconnect()
                if (val.musicYTStream) val.musicYTStream.destroy()
                guildMap.delete(mapKey)
                msg.reply("Disconnected.")
            } else {
                msg.reply("Cannot leave because not connected.")
            }
        } else if (msg.content.trim().toLowerCase() == _CMD_HELP) {
            msg.reply(getHelpString());
        } else if (msg.content.trim().toLowerCase() == _CMD_DEBUG) {
            console.log('toggling debug mode')
            let val = guildMap.get(mapKey);
            if (val.debug)
                val.debug = false;
            else
                val.debug = true;
        } else if (msg.content.trim().toLowerCase() == _CMD_TEST) {
            msg.reply('hello back =)')
        } else if (msg.content.split('\n')[0].split(' ')[0].trim().toLowerCase() == _CMD_MIRROR) {
            msg.reply(msg.content.replace(_CMD_MIRROR, '').trim())
        }
        else if (msg.content.trim().toLowerCase() == _CMD_RESTART) {
            console.log('restart triggered');
            if (guildMap.has(mapKey)) {
                let val = guildMap.get(mapKey);
                if (val.voice_Channel) val.voice_Channel.leave()
                if (val.voice_Connection) val.voice_Connection.disconnect()
                guildMap.delete(mapKey)
                msg.reply("Please wait while I restart. I will leave the chat, and begin restarting. Please feel free to reinvite me whenever you like, I will resume functioning as soon as I am able.")
            } else {
                msg.reply("I will restart. Please invite me to your chat when you are ready, I will resume functioning as soon as I am able.")
            }
            try{restartApp();}
            catch (e) {console.log('Restart error: ' + e)}
        }
        else if (msg.content.split('\n')[0].split(' ')[0].trim().toLowerCase() == _CMD_LANG) {
            const lang = msg.content.replace(_CMD_LANG, '').trim().toLowerCase()
            listWitAIApps(data => {
                if (!data.length)
                    return msg.reply('no apps found! :(')
                for (const x of data) {
                    updateWitAIAppLang(x.id, lang, data => {
                        if ('success' in data)
                            msg.reply('succes!')
                        else if ('error' in data && data.error !== 'Access token does not match')
                            msg.reply('Error: ' + data.error)
                    })
                }
            })
        }
    } catch (e) {
        console.log('discordClient message: ' + e)
        msg.reply('Error#180: Something went wrong, try again or contact the developers if this keeps happening.');
    }

    
})

function getHelpString() {
    let out = 'Thanks for checking out the Speech-to-Text bot!\n'
    out += 'To use the bot: \n'
    out += '- Enter a voice channel on the server\n'
    out += '- Switch to the text channel you would like to record your voice in\n'
    out += '- Be patient with me! Rich wrote me in less than a day in a language he had never used before, so cut the guy some slack!\n'  
    out += '- The more you use me, the better my results should be. I am designed to learn and better understand you the more I hear!\n'
    out += '- If you do find a bug, just let Rich know, and he will do his best to fix it :) \n\n'
    out += '**VOICE COMMANDS:**\n'
    out += '```'
    out += 'bot help\n';
    out += '```'
    out += '**TEXT COMMANDS:**\n'
    out += '```'
    out += _CMD_HELP + '\n'
    out += _CMD_JOIN + '/' + _CMD_LEAVE + '\n';
    out += '```'
    return out;
}

async function connect(msg, mapKey) {
    try {
        let voice_Channel = await discordClient.channels.fetch(msg.member.voice.channelID);
        if (!voice_Channel) return msg.reply("Error: The voice channel does not exist!");
        let text_Channel = await discordClient.channels.fetch(msg.channel.id);
        if (!text_Channel) return msg.reply("Error: The text channel does not exist!");
        let voice_Connection = await voice_Channel.join();
        voice_Connection.play('sound.mp3', { volume: 0.5 });
        guildMap.set(mapKey, {
            'text_Channel': text_Channel,
            'voice_Channel': voice_Channel,
            'voice_Connection': voice_Connection,
            'musicQueue': [],
            'musicDispatcher': null,
            'musicYTStream': null,
            'currentPlayingTitle': null,
            'currentPlayingQuery': null,
            'debug': false,
        });
        speak_impl(voice_Connection, mapKey)
        voice_Connection.on('disconnect', async (e) => {
            if (e) console.log(e);
            guildMap.delete(mapKey);
        })
        msg.reply('connected!')
    } catch (e) {
        console.log('connect: ' + e)
        msg.reply('Error: unable to join your voice channel.');
        throw e;
    }
}

function speak_impl(voice_Connection, mapKey) {
    voice_Connection.on('speaking', async (user, speaking) => {
        if (speaking.bitfield == 0 || user.bot) {
            return
        }
        console.log(`I'm listening to ${user.username}`)
        // this creates a 16-bit signed PCM, stereo 48KHz stream
        const audioStream = voice_Connection.receiver.createStream(user, { mode: 'pcm' })
        audioStream.on('error', (e) => {
            console.log('audioStream: ' + e)
        });
        let buffer = [];
        audioStream.on('data', (data) => {
            buffer.push(data)
        })
        audioStream.on('end', async () => {
            buffer = Buffer.concat(buffer)
            const duration = buffer.length / 48000 / 4;
            console.log("duration: " + duration)

            if (duration < 1.0 || duration > 19) { // 20 seconds max dur
                console.log("TOO SHORT / TOO LONG; SKPPING")
                return;
            }

            try {
                let val = guildMap.get(mapKey);
                let new_buffer = await convert_audio(buffer)
                let out = await transcribe(new_buffer);
               // console.log('Transcribing audio, send to processing.');
               // process_commands_query(out, mapKey, user.id);

                for (var key in out)
                {
                    var value = out[key]
                    //val.text_Channel.send("key: " + key + '\n' + "out: " +  value);
                }
                var transcribed_text = out.split('\n');
                transcribed_text = transcribed_text[transcribed_text.length - 3].replace('"text": "','').replace('",','');
                console.log('out: ' + transcribed_text);
                val.text_Channel.send(user.username + ': ' + transcribed_text);
               
            } 
            catch (e) {
                console.log('tmpraw rename: ' + e)
            }
        })
    })
}

function process_commands_query(query, mapKey, userid) {
    console.log("process_command_query");

    // let out = null;


    // const regex = /^bot ([a-zA-Z]+)(.+?)?$/;
    // const m = query.toLowerCase().match(regex);
    // if (m && m.length) {
    //     const cmd = (m[1] || '').trim();

    //     switch (cmd) {
    //         case 'help':
    //             out = _CMD_HELP;
    //             break;
    //         case 'hello':
    //             out = 'hello back =)'
    //             break;
    //     }
    //     if (out == null)
    //         out = "I didn't catch that...";
    // }
    
    let out = query;
    console.log('text_Channel out: ' + out)
    const val = guildMap.get(mapKey);
    val.text_Channel.send(out);
}

async function music_message(message, mapKey) {
    let replymsgs = [];
    const messes = message.content.split('\n');
    for (let mess of messes) {
        const args = mess.split(' ');

        const chunks = message_chunking(out, DISCORD_MSG_LIMIT);
        for (let chunk of chunks) {
            message.channel.send(chunk);
        }
    }
}

function message_chunking(msg, MAXL) {
    const msgs = msg.split('\n');
    const chunks = [];

    let outmsg = '';
    while (msgs.length) {
        let a = msgs.shift() + '\n';
        if (a.length > MAXL) {
            console.log(a)
            throw new Error('error#418: max single msg limit');
        }

        if ((outmsg + a + 6).length <= MAXL) {
            outmsg += a;
        } else {
            chunks.push('```' + outmsg + '```')
            outmsg = ''
        }
    }
    if (outmsg.length) {
        chunks.push('```' + outmsg + '```')
    }
    return chunks;
}



//////////////////////////////////////////
//////////////// SPEECH //////////////////
//////////////////////////////////////////
async function transcribe(buffer) {

    return transcribe_witai(buffer)
    // return transcribe_gspeech(buffer)
}

// WitAI
let witAI_lastcallTS = null;
const witClient = require('node-witai-speech');

async function transcribe_witai(buffer) {
    console.log('transcribe_witai');
    try {
        // ensure we do not send more than one request per second
        if (witAI_lastcallTS != null) {
            let now = Math.floor(new Date());
            while (now - witAI_lastcallTS < 1000) {
                console.log('sleep')
                await sleep(100);
                now = Math.floor(new Date());
            }
        }
    } 
    catch (e) {
        console.log('transcription error:' + e)
    }

    try {
        console.log('transcribe_witai')
        const extractSpeechIntent = util.promisify(witClient.extractSpeechIntent);
        var stream = Readable.from(buffer);
        const contenttype = "audio/raw;encoding=signed-integer;bits=16;rate=48k;endian=little"
        const output = await extractSpeechIntent(WITAPIKEY, stream, contenttype)
        witAI_lastcallTS = Math.floor(new Date());
        //console.log('transcribed output: ' + output.text)f
        stream.destroy()
        return output;
    } 
    catch (e) {
        console.log('transcribe_witai 851:' + e); console.log(e) 
    }
}

// // Google Speech API
// // https://cloud.google.com/docs/authentication/production
// const gspeech = require('@google-cloud/speech');
// const gspeechclient = new gspeech.SpeechClient({
//     projectId: 'discordbot',
//     keyFilename: 'gspeech_key.json'
// });

// async function transcribe_gspeech(buffer) {
//     try {
//         console.log('transcribe_gspeech')
//         const bytes = buffer.toString('base64');
//         const audio = {
//             content: bytes,
//         };
//         const config = {
//             encoding: 'LINEAR16',
//             sampleRateHertz: 48000,
//             languageCode: 'en-US',  // https://cloud.google.com/speech-to-text/docs/languages
//         };
//         const request = {
//             audio: audio,
//             config: config,
//         };

//         const [response] = await gspeechclient.recognize(request);
//         const transcription = response.results
//             .map(result => result.alternatives[0].transcript)
//             .join('\n');
//         console.log(`gspeech: ${transcription}`);
//         return transcription;

//     } catch (e) { console.log('transcribe_gspeech 368:' + e) }
// }
