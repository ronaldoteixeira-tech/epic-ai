export const SCORE_RULES = Object.freeze({
  capital: Object.freeze({
    "Acima de US$ 100 mil": 40,
    "US$ 30 mil a US$ 100 mil": 30,
    "US$ 15 mil a US$ 30 mil": 20,
  }),
  prazo: Object.freeze({
    "Neste mês": 25,
    "Em 30 a 60 dias": 15,
  }),
  prioridadeAlta: 20,
  liquidez: Object.freeze({ "Parado em conta / CDI": 10 }),
  estrutura: 5,
});

export const ROUTES = Object.freeze({
  IN_PROGRESS: "in_progress",
  NUTRITION: "nutrition",
  CALENDAR_30: "calendar_30",
  CALENDAR_45: "calendar_45",
  STRATEGIC_45: "strategic_45",
});

export function calculateLeadScore(answers = {}) {
  let score = 0;
  score += SCORE_RULES.capital[answers.epic_capital_90d] ?? 0;
  score += SCORE_RULES.prazo[answers.epic_prazo_aporte] ?? 0;

  const priority = Number(answers.epic_prioridade_0a10);
  if (Number.isFinite(priority) && priority >= 8) score += SCORE_RULES.prioridadeAlta;

  score += SCORE_RULES.liquidez[answers.epic_liquidez] ?? 0;
  const structures = Array.isArray(answers.epic_estrutura_us)
    ? answers.epic_estrutura_us
    : [];
  if (structures.some((item) => item !== "Nenhuma ainda")) {
    score += SCORE_RULES.estrutura;
  }

  return Math.max(0, Math.min(100, score));
}

export function classifyLead(answers = {}, options = {}) {
  const score = calculateLeadScore(answers);
  const moment = answers.epic_momento;
  const capital = answers.epic_capital_90d;
  const isComplete = options.isComplete ?? Boolean(moment);

  if (!isComplete) {
    return {
      score,
      temperature: score >= 70 ? "quente" : score >= 40 ? "morno" : "frio",
      route: ROUTES.IN_PROGRESS,
      tag: "em_qualificacao",
      calendarDuration: null,
      reason: "Jornada ainda não concluída.",
    };
  }

  const failedHardGate =
    capital === "Menos de US$ 15 mil (ainda montando)" ||
    moment ===
      "Ainda estou estudando. Não pretendo alocar capital nos próximos 6 meses.";

  if (failedHardGate) {
    return {
      score,
      temperature: "frio",
      route: ROUTES.NUTRITION,
      tag: "nao_qualificado",
      calendarDuration: null,
      reason: "Sem ticket mínimo ou sem intenção de aporte nos próximos 6 meses.",
    };
  }

  if (score < 40) {
    return {
      score,
      temperature: "frio",
      route: ROUTES.NUTRITION,
      tag: "nutricao_score",
      calendarDuration: null,
      reason: "Score abaixo de 40 pontos; segue para maturação antes da agenda.",
    };
  }

  if (
    moment ===
    "Tenho US$ 100 mil ou mais. Quero avaliar uma posição estratégica na operação, não só o aporte padrão."
  ) {
    return {
      score,
      temperature: score >= 70 ? "quente" : "morno",
      route: ROUTES.STRATEGIC_45,
      tag: "estrategico",
      calendarDuration: 45,
      reason: "Lead estratégico elegível para agenda prioritária de 45 minutos.",
    };
  }

  if (
    moment ===
    "Tenho US$ 30 mil ou mais. Quero entrar com posição relevante já no primeiro aporte."
  ) {
    return {
      score,
      temperature: score >= 70 ? "quente" : "morno",
      route: ROUTES.CALENDAR_45,
      tag: "qualificado_alto",
      calendarDuration: 45,
      reason: "Lead qualificado para agenda de 45 minutos.",
    };
  }

  return {
    score,
    temperature: score >= 70 ? "quente" : "morno",
    route: ROUTES.CALENDAR_30,
    tag: "qualificado_entrada",
    calendarDuration: 30,
    reason: "Lead qualificado para agenda de entrada de 30 minutos.",
  };
}
