require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const session = require('express-session');
const generateCaptcha = require('./captcha');
const app = express();

const PORT = process.env.PORT || 3000;

// Environment Variables
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

app.use(express.static('public'));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'sxs-industrial-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 600000 } // 10 minutes
}));

// UI Helper: Render Monolithic Response
function renderStatus(title, message, isError = false, subMessage = '') {
    return `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title} | SXS</title>
        <link rel="stylesheet" href="/style.css">
    </head>
    <body>
        <div class="overlay"></div>
        <main class="container">
            <section class="auth-box" style="border-color: ${isError ? '#ff3333' : '#1a1a1a'};">
                <div class="status-indicator">
                    <span class="dot" style="background-color: ${isError ? '#ff3333' : '#00ff00'}; box-shadow: 0 0 8px ${isError ? '#ff3333' : '#00ff00'};"></span>
                    <span class="status-text">${isError ? 'SYSTEM ERROR' : 'PROCESS COMPLETE'}</span>
                </div>
                <h1 class="logo" style="font-size: 2rem; color: ${isError ? '#ff3333' : '#ffffff'};">${title}</h1>
                <p class="description" style="color: #fff;">${message}</p>
                ${subMessage ? `<p style="font-size: 10px; color: #444; margin-top: -1rem; margin-bottom: 2rem;">${subMessage}</p>` : ''}
                <div class="actions">
                    <a href="/" class="btn-primary">
                        <span class="btn-text">RETURN TO GATE</span>
                    </a>
                </div>
            </section>
        </main>
    </body>
    </html>`;
}

// Route: Get New CAPTCHA
app.get('/api/captcha', (req, res) => {
    try {
        const { image, text } = generateCaptcha();
        req.session.captcha = text;
        res.json({ image });
    } catch (e) {
        res.status(500).json({ error: 'Captcha generation failed' });
    }
});

// 1. Redirect to Discord OAuth2
app.get('/auth/discord', (req, res) => {
    const userCaptcha = req.query.captcha;
    const sessionCaptcha = req.session.captcha;

    if (!userCaptcha || !sessionCaptcha || userCaptcha.toUpperCase() !== sessionCaptcha.toUpperCase()) {
        return res.status(403).send(renderStatus('FORBIDDEN', 'CAPTCHA認証に失敗しました。正しい文字を入力してください。', true));
    }

    req.session.captcha = null;
    req.session.verified = true;

    const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds.join%20email`;
    res.redirect(url);
});

// 2. Callback from Discord
app.get('/auth/callback', async (req, res) => {
    const code = req.query.code;
    
    if (!code) {
        return res.status(400).send(renderStatus('MISSING CODE', '認証コードが提供されませんでした。最初からやり直してください。', true));
    }
    
    if (!req.session.verified) {
        return res.status(403).send(renderStatus('SESSION EXPIRED', 'セッションの有効期限が切れたか、不正なアクセスです。もう一度やり直してください。', true));
    }

    try {
        // Exchange code for Access Token
        const params = new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
        });

        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const accessToken = tokenResponse.data.access_token;

        // Get User Info
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const userId = userResponse.data.id;
        const username = userResponse.data.username;
        const isVerified = userResponse.data.verified;

        if (!isVerified) {
            return res.status(403).send(renderStatus('VERIFICATION REQUIRED', 'Discordのメール認証が済んでいないアカウントは参加できません。', true));
        }

        // 3. Add user to server
        try {
            await axios.put(`https://discord.com/api/guilds/${GUILD_ID}/members/${userId}`, {
                access_token: accessToken
            }, {
                headers: {
                    Authorization: `Bot ${BOT_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
            
            req.session.verified = false;
            res.send(renderStatus('ACCESS GRANTED', `${username} として参加が完了しました。<br>SXSサーバーへよう注目ください。`, false, `USER_ID: ${userId}`));
            
        } catch (error) {
            console.error('Add Member Error:', error.response ? error.response.data : error.message);
            res.status(500).send(renderStatus('JOIN FAILED', 'サーバーへの参加処理中にエラーが発生しました。Botの権限を確認してください。', true, error.message));
        }

    } catch (error) {
        const errorData = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error('Auth Error:', errorData);
        res.status(500).send(renderStatus('AUTH FAILED', 'Discordとの認証連携に失敗しました。設定値（Client ID/Secret/Redirect URI）を確認してください。', true, `DEBUG: ${errorData}`));
    }
});

app.listen(PORT, () => {
    console.log(`SXS Gateway running on port ${PORT}`);
});
