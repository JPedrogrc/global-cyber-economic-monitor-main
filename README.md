# Global Cyber & Economic Monitor

Dashboard React/Vite para visualização demonstrativa de indicadores econômicos e consulta a dados públicos de Threat Intelligence.

> Atividade prática de Engenharia de Qualidade — auditoria, testes e refatoração (12/11/2026).
> Projeto original: [JotaMarcos/global-cyber-economic-monitor](https://github.com/JotaMarcos/global-cyber-economic-monitor)

## 👥 Dupla

- **João Pedro Garcia**
- **Savio José**

## Requisitos

- Node.js 20.19+ ou 22.12+
- npm

## Executar localmente

```bash
npm ci
npm run dev
```

Produção:

```bash
npm run build
npm run preview
```

## Testes

```bash
npm test               # roda todos os testes uma vez (Vitest)
npm run test:watch     # modo watch
npm run test:coverage  # relatório de cobertura (texto + HTML em coverage/)
npm run audit          # npm audit (falha a partir de severidade moderada)
```

**Resultado:** 8 arquivos, **161 testes passando**, cobertura de **98,8% das linhas** e **95,1% dos branches**.

| Arquivo de teste | O que valida |
|---|---|
| `src/security/TokenBucketLimiter.test.js` | Rajada até a capacidade, reposição proporcional/fracionária, teto da capacidade, relógio voltando no tempo, flood de 1000 req, configuração inválida |
| `src/security/ApiCircuitBreaker.test.js` | Todas as transições CLOSED → OPEN → HALF-OPEN → CLOSED/OPEN, limite exato de falhas, timeout (999 ms vs 1000 ms), uma sonda por vez em HALF-OPEN |
| `src/security/sanitize.test.js` | Payloads XSS/SQLi (`<script>`, `onerror=`, `javascript:`, `UNION SELECT`, `DROP TABLE`), limite de tamanho, tipos inválidos, IPv4/IPv6 válidos e inválidos, portas |
| `src/domain/organizations.test.js` | Filtros geográficos (país → estado → município), combinações inconsistentes, setor, busca sanitizada, opções em cascata, agregação por setor, KPIs em pt-BR |
| `src/services/osintFeed.test.js` | Falhas nos feeds OSINT: HTTP 503, timeout com `AbortController`, JSON inválido, CORS, sucesso parcial (só um endpoint), payloads malformados, cache adulterado no `localStorage` |
| `src/domain/telemetry.test.js` | Simulação DDoS (950 req → 90 aceitas, 860 descartadas), sondas XSS, buffer circular de 24 pontos, limites do índice |
| `src/hooks/useOsintFeed.test.jsx` | Fallback cache → demonstração, Circuit Breaker abrindo após 3 falhas e parando de chamar a API, recuperação após o timeout, sem chamadas sobrepostas, polling e limpeza do intervalo |
| `src/App.test.jsx` | Integração com a UI: drill-down e reset em cascata dos selects, XSS na busca e no feed renderizado como texto, aviso de feed indisponível, modal com foco e Esc, `aria-pressed` |

### Técnicas de teste aplicadas

- **Teste unitário** das regras críticas, isoladas em módulos puros (sem React).
- **Análise de valor limite:** capacidade exata do bucket (10 → aceita, 11 → rejeita), `failureThreshold - 1` vs `failureThreshold`, timeout 999 ms vs 1000 ms, porta 0/1/65535/65536, octeto 255/256.
- **Particionamento em classes de equivalência:** IPs válidos/inválidos, níveis Infocon válidos/inválidos, formatos de payload (`[]`, `{data}`, `{topips}`, inválido).
- **Teste de transição de estados:** máquina de estados do Circuit Breaker.
- **Testes parametrizados** (`it.each`) para tabelas de payloads maliciosos e entradas.
- **Teste de segurança / entradas maliciosas:** XSS, SQLi, IP forjado, cache adulterado.
- **Injeção de falhas e test doubles:** `vi.fn()` simulando HTTP 503, timeout, CORS, JSON quebrado e `localStorage` indisponível.
- **Relógio controlado:** injeção de `now()` nas classes e `vi.useFakeTimers()` para testar tempo sem `sleep`.
- **Testes de integração de componentes** com React Testing Library + `user-event`, usando consultas acessíveis (`getByRole`, `getByLabelText`).
- **Cobertura de código** com `@vitest/coverage-v8`.

## Resumo das melhorias

### 1. Refatoração (Clean Code)

O `src/App.jsx` original tinha **1470 linhas** com dados, regras de segurança, chamadas HTTP e toda a interface no mesmo arquivo, sem nada exportado (impossível de testar). Agora:

```
src/
├── config/constants.js        # parâmetros centralizados (sem números mágicos)
├── data/                      # dados estáticos (geografia, setores, organizações, demo)
├── security/                  # sanitize, TokenBucketLimiter, ApiCircuitBreaker
├── domain/                    # regras puras: filtros, KPIs, agregação, telemetria
├── services/osintFeed.js      # HTTP com timeout, parsing, merge e cache do SANS ISC
├── hooks/                     # useOsintFeed, useTelemetryStream
├── components/                # 8 componentes de UI com responsabilidade única
└── App.jsx                    # ~90 linhas, só compõe as peças
```

- Funções pequenas e nomeadas (`matchesFilter`, `parseTopIps`, `mergeThreatLogs`…) no lugar de `if`s aninhados e ternários encadeados.
- Mapas de classes (`SEVERITY_CLASS`, `RISK_CLASS`) no lugar de ternários aninhados no JSX.
- Injeção de dependências (`fetchFeeds`, `fetchImpl`, `storage`, `now`, `random`) para permitir testes determinísticos.
- Filtros num único objeto de estado; o reset em cascata fica explícito no `FiltersPanel`.
- **Bug corrigido:** a regex de IPv6 aceitava palavras hexadecimais como `"cafe"` ou `"abc"` como IP válido.
- **Bug corrigido:** IPs do DShield com zeros à esquerda (`045.148.010.240`) agora são normalizados.
- **Bug corrigido:** em HALF-OPEN, uma falha só reabria o circuito por coincidência do contador; agora a regra é explícita.
- Deduplicação de IPs em O(n) com `Set` (antes era `findIndex` dentro de `filter`, O(n²)).

### 2. Segurança

- **`npm audit`:** 0 vulnerabilidades (antes e depois de adicionar as dependências de teste).
- **CSP e cabeçalhos HTTP** em `netlify.toml`: `Content-Security-Policy` (`script-src 'self'`, `connect-src` restrito ao SANS ISC, `frame-ancestors 'none'`), `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS. O CSP é a defesa real contra XSS; a sanitização em JS é uma camada extra.
- **Cache revalidado:** o conteúdo lido do `localStorage` passa de novo pela sanitização (antes era confiado cegamente).
- A busca tem `maxLength=60` e é sanitizada; os testes confirmam que o React renderiza dados externos como texto, sem interpretar HTML.
- **Limitação documentada:** Token Bucket e Circuit Breaker rodam **no navegador**. Protegem a API externa contra excesso de chamadas do próprio cliente, mas **não protegem contra DDoS real**, que exige WAF/CDN/rate limit no servidor.

### 3. UX, acessibilidade e performance

| Lighthouse (desktop/mobile padrão) | Original (Netlify) | Refatorado (build local) |
|---|---|---|
| Performance | 79 | **86** |
| Acessibilidade | 96 | **100** |
| Boas práticas | 100 | **100** |
| SEO | 90 | **100** |
| First Contentful Paint | 2,4 s | **1,8 s** |
| Largest Contentful Paint | 2,7 s | **2,1 s** |

- **Code splitting:** Recharts carregado com `React.lazy` + `Suspense`. Os 115 KB gzip do Recharts saem do bundle inicial, que fica com **82 KB gzip**; os gráficos chegam num chunk separado.
- **`React.memo`** em tabela, feed, filtros e KPIs: deixam de re-renderizar a cada tick de 2,2 s da telemetria.
- Telemetria **pausa quando a aba está oculta** (`document.hidden`), o que economiza CPU e bateria.
- Animação dos gráficos desligada nas atualizações contínuas; `animate-pulse` respeita `prefers-reduced-motion`.
- Acessibilidade: `<label htmlFor>` ligado a cada select, `aria-label` no botão de fechar (só ícone), modal com `role="dialog"`, `aria-modal`, foco inicial e fechamento com **Esc** ou clique fora, `aria-pressed` no botão de simulação, `aria-live` nos contadores, `scope="col"` e `<caption>` na tabela, ícones com `aria-hidden`.
- Contraste corrigido (`text-slate-500/600` → `text-slate-400/500`), que era a falha de acessibilidade do Lighthouse.
- SEO e boas práticas: `meta description`, `theme-color`, `favicon.svg`, `robots.txt`, `preconnect` com o SANS ISC, cache imutável para `/assets/*`.

## Estado atual das funcionalidades

- **SANS ISC / DShield:** consulta os endpoints públicos de Infocon e Top IPs. A disponibilidade depende da conexão e das políticas CORS do serviço.
- **Cache:** mantém os últimos registros reais obtidos no navegador (`localStorage`). Se a consulta falhar e não houver cache, a interface apresenta registros de demonstração identificados como tais.
- **Abuse.ch e CISA KEV:** ainda não possuem integração implementada nesta versão; não são fontes ativas do feed.
- **Indicadores econômicos, organizações, SLA e simulação de carga:** são dados demonstrativos locais. Não representam telemetria real nem monitoramento contratado de organizações.
- **Segurança:** o limitador e a simulação de carga/XSS são exercícios executados no navegador. Não substituem WAF, firewall, proteção DDoS ou controles de segurança no servidor.

## Observações

Os IPs retornados pelo SANS ISC são apresentados como observados na fonte. O dashboard não afirma que esses endereços foram bloqueados ou mitigados pela aplicação.
