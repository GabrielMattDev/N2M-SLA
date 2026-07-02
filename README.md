# N2M Dashboard SLA v3.0

Dashboard profissional para monitoramento de SLA de tratativas de Notas Fiscais, com conexao direta ao MySQL.

### 1. Instalar Node.js
Baixe em: https://nodejs.org/ (versao LTS recomendada)

### 2. Instalar dependencias
```bash
npm install
```

### 3. Criar arquivo .env (copiar do exemplo)
```bash
copy .env.example .env
```
> O arquivo .env ja vem com as credenciais configuradas.

### 4. Iniciar o servidor
```bash
npm start
```

### 5. Acessar no navegador
```
http://localhost:3000
```

## 📊 Mapeamento de Etapas (SLA)

Baseado na coluna `placa` da tabela `cad_hlan_tb`:

| Placa | Etapa | Limite SLA |
|-------|-------|------------|
| 9999 | RM Loja | 4h |
| 18 | RM CD | 4h |
| 10081 | Comercial | 24h |
| 10084 | Fiscal | 24h |
| 10082 | Cadastro | 12h |
| 10083 | Liberado | 0h |

## 🔌 Endpoints API

| Endpoint | Descricao |
|----------|-----------|
| `GET /api/dashboard` | Resumo completo (stats, graficos, tabela) |
| `GET /api/notas` | Lista notas com filtros |
| `GET /api/notas/:codi_lanc` | Detalhes de uma nota (timeline completa) |
| `GET /api/lojas` | Lista de lojas do banco |
| `GET /api/fornecedores` | Lista de fornecedores |
| `GET /health` | Status do servidor |

## 📝 Filtros disponiveis

- **Data Inicio/Fim**: Periodo de busca
- **Loja**: Filtra por codigo da loja
- **Nota Fiscal**: Busca por numero da NF
- **Fornecedor**: Busca por nome do fornecedor

## 🛠️ Tecnologias

- **Backend:** Node.js + Express + MySQL2
- **Frontend:** HTML5 + CSS3 + JavaScript + Chart.js
- **Banco:** MySQL
