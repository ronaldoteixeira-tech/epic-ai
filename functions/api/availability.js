export async function onRequestPost(context) {
  const origin = context.request.headers.get("origin");
  if (origin && origin !== new URL(context.request.url).origin) {
    return json({ ok: false, message: "Origem não permitida." }, 403);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ ok: false, message: "JSON inválido." }, 400);
  }

  const duration = Number(body.duration);
  const days = Number(body.days || 21);
  if (!isLeadId(body.lead_id) || ![30, 45].includes(duration) || days < 1 || days > 31) {
    return json({ ok: false, message: "Consulta de agenda inválida." }, 422);
  }

  return forward(context, body);
}

export function onRequest() {
  return json({ ok: false, message: "Método não permitido." }, 405);
}

async function forward(context, body) {
  const target = context.env.N8N_AVAILABILITY_WEBHOOK_URL;
  const secret = context.env.N8N_WEBHOOK_SECRET;
  if (!target || !secret) {
    return json({ ok: false, message: "Agenda ainda não configurada." }, 503);
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
    if (!response.ok) return json({ ok: false, message: "Agenda indisponível." }, 502);
    return new Response(text || JSON.stringify({ ok: true, slots: [] }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Falha na consulta de agenda", error);
    return json({ ok: false, message: "Agenda indisponível." }, 502);
  }
}

function isLeadId(value) {
  return typeof value === "string" && value.length >= 16 && value.length <= 80;
}

function json(value, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}
