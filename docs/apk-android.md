# APK Android local

## O que mudou

Agora o projeto tambem tem uma versao Android em [android](C:\Users\Efipe7k\Documents\New project\android).

Essa versao:

- usa a mesma interface que voce aprovou;
- abre dentro de um `WebView`;
- grava os dados em banco SQLite interno do app;
- mantem os registros no aparelho ate o usuario apagar o app ou limpar os dados dele.

## Onde fica o banco

No Android, o banco fica dentro do armazenamento interno privado do app. O usuario comum nao mexe nele direto.

Na pratica, os dados so saem se acontecer uma destas acoes:

1. desinstalar o aplicativo;
2. limpar os dados do aplicativo nas configuracoes do Android;
3. usar uma futura funcao interna de apagar tudo.

## Estrutura principal do Android

- [android/app/src/main/java/com/valeverde/estoque/MainActivity.java](C:\Users\Efipe7k\Documents\New project\android\app\src\main\java\com\valeverde\estoque\MainActivity.java)
- [android/app/src/main/java/com/valeverde/estoque/StockJavascriptBridge.java](C:\Users\Efipe7k\Documents\New project\android\app\src\main\java\com\valeverde\estoque\StockJavascriptBridge.java)
- [android/app/src/main/java/com/valeverde/estoque/StockDatabaseHelper.java](C:\Users\Efipe7k\Documents\New project\android\app\src\main\java\com\valeverde\estoque\StockDatabaseHelper.java)
- [android/app/src/main/assets/index.html](C:\Users\Efipe7k\Documents\New project\android\app\src\main\assets\index.html)
- [android/app/src/main/assets/app.js](C:\Users\Efipe7k\Documents\New project\android\app\src\main\assets\app.js)

## Como gerar o APK

Voce vai precisar de:

- Android Studio;
- JDK 17;
- Android SDK instalado.

Depois:

1. abra a pasta [android](C:\Users\Efipe7k\Documents\New project\android) no Android Studio;
2. aguarde o Gradle sincronizar;
3. clique em `Build > Build Bundle(s) / APK(s) > Build APK(s)`;
4. instale o APK no celular Android.

## Importante sobre esta maquina

Neste ambiente em que eu estou trabalhando agora, nao existem `java`, `gradle` nem Android SDK configurados. Por isso eu consegui deixar o projeto Android pronto, mas nao consegui compilar o `.apk` aqui.
