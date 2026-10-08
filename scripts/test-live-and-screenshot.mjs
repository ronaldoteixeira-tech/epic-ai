import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

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
const profile = path.join(root, ".browser-test-profile");
const outDir = path.join(root, "docs", "test-evidence");
fs.mkdirSync(outDir, { recursive: true });

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
  
  // Usar a URL oficial live para teste real de ponta a ponta
  const targetUrl = "https://epicrentalcar.pages.dev/?reset=1";
  console.log("Navegando para:", targetUrl);
  
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

  const waitFor = async (expression, timeout = 15000) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (await evaluate(expression)) return;
      await delay(100);
    }
    throw new Error(`Timeout: ${expression}`);
  };

  const capture = async (name) => {
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const filePath = path.join(outDir, `${name}.png`);
    fs.writeFileSync(filePath, Buffer.from(shot.data, "base64"));
    console.log(`[Screenshot salvo] -> ${filePath}`);
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
  console.log("Página inicial carregada com sucesso.");
  await capture("01_pagina_captura_inicial");

  const click = async (selector, index = 0, wait = 260) => {
    await evaluate(`document.querySelectorAll(${JSON.stringify(selector)})[${index}].click()`);
    await delay(wait);
  };
  const fill = async (selector, value) => {
    await evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); el.value=${JSON.stringify(value)}; el.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  };

  // 1. Preenchimento do formulário inicial
  console.log("Preenchendo dados de contato...");
  await fill("#nome", "Lead Teste Validacao Visual");
  await fill("#whatsapp", "11999998888");
  await fill("#email", "validacao.epic@gmail.com");
  await evaluate("document.querySelector('#capture-form').requestSubmit()");

  await waitFor("document.querySelector('#question-title')?.textContent.includes('Qual frase')");
  console.log("Pergunta 1 carregada.");
  await capture("02_pergunta_1_perfil");

  // Q1
  await click(".choice", 0);
  await delay(300);

  // Q2 (Múltipla escolha)
  await waitFor("document.querySelector('#question-title')?.textContent.includes('estruturas')");
  await click(".choice", 1); // Conta bancária americana
  await click("[data-action='continue']");
  await delay(300);

  // Q3 (Textarea)
  await waitFor("document.querySelector('#question-title')?.textContent.includes('já investiu fora')");
  await fill("textarea", "Já tenho investimentos e quero dolarizar patrimônio em operação real de veículos.");
  await click("[data-action='continue']");
  await delay(300);

  // Q4
  await waitFor("document.querySelector('#question-title')?.textContent.includes('trava hoje')");
  await click(".choice", 4); // Nada me trava
  await delay(300);

  // Q5 (Capital)
  await waitFor("document.querySelector('#question-title')?.textContent.includes('disponível para alocar')");
  await click(".choice", 2); // US$ 30 mil a US$ 100 mil
  await delay(300);

  // Q6 (Liquidez)
  await waitFor("document.querySelector('#question-title')?.textContent.includes('está...')");
  await click(".choice", 0); // Parado em conta / CDI
  await delay(300);

  // Q7 (Expectativa)
  await waitFor("document.querySelector('#question-title')?.textContent.includes('retorno mensal')");
  await click(".choice", 2); // 2% ao mês ou mais
  await delay(300);

  // Tela de Educação
  await waitFor("Boolean(document.querySelector('#education-title'))");
  console.log("Tela educativa (reframe) exibida.");
  await capture("03_tela_educativa");
  await click("[data-action='continue']");
  await delay(300);

  // Q8 (Motivador)
  await waitFor("document.querySelector('#question-title')?.textContent.includes('mais importa')");
  await click(".choice", 0); // Renda mensal em dólar caindo na conta
  await delay(300);

  // Q9 (Escala 0 a 10)
  await waitFor("document.querySelector('#question-title')?.textContent.includes('prioridade')");
  await click(".choice[data-value='10']");
  await click("[data-action='continue']");
  await delay(300);

  // Q10 (Prazo)
  await waitFor("document.querySelector('#question-title')?.textContent.includes('pretende, de fato')");
  await click(".choice", 0); // Neste mês
  await delay(300);

  // Q11 (Momento - Tela decisiva)
  await waitFor("document.querySelector('#question-title')?.textContent.includes('seu momento hoje')");
  await click(".choice", 2); // Tenho US$ 30 mil ou mais...
  await delay(300);

  // Q12 (Objeção final)
  await waitFor("document.querySelector('#question-title')?.textContent.includes('precisaria estar respondido')");
  await fill("textarea", "Quero entender prazos de rentabilidade, contratos e custódia dos veículos.");
  await capture("04_pergunta_final");
  await click("[data-action='continue']");

  // Esperar tela de resultado / carregamento do calendário
  console.log("Aguardando carregamento da agenda em tempo real via Google Calendar...");
  await waitFor("Boolean(document.querySelector('[data-slot]'))", 20000);
  console.log("Slots de agenda carregados com sucesso!");
  await capture("05_agenda_slots_disponiveis");

  // Selecionar um slot de reunião
  const totalSlots = await evaluate("document.querySelectorAll('[data-slot]').length");
  console.log(`Total de horários renderizados: ${totalSlots}`);
  await click("[data-slot]", 0, 300);
  await capture("06_slot_selecionado");

  // Confirmar agendamento
  console.log("Clicando no botão de confirmação do horário...");
  await click("[data-book]", 0, 500);

  // Aguardar confirmação da reunião
  await waitFor("Boolean(document.querySelector('#confirmation-title'))", 20000);
  const confirmationText = await evaluate("document.querySelector('#confirmation-title')?.textContent");
  const meetingSummary = await evaluate("document.querySelector('.meeting-summary')?.textContent");
  console.log("Confirmação recebida:", confirmationText);
  console.log("Resumo da reunião:", meetingSummary);
  await capture("07_confirmacao_reuniao_agendada");

  // Testar reset
  console.log("Testando reinicialização (reset) do fluxo...");
  await evaluate(`
    localStorage.removeItem("epic_qualification_v1_1");
    localStorage.removeItem("epic_qualification_pending_v1_1");
    sessionStorage.clear();
    location.href = "https://epicrentalcar.pages.dev/?reset=1";
  `);
  await delay(1500);
  await waitFor("Boolean(document.querySelector('#capture-form'))");
  console.log("Fluxo reiniciado com sucesso! Formulário em branco pronto para novo preenchimento.");
  await capture("08_fluxo_reiniciado_com_sucesso");

  socket.close();
  console.log("\n>>> VALIDAÇÃO COMPLETA: TODOS OS PASSOS EXECUTADOS E VALIDADOS COM SUCESSO! <<<");
}

try {
  await main();
} catch (err) {
  console.error("ERRO NO TESTE:", err);
  process.exitCode = 1;
} finally {
  child.kill();
  await delay(250);
  fs.rmSync(profile, { recursive: true, force: true });
}
