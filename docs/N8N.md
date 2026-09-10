# Configuração do n8n

Os arquivos `n8n/epic-leads.workflow.json` e `n8n/epic-calendar.workflow.json` podem ser importados pelo editor do n8n. Eles ficam inativos por padrão para impedir chamadas antes da configuração.

## 1. Criar a planilha

Crie um Google Sheets com duas abas:

- `Leads`: cole na célula A1 o conteúdo de `n8n/sheets-leads-header.csv`.
- `Eventos`: cole na célula A1 o conteúdo de `n8n/sheets-eventos-header.csv`.

Na aba `Leads`, `lead_id` é a coluna de correspondência do upsert. A aba `Eventos` mantém o histórico de passagem pelas telas e fases.

## 2. Importar e configurar “Qualificação, Sheets e roteamento”

1. Importe `epic-leads.workflow.json`.
2. Nos dois nodes Google Sheets, selecione a credencial, o documento e a aba correspondente.
3. Atualize o schema de colunas e mantenha `Map Automatically`.
4. No node de upsert, confirme `lead_id` em “Column to Match On”.
5. Crie uma credencial Header Auth:
   - Name: `X-EPIC-Webhook-Secret`
   - Value: um segredo longo e aleatório.
6. Aplique essa credencial ao Webhook “Leads”.
7. Ative o workflow e copie a URL de produção terminada em `/webhook/epic-leads`.

Os quatro nodes do mini-CRM ficam desativados. Substitua as URLs, configure a autenticação exigida pelo CRM e habilite cada node quando os endpoints existirem.

## 3. Importar e configurar “Disponibilidade e agendamento”

1. Importe `epic-calendar.workflow.json`.
2. Selecione a credencial Google Calendar em todos os nodes de calendário.
3. Troque `REPLACE_WITH_CALENDAR_ID` pelo ID do calendário do Eduardo.
4. No node “Sheets — Buscar lead”, selecione a mesma planilha e a aba `Leads`.
5. No node “Sheets — Registrar reunião”, selecione a planilha, atualize o schema e confirme o upsert por `lead_id`.
6. Aplique a mesma credencial Header Auth aos dois webhooks.
7. Ative o workflow e copie as URLs de produção:
   - `/webhook/epic-calendar-availability`
   - `/webhook/epic-calendar-booking`

A disponibilidade padrão está configurada para dias úteis, das 9h às 18h, com antecedência mínima de 24 horas, janela de 21 dias e início de slots a cada 30 minutos. Ajuste o node “Gerar horários livres” se a operação comercial usar outra regra.

O fluxo de reserva:

1. busca o `lead_id` no Sheets;
2. exige score mínimo de 40 e rota diferente de nutrição;
3. determina 30 ou 45 minutos usando o registro salvo, não o navegador;
4. revalida o horário pelo FreeBusy;
5. cria o evento privado, adiciona o lead como convidado e gera Google Meet;
6. atualiza a linha no Sheets e responde ao site;
7. deixa pronto o webhook `reuniao_agendada` para o mini-CRM.

## 4. Configurar o Cloudflare Pages

Cadastre como segredos/variáveis de produção:

```text
N8N_LEAD_WEBHOOK_URL
N8N_AVAILABILITY_WEBHOOK_URL
N8N_BOOKING_WEBHOOK_URL
N8N_WEBHOOK_SECRET
```

Os valores estão exemplificados em `.dev.vars.example`. O segredo deve ser exatamente o mesmo usado nas credenciais Header Auth do n8n.

## Eventos e payloads do mini-CRM

Cada payload normalizado contém contato, respostas, `epic_score`, `lead_temperature`, `route_key`, `tag`, UTMs e dados de agenda quando existirem.

Rotas previstas:

```text
nutrition     -> nutrição
calendar_30   -> qualificado de entrada
calendar_45   -> qualificado alto
strategic_45  -> estratégico
```

Endpoints placeholder:

```text
POST /webhooks/epic/nutricao
POST /webhooks/epic/qualificado
POST /webhooks/epic/qualificado-alto
POST /webhooks/epic/estrategico
POST /webhooks/epic/reuniao-agendada
```

## GTM

O container `GTM-TM29VM6J` já está instalado. Os eventos disponíveis são:

- `quiz_iniciado`
- `phase_completed`
- `quiz_bloco_3`
- `conteudo_reframe_visualizado`
- `quiz_concluido`
- `desqualificado`
- `material_nutricao_acessado`
- `reuniao_agendada`

`quiz_concluido` também é disparado como `CustomEvent` no `window`. O `dataLayer` não recebe nome, e-mail ou WhatsApp.
