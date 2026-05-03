# Dieffe Preventivi

Applicazione locale per la gestione di preventivi edili — Dieffe Ristrutturazioni.

## Requisiti

- **Node.js** 20 o superiore
- **pnpm** (installabile con `npm install -g pnpm`)

## Primo avvio (macOS / Linux)

```bash
# Doppio click su start.sh oppure da terminale:
bash scripts/start.sh
```

Il browser si aprirà automaticamente su `http://localhost:3847`.

**Credenziali default:**
- Email: `admin@dieffe.it`
- Password: `admin123`

> Cambia la password al primo accesso dalla pagina Utenti.

## Primo avvio (Windows)

Doppio click su `scripts/start.bat`.

## Installazione manuale

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm build
pnpm start
```

## Sviluppo

```bash
pnpm dev
# apri http://localhost:3847
```

## Backup

Copia la cartella `./storage/` in un posto sicuro. Contiene:
- `database.sqlite` — tutti i dati
- `uploads/` — immagini caricate nei preventivi
- `exports/` — file esportati

```bash
# Backup rapido
cp -r storage/ ~/Backup/dieffe-preventivi-$(date +%Y%m%d)/
```

## Aggiornamenti

```bash
git pull
pnpm install
pnpm db:migrate
pnpm build
# riavvia l'app
```

## Export preventivi

Dall'editor preventivo, usa il menu **Esporta** per generare:
- **PDF** — 3 template disponibili (Classico, Moderno, Minimale)
- **Excel (.xlsx)** — con formule reali, modificabile in Excel
- **CSV** — flat export di tutte le voci
- **JSON** — backup completo con immagini, reimportabile

## Template riutilizzabili

Dall'editor preventivo puoi salvare sezioni come template. I template sono accessibili dalla pagina **Template** e riutilizzabili in qualsiasi preventivo.

## Personalizzazione template PDF

I template PDF si trovano in:
```
src/components/pdf-templates/
├── ClassicTemplate.tsx
├── ModernTemplate.tsx
└── MinimalTemplate.tsx
```

Colori e template attivo si configurano in **Impostazioni** → Template PDF.

## Troubleshooting

**Il server non si avvia:**
```bash
# Verifica che la porta 3847 sia libera
lsof -i :3847
# Se occupata, termina il processo trovato
kill -9 <PID>
```

**Database corrotto:**
```bash
# Elimina il DB e ricrea (ATTENZIONE: perdi tutti i dati)
rm storage/database.sqlite
pnpm db:migrate
pnpm db:seed
```

**Errore "argon2 not found" o "better-sqlite3 not found":**
```bash
pnpm install
pnpm rebuild argon2 better-sqlite3
```

**Font non caricati / app lenta al primo avvio:**
I font Google vengono scaricati automaticamente al primo avvio tramite `next/font`. È normale che il primo avvio sia più lento.

## Stack tecnico

- **Framework**: Next.js 16 (App Router) + TypeScript strict
- **Database**: SQLite via better-sqlite3 + Drizzle ORM
- **UI**: Tailwind CSS v4 + shadcn/ui
- **PDF**: @react-pdf/renderer
- **Excel**: ExcelJS
- **Auth**: sessioni custom con argon2 + cookie httpOnly
