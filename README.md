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

Run `supabase/schema.sql` in the Supabase SQL Editor before placing orders. It creates the menu catalog, order table, row-level security policies, and the `place_order` function. New accounts may need to confirm their email, depending on the project's authentication settings.

The profile page supports changing the delivery address and password, and viewing past orders. The sales panel is limited to accounts whose trusted `app_metadata` contains `role: "admin"`. Assign this role through a trusted Supabase admin workflow, never from browser code or user-editable metadata. Admins can open a prefilled order summary for the customer's WhatsApp number from the sales panel.

To sign in to the panel, click the shield icon next to the cart in the header and enter the e-mail and password of an admin account. First create the account normally, then grant the `admin` role in one of two ways: run `supabase/admin.sql` in the Supabase SQL Editor, or set `SUPABASE_SERVICE_ROLE_KEY` and use the Supabase Admin API to update the account's `app_metadata` (as done for `paulo.analise90@gmail.com`). Sign in again so the token picks up the new role. Signing in as admin replaces the current browser session. Never expose the service-role key to the browser.

## Placing an order

The customer reviews the cart and taps **Fazer pedido**. A confirmation sheet shows every item (including special sauce and notes), the delivery address and the total. The order is only saved when the customer taps **Confirmar pedido**.

## Order webhook

After an order is confirmed, the app POSTs it to `ORDER_WEBHOOK_URL` when that variable is set. The body is `{ "event": "order.created", "order": { ... } }` and, if `ORDER_WEBHOOK_SECRET` is set, a `X-Webhook-Secret` header is included so the receiver can validate the request. A webhook failure does not undo the order. Both variables are server-side only (no `NEXT_PUBLIC_` prefix).

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
