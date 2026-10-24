// Start the ClaimRight server.
//
// Environment:
//   PORT                 default 8080
//   DATA_DIR             where the sign-up database lives (default ./data)
//   ADMIN_PASSWORD       staff page password, 12+ characters (staff page is off without it)
//   NOTIFY_WEBHOOK_URL   optional: Slack/Discord/Teams-style webhook told about each new
//                        request (reference number and call time only, no personal details)
//   TRUST_PROXY=1        when running behind a hosting proxy (Railway, Render, Fly...)

import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { openStore } from './store.js';
import { createHandler } from './app.js';

const dataDir = process.env.DATA_DIR || fileURLToPath(new URL('../data', import.meta.url));
const webhook = process.env.NOTIFY_WEBHOOK_URL;

const notify = async (text) => {
  if (!webhook) return;
  await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, content: text }),
  });
};

const adminPassword = process.env.ADMIN_PASSWORD || '';
if (adminPassword && adminPassword.length < 12) console.warn('ADMIN_PASSWORD is shorter than 12 characters: staff page disabled.');

const handler = createHandler({ store: openStore(dataDir), adminPassword, notify, trustProxy: process.env.TRUST_PROXY === '1' });
const port = Number(process.env.PORT) || 8080;
createServer(handler).listen(port, () => {
  console.log(`ClaimRight running at http://localhost:${port}`);
  console.log(adminPassword.length >= 12 ? `Staff page: http://localhost:${port}/admin` : 'Staff page off: set ADMIN_PASSWORD (12+ characters) to turn it on.');
});
