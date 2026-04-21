require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;

// Environment Variables required for Discord OAuth2
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY;

app.use(express.static('public'));
app.use(express.json());

// 1. Redirect to Discord OAuth2
app.get('/auth/discord', async (req, res) => {
    const cfToken = req.query.cf_token;
    
    // Optional: Verify captcha immediately or store it in session
    // For this implementation, we will pass it through or verify here
    if (!cfToken) return res.status(400).send('Security verification required.');

    const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds.join%20email&state=${cfToken}`;
    res.redirect(url);
});

// 2. Callback from Discord
app.get('/auth/callback', async (req, res) => {
    const code = req.query.code;
    const cfToken = req.query.state; // We used 'state' to pass the captcha token
    
    if (!code) return res.status(400).send('Verification failed: No code provided.');
    if (!cfToken) return res.status(400).send('Security token missing.');

    try {
        // A. Verify Turnstile Captcha
        const captchaVerify = await axios.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            secret: TURNSTILE_SECRET,
            response: cfToken
        });

        if (!captchaVerify.data.success) {
            return res.status(403).send('Security verification failed. Please try again.');
        }

        // B. Exchange code for Access Token
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

        // C. Anti-Bot / Anti-Joiner Checks
        // 1. Must have verified email
        if (!isVerified) {
            return res.status(403).send('<h1>Access Denied</h1><p>Discordアカウントのメール認証が必要です。</p>');
        }

        // 3. Add user to server
        // Requires 'guilds.join' scope and Bot must have 'CREATE_INSTANT_INVITE' or be in the server.
        try {
            await axios.put(`https://discord.com/api/guilds/${GUILD_ID}/members/${userId}`, {
                access_token: accessToken
            }, {
                headers: {
                    Authorization: `Bot ${BOT_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
            
            // Success Page
            res.send(`
                <!DOCTYPE html>
                <html lang="ja">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>ACCESS GRANTED | SXS</title>
                    <link rel="stylesheet" href="/style.css">
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
                </head>
                <body>
                    <div class="overlay"></div>
                    <main class="container">
                        <section class="auth-box" style="text-align: center;">
                            <div class="status-indicator" style="justify-content: center;">
                                <span class="dot"></span>
                                <span class="status-text">PROCESS COMPLETE</span>
                            </div>
                            <h1 class="logo" style="font-size: 2rem; color: #00ff00;">GRANTED</h1>
                            <p class="description">認証が完了しました。${username} としてサーバーに参加しました。</p>
                            <a href="https://discord.com/channels/${GUILD_ID}" class="btn-primary">
                                <span class="btn-text">OPEN DISCORD</span>
                                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M5 12h14M12 5l7 7-7 7"/>
                                </svg>
                            </a>
                        </section>
                    </main>
                </body>
                </html>
            `);
        } catch (error) {
            console.error('Add Member Error:', error.response ? error.response.data : error.message);
            res.status(500).send('Failed to add you to the server. The bot might lack permissions.');
        }

    } catch (error) {
        console.error('Auth Error:', error.response ? error.response.data : error.message);
        res.status(500).send('Authentication failed.');
    }
});

app.listen(PORT, () => {
    console.log(`SXS Gateway running on port ${PORT}`);
});
