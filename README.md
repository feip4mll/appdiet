# Prime Diet

Checkpoint inicial do app para dieta/academia com:
- Navegacao entre `Login/Cadastro`, `Home` e `Nova Refeicao`
- Banco local `SQLite`
- API local com autenticacao estruturada (base para proximo checkpoint de IA)

## Requisitos

- Node.js 24+ (com `node:sqlite`)

## Como rodar

1. No terminal, entre na pasta do projeto.
2. Rode:

```powershell
$env:OPENAI_API_KEY="sua-chave-openai"
# opcional:
# $env:OPENAI_MODEL="gpt-4.1-mini"
node server.js
```

3. Abra [http://localhost:8080](http://localhost:8080)

## Banco de dados local

Arquivo SQLite criado automaticamente em:
- `data/prime-diet.db`

Tabelas:
- `users`
- `meals`

## Endpoints principais

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/meals/today`
- `POST /api/meals`
- `GET /api/ai/checkpoint` (placeholder para integracao IA)
- `POST /api/ai/meal-feedback` (feedback das refeicoes via OpenAI)
