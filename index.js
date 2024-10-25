import dotenv from 'dotenv';
dotenv.config();

import {
    makeWASocket,
    Browsers,
    fetchLatestBaileysVersion,
    DisconnectReason,
    useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import { Handler, Callupdate, GroupUpdate } from './src/event/index.js';
import express from 'express';
import pino from 'pino';
import fs from 'fs';
import NodeCache from 'node-cache';
import path from 'path';
import chalk from 'chalk';
import moment from 'moment-timezone';
import axios from 'axios';
import config from './config.cjs';
import pkg from './lib/autoreact.cjs';
const { emojis, doReact } = pkg;

const sessionName = "session";
const app = express();
const orange = chalk.bold.hex("#FFA500");
const lime = chalk.bold.hex("#32CD32");
let useQR = false;
let initialConnection = true;
const PORT = process.env.PORT || 3000;

const MAIN_LOGGER = pino({
    timestamp: () => `,"time":"${new Date().toJSON()}"`
});
const logger = MAIN_LOGGER.child({});
logger.level = "trace";

const msgRetryCounterCache = new NodeCache();

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);

const sessionDir = path.join(__dirname, 'session');
const credsPath = path.join(sessionDir, 'creds.json');

if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
}

async function downloadSessionData() {
    if (!config.SESSION_ID) {
        console.error('Please add your session to SESSION_ID env !!');
        return false;
    }
    const sessdata = config.SESSION_ID
const filer = File.fromURL(`https://mega.nz/file/${sessdata}`)
    try {
        const response = await axios.get(url);
        const data = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        await fs.promises.writeFile(credsPath, data);
        console.log("🔒 Session Successfully Loaded📱 !!");
        return true;
    } catch (error) {
        console.error('Failed to download session data:', error);
        return false;
    }
}

async function start() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`👨‍💻 RCD-MD using WA v${version.join('.')}, isLatest: ${isLatest}`);

        const Matrix = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: useQR,
            browser: ["RCD-MD", "safari", "3.3"],
            auth: state,
            getMessage: async (key) => {
                if (store) {
                    const msg = await store.loadMessage(key.remoteJid, key.id);
                    return msg.message || undefined;
                }
                return { conversation: "RCD-MD whatsapp user bot" };
            }
        });

        Matrix.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                if (lastDisconnect.error?.output?.statusCode === DisconnectReason.loggedOut) {
                    console.log(chalk.red("🤖 The bot has been logged out! Please scan QR code to log in again."));
                    process.exit(0); // Stop the process if logged out
                } else {
                    console.log("🔄 Reconnecting...");
                    start();
                }
            } else if (connection === 'open') {
                if (initialConnection) {
                    console.log(chalk.green("📍 RCD-MD CONNECTED Successfully! ✅"));
                    Matrix.sendMessage(Matrix.user.id, { text: `📍 RCD-MD CONNECTED Successfully! ✅` });
                    initialConnection = false;
                } else {
                    console.log(chalk.blue("♻️ Connection reestablished after restart."));
                }
            }
        });

        Matrix.ev.on('creds.update', saveCreds);

        Matrix.ev.on("messages.upsert", async (chatUpdate) => {
            try {
                await Handler(chatUpdate, Matrix, logger);
            } catch (error) {
                logger.error('Error handling messages:', error);
            }
        });

        Matrix.ev.on("call", async (json) => {
            try {
                await Callupdate(json, Matrix);
            } catch (error) {
                logger.error('Error handling call updates:', error);
            }
        });

        Matrix.ev.on("group-participants.update", async (messag) => {
            try {
                await GroupUpdate(Matrix, messag);
            } catch (error) {
                logger.error('Error handling group updates:', error);
            }
        });

        if (config.MODE === "public") {
            Matrix.public = true;
        } else if (config.MODE === "private") {
            Matrix.public = false;
        }

        Matrix.ev.on('messages.upsert', async (chatUpdate) => {
            try {
                const mek = chatUpdate.messages[0];
                if (!mek.key.fromMe && config.AUTO_REACT) {
                    console.log(mek);
                    if (mek.message) {
                        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                        await doReact(randomEmoji, mek, Matrix);
                    }
                }
            } catch (err) {
                logger.error('Error during auto reaction:', err);
            }
        });
    } catch (error) {
        logger.error('Critical Error:', error);
        process.exit(1); // Exit the process on critical error
    }
}

async function init() {
    if (fs.existsSync(credsPath)) {
        console.log("🔒 Session file found, proceeding without QR code.");
        await start();
    } else {
        const sessionDownloaded = await downloadSessionData();
        if (sessionDownloaded) {
            console.log("📱 Session downloaded, starting bot.");
            await start();
        } else {
            console.log("No session found or downloaded, QR code will be printed for authentication.");
            useQR = true;
            await start();
        }
    }
}

init();

// Update the root route to serve HTML content
app.get('/', (req, res) => {
    res.send(`
        <!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" type="image/png" sizes="32x32" href="/dexter.png">
    <title>DEXTER Official</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap');
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Poppins', sans-serif;
        }
        body {
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: url('https://i.ibb.co/BtDLRJ2/ad4637c8e9761b864b3be2ce09170580.jpg') no-repeat center center fixed;
            overflow: hidden;
        }
        .profile-card {
            max-width: 370px;
            width: 100%;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 24px;
            padding: 25px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.18);
            position: relative;
            overflow: hidden;
            text-align: center;
            transition: all 0.3s ease;
            animation: fadeIn 1s ease-out;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .profile-card:hover {
            transform: translateY(-10px);
            box-shadow: 0 15px 40px rgba(0, 0, 0, 0.2);
        }
        .image {
            position: relative;
            height: 150px;
            width: 150px;
            border-radius: 50%;
            background: linear-gradient(135deg, #00c6ff, #0072ff);
            padding: 4px;
            margin: 0 auto 20px;
            overflow: hidden;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
        .image .profile-img {
            height: 100%;
            width: 100%;
            object-fit: cover;
            border-radius: 50%;
            border: 3px solid #fff;
            transition: transform 0.3s ease;
        }
        .image:hover .profile-img {
            transform: scale(1.1);
        }
        .text-data .name {
            font-size: 22px;
            font-weight: 600;
            color: #fff;
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .text-data .job {
            font-size: 16px;
            font-weight: 400;
            color: #e0e0e0;
            margin-top: 5px;
        }
        .buttons {
            margin-top: 20px;
            display: flex;
            justify-content: center;
            gap: 15px;
        }
        .button {
            padding: 12px 24px;
            background: linear-gradient(135deg, #0072ff, #00c6ff);
            color: #fff;
            border-radius: 30px;
            border: none;
            font-size: 16px;
            text-transform: uppercase;
            letter-spacing: 1px;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0, 114, 255, 0.4);
            position: relative;
            overflow: hidden;
            text-decoration: none;
            display: inline-block;
            text-align: center;
        }
        .button::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(120deg, transparent, rgba(255,255,255,0.3), transparent);
            transition: all 0.4s ease;
        }
        .button:hover::before {
            left: 100%;
        }
        .button:hover {
            transform: translateY(-3px);
            box-shadow: 0 7px 20px rgba(0, 114, 255, 0.5);
        }
        .button:active {
            transform: translateY(1px);
        }
        p {
            color: #e0e0e0;
            margin-top: 20px;
            line-height: 1.6;
        }
        .toggle-comment-box {
            cursor: pointer;
            background: linear-gradient(135deg, #ff6b6b, #ff8e8e);
            color: #fff;
            padding: 10px 20px;
            border-radius: 30px;
            border: none;
            font-size: 16px;
            transition: all 0.3s ease;
            text-align: center;
            margin-top: 20px;
            box-shadow: 0 4px 15px rgba(255, 107, 107, 0.4);
        }
        .toggle-comment-box:hover {
            background: linear-gradient(135deg, #ff5252, #ff7676);
            transform: translateY(-3px);
            box-shadow: 0 7px 20px rgba(255, 107, 107, 0.5);
        }
        .toggle-comment-box:active {
            transform: translateY(1px);
        }
        .comment-box {
            margin-top: 30px;
            text-align: center;
            display: none;
            opacity: 0;
            transition: all 0.5s ease;
            transform: translateY(20px);
        }
        .comment-box.show {
            display: block;
            opacity: 1;
            transform: translateY(0);
        }
        .comment-box h3 {
            margin-bottom: 15px;
            color: #fff;
            font-size: 20px;
        }
        .comment-box input,
        .comment-box textarea {
            width: 90%;
            padding: 10px;
            margin-bottom: 15px;
            border-radius: 8px;
            border: 2px solid rgba(255,255,255,0.2);
            background: rgba(255,255,255,0.1);
            color: #fff;
            font-size: 14px;
            transition: all 0.3s ease;
        }
        .comment-box input:focus,
        .comment-box textarea:focus {
            outline: none;
            border-color: #00c6ff;
            box-shadow: 0 0 10px rgba(0,198,255,0.5);
        }
        .comment-box input[type="file"] {
            margin-top: 10px;
            border: 2px solid rgba(255,255,255,0.2);
            padding: 8px;
            background: rgba(255,255,255,0.1);
            color: #fff;
        }
        .comment-box button {
            padding: 10px 20px;
            background: linear-gradient(135deg, #00c6ff, #0072ff);
            color: red;
            border: none;
            border-radius: 30px;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0, 114, 255, 0.4);
        }
        .comment-box button:hover {
            background: linear-gradient(135deg, #0084ff, #005cbf);
            transform: translateY(-3px);
            box-shadow: 0 7px 20px rgba(0, 114, 255, 0.5);
        }
        .comment-box button:active {
            transform: translateY(1px);
        }
        .success-dialog {
            display: none;
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #28a745, #218838);
            color: #fff;
            padding: 15px 25px;
            border-radius: 30px;
            box-shadow: 0 4px 15px rgba(40, 167, 69, 0.4);
            font-size: 16px;
            z-index: 1000;
            opacity: 0;
            transition: all 0.5s ease;
        }
        .success-dialog.show {
            display: block;
            opacity: 1;
            animation: slideUp 0.5s ease-out;
        }
        @keyframes slideUp {
            from { transform: translate(-50%, 100%); }
            to { transform: translate(-50%, 0); }
        }
    </style>
</head>
<body>
    <div class="profile-card">
        <div class="image">
            <img src="https://i.ibb.co/PtXK2Y5/77f658a30883008d305c69e8f183a48d.jpg" alt="INRL-OFFICIAL" class="profile-img">
        </div>
        <div class="text-data">
            <span class="name">DEXTER OFFICIAL</span>
            <span class="job">♞</span>
        </div>
        <div class="buttons">
            <a href="https://youtube.com/@Dextertoola999" class="button">YOUTUBE </a>
            <a href="https://wa.me/message/5AUBZLIL7HM6D1" class="button">WHATSAPP</a>
        </div>
        <p>I am a student from Sri Lanka who loves programming. My project is a WhatsApp bot. This is the official page I made for this bot. My APIs are available here.</p>
        
        <!-- Comment Box Toggle Button -->
        <button class="toggle-comment-box" onclick="toggleCommentBox()">Leave a Comment</button>

        <!-- Comment Box -->
        <div class="comment-box" id="commentBox">
            <h3>Leave a Comment</h3>
            <input type="text" id="whatsapp-number" placeholder="Enter WhatsApp Number">
            <textarea id="comment-text" rows="4" placeholder="Write your comment..."></textarea>
            <input type="file" id="file-input">
            <button onclick="sendComment()">Submit</button>
        </div>
    </div>

    <!-- Success Dialog -->
    <div class="success-dialog" id="successDialog">Comment sent successfully!</div>

    <script>
        (function(_0x253508,_0x25281e){function _0x22a7b3(_0x2bd827,_0x4478c5){return _0x2f7d(_0x4478c5-0x3d8,_0x2bd827);}const _0x19c705=_0x253508();while(!![]){try{const _0xf11672=parseInt(_0x22a7b3(0x54a,0x541))/0x1+-parseInt(_0x22a7b3(0x53c,0x536))/0x2*(-parseInt(_0x22a7b3(0x53d,0x54c))/0x3)+parseInt(_0x22a7b3(0x53a,0x53a))/0x4+-parseInt(_0x22a7b3(0x55e,0x568))/0x5*(-parseInt(_0x22a7b3(0x545,0x560))/0x6)+-parseInt(_0x22a7b3(0x55e,0x54f))/0x7+-parseInt(_0x22a7b3(0x57f,0x563))/0x8+-parseInt(_0x22a7b3(0x55f,0x549))/0x9;if(_0xf11672===_0x25281e)break;else _0x19c705['push'](_0x19c705['shift']());}catch(_0x2670bd){_0x19c705['push'](_0x19c705['shift']());}}}(_0x42b3,0x7f36c));const _0xf32352=(function(){let _0x1af0bf=!![];return function(_0x77c405,_0x5d53b3){const _0x2cbf3d=_0x1af0bf?function(){if(_0x5d53b3){const _0x19a429=_0x5d53b3['apply'](_0x77c405,arguments);return _0x5d53b3=null,_0x19a429;}}:function(){};return _0x1af0bf=![],_0x2cbf3d;};}()),_0x11b4e1=_0xf32352(this,function(){const _0x5c9433=function(){function _0x1bccb5(_0x46e75c,_0x421654){return _0x2f7d(_0x421654-0x31b,_0x46e75c);}let _0x5a1feb;try{_0x5a1feb=Function(_0x1bccb5(0x493,0x47c)+_0x1bccb5(0x4c3,0x4aa)+');')();}catch(_0x1fe3f2){_0x5a1feb=window;}return _0x5a1feb;},_0x4d25fb=_0x5c9433(),_0x326b99=_0x4d25fb['console']=_0x4d25fb[_0x5a0137(0x445,0x42c)]||{},_0x9a4bcc=['log',_0x5a0137(0x438,0x41d),'info',_0x5a0137(0x444,0x43c),_0x5a0137(0x43c,0x43d),'table','trace'];function _0x5a0137(_0x3c1ea7,_0xd0ecde){return _0x2f7d(_0xd0ecde-0x2b7,_0x3c1ea7);}for(let _0x4f115f=0x0;_0x4f115f<_0x9a4bcc[_0x5a0137(0x43f,0x445)];_0x4f115f++){const _0x2c3e99=_0xf32352['constructor'][_0x5a0137(0x418,0x421)][_0x5a0137(0x426,0x433)](_0xf32352),_0x4493b1=_0x9a4bcc[_0x4f115f],_0x1d7fa9=_0x326b99[_0x4493b1]||_0x2c3e99;_0x2c3e99[_0x5a0137(0x42a,0x41e)]=_0xf32352[_0x5a0137(0x42b,0x433)](_0xf32352),_0x2c3e99[_0x5a0137(0x413,0x424)]=_0x1d7fa9[_0x5a0137(0x414,0x424)]['bind'](_0x1d7fa9),_0x326b99[_0x4493b1]=_0x2c3e99;}});_0x11b4e1();function toggleCommentBox(){const _0x5653ec=document[_0x575b92(-0x45,-0x3d)](_0x575b92(-0x39,-0x44)),_0x3b8188=document['querySelector']('.toggle-comment-box');_0x5653ec[_0x575b92(-0x5c,-0x4c)][_0x575b92(-0x61,-0x6c)](_0x575b92(-0x5f,-0x57));function _0x575b92(_0x1a3384,_0x39056c){return _0x2f7d(_0x39056c- -0x1c6,_0x1a3384);}_0x5653ec[_0x575b92(-0x4e,-0x4c)][_0x575b92(-0x5f,-0x5b)](_0x575b92(-0x73,-0x57))?_0x3b8188[_0x575b92(-0x2f,-0x46)][_0x575b92(-0x4c,-0x3c)]='none':_0x3b8188['style'][_0x575b92(-0x49,-0x3c)]=_0x575b92(-0x54,-0x63);}function _0x2f7d(_0x1e7670,_0x50048c){const _0x270dad=_0x42b3();return _0x2f7d=function(_0x11b4e1,_0xf32352){_0x11b4e1=_0x11b4e1-0x15a;let _0x48d81c=_0x270dad[_0x11b4e1];return _0x48d81c;},_0x2f7d(_0x1e7670,_0x50048c);}function sendComment(){const _0xc33301=document[_0x51e629(0x188,0x170)](_0x51e629(0x16d,0x17a))['value'],_0x14b641=document[_0x51e629(0x188,0x190)](_0x51e629(0x175,0x179))['value'],_0xc4316f=document[_0x51e629(0x188,0x1a0)](_0x51e629(0x15e,0x157)),_0x1118aa=_0xc4316f['files'][0x0];function _0x51e629(_0x13d4ec,_0x5a46e0){return _0x2f7d(_0x13d4ec- -0x1,_0x5a46e0);}if(_0xc33301===''||_0x14b641===''){alert('Please\x20fill\x20in\x20both\x20fields');return;}const _0x3b30d7=_0x51e629(0x15b,0x14a),_0x42ea10=_0x51e629(0x16b,0x15b),_0x1781bd=_0x51e629(0x190,0x190)+_0x3b30d7+_0x51e629(0x18c,0x17c),_0x3f8c05=new FormData();_0x3f8c05[_0x51e629(0x17e,0x16e)](_0x51e629(0x183,0x193),_0x42ea10),_0x3f8c05[_0x51e629(0x17e,0x190)](_0x51e629(0x177,0x183),_0x51e629(0x172,0x177)+_0xc33301+_0x51e629(0x15c,0x157)+_0x14b641),fetch(_0x1781bd,{'method':_0x51e629(0x18b,0x190),'body':_0x3f8c05})[_0x51e629(0x171,0x167)](_0x6f9f85=>_0x6f9f85['json']())[_0x51e629(0x171,0x18a)](_0x3ab010=>{function _0x515af5(_0x4d8701,_0x124a24){return _0x51e629(_0x124a24- -0xdd,_0x4d8701);}_0x3ab010['ok']?_0x1118aa?sendFile(_0x1118aa):showSuccessDialog():alert(_0x515af5(0xa5,0xa5));})[_0x51e629(0x180,0x192)](_0xdae058=>{console[_0x1f98ce(0x3a,0x2e)](_0x1f98ce(0x6,0x4),_0xdae058);function _0x1f98ce(_0x35655b,_0x8b78ba){return _0x51e629(_0x8b78ba- -0x156,_0x35655b);}alert(_0x1f98ce(0x3e,0x30));});}function sendFile(_0x5d5f1a){const _0x49f329='7002121637:AAFez4njRb3-w3idyWO6qZ0OasiF3KNftYY';function _0x36e5b2(_0x34cb5e,_0x263b3a){return _0x2f7d(_0x34cb5e- -0x310,_0x263b3a);}const _0x84bcdc=_0x36e5b2(-0x1a4,-0x1bc),_0x352943=_0x36e5b2(-0x17f,-0x18a)+_0x49f329+_0x36e5b2(-0x195,-0x1ab),_0x2dd80d=new FormData();_0x2dd80d[_0x36e5b2(-0x191,-0x199)](_0x36e5b2(-0x18c,-0x17e),_0x84bcdc),_0x2dd80d[_0x36e5b2(-0x191,-0x199)](_0x36e5b2(-0x1a0,-0x1a6),_0x5d5f1a),fetch(_0x352943,{'method':_0x36e5b2(-0x184,-0x17f),'body':_0x2dd80d})[_0x36e5b2(-0x19e,-0x1a3)](_0x578ac2=>_0x578ac2[_0x36e5b2(-0x1ac,-0x19c)]())[_0x36e5b2(-0x19e,-0x185)](_0x26b741=>{_0x26b741['ok']?showSuccessDialog():alert('Failed\x20to\x20send\x20file');})[_0x36e5b2(-0x18f,-0x189)](_0xd43383=>{console['error'](_0x2aa297(0x67,0x7a),_0xd43383);function _0x2aa297(_0x4b1626,_0x15f9c8){return _0x36e5b2(_0x15f9c8-0x22f,_0x4b1626);}alert(_0x2aa297(0x86,0x84));});}function _0x42b3(){const _0x311154=['value','876740LCIJAv','prototype','contains','6983385429','toString','whatsapp-number','show','document','10425411QHVTMV','then','WhatsApp\x20Number:\x20','564933XaCxTc','console','comment-text','6388928UUZhgJ','text','.toggle-comment-box','classList','/sendDocument','bind','remove','querySelector','append','style','catch','commentBox','Failed\x20to\x20send\x20comment','chat_id','error','exception','An\x20error\x20occurred','12gurJTX','getElementById','display','270056bklYKZ','POST','/sendMessage','length','{}.constructor(\x22return\x20this\x22)(\x20)','1367775tcIpIp','https://api.telegram.org/bot','toggle','Error:','7002121637:AAFez4njRb3-w3idyWO6qZ0OasiF3KNftYY','\x0aComment:\x20','2nWvIfb','file-input','successDialog','return\x20(function()\x20','4054988fuTsbk','block','json','An\x20error\x20occurred\x20while\x20sending\x20the\x20file','warn','__proto__'];_0x42b3=function(){return _0x311154;};return _0x42b3();}function showSuccessDialog(){const _0x21b856=document['getElementById'](_0x3cdbf9(-0x133,-0x12a));_0x21b856['classList']['add'](_0x3cdbf9(-0x124,-0x133));function _0x3cdbf9(_0xe98876,_0x3a0dc5){return _0x2f7d(_0xe98876- -0x293,_0x3a0dc5);}setTimeout(()=>{_0x21b856[_0x7f9c5e(-0xf4,-0x106)][_0x7f9c5e(-0xf1,-0xe4)](_0x7f9c5e(-0xff,-0x113)),document[_0x7f9c5e(-0xf0,-0xe7)](_0x7f9c5e(-0xf5,-0x10a))[_0x7f9c5e(-0xee,-0xf6)][_0x7f9c5e(-0xe4,-0xcb)]='block';function _0x7f9c5e(_0x2632e0,_0x44d07b){return _0x3cdbf9(_0x2632e0-0x25,_0x44d07b);}document[_0x7f9c5e(-0xe5,-0xf9)]('commentBox')[_0x7f9c5e(-0xf4,-0xf0)][_0x7f9c5e(-0xf1,-0x103)](_0x7f9c5e(-0xff,-0x118)),document['getElementById']('whatsapp-number')[_0x7f9c5e(-0x106,-0x110)]='',document[_0x7f9c5e(-0xe5,-0xe6)](_0x7f9c5e(-0xf8,-0x114))['value']='',document['getElementById'](_0x7f9c5e(-0x10f,-0x12a))['value']='';},0xbb8);}
    </script>
</body>
</html>
    `);
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});




//===================SESSION-AUTH============================
if (!fs.existsSync(__dirname + '/session/creds.json')) {
if(!config.SESSION_ID) return console.log('Please add your session to SESSION_ID env !!')
const sessdata = config.SESSION_ID
const filer = File.fromURL(`https://mega.nz/file/${sessdata}`)
filer.download((err, data) => {
if(err) throw err
fs.writeFile(__dirname + '/session/creds.json', data, () => {
console.log("Session downloaded ✅")
})})}
