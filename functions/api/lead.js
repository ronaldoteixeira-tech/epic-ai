const ALLOWED_EVENTS = new Set([
  "quiz_iniciado",
  "answer_saved",
  "phase_completed",
  "quiz_bloco_3",
  "quiz_concluido",
]);

export async function onRequestPost(context) {
  const invalidOrigin = rejectCrossOrigin(context.request);
  if (invalidOrigin) return invalidOrigin;

  const parsed = await readJson(context.request);
  if (parsed.error) return json({ ok: false, message: parsed.error }, 400);

  const body = parsed.value;
  if (!isLeadId(body.lead_id) || !ALLOWED_EVENTS.has(body.event)) {
    return json({ ok: false, message: "Payload de lead inválido." }, 422);
  }
  if (!body.contact || typeof body.answers !== "object") {
    return json({ ok: false, message: "Contato ou respostas ausentes." }, 422);
  }

  return forwardToN8n(context, "N8N_LEAD_WEBHOOK_URL", body);
}

export function onRequest() {
  return json({ ok: false, message: "Método não permitido." }, 405);
}

async function readJson(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 64_000) return { error: "Payload excede o limite permitido." };
  try {
    return { value: await request.json() };
  } catch {
    return { error: "JSON inválido." };
  }
}

function isLeadId(value) {
  return typeof value === "string" && value.length >= 16 && value.length <= 80;
}

function rejectCrossOrigin(request) {
  const origin = request.headers.get("origin");
  const expected = new URL(request.url).origin;
  return origin && origin !== expected
    ? json({ ok: false, message: "Origem não permitida." }, 403)
    : null;
}

async function forwardToN8n(context, variable, body) {
  const target = context.env[variable];
  const secret = context.env.N8N_WEBHOOK_SECRET;
  if (!target || !secret) {
    return json({ ok: false, message: "Integração ainda não configurada." }, 503);
  }

  try {
    const response = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-EPIC-Webhook-Secret": secret,
      },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    const contentType = response.headers.get("content-type") || "application/json";
    if (!response.ok) {
      console.error(`n8n respondeu ${response.status} em ${variable}`);
      return json({ ok: false, message: "Falha temporária na integração." }, 502);
    }
    return new Response(text || JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": contentType, "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error(`Falha ao acessar ${variable}`, error);
    return json({ ok: false, message: "Integração indisponível." }, 502);
  }
}

function json(value, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
