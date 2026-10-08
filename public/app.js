import { classifyLead, ROUTES } from "./scoring.js";

const CONFIG = Object.freeze({
  api: {
    lead: "/api/lead",
    availability: "/api/availability",
    booking: "/api/booking",
  },
  privacyUrl: "https://epicrentalcar.com/privacy",
  nutritionMaterialUrl: "./material-educativo.pdf",
  timezone: "America/Sao_Paulo",
  totalFunnelScreens: 13,
  storageKey: "epic_qualification_v1_1",
  pendingKey: "epic_qualification_pending_v1_1",
});

const questions = [
  {
    id: "epic_perfil",
    number: 1,
    stage: "perfil",
    type: "single",
    title: "Qual frase descreve melhor você hoje?",
    options: [
      "Já invisto fora do Brasil e quero mais um ativo em dólar",
      "Tenho capital no Brasil e nunca dolarizei nada",
      "Já tenho estrutura nos EUA (LLC, conta, imóvel)",
      "Estou começando a estudar agora como sair do real",
    ],
  },
  {
    id: "epic_estrutura_us",
    number: 2,
    stage: "perfil",
    type: "multiple",
    title: "Você já tem alguma dessas estruturas nos EUA?",
    description: "Pode marcar mais de uma.",
    options: [
      "LLC aberta",
      "Conta bancária americana",
      "ITIN / EIN",
      "Imóvel nos EUA",
      "Nenhuma ainda",
    ],
  },
  {
    id: "epic_experiencia_exterior",
    number: 3,
    stage: "experiencia",
    type: "textarea",
    title: "Você já investiu fora do Brasil? Se sim, em quê — e como foi a experiência?",
    description: "Seja direto. É isso que define se essa conversa faz sentido.",
    placeholder: "Digite sua mensagem...",
    maxLength: 200,
  },
  {
    id: "epic_objecao_principal",
    number: 4,
    stage: "experiencia",
    type: "single",
    title: "O que mais te trava hoje para colocar dinheiro para render em dólar?",
    options: [
      "Não sei em quem confiar lá fora",
      "Burocracia, imposto, câmbio — parece complicado demais",
      "Meu capital está travado em outra coisa",
      "Já me queimei em uma operação internacional",
      "Nada me trava, só nunca me apresentaram uma operação boa",
    ],
  },
  {
    id: "epic_capital_90d",
    number: 5,
    stage: "capital",
    type: "single",
    eyebrow: "Filtro principal",
    title: "Quanto você teria disponível para alocar nos próximos 90 dias?",
    options: [
      "Menos de US$ 15 mil (ainda montando)",
      "US$ 15 mil a US$ 30 mil",
      "US$ 30 mil a US$ 100 mil",
      "Acima de US$ 100 mil",
    ],
  },
  {
    id: "epic_liquidez",
    number: 6,
    stage: "capital",
    type: "single",
    title: "Esse capital hoje está...",
    options: [
      "Parado em conta / CDI",
      "Em renda variável",
      "Em imóvel ou negócio próprio",
      "Ainda preciso liberar / vender algo",
    ],
  },
  {
    id: "epic_expectativa_retorno",
    number: 7,
    stage: "reframe",
    type: "single",
    title: "Qual retorno mensal você considera bom para um dinheiro em dólar?",
    options: [
      "Até 0,4% ao mês (o padrão de renda fixa americana)",
      "Cerca de 1% ao mês",
      "2% ao mês ou mais",
      "Sinceramente, não sei o que é realista",
    ],
  },
  {
    id: "education",
    stage: "reframe",
    type: "education",
  },
  {
    id: "epic_motivador",
    number: 8,
    stage: "reframe",
    type: "single",
    title: "O que mais importa pra você nesse investimento?",
    options: [
      "Renda mensal em dólar caindo na conta",
      "Proteger patrimônio do risco Brasil",
      "Construir presença nos EUA (visto, moradia, futuro dos filhos)",
      "Rentabilidade acima de tudo",
    ],
  },
  {
    id: "epic_prioridade_0a10",
    number: 9,
    stage: "temperatura",
    type: "scale",
    title: "De 0 a 10, o quanto dolarizar parte do seu patrimônio é prioridade nos próximos 6 meses?",
  },
  {
    id: "epic_prazo_aporte",
    number: 10,
    stage: "temperatura",
    type: "single",
    title: "Quando você pretende, de fato, fazer o primeiro aporte?",
    options: ["Neste mês", "Em 30 a 60 dias", "Em 3 a 6 meses", "Sem data, só estudando"],
  },
  {
    id: "epic_momento",
    number: 11,
    stage: "compromisso",
    type: "single",
    eyebrow: "Tela decisiva",
    title: "Qual opção descreve o seu momento hoje?",
    description: "Selecione a alternativa que mais combina com a sua realidade.",
    options: [
      "Ainda estou estudando. Não pretendo alocar capital nos próximos 6 meses.",
      "Tenho US$ 15 mil. Quero começar pelo ticket de entrada, ver a operação funcionando de perto e escalar depois.",
      "Tenho US$ 30 mil ou mais. Quero entrar com posição relevante já no primeiro aporte.",
      "Tenho US$ 100 mil ou mais. Quero avaliar uma posição estratégica na operação, não só o aporte padrão.",
    ],
  },
  {
    id: "epic_objecao_final",
    number: 12,
    stage: "compromisso",
    type: "textarea",
    eyebrow: "Última pergunta",
    title: "Se a operação fizer sentido na reunião, o que precisaria estar respondido para você decidir?",
    description: "Escreva sem filtro — eu preparo essa resposta antes da nossa conversa.",
    placeholder: "Digite sua mensagem...",
    maxLength: 200,
  },
];

const phaseEndScreens = Object.freeze({
  epic_estrutura_us: "perfil",
  epic_objecao_principal: "experiencia",
  epic_liquidez: "capital",
  epic_motivador: "reframe",
  epic_prazo_aporte: "temperatura",
});

const app = document.querySelector("#app");
const progressWrap = document.querySelector("#progress-wrap");
const progressBar = document.querySelector("#progress-bar");
const progressTrack = document.querySelector(".progress-track");
const progressValue = document.querySelector("#progress-value");
const progressLabel = document.querySelector("#progress-label");
const toast = document.querySelector("#toast");

const state = loadState();
let isSubmitting = false;
let toastTimer;
let selectedCalendarDay = null;
let selectedSlot = null;
let availableSlots = [];

function createLeadId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `epic-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function initialState() {
  return {
    version: "1.1",
    leadId: createLeadId(),
    currentScreen: -1,
    startedAt: new Date().toISOString(),
    contact: { nome: "", whatsapp: "", email: "" },
    answers: {},
    tracking: collectTracking(),
    completed: false,
    booking: null,
  };
}

function loadState() {
  const params = new URLSearchParams(window.location.search);
  if (
    params.has("reset") ||
    params.has("novo") ||
    params.has("restart") ||
    params.has("teste") ||
    params.has("limpar")
  ) {
    try {
      localStorage.removeItem(CONFIG.storageKey);
      localStorage.removeItem(CONFIG.pendingKey);
      sessionStorage.clear();
    } catch {}
    return initialState();
  }

  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG.storageKey));
    if (saved?.version === "1.1" && saved?.leadId) {
      return { ...initialState(), ...saved };
    }
  } catch {
    localStorage.removeItem(CONFIG.storageKey);
  }
  return initialState();
}

export function resetEpicJourney() {
  try {
    localStorage.removeItem(CONFIG.storageKey);
    localStorage.removeItem(CONFIG.pendingKey);
    sessionStorage.clear();
  } catch {}
  window.location.href = window.location.pathname;
}
if (typeof window !== "undefined") {
  window.resetEpicJourney = resetEpicJourney;
}

function saveState() {
  localStorage.setItem(CONFIG.storageKey, JSON.stringify(state));
}

function collectTracking() {
  const params = new URLSearchParams(window.location.search);
  const fields = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "fbclid",
    "gclid",
  ];
  const tracking = Object.fromEntries(fields.map((field) => [field, params.get(field) || ""]));
  tracking.creative_id = params.get("creative_id") || params.get("ad_id") || "";
  tracking.landing_url = window.location.href;
  tracking.referrer = document.referrer || "";
  return tracking;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function updateProgress(screenIndex = state.currentScreen, complete = false) {
  if (screenIndex < 0 && !complete) {
    progressWrap.hidden = true;
    return;
  }

  progressWrap.hidden = false;
  const percent = complete
    ? 100
    : Math.round(((screenIndex + 1) / CONFIG.totalFunnelScreens) * 100);
  progressBar.style.width = `${percent}%`;
  progressTrack.setAttribute("aria-valuenow", String(percent));
  progressValue.textContent = `${percent}%`;
  progressLabel.textContent = complete ? "Qualificação concluída" : "Seu diagnóstico";
}

function focusScreen() {
  requestAnimationFrame(() => {
    app.focus({ preventScroll: true });
    document.querySelector("h1, h2")?.setAttribute("tabindex", "-1");
    document.querySelector("h1, h2")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function render() {
  if (state.booking) {
    renderBookingConfirmation(state.booking);
    return;
  }

  if (state.completed) {
    renderResult(state.classification || classifyLead(state.answers, { isComplete: true }));
    return;
  }

  if (state.currentScreen < 0) {
    renderCapture();
    return;
  }

  renderQuestion(questions[state.currentScreen]);
}

function renderCapture() {
  updateProgress(-1);
  app.innerHTML = `
    <section class="screen screen-card capture-card" aria-labelledby="capture-title">
      <div class="capture-copy">
        <p class="eyebrow">Epic Rental Car · Orlando</p>
        <h1 id="capture-title">Renda em dólar, em Orlando, a partir de US$ 15 mil.</h1>
        <p class="lead">Uma operação real de frota — carro, placa, contrato e locatário. Não uma promessa de tela.</p>
        <figure class="capture-fleet">
          <img
            src="./nossa-frota.png"
            alt="Operação e desempenho real da nossa frota em Orlando — Epic Rental Car"
            class="capture-fleet-img"
            width="1057"
            height="935"
            loading="eager"
          />
          <figcaption class="capture-fleet-caption">
            <span class="fleet-live-dot" aria-hidden="true"></span>
            Operação real monitorada em Orlando · Carros ativos
          </figcaption>
        </figure>
      </div>
      <form class="capture-form" id="capture-form" novalidate>
        <p class="lead">Responda 12 perguntas rápidas. Se fizer sentido, você agenda uma conversa comigo e sai com a simulação do seu cenário.</p>
        ${captureField("nome", "Seu nome completo", "text", "Nome e sobrenome", "name", state.contact.nome)}
        ${captureField("whatsapp", "WhatsApp com DDD", "tel", "(11) 99999-9999", "tel", state.contact.whatsapp)}
        ${captureField("email", "Seu melhor e-mail", "email", "voce@exemplo.com", "email", state.contact.email)}
        <button class="button button-full" type="submit">Começar</button>
        <p class="privacy-note">
          Ao continuar você concorda com a
          <a href="${CONFIG.privacyUrl}" target="_blank" rel="noopener noreferrer">Política de Privacidade</a>.
        </p>
      </form>
    </section>
  `;

  const form = document.querySelector("#capture-form");
  form.addEventListener("submit", submitCapture);
  form.elements.whatsapp.addEventListener("input", (event) => {
    event.target.value = formatPhone(event.target.value);
  });
  focusScreen();
}

function captureField(id, label, type, placeholder, autocomplete, value) {
  return `
    <div class="field-group">
      <label for="${id}">${label}</label>
      <input
        class="text-input"
        id="${id}"
        name="${id}"
        type="${type}"
        value="${escapeHtml(value)}"
        placeholder="${placeholder}"
        autocomplete="${autocomplete}"
        aria-describedby="${id}-error"
        required
      />
      <span class="field-error" id="${id}-error"></span>
    </div>
  `;
}

function formatPhone(value) {
  const digits = value.replace(/\D/g, "").slice(0, 13);
  const local = digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;
  if (local.length <= 2) return local;
  if (local.length <= 6) return `(${local.slice(0, 2)}) ${local.slice(2)}`;
  if (local.length <= 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7, 11)}`;
}

async function submitCapture(event) {
  event.preventDefault();
  if (isSubmitting) return;

  const form = event.currentTarget;
  clearFieldErrors(form);
  const contact = {
    nome: form.elements.nome.value.trim(),
    whatsapp: form.elements.whatsapp.value.trim(),
    email: form.elements.email.value.trim().toLowerCase(),
  };
  const errors = validateContact(contact);

  if (Object.keys(errors).length) {
    for (const [field, message] of Object.entries(errors)) {
      form.elements[field].setAttribute("aria-invalid", "true");
      document.querySelector(`#${field}-error`).textContent = message;
    }
    form.elements[Object.keys(errors)[0]].focus();
    return;
  }

  state.contact = contact;
  state.currentScreen = 0;
  saveState();
  setBusy(form.querySelector("button[type='submit']"), true, "Salvando...");
  track("quiz_iniciado", { screen: "T0", stage: "captura" });
  const saved = await sendLeadUpdate("quiz_iniciado", "captura", "T0");
  if (!saved) showToast("Contato salvo neste dispositivo. Tentaremos sincronizar novamente.");
  isSubmitting = false;
  render();
}

function validateContact(contact) {
  const errors = {};
  if (contact.nome.split(/\s+/).filter(Boolean).length < 2) {
    errors.nome = "Informe seu nome e sobrenome.";
  }
  const phoneDigits = contact.whatsapp.replace(/\D/g, "");
  if (phoneDigits.length < 10 || phoneDigits.length > 13) {
    errors.whatsapp = "Informe um WhatsApp válido com DDD.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
    errors.email = "Informe um e-mail válido.";
  }
  return errors;
}

function clearFieldErrors(form) {
  form.querySelectorAll("[aria-invalid]").forEach((field) => field.removeAttribute("aria-invalid"));
  form.querySelectorAll(".field-error").forEach((error) => {
    error.textContent = "";
  });
}

function renderQuestion(question) {
  updateProgress();
  if (question.type === "education") {
    renderEducation();
    return;
  }

  const eyebrow = question.eyebrow || `Pergunta ${question.number} de 12`;
  app.innerHTML = `
    <section class="screen screen-card" aria-labelledby="question-title">
      <p class="eyebrow">${eyebrow}</p>
      <h2 id="question-title">${question.title}</h2>
      ${question.description ? `<p class="lead">${question.description}</p>` : ""}
      ${renderControl(question)}
      ${question.type === "single" ? "" : renderActions("Continuar")}
    </section>
  `;

  bindQuestionEvents(question);
  focusScreen();
}

function renderControl(question) {
  const currentValue = state.answers[question.id];
  if (question.type === "textarea") {
    const value = currentValue || "";
    return `
      <label class="sr-only" for="${question.id}">${question.title}</label>
      <textarea
        class="textarea"
        id="${question.id}"
        maxlength="${question.maxLength}"
        placeholder="${question.placeholder}"
      >${escapeHtml(value)}</textarea>
      <span class="counter" id="counter">${String(value).length}/${question.maxLength}</span>
    `;
  }

  if (question.type === "scale") {
    return `
      <div class="scale" role="radiogroup" aria-label="Prioridade de zero a dez">
        ${Array.from({ length: 11 }, (_, value) => {
          const selected = Number(currentValue) === value;
          return `<button class="choice${selected ? " is-selected" : ""}" type="button" data-value="${value}" role="radio" aria-checked="${selected}">${value}</button>`;
        }).join("")}
      </div>
      <div class="scale-labels" aria-hidden="true"><span>Nada prioritário</span><span>Prioridade máxima</span></div>
    `;
  }

  const isMultiple = question.type === "multiple";
  const selectedValues = isMultiple && Array.isArray(currentValue) ? currentValue : [];
  return `
    <div class="choices" role="${isMultiple ? "group" : "radiogroup"}" aria-label="${escapeHtml(question.title)}">
      ${question.options
        .map((option) => {
          const selected = isMultiple ? selectedValues.includes(option) : currentValue === option;
          return `
            <button
              class="choice${selected ? " is-selected" : ""}"
              type="button"
              data-value="${escapeHtml(option)}"
              data-multiple="${isMultiple}"
              role="${isMultiple ? "checkbox" : "radio"}"
              aria-checked="${selected}"
            >
              <span class="choice-marker" aria-hidden="true">✓</span>
              <span class="choice-label">${option}</span>
            </button>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderActions(label) {
  return `
    <div class="actions">
      <button class="back-button" type="button" data-action="back">← Voltar</button>
      <button class="button actions-right" type="button" data-action="continue">${label}</button>
    </div>
  `;
}

function bindQuestionEvents(question) {
  document.querySelector("[data-action='back']")?.addEventListener("click", goBack);
  document.querySelector("[data-action='continue']")?.addEventListener("click", () => submitCurrent(question));

  if (question.type === "textarea") {
    const textarea = document.querySelector(`#${question.id}`);
    textarea.addEventListener("input", () => {
      state.answers[question.id] = textarea.value;
      document.querySelector("#counter").textContent = `${textarea.value.length}/${question.maxLength}`;
      saveState();
    });
    return;
  }

  document.querySelectorAll(".choice").forEach((button) => {
    button.addEventListener("click", async () => {
      const value = button.dataset.value;
      if (question.type === "multiple") {
        toggleMultiple(question, value);
        renderQuestion(question);
        return;
      }
      if (question.type === "scale") {
        state.answers[question.id] = Number(value);
        saveState();
        document.querySelectorAll(".choice").forEach((choice) => {
          const selected = choice === button;
          choice.classList.toggle("is-selected", selected);
          choice.setAttribute("aria-checked", String(selected));
        });
        return;
      }

      state.answers[question.id] = value;
      saveState();
      document.querySelectorAll(".choice").forEach((choice) => {
        const selected = choice === button;
        choice.classList.toggle("is-selected", selected);
        choice.setAttribute("aria-checked", String(selected));
      });
      await new Promise((resolve) => window.setTimeout(resolve, 190));
      submitCurrent(question);
    });
  });
}

function toggleMultiple(question, value) {
  const values = new Set(
    Array.isArray(state.answers[question.id]) ? state.answers[question.id] : [],
  );
  if (value === "Nenhuma ainda") {
    values.clear();
    values.add(value);
  } else {
    values.delete("Nenhuma ainda");
    values.has(value) ? values.delete(value) : values.add(value);
  }
  state.answers[question.id] = [...values];
  saveState();
}

function validateQuestion(question) {
  const value = state.answers[question.id];
  if (question.type === "textarea") {
    const input = document.querySelector(`#${question.id}`);
    const cleanValue = input.value.trim();
    state.answers[question.id] = cleanValue;
    saveState();
    return cleanValue.length > 0;
  }
  if (question.type === "multiple") return Array.isArray(value) && value.length > 0;
  if (question.type === "scale") return Number.isInteger(value) && value >= 0 && value <= 10;
  return Boolean(value);
}

async function submitCurrent(question) {
  if (isSubmitting) return;
  if (!validateQuestion(question)) {
    showToast("Selecione ou preencha uma resposta para continuar.");
    return;
  }

  isSubmitting = true;
  document.querySelectorAll("button").forEach((button) => {
    button.disabled = true;
  });

  const isFinal = question.id === "epic_objecao_final";
  let eventName = "answer_saved";
  if (question.id === "epic_capital_90d") eventName = "quiz_bloco_3";
  if (phaseEndScreens[question.id]) eventName = "phase_completed";
  if (isFinal) eventName = "quiz_concluido";

  if (eventName !== "answer_saved" && !isFinal) {
    track(eventName, {
      screen: `T${question.number}`,
      stage: question.stage,
      phase: phaseEndScreens[question.id] || question.stage,
    });
  }

  const serverResult = await sendLeadUpdate(
    eventName,
    question.stage,
    `T${question.number}`,
    isFinal,
  );

  if (isFinal) {
    state.completed = true;
    const clientClassification = classifyLead(state.answers, { isComplete: true });
    state.classification = normalizeServerClassification(serverResult, clientClassification);
    saveState();
    track("quiz_concluido", {
      screen: `T${question.number}`,
      stage: question.stage,
      phase: question.stage,
      epic_score: state.classification.score,
      epic_route: state.classification.route,
      epic_tag: state.classification.tag,
    });
    isSubmitting = false;
    renderResult(state.classification);
    return;
  }

  state.currentScreen += 1;
  saveState();
  isSubmitting = false;
  render();
}

function normalizeServerClassification(result, fallback) {
  const candidate = result?.classification || result?.data?.classification || result;
  if (!candidate || !Object.values(ROUTES).includes(candidate.route)) return fallback;
  return {
    ...fallback,
    ...candidate,
    score: Number.isFinite(Number(candidate.score)) ? Number(candidate.score) : fallback.score,
    calendarDuration: [30, 45].includes(Number(candidate.calendarDuration))
      ? Number(candidate.calendarDuration)
      : fallback.calendarDuration,
  };
}

function renderEducation() {
  updateProgress();
  app.innerHTML = `
    <section class="screen screen-card education-card" aria-labelledby="education-title">
      <p class="eyebrow">Um ponto importante</p>
      <h2 id="education-title">A maioria dos brasileiros que dolariza aceita 4% a 5% ao ano em treasuries.</h2>
      <p>É seguro e é pouco.</p>
      <p>A Epic opera na outra ponta: frota própria em Orlando, ativo que pode ser tocado, com <strong>meta de 2% a 2,5% ao mês em dólar</strong>. Não é renda fixa — é operação. E é exatamente isso que a gente vai destrinchar na reunião.</p>
      ${renderActions("Continuar")}
    </section>
  `;
  document.querySelector("[data-action='back']").addEventListener("click", goBack);
  document.querySelector("[data-action='continue']").addEventListener("click", () => {
    track("conteudo_reframe_visualizado", { screen: "T7b", stage: "reframe" });
    state.currentScreen += 1;
    saveState();
    render();
  });
  focusScreen();
}

function goBack() {
  if (isSubmitting) return;
  state.currentScreen = Math.max(-1, state.currentScreen - 1);
  saveState();
  render();
}

function buildPayload(eventName, stage, screen, isComplete = false) {
  const classification = classifyLead(state.answers, { isComplete });
  return {
    schema_version: "1.1",
    event: eventName,
    event_id: createLeadId(),
    lead_id: state.leadId,
    occurred_at: new Date().toISOString(),
    client_started_at: state.startedAt,
    stage,
    screen,
    progress_percent: screen === "T0"
      ? 0
      : isComplete
      ? 100
      : Math.round(((state.currentScreen + 1) / CONFIG.totalFunnelScreens) * 100),
    contact: state.contact,
    answers: state.answers,
    score_snapshot: classification.score,
    route_snapshot: classification.route,
    tag_snapshot: classification.tag,
    tracking: state.tracking,
    page: {
      hostname: window.location.hostname,
      pathname: window.location.pathname,
      language: navigator.language,
    },
  };
}

async function sendLeadUpdate(eventName, stage, screen, isComplete = false) {
  const payload = buildPayload(eventName, stage, screen, isComplete);
  try {
    const response = await fetchWithTimeout(CONFIG.api.lead, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    if (!response.ok) throw new Error(`Falha ao salvar (${response.status})`);
    removePending(payload.event_id);
    return await response.json();
  } catch (error) {
    queuePending(payload);
    console.warn("EPIC: atualização pendente de sincronização", error);
    return null;
  }
}

async function fetchWithTimeout(url, options, timeout = 10000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

function queuePending(payload) {
  let queue = [];
  try {
    queue = JSON.parse(localStorage.getItem(CONFIG.pendingKey)) || [];
  } catch {
    queue = [];
  }
  queue = queue.filter((item) => item.event_id !== payload.event_id).slice(-19);
  queue.push(payload);
  localStorage.setItem(CONFIG.pendingKey, JSON.stringify(queue));
}

function removePending(eventId) {
  try {
    const queue = JSON.parse(localStorage.getItem(CONFIG.pendingKey)) || [];
    localStorage.setItem(
      CONFIG.pendingKey,
      JSON.stringify(queue.filter((item) => item.event_id !== eventId)),
    );
  } catch {
    localStorage.removeItem(CONFIG.pendingKey);
  }
}

async function flushPending() {
  let queue = [];
  try {
    queue = JSON.parse(localStorage.getItem(CONFIG.pendingKey)) || [];
  } catch {
    return;
  }
  for (const payload of queue) {
    try {
      const response = await fetch(CONFIG.api.lead, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) removePending(payload.event_id);
    } catch {
      break;
    }
  }
}

function track(eventName, data = {}) {
  const classification = classifyLead(state.answers, { isComplete: state.completed });
  const safeData = {
    event: eventName,
    lead_id: state.leadId,
    epic_score: classification.score,
    epic_route: classification.route,
    epic_tag: classification.tag,
    ...data,
  };
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(safeData);
  window.dispatchEvent(new CustomEvent(eventName, { detail: safeData }));
}

function renderResult(classification) {
  updateProgress(questions.length - 1, true);
  if (classification.route === ROUTES.NUTRITION) {
    renderNutrition(classification);
    return;
  }
  renderCalendar(classification);
}

function renderNutrition(classification) {
  trackOnce("desqualificado", {
    epic_score: classification.score,
    epic_route: classification.route,
    motivo: classification.reason,
  });
  app.innerHTML = `
    <section class="screen screen-card" aria-labelledby="result-title">
      <span class="result-badge">Próximo passo: preparação</span>
      <h2 id="result-title">Pelo que você respondeu, ainda não é a hora de sentar comigo.</h2>
      <p class="lead">Mas é exatamente a hora de entender como funciona. Preparei um material que explica a operação de frota em Orlando do zero: como o carro gera receita, quais são os custos, o que o investidor brasileiro precisa ter nos EUA e quanto isso rende de fato.</p>
      <a class="button" href="${CONFIG.nutritionMaterialUrl}" target="_blank" rel="noopener noreferrer" data-material>
        Receber o material no WhatsApp
      </a>
      <div style="margin-top: 14px;">
        <button class="button button-secondary" type="button" data-action="restart-flow">
          Reiniciar diagnóstico
        </button>
      </div>
      <p class="privacy-note">Material provisório para validação interna. O PDF definitivo substituirá este arquivo.</p>
    </section>
  `;
  document.querySelector("[data-material]").addEventListener("click", () => {
    track("material_nutricao_acessado", { epic_score: classification.score });
  });
  document.querySelector("[data-action='restart-flow']")?.addEventListener("click", resetEpicJourney);
  focusScreen();
}

function renderCalendar(classification) {
  const duration = classification.calendarDuration;
  app.innerHTML = `
    <section class="screen screen-card" aria-labelledby="result-title">
      <div class="result-icon" aria-hidden="true">✓</div>
      <span class="result-badge">Conversa de ${duration} minutos</span>
      <h2 id="result-title">Obrigado. Já estou com suas respostas em mãos.</h2>
      <p class="lead">Escolha o horário abaixo. Vou preparar antes da conversa a projeção com o seu valor: aporte, receita estimada da frota, custos e retorno líquido em dólar.</p>
      <div id="calendar-root" aria-live="polite">
        <div class="calendar-status"><span class="spinner" aria-hidden="true"></span>Buscando horários no calendário...</div>
      </div>
    </section>
  `;
  focusScreen();
  loadAvailability(classification);
}

async function loadAvailability(classification) {
  const root = document.querySelector("#calendar-root");
  selectedSlot = null;
  try {
    const response = await fetchWithTimeout(CONFIG.api.availability, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lead_id: state.leadId,
        duration: classification.calendarDuration,
        days: 21,
        timezone: CONFIG.timezone,
      }),
    });
    if (!response.ok) throw new Error(`Agenda indisponível (${response.status})`);
    const data = await response.json();
    availableSlots = Array.isArray(data.slots) ? data.slots : [];
    if (!availableSlots.length) {
      root.innerHTML = calendarError(
        "Não encontramos horários livres nesta janela. Tente novamente em alguns instantes.",
      );
      bindCalendarRetry(classification);
      return;
    }
    renderSlots(classification);
  } catch (error) {
    console.warn("EPIC: não foi possível consultar a agenda", error);
    root.innerHTML = calendarError(
      "A agenda ainda não está conectada neste ambiente. Suas respostas já foram salvas.",
    );
    bindCalendarRetry(classification);
  }
}

function calendarError(message) {
  return `
    <div class="calendar-status">${message}</div>
    <div class="calendar-confirm">
      <button class="button button-secondary" type="button" data-calendar-retry>Tentar novamente</button>
    </div>
  `;
}

function bindCalendarRetry(classification) {
  document.querySelector("[data-calendar-retry]")?.addEventListener("click", () => {
    const root = document.querySelector("#calendar-root");
    root.innerHTML = `<div class="calendar-status"><span class="spinner" aria-hidden="true"></span>Buscando horários no calendário...</div>`;
    loadAvailability(classification);
  });
}

function dateKey(iso) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CONFIG.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function renderSlots(classification) {
  const root = document.querySelector("#calendar-root");
  const grouped = availableSlots.reduce((map, slot) => {
    const key = dateKey(slot.start);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(slot);
    return map;
  }, new Map());
  const days = [...grouped.keys()];
  if (!selectedCalendarDay || !grouped.has(selectedCalendarDay)) selectedCalendarDay = days[0];

  root.innerHTML = `
    <div class="calendar">
      <div class="date-tabs" role="tablist" aria-label="Dias disponíveis">
        ${days
          .map((day) => {
            const date = new Date(grouped.get(day)[0].start);
            const weekday = new Intl.DateTimeFormat("pt-BR", {
              timeZone: CONFIG.timezone,
              weekday: "short",
            })
              .format(date)
              .replace(".", "");
            const label = new Intl.DateTimeFormat("pt-BR", {
              timeZone: CONFIG.timezone,
              day: "2-digit",
              month: "short",
            })
              .format(date)
              .replace(".", "");
            return `<button class="date-tab${day === selectedCalendarDay ? " is-selected" : ""}" type="button" role="tab" aria-selected="${day === selectedCalendarDay}" data-day="${day}"><span>${weekday}</span><strong>${label}</strong></button>`;
          })
          .join("")}
      </div>
      <div class="slots" role="group" aria-label="Horários disponíveis">
        ${grouped
          .get(selectedCalendarDay)
          .map((slot) => {
            const time = new Intl.DateTimeFormat("pt-BR", {
              timeZone: CONFIG.timezone,
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }).format(new Date(slot.start));
            return `<button class="slot-button${selectedSlot?.start === slot.start ? " is-selected" : ""}" type="button" data-slot="${escapeHtml(slot.start)}">${time}</button>`;
          })
          .join("")}
      </div>
      <div class="calendar-confirm" id="calendar-confirm"></div>
      <p class="privacy-note">Fuso horário: Horário de Brasília · Nome e e-mail serão preenchidos automaticamente.</p>
    </div>
  `;

  document.querySelectorAll("[data-day]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedCalendarDay = button.dataset.day;
      selectedSlot = null;
      renderSlots(classification);
    });
  });

  document.querySelectorAll("[data-slot]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedSlot = availableSlots.find((slot) => slot.start === button.dataset.slot);
      renderSlots(classification);
      const confirm = document.querySelector("#calendar-confirm");
      confirm.innerHTML = `<button class="button button-full" type="button" data-book>Confirmar este horário</button>`;
      confirm.querySelector("[data-book]").addEventListener("click", () => bookMeeting(classification));
    });
  });
}

async function bookMeeting(classification) {
  if (!selectedSlot || isSubmitting) return;
  isSubmitting = true;
  const button = document.querySelector("[data-book]");
  setBusy(button, true, "Confirmando...");
  try {
    const response = await fetchWithTimeout(CONFIG.api.booking, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lead_id: state.leadId,
        start: selectedSlot.start,
        timezone: CONFIG.timezone,
      }),
    }, 15000);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.message || "Este horário não está mais disponível.");
    }
    state.booking = {
      start: data.start || selectedSlot.start,
      end: data.end || selectedSlot.end,
      meet_url: data.meet_url || "",
      event_id: data.event_id || "",
      duration: classification.calendarDuration,
    };
    saveState();
    track("reuniao_agendada", {
      calendar_duration: classification.calendarDuration,
      meeting_start: state.booking.start,
    });
    renderBookingConfirmation(state.booking);
  } catch (error) {
    showToast(error.message || "Não foi possível confirmar. Escolha outro horário.");
    setBusy(button, false, "Confirmar este horário");
    await loadAvailability(classification);
  } finally {
    isSubmitting = false;
  }
}

function renderBookingConfirmation(booking) {
  updateProgress(questions.length - 1, true);
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    timeZone: CONFIG.timezone,
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(booking.start));
  app.innerHTML = `
    <section class="screen screen-card" aria-labelledby="confirmation-title">
      <div class="result-icon" aria-hidden="true">✓</div>
      <span class="result-badge">Reunião confirmada</span>
      <h2 id="confirmation-title">Tudo certo. Sua conversa está na agenda.</h2>
      <div class="meeting-summary"><strong>${escapeHtml(formatted)}</strong><br />Horário de Brasília · ${Number(booking.duration) || 30} minutos</div>
      <p class="lead">O convite será enviado para o seu e-mail. Vou preparar a conversa considerando o valor e a objeção que você indicou.</p>
      ${booking.meet_url ? `<a class="button" href="${escapeHtml(booking.meet_url)}" target="_blank" rel="noopener noreferrer">Abrir link do Google Meet</a>` : ""}
      <div style="margin-top: 14px;">
        <button class="button button-secondary" type="button" data-action="restart-flow">
          Fazer novo teste / Reiniciar
        </button>
      </div>
    </section>
  `;
  document.querySelector("[data-action='restart-flow']")?.addEventListener("click", resetEpicJourney);
  focusScreen();
}

function trackOnce(eventName, data) {
  const key = `epic_tracked_${eventName}_${state.leadId}`;
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, "1");
  track(eventName, data);
}

function setBusy(button, busy, label) {
  if (!button) return;
  isSubmitting = busy;
  button.disabled = busy;
  button.textContent = label;
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 4200);
}

window.addEventListener("online", flushPending);
window.addEventListener("pageshow", flushPending);

render();
