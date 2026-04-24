# Time-Off Microservice - Guia de Execução

## 🚀 Início Rápido

### 📁 Estrutura do Projeto
```
time-off-microservice/
├── 📄 package.json                 # Configurações e scripts
├── 📄 README_APP.md               # Este arquivo - guia da aplicação
├── 📄 README_TESTS.md             # Guia dos testes
├── 📄 TRD.md                     # Documento de Requisitos Técnicos
├── 📁 src/
│   ├── 📄 main.ts                 # Ponto de entrada da aplicação
│   ├── 📄 app.module.ts           # Módulo principal
│   ├── 📁 config/
│   │   └── 📄 database.config.ts  # Configuração TypeORM + SQLite
│   ├── 📁 modules/
│   │   ├── 📁 time-off/          # Módulo principal de time-off
│   │   ├── 📁 hcm/               # Integração HCM
│   │   └── 📁 notification/      # Sistema de notificações
│   └── 📁 test/                   # Arquivos de teste
├── 📁 data/                      # Banco de dados SQLite
└── 📁 dist/                      # Build compilado
```

### Pré-requisitos
- Node.js 18+
- npm ou yarn
- Sistema operacional: Linux, macOS, Windows

### Instalação
```bash
# Navegar para o diretório do projeto
cd /home/bfelipef/Documentos/Wizdaa/time-off-microservice

# Instalar dependências
npm install
```

### Execução

#### ⚡ Modo Desenvolvimento
```bash
# A partir do diretório raiz do projeto
npm run start:dev

# A aplicação iniciará na porta padrão 3000
# Se a porta 3000 estiver ocupada, use:
PORT=3001 npm run start:dev
```

#### 🏭 Modo Produção
```bash
# Build da aplicação
npm run build

# Iniciar em modo produção
npm run start:prod

# Ou especificar porta diferente
PORT=3002 npm run start:prod
```

#### 🐛 Modo Debug
```bash
# Iniciar com debug
npm run start:debug
```

## 🌐 Acesso à Aplicação

### URLs Importantes
```bash
# Aplicação principal
http://localhost:3002

# Documentação Swagger
http://localhost:3002/api/docs

# Health check
http://localhost:3002/api
```

### 📚 Swagger Documentation
A aplicação inclui documentação automática via Swagger:
- **URL**: `http://localhost:3002/api/docs`
- **Endpoints**: 15+ APIs REST documentadas
- **Testes**: Interface interativa para testar APIs
- **Schemas**: Modelos de dados documentados

## 🔧 Configuração

### Variáveis de Ambiente
```bash
# Porta do servidor (opcional)
PORT=3002

# Origem CORS (opcional)
CORS_ORIGIN=*

# Configurações do banco (automático com SQLite)
DB_TYPE=sqlite
DB_DATABASE=./data/time-off.db
```

### Banco de Dados
- **Tipo**: SQLite
- **Local**: `./data/time-off.db`
- **Auto-criação**: Schema criado automaticamente
- **Sincronização**: `synchronize: true` em desenvolvimento

## 📡 APIs Disponíveis

### Time-Off APIs
```bash
# Criar request
POST /api/time-off/requests

# Listar requests
GET /api/time-off/requests

# Aprovar request
POST /api/time-off/requests/:id/approve

# Rejeitar request
POST /api/time-off/requests/:id/reject

# Cancelar request
POST /api/time-off/requests/:id/cancel

# Consultar saldo
GET /api/time-off/balances/:employeeId/:locationId/:balanceType
```

### HCM APIs
```bash
# Health check
GET /api/hcm/health

# Obter configuração
GET /api/hcm/configuration

# Consultar saldo HCM
GET /api/hcm/balances/:employeeId/:locationId/:balanceType
```

## 🚨 Troubleshooting

### Porta Ocupada
```bash
# Verificar processos na porta
lsof -i :3000

# Matar processo
kill -9 <PID>

# Usar porta diferente
PORT=3001 npm run start:prod
```

### Problemas de Build
```bash
# Limpar build
rm -rf dist/

# Rebuild
npm run build
```

### Reset do Banco
```bash
# Remover banco de dados
rm -f ./data/time-off.db

# Reiniciar aplicação (recriará automaticamente)
npm run start:prod
```

## 🔄 Workflow de Desenvolvimento

1. **Setup**: `cd /home/bfelipef/Documentos/Wizdaa/time-off-microservice && npm install`
2. **Desenvolvimento**: `npm run start:dev`
3. **Testes**: `npm run test:ci`
4. **Build**: `npm run build`
5. **Produção**: `npm run start:prod`

## 📋 Status da Aplicação

- ✅ **Build**: TypeScript compilando sem erros
- ✅ **Database**: SQLite conectado e funcional
- ✅ **APIs**: 15+ endpoints REST disponíveis
- ✅ **Documentation**: Swagger ativo e acessível
- ✅ **Tests**: Jest configurado e funcionando

---

## � **Time-Off Microservice - 100% FUNCIONAL!**

**Status Final**: Aplicação completamente implementada e operacional!
- **Health Check**: http://localhost:3000/api/health

### Exemplos de Uso

#### 1. Obter Saldos de Funcionário
```bash
curl -X GET "http://localhost:3000/api/time-off/balances?employeeId=emp-001&locationId=loc-001"
```

#### 2. Criar Solicitação de Tempo de Folga
```bash
curl -X POST "http://localhost:3000/api/time-off/requests" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "emp-001",
    "locationId": "loc-001",
    "balanceType": "ANNUAL",
    "startDate": "2024-02-01",
    "endDate": "2024-02-05",
    "comments": "Férias familiares"
  }'
```

#### 3. Aprovar Solicitação
```bash
curl -X PUT "http://localhost:3000/api/time-off/requests/req-001/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "reviewedBy": "manager-001",
    "comments": "Aprovado para planejamento da equipe"
  }'
```

#### 4. Ver Estatísticas
```bash
curl -X GET "http://localhost:3000/api/time-off/statistics?daysBack=30"
```

## 🗄️ Configuração do Banco de Dados

### Ambiente de Desenvolvimento
- **Tipo**: SQLite
- **Database**: `./data/time-off.db` (criado automaticamente)
- **Sincronização**: Automática (synchronize: true)

### Variáveis de Ambiente
```bash
# Database
DB_TYPE=sqlite
DB_DATABASE=./data/time-off.db

# Servidor
PORT=3000
NODE_ENV=development

# CORS
CORS_ORIGIN=*

# HCM Integration (opcional)
HCM_BASE_URL=http://localhost:3001/hcm
```

## 📊 Monitoramento e Logs

### Logs da Aplicação
- **Nível**: Debug em desenvolvimento
- **Formato**: JSON estruturado
- **Destino**: Console

### Health Checks
```bash
# Verificar se API está online
curl http://localhost:3000/api/health

# Verificar saúde do HCM (simulado)
curl http://localhost:3000/api/hcm/health
```

## 🔧 Configurações Avançadas

### Performance
- **Pool Size**: Configurado automaticamente pelo TypeORM
- **Timeout**: 30 segundos para requisições
- **Rate Limiting**: Não configurado (adicionar se necessário)

### Segurança
- **CORS**: Habilitado para origens configuradas
- **Validation**: Global com class-validator
- **Sanitization**: Automática via ValidationPipe

## 🚨 Troubleshooting

### Problemas Comuns

#### 1. Porta em Uso
```bash
# Mudar porta
PORT=3001 npm run start:dev
```

#### 2. Erro de Permissão no SQLite
```bash
# Criar diretório data
mkdir -p data
chmod 755 data
```

#### 3. Dependências Corrompidas
```bash
# Limpar e reinstalar
rm -rf node_modules package-lock.json
npm install
```

#### 4. Build Falhando
```bash
# Limpar cache do TypeScript
npm run clean
# ou manualmente
rm -rf dist
```

### Logs de Erro
- Verifique console do terminal para logs detalhados
- Logs incluem stack traces completos
- Erros de validação mostram campos específicos

## 🔄 Workflow de Desenvolvimento

### 1. Iniciar Serviço
```bash
npm run start:dev
```

### 2. Testar Endpoints
- Use Swagger UI em http://localhost:3000/api/docs
- Ou use curl/Postman com exemplos acima

### 3. Verificar Logs
- Logs aparecem em tempo real no terminal
- Incluem timestamps e níveis de severidade

### 4. Debug
- Use `npm run start:debug`
- Conecte VS Code ou Chrome DevTools
- Breakpoints disponíveis nos serviços

## 📱 Documentação Adicional

- **API Completa**: http://localhost:3000/api/docs
- **TRD**: `TRD.md` - Requisitos Técnicos
- **Testes**: `README_TESTS.md` - Guia de Testes
- **Arquitetura**: `docs/` - Documentação detalhada

## 🎯 Próximos Passos

1. **Configurar ambiente** conforme variáveis acima
2. **Executar testes** para validar funcionamento
3. **Explorar Swagger** para conhecer todos endpoints
4. **Testar workflows** completos (criar → aprovar → sincronizar)
5. **Monitorar logs** durante operações

---

**Nota**: Este guia assume execução em ambiente local. Para produção, ajuste variáveis de ambiente e configurações de segurança.
