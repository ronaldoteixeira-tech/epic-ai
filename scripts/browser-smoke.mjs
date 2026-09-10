import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
const chrome =
  process.env.CHROME_BIN ||
  path.join(
    process.env.LOCALAPPDATA || "",
    "ms-playwright",
    "chromium-1234",
    "chrome-win64",
    "chrome.exe",
  );
const profile = path.join(root, ".browser-smoke-profile");
const screenshot = path.join(root, "preview-mobile-flow.png");
const entryScreenshot = path.join(root, "preview-mobile-entry.png");

if (!fs.existsSync(chrome)) throw new Error(`Chromium não encontrado em ${chrome}`);
fs.rmSync(profile, { recursive: true, force: true });
fs.mkdirSync(profile, { recursive: true });

const child = spawn(
  chrome,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--allow-file-access-from-files",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForFile(file, timeout = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (fs.existsSync(file)) return;
    await delay(100);
  }
  throw new Error(`Timeout esperando ${file}`);
}

async function main() {
  const portFile = path.join(profile, "DevToolsActivePort");
  await waitForFile(portFile);
  const [port] = fs.readFileSync(portFile, "utf8").split(/\r?\n/);
  const targetUrl = pathToFileURL(path.join(root, "public", "index.html")).href;
  const target = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(targetUrl)}`, {
    method: "PUT",
  }).then((response) => response.json());

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  let callId = 0;
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    message.error ? reject(new Error(message.error.message)) : resolve(message.result);
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++callId;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async (expression, timeout = 8000) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (await evaluate(expression)) return;
      await delay(80);
    }
    throw new Error(`Timeout: ${expression}`);
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
    screenWidth: 390,
    screenHeight: 844,
  });
  await send("Page.navigate", { url: targetUrl });
  await waitFor("document.readyState === 'complete' && Boolean(document.querySelector('#capture-form'))");

  const initialAudit = await evaluate(`({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    title: document.querySelector('#capture-title')?.textContent
  })`);
  const entryCapture = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  fs.writeFileSync(entryScreenshot, Buffer.from(entryCapture.data, "base64"));

  await evaluate(`
    window.fetch = async (url, options = {}) => {
      const target = String(url);
      const json = (value, status = 200) => new Response(JSON.stringify(value), {status, headers:{'Content-Type':'application/json'}});
      if (target.includes('/api/availability')) {
        const a = new Date(Date.now() + 48*60*60*1000); a.setUTCHours(13,0,0,0);
        const b = new Date(a.getTime() + 60*60*1000);
        return json({ok:true, slots:[
          {start:a.toISOString(), end:new Date(a.getTime()+45*60000).toISOString()},
          {start:b.toISOString(), end:new Date(b.getTime()+45*60000).toISOString()}
        ]});
      }
      if (target.includes('/api/booking')) {
        const body = JSON.parse(options.body);
        return json({ok:true,event_id:'test-event',start:body.start,end:new Date(new Date(body.start).getTime()+45*60000).toISOString(),meet_url:'https://meet.google.com/test'});
      }
      return json({ok:true});
    };
  `);

  const click = async (selector, index = 0, wait = 260) => {
    await evaluate(`document.querySelectorAll(${JSON.stringify(selector)})[${index}].click()`);
    await delay(wait);
  };
  const fill = async (selector, value) => {
    await evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); el.value=${JSON.stringify(value)}; el.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  };

  await fill("#nome", "Pessoa de Teste");
  await fill("#whatsapp", "11999999999");
  await fill("#email", "teste@example.com");
  await evaluate("document.querySelector('#capture-form').requestSubmit()");
  await waitFor("document.querySelector('#question-title')?.textContent.includes('Qual frase')");

  await click(".choice", 0);
  await click(".choice", 0, 80);
  await click("[data-action='continue']");
  await fill("textarea", "Já investi fora e tive uma boa experiência.");
  await click("[data-action='continue']");
  await click(".choice", 4);
  await click(".choice", 3);
  await click(".choice", 0);
  await click(".choice", 1);
  await click("[data-action='continue']");
  await click(".choice", 0);
  await click(".choice[data-value='10']", 0, 80);
  await click("[data-action='continue']");
  await click(".choice", 0);
  await click(".choice", 3);
  await fill("textarea", "Quero entender custos, riscos e retorno líquido.");
  await click("[data-action='continue']", 0, 400);
  await waitFor("Boolean(document.querySelector('[data-slot]'))");
  await click("[data-slot]", 0, 80);
  await click("[data-book]", 0, 250);
  await waitFor("document.querySelector('#confirmation-title')?.textContent.includes('Tudo certo')");

  const audit = await evaluate(`({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    title: document.querySelector('#confirmation-title')?.textContent,
    events: (window.dataLayer || []).map(item => item.event).filter(Boolean),
    leaksPii: JSON.stringify(window.dataLayer || []).includes('teste@example.com')
  })`);
  const capture = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  fs.writeFileSync(screenshot, Buffer.from(capture.data, "base64"));
  console.log(JSON.stringify({ entry: initialAudit, confirmation: audit }, null, 2));

  if (initialAudit.scrollWidth > initialAudit.width) throw new Error("Entrada tem overflow horizontal");
  if (audit.scrollWidth > audit.width) throw new Error("Layout mobile tem overflow horizontal");
  if (audit.leaksPii) throw new Error("PII encontrada no dataLayer");
  for (const event of ["quiz_iniciado", "quiz_bloco_3", "quiz_concluido", "reuniao_agendada"]) {
    if (!audit.events.includes(event)) throw new Error(`Evento GTM ausente: ${event}`);
  }
  socket.close();
}

try {
  await main();
} finally {
  child.kill();
  await delay(250);
  fs.rmSync(profile, { recursive: true, force: true });
}
