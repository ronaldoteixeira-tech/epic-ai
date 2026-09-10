# Score e roteamento comercial

O score mede capacidade, urgência, prioridade e atrito operacional. Ele não substitui os bloqueios explícitos da jornada.

## Pontuação

| Dimensão | Resposta | Pontos | Racional |
|---|---|---:|---|
| Capital em 90 dias | Acima de US$ 100 mil | 40 | Maior impacto potencial e prioridade comercial |
| Capital em 90 dias | US$ 30 mil a US$ 100 mil | 30 | Ticket alto |
| Capital em 90 dias | US$ 15 mil a US$ 30 mil | 20 | Ticket de entrada válido |
| Prazo | Neste mês | 25 | Intenção imediata |
| Prazo | Em 30 a 60 dias | 15 | Janela comercial ativa |
| Prioridade | Nota de 8 a 10 | 20 | Forte relevância declarada |
| Liquidez | Parado em conta / CDI | 10 | Menor atrito para alocação |
| Estrutura nos EUA | Qualquer estrutura existente | 5 | Menos etapas operacionais |

Máximo: 100 pontos.

## Bloqueios duros

O lead vai para nutrição independentemente do score quando:

- declara capital abaixo de US$ 15 mil na T5; ou
- escolhe na T11 que ainda está estudando e não pretende alocar nos próximos seis meses.

## Faixas

| Resultado | Tratamento |
|---|---|
| Abaixo de 40 | Frio; nutrição, sem acesso ao calendário |
| 40 a 69 | Morno; pode agendar conforme a faixa declarada na T11 |
| 70 a 100 | Quente; agenda direta e maior prioridade comercial |

Depois de vencer os bloqueios e atingir 40 pontos:

- T11 de US$ 15 mil → reunião de 30 minutos, tag `qualificado_entrada`.
- T11 de US$ 30 mil ou mais → reunião de 45 minutos, tag `qualificado_alto`.
- T11 de US$ 100 mil ou mais → reunião de 45 minutos e ramo prioritário, tag `estrategico`.

## Por que 40 pontos

Quarenta representa ao menos dois sinais relevantes, por exemplo capital de US$ 30–100 mil mais liquidez, ou ticket de entrada combinado com urgência. Isso evita que uma única resposta otimista abra a agenda. O limiar pode ser ajustado depois de 50–100 leads, comparando score, presença na reunião e aporte fechado.

O cálculo canônico está duplicado de forma intencional em dois pontos:

- `public/scoring.js`, para experiência imediata no navegador;
- node “Validar, pontuar e normalizar” do workflow n8n, como autoridade de servidor.

Qualquer alteração de regra deve ser aplicada nos dois locais e coberta pelos testes.
