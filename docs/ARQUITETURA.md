# Arquitetura da jornada EPIC

## Decisão

O n8n será a camada de orquestração. As Pages Functions não conhecem credenciais do Google nem regras comerciais: validam o formato, escondem as URLs dos webhooks e encaminham cada solicitação com um segredo compartilhado.

```text
Navegador
   │  /api/lead · /api/availability · /api/booking
   ▼
Cloudflare Pages Functions
   │  segredo servidor-servidor
   ▼
n8n
   ├── Google Sheets: histórico de eventos + estado atual do lead
   ├── Google Calendar: free/busy + criação da reunião/Meet
   └── mini-CRM: webhooks desativados e prontos para conexão
```

O navegador calcula um score apenas para manter a experiência responsiva. O n8n sempre recalcula o valor antes de persistir ou autorizar uma reunião. No agendamento, o n8n busca o lead no Sheets, valida sua rota e consulta novamente o horário para evitar dupla reserva.

## n8n versus Apps Script

| Critério | n8n autohospedado | Google Apps Script |
|---|---|---|
| Credenciais | Centralizadas e reutilizáveis | Ligadas ao projeto/usuário do script |
| Sheets + Calendar + CRM | Fluxo visual único e fácil de ramificar | Exige código e manutenção manual |
| Retentativas e auditoria | Histórico de execuções nativo | Precisa ser construído com logs e triggers |
| Roteamento por score | Switch visual e webhooks por rota | Condicionais em código |
| Latência | Um salto de rede adicional | Pode ser ligeiramente menor em integração só Google |
| Disponibilidade | Depende da saúde da instância própria | Infraestrutura gerenciada pelo Google |
| Limites | Capacidade da instância e APIs conectadas | Quotas e tempo máximo do Apps Script |
| Portabilidade | Fácil trocar Sheets/CRM depois | Mais acoplado ao Google Workspace |

Para este projeto, o n8n é a melhor escolha porque já está disponível e a jornada precisa integrar três destinos. Apps Script só seria mais simples se o único requisito fosse inserir linhas em uma planilha.

## Persistência e recuperação

- T0 é enviado imediatamente.
- Cada resposta gera uma atualização com o estado completo do lead.
- Fechamentos de fase geram `phase_completed`.
- Falhas temporárias ficam em uma fila curta no `localStorage` e são reenviadas quando a conexão volta.
- O n8n grava o último estado na aba `Leads` por upsert de `lead_id` e mantém os eventos na aba `Eventos`.
- Dados pessoais não são enviados ao `dataLayer` do GTM.

## Segurança

- URLs e credenciais n8n ficam em segredos do Cloudflare Pages.
- Os webhooks n8n devem usar Header Auth com `X-EPIC-Webhook-Secret`.
- A criação de reunião não confia no score recebido do navegador.
- A página coleta somente nome, WhatsApp, e-mail e faixas declaradas; não coleta CPF, conta ou valor financeiro identificável.
- Para tráfego pago em produção, recomenda-se adicionar Cloudflare Turnstile ao T0 como próxima camada antispam.
