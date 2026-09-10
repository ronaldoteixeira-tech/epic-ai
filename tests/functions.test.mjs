import test from "node:test";
import assert from "node:assert/strict";

import { onRequestPost as saveLead } from "../functions/api/lead.js";
import { onRequestPost as getAvailability } from "../functions/api/availability.js";
import { onRequestPost as bookMeeting } from "../functions/api/booking.js";

const leadId = "12345678-1234-4234-8234-123456789012";

function context(path, body, env = {}) {
  return {
    request: new Request(`https://epicrentalcar.pages.dev${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://epicrentalcar.pages.dev" },
      body: JSON.stringify(body),
    }),
    env,
  };
}

test("endpoint de lead valida e encaminha o segredo apenas no servidor", async () => {
  const originalFetch = globalThis.fetch;
  let forwarded;
  globalThis.fetch = async (url, options) => {
    forwarded = { url, options };
    return Response.json({ ok: true });
  };

  try {
    const response = await saveLead(
      context(
        "/api/lead",
        {
          lead_id: leadId,
          event: "quiz_iniciado",
          contact: { nome: "Teste", whatsapp: "11999999999", email: "teste@example.com" },
          answers: {},
        },
        { N8N_LEAD_WEBHOOK_URL: "https://n8n.example/webhook", N8N_WEBHOOK_SECRET: "secret" },
      ),
    );
    assert.equal(response.status, 200);
    assert.equal(forwarded.options.headers["X-EPIC-Webhook-Secret"], "secret");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("consulta de agenda rejeita duração fora das rotas", async () => {
  const response = await getAvailability(
    context("/api/availability", { lead_id: leadId, duration: 60, days: 21 }),
  );
  assert.equal(response.status, 422);
});

test("agendamento rejeita horário passado", async () => {
  const response = await bookMeeting(
    context("/api/booking", { lead_id: leadId, start: "2020-01-01T10:00:00-03:00" }),
  );
  assert.equal(response.status, 422);
});
