# Dieffe Preventivi per iPhone

App iPhone personale, da installare sui propri dispositivi con un Apple ID
gratuito. Non serve l'Apple Developer Program e l'app non passa dall'App Store.

## Come è fatta

- **Tab bar nativa** (Liquid Glass): Home, Clienti, Listino, Altro, più il tasto
  **＋** per un nuovo preventivo. Un secondo tap su una sezione torna alla sua
  pagina iniziale.
- **Schermate native (SwiftUI):**
  - **Home:** statistiche, aperti di recente, archivio con ricerca, filtri per
    stato e cliente, ordinamento, lavori extra sotto il loro preventivo; scorri
    a sinistra per spostare nel cestino.
  - **Clienti:** elenco con ricerca e ordinamento, scheda con Chiama,
    Messaggio, Email e Indicazioni, preventivi collegati, nuovo e modifica.
  - **Nuovo preventivo** (titolo, cliente, cantiere) e **Importa da file** (PDF,
    Word, Excel: l'AI del sito ricava sezioni e voci).
  - **Editor dei preventivi:** intestazione, sezioni (anche opzionali e a
    corpo) e voci con descrizione formattata, quantità, unità, prezzo, sconto,
    note e foto; aggiunta dal listino, suggerimenti AI (testo e prezzo),
    duplica, riordina, elimina; totali con sconto e IVA; stato, PDF, Excel,
    CSV, link per il cliente con PIN, lavori extra, blocco (admin), cestino.
    Salvataggio automatico. "Apri nel sito" per chat AI e riassegnazione.
  - **Listino** (sezione a sé): riepilogo (attive, fissate, mai usate,
    disattivate), categorie del catalogo, sottocategorie, scheda della voce
    con utilizzo; ricerca in tutto il listino, nuova voce, modifica,
    attiva/disattiva, fissa, elimina.
  - **Profilo** (tasto in alto a sinistra nella Home, o da Altro): aspetto
    chiaro/scuro, Face ID, cambio password, Esci.
  - **Altro:** Aiuto (assistente AI e messaggio all'amministratore), App
    iPhone e i collegamenti alle altre pagine.
  - **Accesso** con email e password, compatibile con il riempimento automatico
    delle password.
- Le schermate native usano le API JSON del sito (`/api/app/*`,
  `/api/clients`, `/api/quotes`, `/api/price-list`).
- **Ancora web** (`WKWebView`, dentro Altro con titolo e "indietro" nativi):
  lavori extra, statistiche, comunicazioni, cestino, impostazioni azienda,
  utenti e pagine di amministrazione. Il sito riconosce l'app dallo User-Agent `DieffeiOS/x.y`,
  nasconde la propria tab bar e segnala all'app ogni cambio di pagina: le
  pagine che hanno una versione nativa si aprono in nativo.
- **PDF, Excel e CSV** si aprono nell'anteprima di sistema (Quick Look), con
  Condividi, Salva su File, AirDrop e Stampa.
- **Face ID** all'apertura e dopo un minuto in background. Nel selettore app il
  contenuto è coperto.
- **Badge** con le notifiche non lette, tirare verso il basso per aggiornare,
  schermata nativa quando si è offline.
- **Impostazioni native**: *Altro › App iPhone*.

Prossime fasi: le pagine di Altro ancora web (statistiche, comunicazioni,
cestino, lavori extra, amministrazione).

```
ios/
├── project.yml              progetto (XcodeGen) → genera Dieffe.xcodeproj
├── Config/
│   ├── App.xcconfig         indirizzo del sito, identificativo
│   └── Signing.example.xcconfig   modello per la tua firma personale
└── Dieffe/
    ├── App/                 avvio, tab bar, stato condiviso, instradamento
    ├── Data/                API del sito, modelli, archivi dei dati
    ├── Native/              schermate SwiftUI (Home, Clienti, Nuovo,
    │                        Importa, Accesso), Face ID, impostazioni
    ├── Web/                 WKWebView, download, messaggi sito ↔ app
    └── Resources/           icona Liquid Glass (AppIcon.icon), logo, colore
```

## Primo avvio, passo per passo

Ti servono un Mac con macOS 26 o successivo, l'iPhone (iOS 26 o successivo) e
il cavo.

### 1. Installa Xcode e gli strumenti

1. Installa **Xcode** dal Mac App Store e aprilo una volta per completare
   l'installazione dei componenti.
2. Apri il **Terminale** e installa Homebrew (se non l'hai già) seguendo
   <https://brew.sh>.
3. Installa XcodeGen: `brew install xcodegen`

### 2. Collega il tuo Apple ID

1. Xcode › **Impostazioni** (⌘,) › **Account** › **＋** › *Apple ID*. Accedi con
   il tuo Apple ID.
2. Comparirà un team **"Il tuo nome (Personal Team)"**.
3. Non serve altro per ora: il Team ID lo recuperiamo al punto 5.

### 3. Scarica il progetto

```sh
git clone https://github.com/thomas-addamo/dieffe-preventivi.git
cd dieffe-preventivi/ios
cp Config/Signing.example.xcconfig Config/Signing.xcconfig
xcodegen                            # crea Dieffe.xcodeproj
open Dieffe.xcodeproj
```

Il file `Signing.xcconfig` resta solo sul tuo Mac e non finisce nel
repository.

### 4. Prepara l'iPhone

1. Collega l'iPhone al Mac con il cavo, sbloccalo e tocca **Autorizza** su
   "Vuoi autorizzare questo computer?".
2. Su iPhone: **Impostazioni › Privacy e sicurezza › Modalità sviluppatore** ›
   attiva e riavvia. La voce compare dopo aver collegato l'iPhone a Xcode.

### 5. Installa l'app

1. In Xcode, in alto al centro, scegli il tuo **iPhone** come destinazione.
2. Seleziona il progetto **Dieffe** › target **Dieffe** › **Signing &
   Capabilities** › **Team**: scegli *Il tuo nome (Personal Team)*. Se Xcode
   segnala che l'identificativo è già in uso, aggiungi un suffisso tuo in
   *Bundle Identifier* (es. `it.dieffe.preventivi.thomas`).
3. Salva la scelta, così sopravvive a ogni `xcodegen`. Nel Terminale, dentro
   `ios/`, esegui `grep -m1 DEVELOPMENT_TEAM Dieffe.xcodeproj/project.pbxproj`.
   Copia il codice di 10 caratteri in `Config/Signing.xcconfig`, alla voce
   `DIEFFE_TEAM_ID`. Se hai cambiato l'identificativo, copialo anche in
   `DIEFFE_BUNDLE_ID`.
4. Premi **▶︎ Run** (⌘R). La prima volta Xcode registra il dispositivo e crea
   il certificato.
5. Su iPhone, la prima volta: **Impostazioni › Generali › VPN e gestione
   dispositivi** › il tuo Apple ID › **Autorizza**.
6. Apri **Dieffe** dalla Home e fai l'accesso come sul sito.

## Aggiornare l'app

```sh
cd dieffe-preventivi && git pull
cd ios && xcodegen && open Dieffe.xcodeproj    # poi ⌘R con l'iPhone collegato
```

Le modifiche al **sito** arrivano subito nell'app, senza reinstallare. Serve
reinstallare solo quando cambia il codice della cartella `ios/`.

## Limiti dell'Apple ID gratuito

- **La firma scade dopo 7 giorni.** Dopo la scadenza l'app non si apre finché
  non la reinstalli con ⌘R dal Mac. I dati e l'accesso restano.
- Puoi installare al massimo **3 app** firmate così per dispositivo.
- Niente notifiche push di sistema (APNs). Il badge sull'icona invece funziona.

**Rinnovo automatico (facoltativo).** [SideStore](https://sidestore.io)
rinnova la firma ogni settimana direttamente dall'iPhone, senza Mac. Esporta
l'archivio da Xcode (Product › Archive › Distribute App › Custom › Release
Testing) e installa il file `.ipa` con SideStore.

## Sviluppo

- **Ispezionare le pagine:** con l'app in Debug, apri Safari sul Mac ›
  Sviluppo › il tuo iPhone › Dieffe. Le pagine si ispezionano come sul web.
- **Cambiare server** (ad esempio un'anteprima Vercel): `DIEFFE_BASE_URL` in
  `Config/App.xcconfig` oppure in `Signing.xcconfig`.
- **Icona:** è la stessa icona Liquid Glass dell'app Mac (`assets/icon.icon`,
  formato Icon Composer). Dopo averla cambiata, dalla radice del repository:
  `node scripts/ios/gen-ios-icon.mjs`.
- **Autotest (build Debug):** `xcrun simctl launch booted it.dieffe.preventivi
  -DieffeSelfTest YES` prova contro il server, con l'account già connesso,
  creazione e salvataggi di preventivo, sezioni, voci, foto, link, extra,
  blocco, clienti e listino, poi elimina tutto. Risultato in
  `Documents/selftest.log` del contenitore dell'app.
- **Controllo automatico:** GitHub Actions (*Build app iPhone*) compila l'app
  senza firma a ogni modifica della cartella `ios/`.
