# Hospedagem e gateway

## 1. Como hospedar este site

Como o projeto e estatico, voce pode hospedar em servicos simples de arquivos web.

Opcoes comuns:

- Hostinger com hospedagem compartilhada
- Vercel
- Netlify
- Cloudflare Pages

Fluxo basico:

1. publique os arquivos `index.html`, `styles.css`, `app.js`, `manifest.webmanifest`, `service-worker.js` e `assets/`;
2. confirme se a pagina abre em `https`;
3. se tiver dominio proprio, aponte o DNS para a hospedagem;
4. teste no celular e no desktop.

## 2. Como integrar o gateway

Se o gateway gerar um link de checkout pronto:

1. copie a URL do checkout;
2. abra [app.js](C:\Users\Efipe7k\Documents\New project\app.js);
3. altere `const CHECKOUT_URL = "";` para o link real;
4. publique de novo o site.

Exemplo:

```js
const CHECKOUT_URL = "https://seu-checkout-aqui.com/pagar";
```

Quando o usuario clicar em `Ir para o checkout`, ele sera enviado para o pagamento.

## 3. Gateways que costumam funcionar bem

- Mercado Pago
- Stripe
- Kiwify
- Hotmart
- Eduzz
- Yampi

Se o seu gateway tiver checkout transparente ou API propria, ai o fluxo muda e pode exigir backend ou script especifico.

## 4. Recomendacao pratica

Para lancar rapido:

1. use um gateway que entregue link de checkout;
2. conecte esse link em `CHECKOUT_URL`;
3. hospede primeiro;
4. depois refinamos pixel, analytics, upsell e automacoes.
