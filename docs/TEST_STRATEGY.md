# Estratégia de Testes - Time-Off Microservice

## Visão Geral

Este documento define a estratégia completa de testes para o microserviço de Time-Off, seguindo os princípios de desenvolvimento agêntico onde os testes guiam a implementação.

## Estrutura de Testes

```
src/
├── test/
│   ├── unit/
│   │   ├── services/
│   │   │   ├── time-off-balance.service.spec.ts
│   │   │   ├── time-off-request.service.spec.ts
│   │   │   ├── hcm-integration.service.spec.ts
│   │   │   └── balance-sync.service.spec.ts
│   │   ├── controllers/
│   │   │   ├── time-off.controller.spec.ts
│   │   │   └── hcm-mock.controller.spec.ts
│   │   ├── repositories/
│   │   │   ├── time-off-balance.repository.spec.ts
│   │   │   └── time-off-request.repository.spec.ts
│   │   └── utils/
│   │       ├── validation.util.spec.ts
│   │       └── date.util.spec.ts
│   ├── integration/
│   │   ├── time-off-api.integration.spec.ts
│   │   ├── hcm-integration.integration.spec.ts
│   │   └── database.integration.spec.ts
│   ├── e2e/
│   │   ├── time-off-workflow.e2e.spec.ts
│   │   ├── balance-sync.e2e.spec.ts
│   │   └── error-handling.e2e.spec.ts
│   ├── performance/
│   │   ├── load-testing.spec.ts
│   │   └── concurrency.spec.ts
│   ├── mocks/
│   │   ├── hcm-mock.server.ts
│   │   ├── database.mock.ts
│   │   └── fixtures/
│   │       ├── employees.json
│   │       ├── locations.json
│   │       └── balances.json
│   └── helpers/
│       ├── test-setup.ts
│       ├── database-helper.ts
│       └── request-helper.ts
```

## Tipos de Testes

### 1. Testes Unitários (90%+ coverage)

#### Objetivo
- Testar lógica de negócio isoladamente
- Validar cálculos e transformações
- Garantir comportamento esperado dos serviços

#### Escopo
- Services: Lógica de negócio principal
- Controllers: Validação de inputs e responses
- Repositories: Operações de banco de dados
- Utils: Funções utilitárias e helpers

#### Critérios
- Cobertura mínima: 90%
- Todos os branches testados
- Mock de todas as dependências externas

### 2. Testes de Integração

#### Objetivo
- Testar interação entre componentes
- Validar fluxos de dados completos
- Garantir comunicação correta entre módulos

#### Escopo
- APIs completas (Controller → Service → Repository)
- Integração com banco de dados real
- Comunicação com serviços externos (mock)

#### Critérios
- Testar todos os endpoints principais
- Validar transações ACID
- Testar tratamento de erros

### 3. Testes E2E (End-to-End)

#### Objetivo
- Testar fluxos completos do usuário
- Validar comportamento do sistema como um todo
- Simular cenários reais de uso

#### Escopo
- Fluxo completo de solicitação de folga
- Sincronização com HCM
- Recuperação de falhas

#### Critérios
- Testar todos os principais workflows
- Incluir casos de erro e edge cases
- Validar performance em cenários reais

### 4. Testes de Performance

#### Objetivo
- Validar performance sob carga
- Identificar gargalos
- Garantir escalabilidade

#### Escopo
- Load testing: múltiplas requisições simultâneas
- Stress testing: limites do sistema
- Concurrency test: operações concorrentes

#### Critérios
- Latência < 200ms para 95% das requisições
- Suportar 100+ requisições simultâneas
- Sem memory leaks

### 5. Testes de Mock HCM

#### Objetivo
- Simular comportamento real do HCM
- Testar resiliência e fallback
- Validar tratamento de erros

#### Comportamentos Simulados
- Sucesso normal
- Timeout
- Erros de validação
- Saldo insuficiente
- Funcionário não encontrado
- Mudanças independentes de saldo

## Cenários de Teste

### Cenários Principais

#### 1. Criação de Solicitação de Folga
```typescript
describe('Time-Off Request Creation', () => {
  it('should create request with sufficient balance')
  it('should reject request with insufficient balance')
  it('should reject overlapping requests')
  it('should validate date ranges')
  it('should handle weekend/holiday calculations')
})
```

#### 2. Aprovação de Solicitação
```typescript
describe('Request Approval', () => {
  it('should approve valid request and update balance')
  it('should sync with HCM after approval')
  it('should handle HCM sync failure gracefully')
  it('should rollback on approval failure')
})
```

#### 3. Sincronização de Saldos
```typescript
describe('Balance Synchronization', () => {
  it('should sync individual employee balance')
  it('should handle batch synchronization')
  it('should detect and resolve conflicts')
  it('should retry failed syncs with exponential backoff')
})
```

#### 4. Validações de Negócio
```typescript
describe('Business Validations', () => {
  it('should validate minimum notice period')
  it('should enforce maximum consecutive days')
  it('should respect role-based approval limits')
  it('should calculate business days correctly')
})
```

### Edge Cases e Error Handling

#### 1. Falhas de Comunicação HCM
```typescript
describe('HCM Communication Failures', () => {
  it('should handle HCM timeout')
  it('should retry with exponential backoff')
  it('should use cached balance during HCM outage')
  it('should queue failed operations for later retry')
})
```

#### 2. Consistência de Dados
```typescript
describe('Data Consistency', () => {
  it('should maintain ACID properties')
  it('should handle concurrent balance updates')
  it('should detect and resolve conflicts')
  it('should audit all balance changes')
})
```

#### 3. Performance sob Carga
```typescript
describe('Performance Under Load', () => {
  it('should handle 100+ concurrent requests')
  it('should maintain response time under 200ms')
  it('should not leak memory under sustained load')
  it('should gracefully degrade under extreme load')
})
```

## Mock Strategy

### HCM Mock Server
```typescript
// Comportamentos configuráveis
interface HCMMockConfig {
  responseDelay: number;
  failureRate: number;
  behaviors: {
    timeout: boolean;
    insufficientBalance: boolean;
    employeeNotFound: boolean;
    randomErrors: boolean;
  };
}
```

### Database Mock
```typescript
// SQLite em memória para testes
const testDatabaseConfig = {
  type: 'sqlite',
  database: ':memory:',
  synchronize: true,
  dropSchema: true,
};
```

### Fixtures
```typescript
// Dados de teste consistentes
const testFixtures = {
  employees: [...],
  locations: [...],
  balances: [...],
  requests: [...],
};
```

## Métricas e Coverage

### Coverage Targets
- **Statements**: 95%+
- **Branches**: 90%+
- **Functions**: 95%+
- **Lines**: 95%+

### Quality Gates
- Zero test failures
- Coverage mínimo atingido
- Performance benchmarks pass
- Security scan clean

### Reporting
- Coverage reports HTML
- Performance dashboards
- Test execution time tracking
- Failure analysis and trends

## Ambiente de Teste

### Configuração
- Database: SQLite em memória
- HCM: Mock server configurável
- Timeout: 5 segundos por teste
- Parallel execution: enabled

### CI/CD Integration
- Executar em cada PR
- Blocar merge se falhar
- Gerar reports de coverage
- Publicar resultados

## Best Practices

### 1. Test-First Development
- Escrever testes antes do código
- Usar TDD para features complexas
- Refatorar com segurança dos testes

### 2. Test Isolation
- Cada teste independente
- Cleanup automático
- Sem estados compartilhados

### 3. Realistic Data
- Usar dados realistas
- Incluir edge cases
- Variar cenários de teste

### 4. Maintainable Tests
- Testes claros e legíveis
- Helpers e utilities reutilizáveis
- Documentação de cenários complexos

## Execution Strategy

### Local Development
```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# All tests with coverage
npm run test:all
```

### CI Pipeline
```bash
# Fast feedback (unit + integration)
npm run test:ci

# Full suite (pre-release)
npm run test:full

# Performance tests
npm run test:performance
```

## Success Criteria

### Functional
- [ ] 100% dos requisitos testados
- [ ] Todos os edge cases cobertos
- [ ] Zero bugs em produção (pós-testes)

### Non-Functional
- [ ] Performance benchmarks atingidos
- [ ] Coverage targets alcançados
- [ ] Zero regressões

### Quality
- [ ] Testes mantíveis e legíveis
- [ ] Documentação completa
- [ ] Processo de CI/CD robusto
