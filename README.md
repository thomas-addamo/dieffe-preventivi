<div align="center">

<img src="public/icona_dieffe.svg" alt="Dieffe Preventivi" width="96" height="96" />

# Dieffe Preventivi

**Preventivi edili professionali, dal sopralluogo alla firma del cliente.**

Il gestionale con cui Dieffe Ristrutturazioni prepara, invia e archivia i preventivi dei propri cantieri:<br/>
sul web, su iPhone e nelle app desktop per macOS e Windows.

[![Versione](https://img.shields.io/github/v/release/thomas-addamo/dieffe-preventivi?label=versione&color=1e40af)](https://github.com/thomas-addamo/dieffe-preventivi/releases/latest)
[![Piattaforme](https://img.shields.io/badge/web%20·%20iPhone%20·%20macOS%20·%20Windows-0f172a)](#piattaforme)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![SwiftUI](https://img.shields.io/badge/SwiftUI-iOS%2026-F05138?logo=swift&logoColor=white)](ios/README.md)

[**Apri l'app**](https://dieffe-preventivi.vercel.app) &nbsp;·&nbsp;
[**Scarica per Mac e Windows**](https://github.com/thomas-addamo/dieffe-preventivi/releases/latest) &nbsp;·&nbsp;
[App iPhone](ios/README.md) &nbsp;·&nbsp;
[Novità](#novità-e-versioni)

</div>

<br/>

## In breve

Un unico strumento al posto di fogli Excel, documenti sparsi e mail scritte a mano.
Il preventivo nasce in cantiere dal telefono, si rifinisce in ufficio, parte per email
con il PDF allegato e torna firmato dal cliente, tutto nello stesso posto.

```
 Sopralluogo  ──►  Preventivo  ──►  Invio per email  ──►  Firma online  ──►  Archivio
  (iPhone)        (listino + AI)    (PDF + link + PIN)     (dal cliente)     (statistiche)
```

## Funzionalità

### Preventivi

| | |
|---|---|
| **Editor** | Sezioni e voci trascinabili, quantità, sconti, prezzi a corpo, sezioni opzionali; più preventivi aperti in schede, riepilogo sempre a vista. |
| **Descrizioni formattate** | Grassetto, corsivo, sottolineato ed elenchi nelle voci, riportati fedelmente nel PDF. |
| **Duplica** | Copia completa di un preventivo (sezioni, voci, prezzi, foto) per lo stesso cliente o per un altro. |
| **Lavori extra** | Lavorazioni aggiuntive in un preventivo legato all'originale (`PREV-…-E1`), con importo separato e PDF marcato "Extra". |
| **Import da file** | Un computo in PDF, Word o Excel diventa un preventivo completo, letto dall'AI. |

### Cliente

| | |
|---|---|
| **Invio per email** | Mail già pronta dalla casella ufficiale dell'impresa, con PDF allegato, riferimenti del preventivo e pulsante per aprirlo online. Più destinatari in CC o CCN, note controllate dall'AI, anteprima prima dell'invio. |
| **Link e firma online** | Pagina pubblica protetta da codice di accesso, da cui il cliente consulta, accetta e firma. |
| **Export** | PDF impaginato con immagini, Excel con formule, CSV e backup JSON. |
| **Comunicazioni** | Lettere su carta intestata a clienti, condòmini o architetti, con timbro e PDF. |

### Intelligenza artificiale

| | |
|---|---|
| **Prezzi spiegati** | Suggerimenti di prezzo motivati da listino, storico dei preventivi e mercato. |
| **Listino che impara** | Catalogo a categorie con codici gerarchici (es. `PAV.02.05`), alimentato dai preventivi e riordinato ogni notte: doppioni uniti, voci inutilizzate rimosse. |
| **Testi** | Miglioramento delle descrizioni e controllo ortografico e grammaticale delle note per il cliente. |
| **Dashboard personale** | Lavori in sospeso e consigli del giorno per ogni utente. |

### Gestione

| | |
|---|---|
| **Clienti** | Anagrafica con contatti e storico dei preventivi. |
| **Statistiche** | Andamento di valore, conversione e stati dei preventivi. |
| **Ruoli e sicurezza** | Amministratore, editor e sola lettura; registro attività, sessioni attive, blocco dei preventivi, cestino con ripristino. |
| **Notifiche** | Centro notifiche in app e notifiche push su iPhone, Mac e browser. |
| **Aiuto** | Assistente sull'uso dell'app e messaggi diretti all'amministratore. |

## Piattaforme

Ogni funzione importante esce nello stesso momento su tutte le piattaforme, con la
stessa versione e un'interfaccia pensata per ciascuna.

| | |
|---|---|
| 🌐 **Web** | Funziona in qualsiasi browser, anche come app installata da Safari. |
| 📱 **iPhone** | App nativa in SwiftUI con Liquid Glass, Face ID, Dynamic Island per i sopralluoghi e aggiornamento automatico sui dispositivi dell'impresa. [Dettagli →](ios/README.md) |
| 💻 **macOS** | Icona Liquid Glass, barra del titolo integrata, sidebar traslucida, menu completi e badge nel Dock. |
| 🪟 **Windows** | Stessa app desktop, con installer e scorciatoie da tastiera. |

### Download desktop

| Sistema | Pacchetto |
|---|---|
| Mac con chip Apple (M1 e successivi) | [Dieffe-Preventivi-mac-arm64.dmg](https://github.com/thomas-addamo/dieffe-preventivi/releases/latest/download/Dieffe-Preventivi-mac-arm64.dmg) |
| Mac con processore Intel | [Dieffe-Preventivi-mac-x64.dmg](https://github.com/thomas-addamo/dieffe-preventivi/releases/latest/download/Dieffe-Preventivi-mac-x64.dmg) |
| Windows 10 / 11 (x64) | [Dieffe-Preventivi-Setup-x64.exe](https://github.com/thomas-addamo/dieffe-preventivi/releases/latest/download/Dieffe-Preventivi-Setup-x64.exe) |

L'app si aggiorna da sola: l'interfaccia segue il sito e, quando esce una nuova versione,
viene proposto il pacchetto giusto.

<details>
<summary><b>Primo avvio</b> (l'app non è ancora notarizzata da Apple né firmata da Microsoft)</summary>

<br/>

**macOS** (12 Monterey o successivo)
1. Apri il `.dmg` e trascina **Dieffe Preventivi** in **Applicazioni**.
2. Apri l'app: macOS avvisa che non può verificare lo sviluppatore. Premi **Fine**.
3. Apri **Impostazioni di Sistema → Privacy e sicurezza** e premi **Apri comunque**.

**Windows**
1. Avvia l'installer.
2. Se compare *«Windows ha protetto il PC»*, premi **Ulteriori informazioni → Esegui comunque**.

</details>

<details>
<summary><b>Scorciatoie da tastiera</b> (su Windows <kbd>Ctrl</kbd> al posto di <kbd>⌘</kbd>)</summary>

<br/>

| Azione | Scorciatoia |
|---|---|
| Nuovo preventivo · lavoro extra · comunicazione | <kbd>⌘N</kbd> · <kbd>⇧⌘N</kbd> · <kbd>⌥⌘N</kbd> |
| Duplica preventivo | <kbd>⌘D</kbd> |
| Invia per email | <kbd>⌥⌘E</kbd> |
| Anteprima · scarica PDF | <kbd>⌘E</kbd> · <kbd>⇧⌘E</kbd> |
| Importa da file | <kbd>⌘O</kbd> |
| Cerca un preventivo | <kbd>⌘K</kbd> |
| Sezioni dell'app | <kbd>⌘1</kbd> … <kbd>⌘9</kbd> |
| Indietro · avanti | <kbd>⌘[</kbd> · <kbd>⌘]</kbd> |
| Barra laterale | <kbd>⌃⌘S</kbd> |
| Assistente | <kbd>⇧⌘/</kbd> |

</details>

## Tecnologie

| | |
|---|---|
| **Web app** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Radix |
| **Dati** | PostgreSQL (Neon) con Drizzle ORM, immagini su Cloudinary |
| **Documenti** | @react-pdf/renderer, ExcelJS, Tiptap, React Email |
| **AI** | Modelli open su Groq |
| **iPhone** | SwiftUI, MapKit, Swift Charts, ActivityKit, XcodeGen |
| **Desktop** | Electron, build e release automatiche con GitHub Actions |
| **Hosting** | Vercel |

## Sviluppo

> Il progetto è sviluppato per uso interno. Le istruzioni servono a chi lavora al codice;
> nessuna credenziale è inclusa nel repository.

**Requisiti:** Node.js 22, pnpm 10 (per l'app iPhone: Xcode 26 e XcodeGen).

```bash
pnpm install
cp .env.example .env.local   # compila le variabili richieste
pnpm db:migrate              # applica le migrazioni
pnpm dev                     # http://localhost:3847
```

<details>
<summary><b>Comandi</b></summary>

<br/>

| Comando | Descrizione |
|---|---|
| `pnpm dev` | Server di sviluppo |
| `pnpm build` | Build di produzione |
| `pnpm lint` | Controlli ESLint |
| `pnpm db:generate` / `pnpm db:migrate` | Genera / applica le migrazioni (in produzione partono da sole a ogni deploy, vedi `scripts/migrate-deploy.ts`) |
| `pnpm electron:dev` | App desktop collegata al server di sviluppo |
| `pnpm electron:build:mac` / `pnpm electron:build:win` | Pacchetti desktop locali in `dist-electron/` |

</details>

<details>
<summary><b>Struttura del codice</b></summary>

<br/>

```
src/app/          pagine e API (App Router)
src/components/   interfaccia (editor, PDF, componenti condivisi)
src/lib/          dominio: calcoli, AI, email, export, permessi, database
electron/         app desktop (finestra, menu, aggiornamenti)
ios/              app iPhone nativa (SwiftUI)
scripts/          migrazioni e preparazione dei pacchetti desktop
```

</details>

<details>
<summary><b>Sistema di design</b></summary>

<br/>

Un unico sistema di token (colori, ombre, raggi) in `src/app/globals.css`, con la regola
degli **angoli concentrici**: il raggio di un contenitore è quello dei suoi controlli più
la distanza dal bordo (controlli 12px · card `rounded-card` 28px con padding 16px ·
finestre `rounded-sheet` 32px con padding 20px). Tutte le pagine usano `Page` e
`PageHeader` (`src/components/shared/Page.tsx`) per margini, larghezze e titoli uniformi.
L'app desktop usa lo stesso sistema con un proprio design, attivato solo al suo interno.

</details>

## Novità e versioni

La versione segue il versionamento semantico ed è in `src/lib/version.ts` (allineata a
`package.json`). Le novità di ogni versione sono in `src/lib/changelog.ts` e compaiono
agli utenti nel riquadro **Novità**, su tutte le piattaforme.

Un tag `vX.Y.Z` fa partire GitHub Actions, che crea i pacchetti macOS e Windows e li
pubblica nella [pagina delle release](https://github.com/thomas-addamo/dieffe-preventivi/releases).

## Licenza

© 2026 Dieffe Ristrutturazioni. Tutti i diritti riservati.<br/>
Codice consultabile pubblicamente; non è concesso il riutilizzo senza autorizzazione scritta.
