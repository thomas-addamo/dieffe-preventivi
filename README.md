# Dieffe Preventivi

Applicazione web per la gestione di preventivi edili — Dieffe Ristrutturazioni.

Ospitata su Vercel, database su Neon (PostgreSQL), immagini su Cloudinary.

## Accesso

URL produzione: fornito da Vercel dopo il primo deploy.

Credenziali default (cambiarle dopo il primo accesso):
- Email: `admin@dieffe.it`
- Password: `admin123`

---

## Sviluppo locale

### Prerequisiti

- Node.js 20 o superiore
- pnpm (`npm install -g pnpm`)
- Account Neon (database) e Cloudinary (immagini)

### Configurazione

```bash
cp .env.example .env.local
# Compilare .env.local con le credenziali Neon e Cloudinary
```

### Avvio

```bash
pnpm install
pnpm db:migrate   # applica migrazioni sul database Neon
pnpm db:seed      # inserisce dati esempio (solo prima volta)
pnpm dev          # avvia su http://localhost:3847
```

---

## Setup Neon (database PostgreSQL)

1. Creare un account su [neon.tech](https://neon.tech)
2. Creare un nuovo progetto (regione: EU Central o EU West)
3. Dalla dashboard, copiare la **Connection String** (formato `postgresql://...`)
4. Incollarla in `.env.local` come `DATABASE_URL`

---

## Setup Cloudinary (storage immagini)

1. Creare un account su [cloudinary.com](https://cloudinary.com)
2. Dalla dashboard, copiare Cloud Name, API Key e API Secret
3. Andare in **Settings → Upload → Upload presets** e creare un preset:
   - Nome: `dieffe-quotes`
   - Signing mode: **Signed**
4. Compilare in `.env.local`:
   ```
   CLOUDINARY_CLOUD_NAME=...
   CLOUDINARY_API_KEY=...
   CLOUDINARY_API_SECRET=...
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=...
   ```

---

## Deploy su Vercel

1. Pubblicare il repository su GitHub (privato)
2. Su [vercel.com](https://vercel.com): **New Project** → selezionare il repo
3. Configurare le variabili d'ambiente (stesse di `.env.local`) nella sezione **Environment Variables**
4. Impostare il **Build Command** su:
   ```
   pnpm db:migrate && pnpm build
   ```
5. Cliccare **Deploy**
6. Dopo il primo deploy, copiare l'URL Vercel e impostare `BETTER_AUTH_URL` (se usato) o aggiornare la configurazione auth con l'URL effettivo, poi fare redeploy

---

## Aggiornamenti

Ogni `git push` su `main` avvia automaticamente un nuovo deploy su Vercel, con esecuzione delle eventuali nuove migrazioni database.

```bash
git add .
git commit -m "Descrizione modifica"
git push
```

---

## Export preventivi

Dall'editor preventivo, menu **Esporta**:
- **PDF** — template classico con immagini
- **Excel (.xlsx)** — con formule, modificabile
- **CSV** — flat export di tutte le voci
- **JSON** — backup completo, reimportabile

## Backup dati

Dall'editor preventivo, usare **Esporta → JSON** per ogni preventivo. Il file JSON contiene tutti i dati ed e reimportabile in qualsiasi momento.

Per un backup completo del database, usare il tool di export di Neon dalla dashboard.

---

## Stack tecnico

- **Framework**: Next.js 16 (App Router) + TypeScript strict
- **Database**: PostgreSQL su Neon + Drizzle ORM
- **Storage immagini**: Cloudinary
- **Hosting**: Vercel
- **UI**: Tailwind CSS v4 + shadcn/ui
- **PDF**: @react-pdf/renderer
- **Excel**: ExcelJS
- **Auth**: sessioni custom con argon2 + cookie httpOnly
