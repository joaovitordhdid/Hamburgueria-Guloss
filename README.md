# Hamburgueria Gulos — cardápio digital

Site de pedidos da Hamburgueria Gulos: cardápio visual, carrinho, checkout com dados obrigatórios (nome, CPF validado, WhatsApp, localização e endereço), cupom automático e painel do dono.

É um site estático (HTML, CSS e JavaScript puros, sem build). Para rodar localmente: `python3 -m http.server` nesta pasta e abra http://localhost:8000. Na Vercel, basta importar o repositório sem configurar nada.

## Painel do dono
Link "Painel do dono" no rodapé (ou `#painel` no fim do endereço). No primeiro acesso você cria o email e a senha.
- Produtos: preços, promoções, fotos, ingredientes, adicionais, categorias, ativar/ocultar.
- Estoque: entrada de mercadoria, mínimo, alertas e histórico.
- Financeiro: gráficos de faturamento, categorias, mais vendidos, formas de pagamento, horários, despesas e DRE, exportação CSV.
- Pedidos: andamento do pedido, dados do cliente, mapa, cupom/nota.
- Configurações: dados da loja, taxa de entrega, PIX, nota fiscal, backup.

**Importante:** hoje os dados ficam salvos no navegador (localStorage). Isso serve para testar e para um único aparelho. Para os pedidos dos clientes chegarem no painel do dono em outro aparelho, é preciso ligar um banco de dados (ex.: Supabase). A camada `js/store.js` foi feita para essa troca.

## Nota fiscal (NFC-e)
O site já gera um cupom do pedido automaticamente e tem a integração pronta em `js/nfe.js` (Focus NFe ou eNotas). Para emitir nota de verdade é preciso:
1. CNPJ ativo e Inscrição Estadual habilitada para NFC-e na SEFAZ-SE.
2. Certificado digital A1.
3. CSC (código de segurança do contribuinte) e o ID do token, gerados na SEFAZ.
4. Conta num emissor (Focus NFe, eNotas, etc.).
5. Um pequeno servidor (ex.: função na Vercel) que guarda o token do emissor e envia a nota. O token nunca pode ficar no navegador.
6. Conferir com o contador os códigos fiscais (CFOP, NCM, CSOSN).

## Estrutura
- `js/data.js` — cardápio original (gerado a partir do site atual).
- `js/store.js` — dados (cardápio, pedidos, estoque, configurações).
- `js/menu.js` + `css/menu.css` — cardápio.
- `js/checkout.js` + `js/nfe.js` + `css/checkout.css` — carrinho, pagamento e cupom/nota.
- `js/admin.js` + `css/admin.css` — rodapé e painel do dono.
