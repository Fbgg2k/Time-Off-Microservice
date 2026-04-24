# Documento de Requisitos Técnicos (TRD)
## Time-Off Microservice

### 1. Visão Geral

#### 1.1 Contexto do Problema
O microserviço de Time-Off deve gerenciar o ciclo de vida de solicitações de tempo de folga, mantendo a integridade dos saldos entre o sistema ExampleHR/ReadyOn e o sistema HCM (Human Capital Management) externo.

#### 1.2 Desafios Principais
- **Sincronização de Saldos**: Manter consistência entre dois sistemas onde o HCM é a "Fonte da Verdade"
- **Atualizações Independentes**: O HCM pode atualizar saldos independentemente (ex: bônus de aniversário de trabalho)
- **Validação em Tempo Real**: Garantir saldos suficientes antes de aprovar solicitações
- **Tratamento de Erros**: Lidar com falhas na comunicação com HCM

### 2. Arquitetura do Sistema

#### 2.1 Componentes Principais
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend UI   │────│  Time-Off API    │────│   HCM System    │
│ (ReadyOn/ExHR)  │    │   (NestJS)       │    │  (External)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   SQLite DB     │
                       │   (Local Cache) │
                       └─────────────────┘
```

#### 2.2 Módulos do Sistema
- **Time-Off Module**: Gerencia solicitações e saldos
- **HCM Integration Module**: Comunicação com sistema externo
- **Balance Sync Module**: Sincronização de saldos
- **Validation Module**: Validação de regras de negócio

### 3. Modelo de Dados

#### 3.1 Entidades Principais

##### Employee
```typescript
interface Employee {
  id: string;
  name: string;
  email: string;
  locationId: string;
  createdAt: Date;
  updatedAt: Date;
}
```

##### Location
```typescript
interface Location {
  id: string;
  name: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}
```

##### TimeOffBalance
```typescript
interface TimeOffBalance {
  id: string;
  employeeId: string;
  locationId: string;
  balanceType: 'ANNUAL' | 'SICK' | 'PERSONAL';
  totalDays: number;
  usedDays: number;
  availableDays: number;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

##### TimeOffRequest
```typescript
interface TimeOffRequest {
  id: string;
  employeeId: string;
  locationId: string;
  balanceType: string;
  startDate: Date;
  endDate: Date;
  daysRequested: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  requestedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  comments?: string;
}
```

##### BalanceSyncLog
```typescript
interface BalanceSyncLog {
  id: string;
  employeeId: string;
  locationId: string;
  balanceType: string;
  previousBalance: number;
  newBalance: number;
  syncType: 'REALTIME' | 'BATCH' | 'MANUAL';
  source: 'HCM_SYNC' | 'REQUEST_APPROVAL' | 'MANUAL_ADJUSTMENT';
  success: boolean;
  errorMessage?: string;
  syncedAt: Date;
}
```

### 4. APIs Requeridas

#### 4.1 Time-Off Management APIs

##### GET /api/time-off/balances
- **Descrição**: Obter saldos de tempo de folga de um funcionário
- **Parâmetros**: `employeeId`, `locationId`, `balanceType?`
- **Response**: Lista de saldos disponíveis

##### POST /api/time-off/requests
- **Descrição**: Criar nova solicitação de tempo de folga
- **Body**: `TimeOffRequest` (sem id, status, dates)
- **Validação**: Verificar saldo disponível antes de criar
- **Response**: Solicitação criada com status PENDING

##### GET /api/time-off/requests
- **Descrição**: Listar solicitações (com filtros)
- **Parâmetros**: `employeeId?`, `status?`, `startDate?`, `endDate?`
- **Response**: Lista paginada de solicitações

##### PUT /api/time-off/requests/:id/approve
- **Descrição**: Aprovar solicitação
- **Body**: `{ reviewedBy: string, comments?: string }`
- **Lógica**: Validar saldo, deduzir dias, sincronizar com HCM

##### PUT /api/time-off/requests/:id/reject
- **Descrição**: Rejeitar solicitação
- **Body**: `{ reviewedBy: string, comments: string }`

#### 4.2 Balance Management APIs

##### POST /api/balances/sync/:employeeId
- **Descrição**: Sincronizar manualmente saldos com HCM
- **Response**: Status da sincronização

##### POST /api/balances/sync/batch
- **Descrição**: Sincronização em lote para todos os funcionários
- **Response**: Status do job em lote

#### 4.3 HCM Integration APIs (Mock)

##### GET /api/hcm/balances/:employeeId/:locationId
- **Descrição**: Obter saldos do HCM (mock)
- **Response**: Saldos atuais do HCM

##### POST /api/hcm/balances/validate
- **Descrição**: Validar saldo no HCM (mock)
- **Body**: `{ employeeId, locationId, balanceType, daysRequested }`
- **Response**: `{ valid: boolean, availableBalance: number }`

##### POST /api/hcm/requests
- **Descrição**: Notificar HCM sobre solicitação aprovada (mock)
- **Body**: Dados da solicitação aprovada

### 5. Estratégias de Sincronização

#### 5.1 Real-time Sync
- **Quando**: Após aprovação de solicitação
- **Como**: Chamada imediata à API HCM
- **Fallback**: Registrar para retry se falhar

#### 5.2 Batch Sync
- **Quando**: Diário ou sob demanda
- **Como**: Processar todos os funcionários
- **Performance**: Processar em batches para evitar overload

#### 5.3 Event-driven Sync
- **Quando**: Mudanças detectadas no HCM
- **Como**: Webhook ou polling
- **Implementação**: Listener para eventos HCM

### 6. Validações e Regras de Negócio

#### 6.1 Validações de Solicitação
- Saldo disponível suficiente
- Período não conflitante com outras solicitações
- Antecedência mínima (configurável)
- Dias úteis vs finais de semana (configurável)

#### 6.2 Regras de Aprovação
- Hierarquia de aprovação (manager > HR)
- Limites por período (ex: máximo 15 dias consecutivos)
- Políticas por tipo de folga

#### 6.3 Consistência de Dados
- Transações ACID para operações críticas
- Idempotência para operações de retry
- Auditoria completa de mudanças

### 7. Estratégia de Testes

#### 7.1 Testes Unitários
- **Cobertura**: Mínimo 90%
- **Foco**: Lógica de negócio, validações, cálculos
- **Mocks**: Repositórios e serviços externos

#### 7.2 Testes de Integração
- **Cenários**: Fluxos completos de solicitação
- **Banco**: SQLite em memória
- **HCM**: Mock servers com comportamento realista

#### 7.3 Testes E2E
- **APIs**: Testar todos os endpoints
- **Performance**: Testar carga e concorrência
- **Resiliência**: Testar falhas e recuperação

#### 7.4 Testes de Mock HCM
- **Comportamentos**: Sucesso, falha, timeout
- **Cenários**: Saldo insuficiente, funcionário não encontrado
- **Simulação**: Mudanças independentes de saldo

### 8. Considerações de Performance

#### 8.1 Cache
- **Redis**: Cache de saldos frequentemente acessados
- **TTL**: 15 minutos para dados de saldo
- **Invalidação**: Após atualizações

#### 8.2 Banco de Dados
- **Índices**: employeeId, locationId, status, dates
- **Queries otimizadas**: Evitar N+1 queries
- **Conexões**: Pool de conexões gerenciado

#### 8.3 APIs Externas
- **Timeout**: 5 segundos para chamadas HCM
- **Retry**: Exponential backoff (3 tentativas)
- **Circuit Breaker**: Isolar falhas do HCM

### 9. Segurança

#### 9.1 Autenticação
- **JWT**: Tokens para APIs internas
- **RBAC**: Role-based access control
- **Scopes**: Permissões granulares por recurso

#### 9.2 Validação
- **Input**: Sanitização de todos os inputs
- **DTOs**: Validação estrita com class-validator
- **Rate Limiting**: Prevenir abuse

#### 9.3 Auditoria
- **Logs**: Todas as operações críticas
- **Trace**: Correlation ID para requisições
- **Retenção**: Logs por 90 dias

### 10. Monitoramento e Observabilidade

#### 10.1 Métricas
- **Business**: Solicitações por dia, taxa de aprovação
- **Technical**: Latência APIs, taxa de erro HCM
- **Infrastructure**: CPU, memória, conexões DB

#### 10.2 Alertas
- **Críticos**: Falha completa HCM, DB down
- **Warnings**: Alta latência, aumento de erros
- **Info**: Sync batch completado

#### 10.3 Dashboards
- **Real-time**: Status do sistema, métricas principais
- **Histórico**: Tendências, performance over time
- **Operacional**: Jobs de sincronização, erros

### 11. Deploy e Infraestrutura

#### 11.1 Containerização
- **Docker**: Multi-stage build
- **Imagem**: Alpine-based para tamanho reduzido
- **Health Check**: Endpoint /health

#### 11.2 Configuração
- **Environment**: Variáveis de ambiente
- **Secrets**: Gerenciador de secrets
- **Features**: Feature flags para experimentos

#### 11.3 Backup e Recovery
- **DB**: Backup diário do SQLite
- **Logs**: Centralização em serviço externo
- **DRP**: Plano de recovery point objective

### 12. Alternativas Consideradas

#### 12.1 Banco de Dados
- **Opção**: PostgreSQL vs SQLite
- **Decisão**: SQLite (simplicidade, requisitos)
- **Trade-off**: Escalabilidade vs complexidade

#### 12.2 Comunicação HCM
- **Opção**: REST vs GraphQL vs Message Queue
- **Decisão**: REST (simplicidade, requisitos)
- **Trade-off**: Real-time vs eventual consistency

#### 12.3 Arquitetura
- **Opção**: Monolito vs Microserviços
- **Decisão**: Microserviço único (escopo delimitado)
- **Trade-off**: Complexidade vs foco

### 13. Riscos e Mitigações

#### 13.1 Riscos Técnicos
- **Inconsistência de dados**: Implementar reconciliação periódica
- **Falha HCM**: Circuit breaker + retry + fallback
- **Performance**: Cache + otimização de queries

#### 13.2 Riscos de Negócio
- **Perda de dados**: Backup + auditoria
- **Compliance**: Logs + validações rigorosas
- **UX**: Feedback rápido + status claro

### 14. Roadmap de Implementação

#### Phase 1: Foundation (Sprint 1)
- Setup do projeto e estrutura
- Entidades básicas e migrations
- Mock HCM endpoints básicos

#### Phase 2: Core Features (Sprint 2)
- APIs de gerenciamento de saldos
- Validações e regras de negócio
- Testes unitários e integração

#### Phase 3: Advanced Features (Sprint 3)
- Sincronização com HCM
- Testes E2E e performance
- Monitoramento e observabilidade

#### Phase 4: Production Ready (Sprint 4)
- Security hardening
- Documentação completa
- Deploy e configuração production

### 15. Success Criteria

#### 15.1 Funcionais
- [ ] 100% dos requisitos implementados
- [ ] Todos os cenários de teste passando
- [ ] Cobertura de testes > 90%

#### 15.2 Não-funcionais
- [ ] Latência < 200ms para 95% das requisições
- [ ] Disponibilidade > 99.9%
- [ ] Zero data loss em sincronizações

#### 15.3 Qualidade
- [ ] Code review aprovado
- [ ] Documentação completa
- [ ] Security scan sem vulnerabilidades críticas
