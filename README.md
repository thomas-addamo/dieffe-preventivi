<div align="center">

<img src="public/icona_dieffe.svg" alt="Dieffe Preventivi" width="88" height="88" />

# Dieffe Preventivi

**Preventivi edili professionali, dal sopralluogo alla firma del cliente.**

Web app, app per iPhone (installabile da Safari) e app desktop per macOS e Windows.

[Sito](https://dieffe-preventivi.vercel.app) · [Scarica l'app desktop](https://github.com/thomas-addamo/dieffe-preventivi/releases/latest) · [Novità](#novità-e-versioni)

</div>

---

## Cos'è

Dieffe Preventivi è il gestionale con cui **Dieffe Ristrutturazioni** prepara, invia e
archivia i preventivi dei propri cantieri. Sostituisce fogli Excel e documenti sparsi
con un unico strumento, disponibile ovunque: in ufficio, in cantiere, dal telefono.

## Funzionalità

| | |
|---|---|
| **Editor di preventivi** | Sezioni e voci trascinabili, quantità, sconti, prezzi a corpo, sezioni opzionali, più preventivi aperti in schede. |
| **Descrizioni formattate** | Grassetto, corsivo, sottolineato ed elenchi direttamente nelle voci, riportati fedelmente nel PDF. |
| **Listino prezzi** | Listino aziendale con codici e categorie, che si arricchisce imparando dai preventivi già fatti. |
| **Assistente AI** | Suggerimenti di prezzo spiegati (listino, storico, mercato), miglioramento dei testi e import di preventivi da PDF, Word ed Excel. |
| **Condivisione e firma** | Link pubblico per il cliente, protetto da PIN opzionale, con accettazione e firma online. |
| **Export** | PDF impaginato con immagini, Excel con formule, CSV e backup JSON. Da iPhone il PDF si condivide o si salva su File. |
| **Clienti e template** | Anagrafica clienti con lo storico dei preventivi e template riutilizzabili. |
| **Statistiche** | Andamento di valore, conversione e stati dei preventivi. |
| **Ruoli e controllo** | Amministratore, editor e sola lettura; registro attività, sessioni attive, blocco dei preventivi, cestino con ripristino. |
| **Notifiche** | Centro notifiche in app e notifiche push su iPhone, Mac e browser. |

## App desktop

L'app desktop offre l'esperienza di un'applicazione nativa:

- **macOS** — barra del titolo integrata, sidebar traslucida con i materiali di sistema,
  font SF, modalità chiara/scura sincronizzata, badge delle notifiche nel Dock.
- **Menu e scorciatoie** — `⌘N` nuovo preventivo, `⌘1…7` per le sezioni, `⌘[` / `⌘]`
  avanti e indietro, `⌘,` impostazioni; menu contestuale di sistema con correzione ortografica.
- **Sempre aggiornata** — l'interfaccia si aggiorna da sola; quando esce una nuova
  versione dell'app, viene segnalata con il link diretto al pacchetto giusto.

### Download

| Sistema | Pacchetto |
|---|---|
| Mac con chip Apple (M1 e successivi) | [Dieffe-Preventivi-mac-arm64.dmg](https://github.com/thomas-addamo/dieffe-preventivi/releases/latest/download/Dieffe-Preventivi-mac-arm64.dmg) |
| Mac con processore Intel | [Dieffe-Preventivi-mac-x64.dmg](https://github.com/thomas-addamo/dieffe-preventivi/releases/latest/download/Dieffe-Preventivi-mac-x64.dmg) |
| Windows 10 / 11 (x64) | [Dieffe-Preventivi-Setup-x64.exe](https://github.com/thomas-addamo/dieffe-preventivi/releases/latest/download/Dieffe-Preventivi-Setup-x64.exe) |

### Primo avvio

L'app non è ancora notarizzata da Apple né firmata da Microsoft, quindi la prima
apertura va confermata una volta sola.

**macOS** (12 Monterey o successivo)
1. Apri il `.dmg` e trascina **Dieffe Preventivi** in **Applicazioni**.
2. Apri l'app: macOS avvisa che non può verificare lo sviluppatore. Premi **Fine**.
3. Apri **Impostazioni di Sistema → Privacy e sicurezza** e premi **Apri comunque**.

**Windows**
1. Avvia l'installer.
2. Se compare *«Windows ha protetto il PC»*, premi **Ulteriori informazioni → Esegui comunque**.

## Tecnologie

- **Web app** — Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, componenti Radix
- **Dati** — PostgreSQL (Neon) con Drizzle ORM, immagini su Cloudinary
- **Documenti** — @react-pdf/renderer (PDF), ExcelJS (Excel), Tiptap (testo formattato)
- **App desktop** — Electron con firma del pacchetto e build automatiche su GitHub Actions
- **Hosting** — Vercel

## Sviluppo

> Il progetto è sviluppato per uso interno. Le istruzioni qui sotto servono a chi
> lavora al codice; nessuna credenziale è inclusa nel repository.

**Requisiti:** Node.js 22, pnpm 10.

```bash
pnpm install
cp .env.example .env.local   # compila le variabili richieste
pnpm db:migrate              # applica le migrazioni
pnpm dev                     # http://localhost:3847
```

| Comando | Descrizione |
|---|---|
| `pnpm dev` | Server di sviluppo |
| `pnpm build` | Build di produzione |
| `pnpm lint` | Controlli ESLint |
| `pnpm db:generate` / `pnpm db:migrate` | Genera / applica le migrazioni del database |
| `pnpm electron:dev` | App desktop collegata al server di sviluppo |
| `pnpm electron:build:mac` / `pnpm electron:build:win` | Pacchetti desktop locali in `dist-electron/` |

### Struttura

```
src/app/          pagine e API (App Router)
src/components/   interfaccia (editor, PDF, componenti condivisi)
src/lib/          dominio: calcoli, AI, export, permessi, database
electron/         app desktop (finestra, menu, aggiornamenti)
scripts/desktop/  preparazione e firma dei pacchetti desktop
```

### Design

Un unico sistema di token (colori, ombre, raggi) in `src/app/globals.css`, con la regola
dei **raggi annidati**: il raggio di un elemento interno è quello del contenitore meno
il suo padding. L'app desktop usa lo stesso sistema con un proprio design, attivato solo
al suo interno: il sito resta invariato.

## Novità e versioni

Il numero di versione segue il versionamento semantico e si trova in `src/lib/version.ts`
(allineato a `package.json`). Le novità di ogni versione sono in `src/lib/changelog.ts`
e compaiono agli utenti nel riquadro **Novità** in cima all'app.

Per pubblicare una nuova versione dell'app desktop si crea il tag corrispondente
(`git tag vX.Y.Z && git push origin vX.Y.Z`): GitHub Actions crea i pacchetti macOS e
Windows e li pubblica nella [pagina delle release](https://github.com/thomas-addamo/dieffe-preventivi/releases).

## Licenza

© 2026 Dieffe Ristrutturazioni. Tutti i diritti riservati.
Codice consultabile pubblicamente; non è concesso il riutilizzo senza autorizzazione scritta.
