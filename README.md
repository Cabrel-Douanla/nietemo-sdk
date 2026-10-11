# nietemo

Official TypeScript & JavaScript Client SDK for **Nietemo BaaS** (Backend-as-a-Service) and **Mobile Money** payments across Africa.

[![npm version](https://img.shields.io/npm/v/nietemo.svg)](https://www.npmjs.com/package/nietemo)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

---

## Features

- ⚡ **Zero-Config Database**: Instant document store powered by ACID PostgreSQL.
- 📱 **Native Mobile Money**: Orange Money, MTN MoMo, Wave, Airtel Money, Moov, M-Pesa, Djamo and more, in 18 African countries (powered by Swinmo Pay).
- ⚡ **Nietemo Server Functions**: Run custom serverless functions securely on Nietemo BaaS Cloud.
- 🔑 **Social OAuth & Auth**: Google, Apple, Microsoft, GitHub, plus Email/Password, OTP, and Magic Links.
- ☁️ **Cloudflare R2 Storage**: High-speed object & document storage with presigned URLs.
- 📧 **Transactional Email (Resend)**: Zero-config email templates and custom transactional messaging.
- 🔒 **Zero-Leak Security**: Authenticate with public Anon Keys or private Service Role keys.
- 🍪 **HttpOnly Encrypted Cookies**: AES-256-GCM authenticated session encryption (immunized against XSS).
- 📦 **Universal Runtime**: Works in Browser (React, Vue, Svelte), Node.js, Next.js, and Edge runtimes.
- 🚀 **Zero Dependencies**: Lightweight (< 38 KB), built on modern standard `fetch`.

---

## Installation

```bash
npm install nietemo
# or
pnpm add nietemo
# or
yarn add nietemo
```

---

## Quickstart

### 1. Initialize the client

```typescript
import { createClient } from 'nietemo';

export const nietemo = createClient({
  appId: process.env.NEXT_PUBLIC_NIETEMO_APP_ID!,
  apiKey: process.env.NEXT_PUBLIC_NIETEMO_API_KEY!,
  // endpoint: 'https://api.nietemo.site' (default)
});
```

### 2. Database Operations (Collections)

```typescript
interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
}

const products = nietemo.collection<Product>('products');

// Query documents
const items = await products.find({ category: 'shoes' }, { limit: 20, orderBy: 'price', order: 'desc' });

// Get a single document by ID
const shoe = await products.findById('rec_abc123');

// Insert a new document
const newItem = await products.insert({
  name: 'Sneakers Pro',
  price: 35000,
  category: 'shoes',
  stock: 10,
});

// Update a document
await products.update(newItem.id, {
  stock: 9,
});

// Delete a document
await products.delete(newItem.id);
```

### 3. Mobile Money Payments

`checkout()` opens the secure **Swinmo Pay** payment window, where the payer picks their country and operator
(Orange Money, MTN MoMo, Wave, Moov, Airtel, M-Pesa… in 18 African countries) and enters their number. Your app needs
no payment form: a "Pay" button is enough.

```typescript
const result = await nietemo.payments.checkout({
  amount: 35000,
  currency: 'XAF',          // the payer is debited the equivalent in their own currency
  title: 'Commande #1042',  // shown in the payment window
  metadata: { orderId: 'ord_1042' },
  // optional: country: 'CM' (pre-selected), customer: { name, email, phone } (pre-filled)
});

switch (result.status) {
  case 'SUCCESS':   /* paid and confirmed by the server */ break;
  case 'PENDING':   /* the operator is still validating: check later with getStatus(result.transactionId) */ break;
  case 'CANCELLED': /* the payer closed the window */ break;
  default:          /* FAILED | EXPIRED */ console.log(result.errorMessage);
}
```

`checkout()` runs in the browser (call it from a click handler). Only `SUCCESS` means the money was received.

#### Advanced: charge a known number

On a server, or when the app already collected the payer's details, `initiate()` charges a number directly:

```typescript
const payment = await nietemo.payments.initiate({
  operator: 'ORANGE',      // or a full code like 'ORANGE_CMR'
  country: 'CM',           // optional when the phone has its dial code (+237…)
  phone: '+237690000000',
  amount: 35000,
  currency: 'XAF',
  title: 'Commande #1042',
});

console.log(payment.instruction); // prompt to show the payer, when the operator sends one

const result = await nietemo.payments.waitForStatus(payment.transactionId, { timeoutMs: 120000 });
```

Supported countries and operators are exported for building selectors:

```typescript
import { MOBILE_MONEY_COUNTRIES, getMobileMoneyCountry } from 'nietemo';

getMobileMoneyCountry('CI')?.operators; // ['ORANGE', 'MTN', 'WAVE', 'MOOV', 'DJAMO']
```

> **Test mode:** with a test key on the server, the last two digits of the phone number decide the outcome:
> `…55` → insufficient funds, `…99` → PIN rejected, anything else succeeds (e.g. `690000000`).

### 4. User Authentication

```typescript
// Register a new customer
const { user, session } = await nietemo.auth.signUp({
  email: 'client@example.com',
  password: 'SecurePassword123!',
  name: 'Moussa Diop',
  phone: '+221770000000',
});

// Sign in with password
await nietemo.auth.signInWithPassword({
  email: 'client@example.com',
  password: 'SecurePassword123!',
});

// Social Authentication (Google, Apple, Microsoft, GitHub)
await nietemo.auth.signInWithGoogle({ redirectTo: '/dashboard' });
// or: await nietemo.auth.signInWithApple();
// or: await nietemo.auth.signInWithMicrosoft();
// or: await nietemo.auth.signInWithGithub();

// Password Reset & Verification
await nietemo.auth.sendPasswordResetEmail('client@example.com');
await nietemo.auth.resetPassword({ email: 'client@example.com', code: '123456', newPassword: 'NewPassword456!' });

// Get current session
const currentUser = nietemo.auth.getUser();
```

### 5. File & Document Storage (Cloudflare R2)

Store and retrieve user avatars, documents, and media with multi-tenant isolation:

```typescript
// Upload a file (File, Blob, Buffer, or Uint8Array)
const file = event.target.files[0];
const uploaded = await nietemo.storage.upload(file, {
  folder: 'avatars',
  customName: `user_${currentUser.id}.png`,
  isPublic: true,
});

console.log('Public URL:', uploaded.publicUrl);

// List files in a folder
const files = await nietemo.storage.listFiles({ folder: 'avatars' });

// Delete a file
await nietemo.storage.delete(uploaded.id);
```

### 6. Transactional Email via Resend

Send verified authentication emails or custom transactional messages:

```typescript
// Send transactional email
await nietemo.email.send({
  to: 'client@example.com',
  subject: 'Confirmation de votre commande #1042',
  html: '<p>Merci pour votre achat sur notre boutique !</p>',
});
```

### 7. Nietemo Server Functions (Cloud Serverless Functions)

Execute custom server-side logic, secret external API calls (e.g. OpenAI, Stripe), or sensitive calculations deployed on Nietemo BaaS Cloud:

```typescript
// Invoke a server function deployed as "calculate-tax"
const { data, error } = await nietemo.functions.invoke('calculate-tax', {
  body: { orderId: 'ord_1042' },
});

if (error) {
  console.error('Erreur fonction:', error.message);
} else {
  console.log('Résultat calculé:', data);
}
```

### 8. Secure Session Management with Encrypted HttpOnly Cookies

To protect against XSS (Cross-Site Scripting) and CSRF attacks, Nietemo SDK provides native server-side helpers for **AES-256-GCM encrypted `HttpOnly` cookies**:

```typescript
// In a Next.js 15 Route Handler, Server Action, or Node.js server:

// 1. Create an encrypted HttpOnly Set-Cookie header upon login
const setCookieHeader = await nietemo.auth.createSessionCookie(session);
// Response header: nietemo_session=<aes-256-gcm-cipher>; Path=/; HttpOnly; Secure; SameSite=Lax

// 2. Decrypt and verify session on incoming requests
const sessionPayload = await nietemo.auth.verifySessionCookie(req.headers.get('cookie'));
if (sessionPayload) {
  console.log('Authenticated user:', sessionPayload.userId);
}

// 3. Destroy cookie upon logout
const clearHeader = nietemo.auth.clearSessionCookie();
```

In browser environments, the client automatically configures `credentials: 'include'` on all requests, so `HttpOnly` cookies are forwarded transparently without ever exposing tokens to `document.cookie` or `localStorage`.

---

## Deployment & VPS Hosting

When exporting your application from Nietemo to your personal VPS or GitHub:

1. Add your credentials to `.env`:
   ```env
   NEXT_PUBLIC_NIETEMO_APP_ID="your-application-uuid"
   NEXT_PUBLIC_NIETEMO_API_KEY="nietemo_pk_live_your_public_key"
   ```
2. Run your project natively with `npm run dev` or `docker compose up -d`.
3. Your data and payment processing remain active without needing to configure or maintain your own PostgreSQL server.

---

## License

MIT © [Nietemo Platform](https://nietemo.site)
