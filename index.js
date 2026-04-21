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

// Route: Get New CAPTCHA
app.get('/api/captcha', (req, res) => {
    const { image, text } = generateCaptcha();
    req.session.captcha = text;
    res.json({ image });
});

// 1. Redirect to Discord OAuth2
app.get('/auth/discord', (req, res) => {
    const userCaptcha = req.query.captcha;
    const sessionCaptcha = req.session.captcha;

    if (!userCaptcha || userCaptcha.toUpperCase() !== sessionCaptcha) {
        return res.status(403).send('Invalid CAPTCHA. Please try again.');
    }

    // Clear captcha so it can't be reused
    req.session.captcha = null;
    req.session.verified = true;

    const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds.join%20email`;
    res.redirect(url);
});

// 2. Callback from Discord
app.get('/auth/callback', async (req, res) => {
    const code = req.query.code;
    
    if (!code) return res.status(400).send('Verification failed: No code provided.');
    if (!req.session.verified) return res.status(403).send('Session expired or security check failed.');

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

        // Anti-Bot Checks
        if (!isVerified) {
            return res.status(403).send('Discord email verification required.');
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
            
            // Clear verification
            req.session.verified = false;

            // Success Page
            res.send(`
                <!DOCTYPE html>
                <html lang="ja">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>ACCESS GRANTED | SXS</title>
                    <link rel="stylesheet" href="/style.css">
                </head>
                <body>
                    <div class="overlay"></div>
                    <main class="container">
                        <section class="auth-box" style="text-align: center;">
                            <h1 class="logo" style="font-size: 2rem; color: #00ff00;">GRANTED</h1>
                            <p class="description">認証が完了しました。${username} として参加しました。</p>
                            <a href="https://discord.com/channels/${GUILD_ID}" class="btn-primary">OPEN DISCORD</a>
                        </section>
                    </main>
                </body>
                </html>
            `);
        } catch (error) {
            console.error('Add Member Error:', error.response ? error.response.data : error.message);
            res.status(500).send('Failed to add you to the server.');
        }

    } catch (error) {
        console.error('Auth Error:', error.response ? error.response.data : error.message);
        res.status(500).send('Authentication failed.');
    }
});

app.listen(PORT, () => {
    console.log(`SXS Gateway running on port ${PORT}`);
});
