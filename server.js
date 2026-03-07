const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const AI_PROVIDER = (process.env.AI_PROVIDER || 'openai').toLowerCase();
const OPENAI_KEY  = process.env.OPENAI_API_KEY  || '';
const GEMINI_KEY  = process.env.GEMINI_API_KEY  || '';

// ===== MIME TYPES =====
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

// ===== JSON bodyパーサー =====
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch(e) { resolve({}); }
    });
    req.on('error', reject);
  });
}

// ===== JSONレスポンス =====
function sendJSON(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

// ===== プロンプト生成 =====
function replyPrompt(mode, interests) {
  const int = interests.length ? interests.join('、') : '未設定';
  const modes = {
    influencer: `インフルエンサーモード: ユーザーの投稿に熱狂的・共感的なコメントをする3〜5人で返信。likes は 100〜99999。`,
    mental:     `メンタルケアモード: 温かく寄り添う3〜4人で返信。likes は 10〜2000。`,
    debate:     `ディベートモード: 賛成・反対・中立など様々な立場の3〜5人が議論。likes は 10〜5000。`,
    legend:     `レジェンドトークモード: 歴史上の偉人3〜4人がその人物らしく返信。likes は 1000〜100000。`,
  };
  return `あなたは日本語SNS「いどばた」のAIです。
ユーザーの趣味・興味: ${int}
${modes[mode] || modes.influencer}
各キャラクター: name(日本語), id(@英数字), avatar(絵文字1つ), comment(返信文), likes(整数)
必ずJSON配列のみ返してください。説明文やコードブロック記号は不要です。
例: [{"name":"象のり造","id":"@zou","avatar":"🐘","comment":"バズる！","likes":2341}]`;
}

function timelinePrompt(interests, mode) {
  const int = interests.length ? interests.join('、') : '未設定';
  return `あなたは日本語SNS「いどばた」のAIです。
ユーザーの趣味・興味: ${int} / モード: ${mode}
上記の趣味に関連した個性的なSNS投稿を6〜8件生成してください。
各投稿: name(日本語), id(@英数字), avatar(絵文字1つ), comment(投稿。ハッシュタグOK), likes(100〜50000の整数)
必ずJSON配列のみ返してください。説明文・コードブロック記号は不要です。`;
}

// ===== AI呼び出し (Node.js標準httpsのみ) =====
function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const opts = {
      hostname, path, method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(bodyStr) }
    };
    const req = require('https').request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('JSON parse error: ' + data.slice(0,200))); }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function parseAI(raw) {
  const cleaned = raw.replace(/```json|```/g, '').trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (match) return JSON.parse(match[0]);
  return JSON.parse(cleaned);
}

async function callOpenAI(system, user) {
  const data = await httpsPost('api.openai.com', '/v1/chat/completions',
    { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
    { model: 'gpt-4o-mini', messages: [{role:'system',content:system},{role:'user',content:user}], max_tokens: 1200, temperature: 0.9 }
  );
  return parseAI(data.choices[0].message.content || '[]');
}

async function callGemini(system, user) {
  const prompt = `${system}\n\nユーザーの投稿: ${user}`;
  const data = await httpsPost(
    'generativelanguage.googleapis.com',
    `/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
    { 'Content-Type': 'application/json' },
    { contents: [{parts:[{text:prompt}]}], generationConfig: {temperature:0.9, maxOutputTokens:1200} }
  );
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
  return parseAI(raw);
}

async function callAI(system, user) {
  if (AI_PROVIDER === 'gemini' && GEMINI_KEY) return callGemini(system, user);
  if (OPENAI_KEY) return callOpenAI(system, user);
  throw new Error('APIキーが設定されていません。環境変数を確認してください。');
}

// ===== HTTPサーバー =====
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type'});
    return res.end();
  }

  // API: /api/health
  if (pathname === '/api/health') {
    return sendJSON(res, 200, {
      status: 'ok', provider: AI_PROVIDER,
      hasKey: !!(AI_PROVIDER === 'gemini' ? GEMINI_KEY : OPENAI_KEY)
    });
  }

  // API: /api/reply
  if (pathname === '/api/reply' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const { text, mode, interests = [] } = body;
      if (!text) return sendJSON(res, 400, { error: 'text is required' });
      const validMode = ['influencer','mental','debate','legend'].includes(mode) ? mode : 'influencer';
      const replies = await callAI(replyPrompt(validMode, interests), text);
      return sendJSON(res, 200, { replies });
    } catch(err) {
      console.error('/api/reply error:', err.message);
      return sendJSON(res, 500, { error: err.message, replies: [] });
    }
  }

  // API: /api/timeline
  if (pathname === '/api/timeline' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const { interests = [], mode = 'influencer' } = body;
      const posts = await callAI(timelinePrompt(interests, mode), 'タイムライン投稿を生成してください。');
      return sendJSON(res, 200, { posts });
    } catch(err) {
      console.error('/api/timeline error:', err.message);
      return sendJSON(res, 500, { error: err.message, posts: [] });
    }
  }

  // 静的ファイル配信
  let filePath = path.join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname);
  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPAフォールバック
      fs.readFile(path.join(__dirname, 'public', 'index.html'), (err2, data2) => {
        if (err2) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data2);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`✅ いどばたサーバー起動 ポート:${PORT}`);
  console.log(`🤖 AI: ${AI_PROVIDER} / キー: ${!!(AI_PROVIDER==='gemini'?GEMINI_KEY:OPENAI_KEY) ? '設定済み✅' : '未設定❌'}`);
});
