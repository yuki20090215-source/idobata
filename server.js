const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const PORT        = process.env.PORT || 3000;
const AI_PROVIDER = (process.env.AI_PROVIDER || 'openai').toLowerCase();
const OPENAI_KEY  = process.env.OPENAI_API_KEY || '';
const GEMINI_KEY  = process.env.GEMINI_API_KEY || '';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (_) { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type':  'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      const indexPath = path.join(__dirname, 'public', 'index.html');
      fs.readFile(indexPath, (err2, indexData) => {
        if (err2) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(indexData);
      });
      return;
    }
    const ext  = path.extname(filePath);
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

function httpsPost(hostname, reqPath, headers, bodyObj) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(bodyObj);
    const options = {
      hostname,
      path:   reqPath,
      method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        ...headers,
      },
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`APIエラー HTTP ${res.statusCode}: ${raw.slice(0, 300)}`));
          return;
        }
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(new Error('JSONパース失敗: ' + raw.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function parseAIResponse(raw) {
  const cleaned = raw.replace(/```json|```/g, '').trim();
  const match   = cleaned.match(/\[[\s\S]*\]/);
  if (match) return JSON.parse(match[0]);
  return JSON.parse(cleaned);
}

async function callOpenAI(systemPrompt, userText) {
  const data = await httpsPost(
    'api.openai.com',
    '/v1/chat/completions',
    { Authorization: `Bearer ${OPENAI_KEY}` },
    {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userText },
      ],
      max_tokens:  1200,
      temperature: 0.9,
    }
  );
  return parseAIResponse(data.choices[0].message.content || '[]');
}

async function callGemini(systemPrompt, userText) {
  const data = await httpsPost(
    'generativelanguage.googleapis.com',
    `/v1beta/models/gemini-1.5-flash:generateContent?key=${GEM
