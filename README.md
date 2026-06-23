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

## App Desktop (macOS + Windows)

L'app desktop è un wrapper Electron che carica la stessa web app (la versione
pubblicata su Vercel in produzione, `localhost:3847` in sviluppo). Aggiunge menu
nativi, finestra ridimensionabile con dimensioni persistenti, banner offline e
aggiornamenti automatici.

### Download

Vai su [GitHub Releases](https://github.com/thomas-addamo/dieffe-preventivi/releases)
e scarica l'ultima versione:
- **macOS**: `Dieffe-Preventivi-x.x.x.dmg`
- **Windows**: `Dieffe-Preventivi-Setup-x.x.x.exe`

### Installazione macOS

1. Apri il file `.dmg`
2. Trascina l'app nella cartella Applicazioni
3. Al primo avvio: tasto destro → Apri → Apri comunque
   (necessario solo la prima volta se l'app non è notarizzata)

### Installazione Windows

1. Esegui il file `.exe` o `.msi`
2. Segui l'installazione guidata

### Sviluppo desktop

```bash
pnpm install
pnpm electron:dev   # compila il wrapper, avvia Next su :3847 e apre la finestra Electron
```

Build locale dei pacchetti distribuibili:

```bash
pnpm electron:build:mac   # solo macOS (.dmg + .zip)
pnpm electron:build:win   # solo Windows (.exe + .msi)
pnpm electron:dist        # entrambi
```

### Funzionalità offline

Quando non c'è connessione internet:
- Un banner arancione in alto avvisa della modalità offline
- I preventivi già visualizzati in precedenza sono consultabili (cache del renderer)
- Le modifiche sono disabilitate finché non torni online
- Al ripristino della connessione, l'app si riconnette automaticamente

### Aggiornamenti automatici

L'app controlla automaticamente gli aggiornamenti all'avvio e ogni ora.
Quando un aggiornamento è disponibile, viene scaricato in background.
Al termine del download, appare un banner in basso a destra con il bottone
"Riavvia" per installare l'aggiornamento.

### Release nuova versione (per admin)

1. Aggiorna la versione in `package.json` **e** in `src/lib/version.ts` (devono restare allineate)
2. Crea un tag git: `git tag v3.x.x && git push origin v3.x.x`
3. GitHub Actions builderà automaticamente macOS + Windows
4. I file appaiono in GitHub Releases dopo ~10 minuti
5. Tutti gli utenti con l'app installata ricevono notifica automatica

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
