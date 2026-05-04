# Prime Diet

Este repositorio contem:
- App Flutter em `prime_diet_flutter/` (projeto principal para checkpoint)
- Backend/versao web legada em `server.js`, `index.html`, `app.js`

## Como rodar (Flutter - correto para avaliacao)

Rode os comandos **dentro da subpasta** `prime_diet_flutter`:

```bash
cd prime_diet_flutter
flutter pub get
flutter run -d chrome
```

## Backend IA (opcional)

Se quiser usar feedback via backend local:

```bash
cd ..
node server.js
```

## IA local (Ollama)

Para feedback de IA local, a maquina precisa ter o **Ollama** instalado e ativo.

Passos rapidos:

```bash
ollama --version
ollama pull llama3.1:8b
ollama run llama3.1:8b
```

Com o Ollama ativo, o backend usa IA local automaticamente.

## Importante

Se rodar Flutter na pasta raiz (`New project`) pode dar erro de avaliacao.
Para checkpoint, use sempre `cd prime_diet_flutter` antes dos comandos Flutter.
