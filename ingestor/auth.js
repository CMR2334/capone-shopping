// One-time OAuth flow: opens a browser, captures the redirect,
// exchanges the code for a refresh token, saves to token.json.
// Run once; the refresh token is then reused indefinitely.

const fs = require('fs');
const path = require('path');
const http = require('http');
const { google } = require('googleapis');

const ROOT = path.resolve(__dirname, '..');
const CLIENT_SECRET_PATH = path.join(ROOT, 'client_secret.json');
const TOKEN_PATH = path.join(ROOT, 'token.json');
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const PORT = 53117;
const REDIRECT_URI = `http://127.0.0.1:${PORT}`;

if (!fs.existsSync(CLIENT_SECRET_PATH)) {
  console.error(`\nMissing ${CLIENT_SECRET_PATH}`);
  console.error('Copy your client_secret JSON from Google Cloud into the project root and rerun.\n');
  process.exit(1);
}

const credentials = JSON.parse(fs.readFileSync(CLIENT_SECRET_PATH, 'utf8'));
const { client_id, client_secret } = credentials.installed || credentials.web;

const oauth2Client = new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent',
});

console.log('\n========================================================================');
console.log('  Open this URL in your browser and sign in with cmreko91@gmail.com:');
console.log('========================================================================\n');
console.log(authUrl);
console.log('\nWaiting for browser callback on ' + REDIRECT_URI + ' ...\n');

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, REDIRECT_URI);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`<h1>Auth error: ${error}</h1>`);
      console.error('Auth error from Google:', error);
      server.close();
      process.exit(1);
    }

    if (!code) {
      res.writeHead(400);
      res.end('Missing code parameter');
      return;
    }

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<h1>No refresh token returned. Revoke access at https://myaccount.google.com/permissions and rerun.</h1>');
      console.error('\nNo refresh_token in response. Visit https://myaccount.google.com/permissions, revoke "capone-shopping", and rerun.\n');
      server.close();
      process.exit(1);
    }

    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <html><body style="font-family: -apple-system, system-ui, sans-serif; padding: 40px; max-width: 600px; margin: auto;">
        <h1 style="color: #34c759;">Auth successful</h1>
        <p>You can close this tab and return to Terminal.</p>
      </body></html>
    `);

    console.log('\nSuccess. Refresh token saved to token.json');
    console.log('\nFor GitHub Actions later, you will use this value as the GMAIL_REFRESH_TOKEN secret:\n');
    console.log(tokens.refresh_token);
    console.log('');

    server.close();
    process.exit(0);
  } catch (err) {
    console.error('Error exchanging code:', err.message);
    res.writeHead(500);
    res.end('Auth failed: ' + err.message);
    server.close();
    process.exit(1);
  }
});

server.listen(PORT, '127.0.0.1');
