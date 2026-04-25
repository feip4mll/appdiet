# Arquitetura sugerida para a proxima fase

## Objetivo

Transformar o MVP local da Vale Verde em um app multiusuario de verdade, com login, sincronizacao online e recursos de IA.

## Stack recomendada

- Frontend mobile: React Native com Expo ou PWA mais robusta.
- Backend: Node.js, Supabase ou Firebase.
- Banco de dados: Postgres ou Firestore.
- Autenticacao: email e senha para colaboradores da empresa.
- IA: chamada server-side para a API da OpenAI.

## Modelagem minima

### `users`

- `id`
- `name`
- `email`
- `role`
- `created_at`

### `products`

- `id`
- `name`
- `category`
- `default_unit`
- `active`

### `daily_stock_sessions`

- `id`
- `date`
- `created_by`
- `created_at`
- `updated_at`

### `daily_stock_items`

- `id`
- `session_id`
- `product_id`
- `product_name_snapshot`
- `quantity`
- `unit`
- `category`
- `created_by`
- `created_at`

## Fluxo da OpenAI

Nunca chame a API da OpenAI direto do app do usuario, porque a chave ficaria exposta.

Fluxo certo:

1. O usuario envia texto ou audio pelo app.
2. O backend recebe esse conteudo.
3. O backend chama a OpenAI com a chave protegida.
4. O backend devolve uma estrutura pronta para gravar no estoque.

## Recursos de IA que fazem sentido

- Interpretar algo como "Hoje entrou 20 kg de tomate e 14 macos de alface".
- Padronizar nome de produto e unidade.
- Responder perguntas como "qual item mais apareceu neste mes?".
- Gerar resumo diario para mandar no WhatsApp ou email.

## API minima sugerida

- `POST /auth/login`
- `GET /stock/days/:date`
- `POST /stock/days/:date/items`
- `DELETE /stock/items/:id`
- `POST /ai/parse-stock-note`
- `POST /ai/daily-summary`

## Ordem pratica de evolucao

1. Validar este MVP com a rotina real da Vale Verde.
2. Definir lista oficial de produtos e unidades.
3. Subir backend com login e banco online.
4. Sincronizar o app com dados reais.
5. Adicionar IA para entrada por texto ou voz.
