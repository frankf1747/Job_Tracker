/** The popup: sign in once, then it stays signed in and refreshes itself. */

import { signIn, currentSession, clearSession } from './supabase.js';

const $ = (id) => document.getElementById(id);
const form = $('signin');
const account = $('account');
const msg = $('msg');

function say(text, isError = false) {
  msg.textContent = text;
  msg.className = isError ? 'msg err' : 'msg';
}

/** Show the username the tracker knows, not the synthetic @jobtracker.local. */
function displayName(email) {
  return String(email || '').replace(/@jobtracker\.local$/i, '');
}

async function render() {
  const session = await currentSession();
  form.hidden = !!session;
  account.hidden = !session;
  if (session) $('who').textContent = displayName(session.email);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  say('Signing in…');
  try {
    await signIn($('username').value, $('password').value);
    $('password').value = '';
    say('');
    await render();
  } catch (err) {
    say(err.message || 'Could not sign in.', true);
  }
});

$('signout').addEventListener('click', async () => {
  await clearSession();
  say('');
  await render();
});

void render();
