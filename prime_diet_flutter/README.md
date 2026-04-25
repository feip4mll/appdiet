# Prime Diet (Flutter)

Base Flutter do Prime Diet com:
- Login/Cadastro local
- Home com calorias e agua
- Cadastro de refeicao com foto da galeria
- Edicao e exclusao de refeicoes
- Persistencia local com SQLite

## Como rodar

1. Instale Flutter no seu ambiente.
2. No terminal:

```bash
cd prime_diet_flutter
flutter pub get
flutter run
```

## Importante neste workspace

Neste ambiente do Codex, o comando `flutter` nao esta disponivel, por isso eu preparei os arquivos Flutter manualmente.

Se a sua maquina ainda nao tiver as pastas de plataforma (`android`, `ios`, `web`, etc.) dentro de `prime_diet_flutter`, rode:

```bash
flutter create .
```

Esse comando cria as pastas faltantes sem perder o `lib/main.dart` e o `pubspec.yaml` que ja estao prontos.
