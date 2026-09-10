import test from "node:test";
import assert from "node:assert/strict";

import { calculateLeadScore, classifyLead, ROUTES } from "../scoring.js";

const strongLead = {
  epic_capital_90d: "Acima de US$ 100 mil",
  epic_prazo_aporte: "Neste mês",
  epic_prioridade_0a10: 10,
  epic_liquidez: "Parado em conta / CDI",
  epic_estrutura_us: ["LLC aberta"],
  epic_momento:
    "Tenho US$ 100 mil ou mais. Quero avaliar uma posição estratégica na operação, não só o aporte padrão.",
};

test("score máximo soma 100 pontos", () => {
  assert.equal(calculateLeadScore(strongLead), 100);
});

test("hard gate sempre envia para nutrição", () => {
  const result = classifyLead(
    {
      ...strongLead,
      epic_capital_90d: "Menos de US$ 15 mil (ainda montando)",
    },
    { isComplete: true },
  );
  assert.equal(result.route, ROUTES.NUTRITION);
  assert.equal(result.tag, "nao_qualificado");
});

test("score abaixo de 40 envia para nutrição mesmo sem hard gate", () => {
  const result = classifyLead(
    {
      epic_capital_90d: "US$ 15 mil a US$ 30 mil",
      epic_prazo_aporte: "Em 3 a 6 meses",
      epic_prioridade_0a10: 5,
      epic_liquidez: "Em renda variável",
      epic_estrutura_us: ["Nenhuma ainda"],
      epic_momento:
        "Tenho US$ 15 mil. Quero começar pelo ticket de entrada, ver a operação funcionando de perto e escalar depois.",
    },
    { isComplete: true },
  );
  assert.equal(result.score, 20);
  assert.equal(result.route, ROUTES.NUTRITION);
  assert.equal(result.tag, "nutricao_score");
});

test("lead de entrada elegível recebe agenda de 30 minutos", () => {
  const result = classifyLead(
    {
      epic_capital_90d: "US$ 15 mil a US$ 30 mil",
      epic_prazo_aporte: "Neste mês",
      epic_prioridade_0a10: 9,
      epic_liquidez: "Parado em conta / CDI",
      epic_estrutura_us: ["Nenhuma ainda"],
      epic_momento:
        "Tenho US$ 15 mil. Quero começar pelo ticket de entrada, ver a operação funcionando de perto e escalar depois.",
    },
    { isComplete: true },
  );
  assert.equal(result.score, 75);
  assert.equal(result.route, ROUTES.CALENDAR_30);
  assert.equal(result.calendarDuration, 30);
});

test("lead estratégico recebe agenda prioritária de 45 minutos", () => {
  const result = classifyLead(strongLead, { isComplete: true });
  assert.equal(result.route, ROUTES.STRATEGIC_45);
  assert.equal(result.calendarDuration, 45);
});
