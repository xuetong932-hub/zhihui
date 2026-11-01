import { DOCX_TYPE } from './docx.js';
// Google Docs export (not yet verified against a real Google project). OAuth runs in a pop-up that returns to
// /oauth-callback.html on this origin; the opener reads the access token from the pop-up's address and closes it.
// Scope drive.file only allows files this app creates. The token stays in memory for this upload.
const fail = code => Object.assign(new Error(code), { code });
export function googleToken(clientId, { open = (...args) => window.open(...args), origin = location.origin, timeoutMs = 180000 } = {}) {
  const state = crypto.randomUUID();
  const url = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({ client_id: clientId, redirect_uri: `${origin}/oauth-callback.html`, response_type: 'token', scope: 'https://www.googleapis.com/auth/drive.file', include_granted_scopes: 'true', state, prompt: 'consent' })}`;
  const popup = open(url, 'knowledge-review-google', 'width=520,height=640');
  if (!popup) return Promise.reject(fail('popup'));
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (popup.closed) { clearInterval(timer); reject(fail('closed')); return; }
      if (Date.now() - started > timeoutMs) { clearInterval(timer); popup.close(); reject(fail('timeout')); return; }
      let hash = '';
      try { if (popup.location.origin === origin) hash = popup.location.hash; } catch { return; /* Still on Google's origin. */ }
      if (!hash) return;
      clearInterval(timer); popup.close();
      const params = new URLSearchParams(hash.slice(1));
      if (params.get('state') !== state || !params.get('access_token')) { reject(fail('denied')); return; }
      resolve(params.get('access_token'));
    }, 400);
  });
}
// Uploads the .docx and asks Drive to convert it to a Google Doc; returns the document's edit link.
export async function uploadAsGoogleDoc(token, name, bytes, fetchImpl = (...args) => fetch(...args)) {
  const boundary = `kr-${crypto.randomUUID()}`, metadata = JSON.stringify({ name, mimeType: 'application/vnd.google-apps.document' });
  const body = new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${DOCX_TYPE}\r\n\r\n`, bytes, `\r\n--${boundary}--`]);
  const response = await fetchImpl('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body, signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw fail(`http-${response.status}`);
  const { id } = await response.json();
  if (typeof id !== 'string' || !/^[\w-]{10,}$/.test(id)) throw fail('upload');
  return `https://docs.google.com/document/d/${id}/edit`;
}
