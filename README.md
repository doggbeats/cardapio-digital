This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Supabase authentication

Copy `.env.example` to `.env.local` and fill in the project URL and public anon key from your Supabase project settings. Never put a secret or service-role key in a `NEXT_PUBLIC_*` variable. Restart the development server after changing the file.

### Database setup (do this first)

Open the Supabase SQL Editor and run **`supabase/setup.sql`** once. It creates everything the app needs in one go:

- `menu_catalog` (products, with description, category, image, promotion and highlight fields) and the initial products
- `orders` and the `place_order` function
- `product_categories` (menu categories) and `product_addons` (paid add-ons)
- row-level security policies and the public `product-images` storage bucket
- the `orders` table in the `supabase_realtime` publication

The script is safe to run again, so re-running it is the easiest fix if any table is missing. If you are upgrading an existing project instead, run only the individual migrations you need: `supabase/products_migration.sql`, `supabase/categories.sql`, `supabase/product_addons.sql` (same as `addons_migration.sql`) and `supabase/realtime_orders.sql`.

**Schema cache errors** such as `Could not find the table 'public.product_categories' in the schema cache` mean the table is not in the database (run the SQL above) or PostgREST is using a stale cache. If the table already exists, run `notify pgrst, 'reload schema';` in the SQL Editor or use **Settings → API → Reload schema cache**, then refresh the app.

New accounts may need to confirm their email, depending on the project's authentication settings.

The profile page supports changing the delivery address and password, and viewing past orders. The sales panel is limited to accounts whose trusted `app_metadata` contains `role: "admin"`. Assign this role through a trusted Supabase admin workflow, never from browser code or user-editable metadata. Admins can open a prefilled order summary for the customer's WhatsApp number from the sales panel.

To sign in to the panel, click the shield icon next to the cart in the header and enter the e-mail and password of an admin account. First create the account normally, then grant the `admin` role in one of two ways: run `supabase/admin.sql` in the Supabase SQL Editor, or set `SUPABASE_SERVICE_ROLE_KEY` and use the Supabase Admin API to update the account's `app_metadata`. Sign in again so the token picks up the new role. Signing in as admin replaces the current browser session. Never expose the service-role key to the browser.

## Product management

Inside the admin panel there are four tabs: **Vendas**, **Produtos**, **Categorias** and **Adicionais**.

- **Produtos**: create, edit, delete and enable/disable products. The form includes name, price, promotional price (used by the **Ofertas** page), category, description, image, badge, availability and a **Destaque** checkbox. Highlighted products appear in the **Destaques** section on the home page and in the **Destaques** menu filter. Images are uploaded from the device (JPG, PNG, WEBP or GIF, up to 5 MB) through `/api/admin/products/upload` to the public `product-images` Supabase Storage bucket created by `supabase/storage.sql` (also included in `supabase/setup.sql`); there is no URL field. When no image is uploaded, the app picks a photo that matches the product name and description automatically. The product list can be searched by name, description or category and filtered by category; use **Limpar** to reset both filters.
- **Categorias**: add and delete menu categories. Deleting a category that still has products is blocked and shows how many products use it. Use the **Mover produtos** button to move all of that category's products to another category at once, then delete it.
- **Adicionais**: add and delete paid add-ons (name and price). They replace the old fixed "Molho especial" and are offered only for products in **Burgers** and **Hot Dog**.

Changes are saved through server-only Route Handlers that verify the admin role and use the service-role key; the public menu reloads the catalog on startup so every customer sees the updated products.

## Placing an order

The customer reviews the cart and taps **Fazer pedido**. A confirmation sheet shows every item (including selected add-ons and notes), the delivery address and the total. The order is only saved when the customer taps **Confirmar pedido**. Add-on prices are validated again by the `place_order` database function, so the browser cannot change them.

## Order webhook

After an order is confirmed, the app POSTs it to `ORDER_WEBHOOK_URL` when that variable is set. The body is `{ "event": "order.created", "order": { ... } }` and, if `ORDER_WEBHOOK_SECRET` is set, a `X-Webhook-Secret` header is included so the receiver can validate the request. A webhook failure does not undo the order. Both variables are server-side only (no `NEXT_PUBLIC_` prefix).

## WhatsApp e alertas de pedido

Ao confirmar um pedido, o servidor envia o resumo (itens, valores, cliente e endereço) para o WhatsApp da loja via WhatsApp Cloud API. Configure `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` e `WHATSAPP_STORE_PHONE_NUMBER` (em E.164, sem `+`) para ativar o envio automático; `WHATSAPP_API_VERSION` é opcional. Sem essas variáveis, ou se a API falhar, o cardápio abre um link `wa.me` com a mensagem pronta para envio manual. Nenhuma credencial do WhatsApp é exposta ao navegador.

O painel administrativo acompanha novos pedidos em tempo real via Supabase Realtime: aparece um aviso com cliente e total, um contador na aba **Vendas** e uma notificação do sistema. Use o botão **Ativar notificações** no painel para liberar a permissão do navegador (browsers exigem um clique para isso). O alarme sonoro é automático e alto, mas **só toca quando o painel administrativo está aberto**; o aviso visual continua funcionando mesmo com o painel fechado. O botão **Testar alarme** permite conferir o som a qualquer momento. O status **Ao vivo** indica que a conexão está ativa.

O áudio é liberado no primeiro clique ou tecla no app, conforme exigem as políticas de autoplay dos navegadores. Se o alarme não tocar, clique em **Testar alarme** no painel e verifique se o volume do dispositivo não está mudo.

Se o Realtime não estiver disponível (status **Offline**, normalmente porque a migração `realtime_orders.sql` não foi executada), o painel administrativo passa a consultar novos pedidos a cada 5 segundos enquanto a aba **Vendas** está aberta. Assim o aviso, a contagem e a notificação continuam funcionando; a configuração do Realtime apenas os torna instantâneos.

No painel do cliente, o status **Em preparo** mostra uma animação da cozinha (panela, fogo e vapor) e a mudança para **Saiu para entrega** mostra uma moto animada com o endereço e o CEP de entrega. Ambos os status chegam em tempo real. Para habilitar os eventos, execute `supabase/realtime_orders.sql` no SQL Editor (o script já está incluído em `supabase/setup.sql`).

## Cookie consent

A consent banner appears on the first visit with **Aceitar todos**, **Recusar** and **Personalizar** options. The choice is stored in the `cardapio_cookie_consent` cookie (180 days, `SameSite=Lax`) and can be changed at any time through **Preferências de cookies** in the footer. Only necessary cookies are set before consent; optional analytics and marketing categories are recorded in the preference but no third-party script is loaded. When `NEXT_PUBLIC_META_PIXEL_ID` is set, the Meta Pixel script is loaded only after Marketing consent and stops receiving events if the preference is revoked.

## Encrypted environment variables

The values in `.env.local` are encrypted with [dotenvx](https://dotenvx.com). The scripts `dev`, `build` and `start` decrypt them at runtime, so the plaintext values are never written back to disk. The private key lives in `.env.keys`, which is gitignored like the env files. Keep `.env.keys` outside source control and, in CI, provide `DOTENV_PRIVATE_KEY_LOCAL` as a secret instead.

After editing `.env.local`, run `npm run env:encrypt`. To inspect or export the plaintext locally, use `npm run env:decrypt` (remember to encrypt again afterwards).

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
