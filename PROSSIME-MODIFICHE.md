# Prossime modifiche — Dieffe Preventivi

> **File condiviso tra tutte le sessioni di Claude su questo progetto.**
> Ogni sessione lo legge **per intero** prima di iniziare e lo aggiorna quando prende in carico o chiude una voce.
> Schermate di riferimento: `docs/prossime-modifiche/`.

### Quadro d'insieme (aggiornato al 2026-11-21, 4.8.3 online)
| Voce | Cosa | Stato | Versione |
|---|---|---|---|
| A1 | Riepilogo che non scorre | ✅ Fatto, verificato in produzione | 4.6.1 |
| A2 | Togliere "Riassegna" | ✅ Fatto, verificato in produzione | 4.6.2 |
| A3 | Tasto "Vai al cantiere" | ✅ Fatto, verificato in produzione | 4.7.0 |
| A4 | Archivio cantieri su iPhone | ✅ Fatto, verificato sul simulatore | 4.7.0 |
| A5 | SAL e avanzamenti | ✅ Fatto; collegamento SAL ↔ fase da provare a mano | 4.7.0 + 4.7.1 |
| A6 | Barra del preventivo compatta | ✅ Fatto, verificato in produzione | 4.7.0 |
| A7 | SAL per ogni preventivo (anche extra) | 🧪 In test: online, da confermare con l'utente | 4.8.0 |
| A8 | Stato cantiere "Da avviare" | ✅ Fatto, verificato in produzione | 4.8.1 |
| A9 | Notifiche cancellate dopo 30 giorni | 🧪 Online; controllo dopo la prima notte | 4.8.3 |
| B1 | Blocco automatico dei preventivi | 🧪 In test: verificato da admin ed editor; manca il 423 via API | 4.8.0 + 4.8.1 |
| B2 | Correzione automatica con IA | 🧪 In test: online, da provare nell'uso reale | 4.8.0 |
| B3 | Documenti PDF nel cantiere | 🧪 In test: caricamento e apertura verificati; manca il PDF grande | 4.8.0 → 4.8.2 |
| C1–C3 | Restyling (solo sito e Mac) | 🚀 Pubblicato il 22/11; controllo in produzione da fare | 4.9.0 |
| D1 | Sopralluogo con IA vocale | 📋 Da fare (prima lo studio) | — |
| D2 | iPhone: menu laterale al posto di "Altro" | 📋 Da fare (prima il mockup) | — |

---

## 0. Regole per tutte le sessioni

### 0.1 Come si lavora una voce
1. Leggi tutto il file: cosa è in programma, cosa è già in lavorazione, le decisioni prese (§5).
2. Prendi **la prima voce `📋 Da fare` della prima fase non ancora completata** (A → B → C → D), salvo diversa indicazione dell'utente.
3. Segna la voce `🔧 In corso`, con branch e data.
4. **Fai l'analisi del database del §0.3 prima di progettare** e scrivine il risultato nel campo "Analisi DB" della voce.
5. Studia il codice indicato in "Dove". Se la voce richiede scelte di design o di prodotto, **proponi all'utente prima di implementare**, includendo l'analisi DB.
6. Implementa su **sito, desktop (macOS/Windows) e iPhone**, salvo indicazione diversa nella voce.
7. Esegui **tutti i test del §0.2** e la checklist specifica della voce, compresa la verifica DB "dopo".
8. Chiudi la voce: `✅ Fatto`, versione, una riga sull'esito. Poi spostala in §6.
9. Non lavorare su una voce che un'altra sessione ha `🔧 In corso` senza chiedere all'utente.

Stati: `📋 Da fare` · `🔧 In corso` · `⏸️ In pausa` · `🧪 In test` · `✅ Fatto`

### 0.2 Test obbligatori (definizione di "fatto")
Nessuna voce è chiusa senza questi controlli, con l'esito scritto nella voce.

**Funzionali**
- [ ] Il caso principale funziona dall'inizio alla fine con dati reali o di seed.
- [ ] Casi limite: dati vuoti, valori molto lunghi, permessi diversi (admin / utente normale), utente offline o rete lenta.
- [ ] Nessuna regressione nelle schermate vicine: dashboard, editor preventivo, cantieri, PDF.
- [ ] `pnpm lint` e build (`next build`) senza errori; per iPhone, build Xcode senza errori.

**Grafici**
- [ ] Screenshot **prima / dopo** nel browser integrato, a larghezza desktop (≥1280px), tablet (768px) e telefono (375px).
- [ ] Tema chiaro e scuro.
- [ ] App desktop (Electron): stessa schermata controllata.
- [ ] iPhone nel Simulatore: screenshot della schermata, scorrimento, tab bar, tastiera aperta.
- [ ] Niente testi tagliati, sovrapposti, scorrimenti bloccati o scorrimento orizzontale indesiderato.

**Efficienza**
- [ ] La pagina non diventa più lenta: niente richieste in più inutili, niente ricaricamenti in loop (controllare la scheda Rete e la console).
- [ ] Le funzioni IA hanno un limite di frequenza (debounce) e non partono a ogni tasto.

**Database (dopo l'implementazione)**
- [ ] Rifare le misure del §0.3 e confrontarle con quelle "prima": tempi delle query, numero di query per pagina, dimensione delle tabelle.
- [ ] Nessuna nuova query lenta e nessuna scansione completa su tabelle grandi dove serve un indice.
- [ ] Le migrazioni Drizzle sono reversibili o hanno un piano di rientro, e non perdono dati esistenti.

**Rilascio**
- [ ] Versione aggiornata e voce nel changelog. `important: true` solo per i rilasci grandi (vedi memoria "Novità solo se importanti").

### 0.3 Analisi del database prima di progettare (obbligatoria per ogni voce)
Prima di progettare una funzionalità si misura sui dati reali quanto pesa sul DB e come renderla più efficiente. L'esito va nel campo **"Analisi DB"** della voce e viene mostrato all'utente insieme alla proposta.

**Strumenti:** connettore Neon (statistiche e query in sola lettura), `pnpm db:studio`, schema in `src/lib/db/schema.ts`.
**Sicurezza:** sul DB di produzione si fanno solo letture (SELECT, EXPLAIN). Le prove di scrittura o migrazione si fanno su un **branch Neon** separato, mai sulla produzione.

**1. Statistiche di partenza**
- Tabelle coinvolte: numero di righe, dimensione (dati e indici), crescita stimata (righe al mese).
- Indici esistenti sulle tabelle coinvolte e quanto vengono usati; indici mai usati o duplicati.
- Query lente esistenti che toccano quelle tabelle.

**2. Impatto della nuova funzionalità**
- Quali query nuove o modificate servono, per quale schermata, e quante volte vengono eseguite (per apertura pagina, per utente, al giorno).
- `EXPLAIN ANALYZE` delle query previste sui dati reali: tempo, righe lette, uso degli indici.
- Nuove colonne o tabelle: spazio stimato e crescita (es. allegati, audio, log IA).
- Rischi: query N+1, conteggi pesanti in dashboard, blocchi in scrittura, file pesanti salvati nel DB invece che nello storage.

**3. Ottimizzazioni proposte**
- Indici da aggiungere o rimuovere, query da unire, dati da precalcolare o tenere in cache, paginazione, colonne da non caricare.
- Pulizia di dati inutili o vecchi collegati alla funzionalità.

**4. Risultato da scrivere nella voce**
```
Analisi DB (data):
- Tabelle: <nome> <righe> / <dimensione>
- Query previste: <n> per <schermata>, tempo stimato <ms>
- Impatto: basso / medio / alto, perché
- Ottimizzazioni: <elenco>
- Dopo il rilascio: <misure di confronto>
```

---

## 1. Fase A — Tempi brevi: bug e correzioni rapide

Da fare per prime: sono bug che bloccano il lavoro o modifiche piccole e già chiare.

### A1. Riepilogo del preventivo che non scorre fino in fondo  _(rif. utente: #7)_
- **Stato:** ✅ Fatto (4.6.1, 2026-11-21), verificato in produzione — branch `claude/project-changes-documentation-e7b724`
- **Causa trovata:** l'altezza massima del pannello era `100dvh - barra strumenti`, ma su desktop (≥1024px) a scorrere è il `<main>` sotto l'intestazione dell'app e gli eventuali banner. Il pannello quindi superava lo schermo di circa l'altezza dell'intestazione e la parte finale (Condizioni di pagamento) restava irraggiungibile. In più, il pulsante della chat IA copriva l'ultima riga.
- **Correzione:** altezza calcolata sul contenitore che scorre davvero (ricalcolata quando cambiano finestra, breakpoint o banner) e spazio in fondo (`pb-24`) per il pulsante della chat. File: `src/components/quote-editor/QuoteEditor.tsx`.
- **Piattaforme:** sito · desktop (verificare anche iPhone)
- **Cosa:** in alcuni preventivi, quelli con molte sezioni o con sezioni opzionali, il pannello "Riepilogo" a destra resta bloccato. Non si arriva a "Condizioni di pagamento" e ai campi sotto il totale.
- **Schermata:** `docs/prossime-modifiche/04-riepilogo-bloccato.png`
- **Dove:** `src/components/quote-editor/TotalsPanel.tsx`, `QuoteEditor.tsx` (altezza e overflow del pannello sticky).
- **Test specifici:** preventivo con oltre 10 sezioni e una opzionale; finestra bassa (altezza 700px); il bottone chat viola non deve coprire l'ultima riga.
- **Analisi DB (2026-11-21):** nessun impatto. La correzione è solo di layout e non aggiunge query: il riepilogo usa i dati già caricati con il preventivo. Caso di prova trovato con una query in sola lettura: **PREV-2026-007** (11 sezioni, 1 opzionale, 69 voci; è quello della schermata). Seguono PREV-2026-011 (8 sezioni) e PREV-2026-024 (7). Prima/dopo: invariato.
- **Esito:** bug riprodotto in produzione su PREV-2026-007 a 1440×820: pannello fino a 913px su 820, ultima riga a 897px, irraggiungibile. Con la formula nuova, applicata in pagina:
  - 1440×820: il pannello finisce a 820 e l'ultima riga (724) sta sopra la chat (748);
  - 1280×700: ultima riga a 598 su 700;
  - 900×700 (tablet, scorre la finestra): invariato e corretto.

  `tsc` e lint ok. **Non fatti:** `next build` locale (lancia le migrazioni sul DB; la build su Vercel è riuscita), tema scuro (nessun colore cambiato), app desktop Electron.
  - **Verifica in produzione (deploy `c526422`):** su PREV-2026-007 a 1440×820 l'altezza calcolata è 669px, il pannello finisce a 820 e l'ultima riga (724) è sopra la chat (748). ✅

### A2. Rimuovere completamente il tasto "Riassegna"  _(#4)_
- **Stato:** ✅ Fatto (4.6.2, 2026-11-21) — branch `claude/project-changes-documentation-e7b724`
- **Piattaforme:** sito · desktop · iPhone
- **Cosa:** togliere il tasto "Riassegna" da ogni preventivo: la barra in alto, il menu e l'eventuale equivalente su iPhone. Rimuovere anche il codice rimasto inutilizzato (dialog, API), senza toccare lo storico dell'audit log.
- **Dove:** `src/components/quote-editor/QuoteEditor.tsx` (righe ~1104 e ~1180), `src/lib/help-guide.ts`, `src/lib/notifications.ts`, `ios/Dieffe/App/AppModel.swift`.
- **Test specifici:** l'audit log con vecchie riassegnazioni si apre ancora; la guida non cita più il tasto.
- **Analisi DB (2026-11-21):** `users` 4 righe (48 kB); `audit_log` 159 righe, di cui **0** `quote.reassigned`; **0** notifiche `quote_assigned`: la funzione non è mai stata usata. Ottimizzazione: tolta la query `SELECT id, name FROM users ORDER BY name` che partiva a ogni apertura dell'editor da parte di un admin e serviva solo alla finestra Riassegna (una query in meno per apertura). Nessuna migrazione: il valore `quote_assigned` resta nell'enum delle notifiche e l'etichetta resta nell'audit log, per eventuali righe storiche, senza costi.
- **Esito:**
  - **Tolti:** il tasto nella barra, la voce nel menu ⋯, la finestra di scelta utente, l'API `PATCH /api/quotes/[id]/reassign`, `notifyQuoteAssigned`, la prop `users` dell'editor e la sua query. Testi aggiornati in guida, README iOS e commento in `AppModel.swift`.
  - **Su iPhone** non c'era un tasto nativo: rimandava al sito.
  - **Controlli:** `tsc` ok; lint senza nuovi avvisi (tolto anche l'import inutilizzato `DialogDescription`).
  - **Verifica in produzione (deploy `c569313`, admin):**
    - 1440×820: barra con Condividi, Esporta, Lavoro extra, Duplica, Blocca, senza Riassegna e senza scorrimento orizzontale;
    - 390×844: il menu ⋯ non contiene più Riassegna;
    - `/api/quotes/[id]/reassign` risponde 404. ✅
  - **Non verificato:** vista da utente normale, che però non aveva mai avuto il tasto (era solo per admin). Build Xcode non necessaria: in Swift è cambiato solo un commento.

### A3. Tasto "Vai al cantiere" su ogni preventivo  _(#12)_
- **Stato:** ✅ Fatto in 4.7.0 (2026-11-21, branch `claude/project-changes-documentation-e7b724`)
- **Piattaforme:** sito · desktop · iPhone
- **Cosa:** ogni preventivo ha un tasto che apre la scheda cantiere collegata. Se il cantiere non esiste ancora, il tasto spiega come crearlo, oppure lo crea se il preventivo è accettato.
- **Dove:** `QuoteEditor.tsx` (barra azioni), `src/lib/sites/`, `ios/Dieffe/Native/Editor/QuoteEditorView.swift` → `Sites/SiteDetailView.swift`.
- **Test specifici:** preventivo con cantiere, senza cantiere e in bozza; ritorno indietro corretto su iPhone.
- **Analisi DB:** 37 preventivi vivi, 23 con `site_id`, 22 cantieri (16 in corso, 6 conclusi). Il tasto legge `quotes.site_id` + `sites` con una join per chiave primaria (indici `quotes_site_id_idx`, pk): costo trascurabile, nessun indice nuovo. Solo se un preventivo inviato/accettato non ha ancora il cantiere si esegue subito `syncSites()` (una transazione).
- **Esito:** Nuova API `GET /api/quotes/:id/site` (`src/lib/sites/quote-site.ts`), usata da sito e iPhone. Sito/desktop: tasto **Cantiere** nella barra (da tablet in su) e voce **Vai al cantiere** nel menu ⋯ su telefono; senza cantiere il tasto spiega come nasce. Cambiando stato in Inviato/Accettato il tasto si aggiorna da solo. iPhone: voce **Vai al cantiere** in testa al menu Azioni dell'editor; il cantiere si apre in un foglio sopra il preventivo e «Fine» torna all'editor.
  - **Verifica in produzione (4.7.0):** sito a 1440 px, PREV-2026-007 → tasto Cantiere apre il cantiere giusto; iPhone 18 Pro (simulatore), PREV-2026-006 → «Vai al cantiere» apre il cantiere sopra l'editor e la freccia torna al preventivo. ✅
  - **Non verificato:** preventivo in bozza senza cantiere (messaggio di spiegazione), utente non admin.

### A4. iPhone: mostrare i lavori archiviati e finiti  _(#9)_
- **Stato:** ✅ Fatto in 4.7.0 (2026-11-21, branch `claude/project-changes-documentation-e7b724`)
- **Piattaforme:** iPhone (allineare a macOS)
- **Cosa:** su iPhone non si vedono in nessun modo i lavori archiviati e conclusi, che invece su macOS si vedono. Aggiungere un filtro o una sezione "Archiviati / Conclusi" con gli stessi criteri del sito.
- **Dove:** `ios/Dieffe/Native/Sites/SitesView.swift`, `ios/Dieffe/Native/Quotes/`, `ios/Dieffe/Data/Models.swift`; confrontare con il filtro web in `src/app/(app)/cantieri/` e `preventivi/`.
- **Test specifici:** gli stessi conteggi su macOS e iPhone; si apre un lavoro archiviato; i filtri restano dopo il riavvio dell'app.
- **Analisi DB:** Nessun impatto: l'archivio usa già `GET /api/sites/archive` (6 cantieri conclusi, 0 ritirati).
- **Esito:** Causa: il filtro **Archivio** esisteva ma era il 4° chip, fuori dallo schermo a destra e sotto mappa, KPI e consigli: di fatto invisibile. Ora: tasto **Archivio** fisso in alto a destra nella sezione Cantieri; in archivio si vede subito l'elenco (mappa e panoramica nascoste); il chip selezionato scorre in vista; il filtro scelto resta dopo il riavvio (`UserDefaults sites.filter`). I preventivi archiviati erano già visibili dal chip «Archiviati» della Home.
  - **Verifica (simulatore iPhone 18 Pro, dati di produzione):** un tocco sul tasto Archivio mostra subito i 6 cantieri conclusi. ✅ Installata sull'iPhone di Thomas.

### A5. SAL e avanzamenti del cantiere: studio e correzione dei bug  _(#8)_
- **Stato:** ✅ Fatto in 4.7.0 (2026-11-21, branch `claude/project-changes-documentation-e7b724`)
- **Piattaforme:** sito · desktop · iPhone
- **Cosa:** in ogni cantiere SAL e avanzamenti hanno bug seri. A volte non sono cliccabili e non sono collegati tra loro: per esempio un SAL "a fine Demolizioni" deve risultare raggiunto quando la fase Demolizioni è completata, e viceversa.
  1. **Studio di funzionalità:** mappare il flusso attuale (fasi → milestone SAL → fatturato → incassato) e scrivere in questa voce come funziona oggi e come deve funzionare.
  2. Elencare i bug trovati con i passi per riprodurli.
  3. Correggere, rendere coerenti i totali (Totale SAL, Da fatturare, Fatturato, Da incassare, barre %) e rendere tutti gli elementi cliccabili.
- **Schermata:** `docs/prossime-modifiche/05-sal-fatture.webp`. Esempio da verificare: due SAL segnati come "Fatturato" ma la card Fatturato mostra 0,00 €.
- **Dove:** `src/app/(app)/cantieri/[id]/MilestonesTab.tsx`, `PhasesTab.tsx`, `site-api.ts`, `src/lib/sites/`, `ios/Dieffe/Native/Sites/SiteSections.swift`.
- **Test specifici:** completare o annullare una fase e controllare l'aggiornamento del SAL; segnare e togliere Fatturato e Incassato e controllare card e barre; IVA corretta; stessi valori su sito e iPhone; aggiornamento senza ricaricare la pagina.
- **Analisi DB:** 27 SAL, 43 fasi, 7 SAL «a fine fase» (tutti con `phase_id`). Anomalie trovate nei dati: (a) 2 SAL fatturati+incassati ma non raggiunti (Palazzina Nasi, Capannone); (b) «Metà lavori» del cantiere Balconi raggiunto il 21/11 con la fase Demolizioni aperta e **non** fatturato. Ogni modifica di un SAL ora rilancia `recomputeSite` (3 letture per `site_id` indicizzato + scritture solo se cambia qualcosa): impatto trascurabile.
- **Esito:** Studio del flusso: fasi (peso = importo) → avanzamento; SAL con momento (accettazione, inizio lavori, fine fase, fine lavori, a mano) → raggiunto → fatturato → incassato; totali calcolati dalle righe (`metrics.ts`). Bug trovati e corretti:
  1. **La pillola arancione «Fatturato» voleva dire «da fatturare»** (è il caso della schermata: card Fatturato 0 € corretta, nessun SAL era fatturato). Ora l'etichetta dice «Da fatturare» / «Da incassare» quando manca il passo, e «Fatturato ✓» / «Incassato ✓» quando è fatto (sito e iPhone).
  2. **Togliere «Fatturato» lasciava il SAL raggiunto** anche se la fase non era finita (origine dell'anomalia Balconi). Ora ogni modifica ricalcola il cantiere.
  3. **«Incassato» senza «Fatturato» non segnava il SAL raggiunto.** Corretto; i dati vecchi incoerenti si sistemano da soli al primo ricalcolo.
  4. **SAL «a fine fase» e fase non erano collegati nei due sensi**: ora segnare raggiunto (o fatturare) il SAL completa la fase, annullarlo la riapre.
  5. **Pallini non cliccabili**: ora si cliccano per i SAL a mano e a fine fase (con tooltip); per gli altri il tooltip spiega quando scattano.
  6. Le card dei totali si aggiornano subito, senza aspettare il server.
  7. **(4.7.1)** I SAL fatturati o incassati con dati vecchi risultavano «non ancora raggiunto»: ora il dettaglio li mostra raggiunti (verificato in produzione sul cantiere Palazzina Nasi). ✅
  - **Da provare a mano** (non fatto per non modificare dati veri): segnare raggiunto un SAL «a fine fase» e controllare che la fase si completi, poi annullare. Il SAL «Metà lavori» del cantiere Balconi, segnato per errore, torna a posto alla prima modifica di quel cantiere.

### A6. Barra dei tasti del preventivo che esce dalla pagina  _(#13, aggiunta il 2026-11-21)_
- **Stato:** ✅ Fatto in 4.7.0 (2026-11-21, branch `claude/project-changes-documentation-e7b724`)
- **Piattaforme:** sito · desktop (controllare anche iPhone e tablet)
- **Cosa:** quando i tasti sono tanti (stato, Condividi, Esporta, Lavoro extra, Duplica, Elimina, Blocca, Riassegna…) la barra degli strumenti dell'editor esce dalla pagina, a destra oltre il riepilogo. Bisogna ripensare e **compattare** la barra:
  - le azioni principali restano visibili (stato, Condividi, Esporta);
  - le secondarie (Lavoro extra, Duplica, Blocca, Elimina…) passano in un menu "Altro" (⋯);
  - sotto una certa larghezza, solo icone con tooltip;
  - la barra non deve **mai** superare la larghezza disponibile: prevedere un passaggio automatico al menu in base allo spazio, non solo a breakpoint fissi.
- **Dipendenze:** farla **dopo A2** (toglie "Riassegna") e **insieme ad A3** (aggiunge "Vai al cantiere"), così si progetta la barra con l'elenco definitivo dei tasti. Proporre all'utente la disposizione prima di implementare.
- **Schermata:** `docs/prossime-modifiche/06-barra-tasti-preventivo.webp`
- **Dove:** `src/components/quote-editor/QuoteEditor.tsx` (barra `toolbarRef`, righe ~920–1210, menu `DropdownMenu` già presente).
- **Test specifici:**
  - larghezze 1024, 1280, 1440 e 1920, con barra laterale aperta e chiusa;
  - preventivo con tutti i tasti possibili (admin, lavoro extra, bloccato, accettato);
  - utente con pochi permessi;
  - scorciatoie da tastiera e menu dell'app desktop ancora funzionanti;
  - nessuno scorrimento orizzontale della pagina.
- **Analisi DB:** Nessun impatto.
- **Esito:** Barra da tablet in su: stato, Condividi, Esporta, Cantiere e menu **⋯ Altre azioni** (Lavoro extra, Duplica, Blocca/Sblocca, Elimina). Compattazione automatica misurando lo spazio reale (ResizeObserver con isteresi, non breakpoint): quando non ci sta, i tasti restano solo icone con tooltip. Telefono invariato (menu ⋯). Scorciatoie e menu dell'app desktop (`useMenuParam`) invariati.
  - **Verifica in produzione (4.7.0):** PREV-2026-007 con barra laterale aperta: a 1024 px solo icone (3 etichette nascoste), a 1280 e 1440 px etichette complete; mai scorrimento orizzontale. ✅
  - **Dalla 4.8.0** il menu ⋯ contiene anche «Riblocca» / «Richiedi sblocco» (vedi B1).
  - **Non verificato:** 1920 px, utente con pochi permessi, app desktop Electron.

### A7. iPhone: aggiungere i SAL (stato avanzamento lavori) per ogni preventivo  _(#14, aggiunta il 2026-11-21)_
- **Stato:** 🧪 In test — online dalla 4.8.0 (2026-11-21, branch `claude/project-changes-documentation-e7b724`): **confermare con l'utente** che era questo il problema
- **Piattaforme:** sito · desktop · iPhone
- **Cosa:** su iPhone non si riesce ad aggiungere lo stato avanzamento lavori per ciascun preventivo. Da verificare con l'utente cosa manca esattamente; ipotesi emerse dal codice:
  - oggi né sito né iPhone permettono di scegliere **a quale preventivo** (principale o lavoro extra) appartiene un SAL aggiunto a mano: la percentuale si calcola sempre sul principale (`createEntity` in `src/lib/sites/entities.ts` non riceve `quoteId`);
  - ~~sui cantieri "in attesa" l'iPhone non mostra la sezione SAL~~ — verificato: la sezione c'è (ipotesi scartata);
  - dall'editor del preventivo su iPhone non c'è un accesso diretto ai suoi SAL (ora c'è "Vai al cantiere", A3).
- **Dove:** `ios/Dieffe/Native/Sites/SiteSections.swift` (`MilestoneAddSheet`), `SiteDetailView.swift`, `src/lib/sites/entities.ts` (campo `quoteId` nella creazione), `MilestonesTab.tsx`.
- **Test specifici:** SAL a percentuale su un lavoro extra (importo calcolato sull'extra, non sul principale); SAL aggiunto da iPhone visibile sul sito e viceversa; cantiere in attesa.
- **Analisi DB:** Nessuna colonna nuova: `site_milestones.quote_id` esisteva già ma non si poteva impostare. 1 preventivo extra su 37.
- **Esito:** Aggiungendo un SAL si sceglie il preventivo (principale o lavoro extra) su cui calcolare la percentuale: sito (tendina, che compare solo con più preventivi) e iPhone (selettore nel foglio «Nuovo SAL», ora anche a tutta altezza). Il server verifica che il preventivo appartenga al cantiere. Sul sito i SAL di un extra mostrano il suo numero.

### A8. Stato del cantiere che resta "Da avviare"  _(#15, aggiunta il 2026-11-21, priorità alta)_
- **Stato:** ✅ Fatto in 4.8.1 (2026-11-21), verificato in produzione — branch `claude/project-changes-documentation-e7b724`
- **Piattaforme:** sito · desktop · iPhone (lo stato lo calcola il server)
- **Cosa:** ogni cantiere, anche avviato e avanzato, dice "Da avviare". Lo stato deve aggiornarsi da solo.
- **Causa:** `computeSiteMetrics` (`src/lib/sites/metrics.ts`) dà "Da avviare" a ogni cantiere senza **data di inizio lavori**, che si inseriva solo a mano in «Tempi e costi»: in produzione nessun cantiere ce l'ha (es. "Ristrutturazione alloggio" al 91% risultava da avviare).
- **Analisi DB:** 13 cantieri attivi, 0 con `start_date`; 2 aperti con fasi già completate (91,2% e 18,7%). Correzione: una scrittura per cantiere, solo quando cambia.
- **Esito:** `recomputeSite` imposta da solo la data di inizio (giorno della prima fase completata) se manca, poi mette in calendario le fasi e la fine prevista: lo stato passa a In corso / In ritardo e scattano i SAL «a inizio lavori». In più `computeSiteMetrics`: avanzamento > 0 senza data → «In corso» (mai più «Da avviare» con lavoro fatto; test aggiunto). I cantieri già avviati si sistemano alla prima apertura (`healSiteStart`, sito e API dell'iPhone). La data si può sempre cambiare a mano da «Tempi e costi».
  - **Verifica in produzione (deploy `59b2c19`):** alla prima apertura "Ristrutturazione alloggio" ha preso inizio 21/11 e fine prevista 22/12 (4 fasi in calendario) e "Palazzina Nasi" inizio 18/11 e fine 21 lug (10 fasi in calendario): entrambi «In tempo» su sito, API e iPhone (simulatore), in verde sulla mappa. Gli altri cantieri attivi restano «Da avviare» perché sono allo 0%. ✅
  - **Nota per l'utente:** la fine prevista si calcola dalle durate delle fasi stimate dall'IA; se non è realistica si corregge in «Tempi e costi».


### A9. Notifiche cancellate dal DB dopo 30 giorni  _(#16, aggiunta il 2026-11-21)_
- **Stato:** 🧪 Online dalla 4.8.3 (2026-11-21, deploy `9655d8a`, branch `claude/project-changes-documentation-e7b724`)
- **Piattaforme:** server (vale per sito, desktop e iPhone, che leggono le stesse notifiche)
- **Cosa:** le notifiche (campanella) devono essere eliminate dal database dopo 30 giorni.
- **Situazione attuale:** il cron notturno `GET /api/cron/cleanup-trash` (ogni giorno alle 2:00, `vercel.json`) cancella già le notifiche, ma solo quelle **lette** da più di **90 giorni** (`read_at < now() - 90 giorni`); le non lette restano per sempre.
- **Deciso con l'utente (2026-11-21):** 30 giorni dalla creazione per **tutte** le notifiche, anche le non lette.
- **Dove:** `src/app/api/cron/cleanup-trash/route.ts` (righe ~51–55), eventuale testo in `NotificationsView.swift` / pannello notifiche del sito («le notifiche restano 30 giorni»).
- **Test specifici:** il cron cancella solo le notifiche più vecchie di 30 giorni; le richieste di sblocco (B1) in attesa non perdono il loro stato (vive in `quotes.unlock_requested_at`, non nella notifica); badge «non lette» corretto su sito e iPhone dopo la pulizia.
- **Analisi DB (2026-11-21):** `notifications` 66 righe, 120 kB, circa 0,4 nuove al giorno (la più vecchia è dell'11/06/2026); **39 più vecchie di 30 giorni**, che verrebbero cancellate al primo giro; 2 non lette in totale, nessuna non letta più vecchia di 30 giorni. Indici esistenti: `notifications_user_id_idx`, `notifications_user_read_idx (user_id, read_at)`. Una cancellazione per `created_at` su tutta la tabella oggi è trascurabile (66 righe); se la tabella crescerà, valutare un indice su `created_at`. Nessuna migrazione necessaria.
- **Esito:** nel cron notturno la regola «lette da più di 90 giorni» è sostituita da `created_at < oggi − 30 giorni` (stessa data già usata dal cron per il cestino). Prova sul ramo Neon di prova (poi eliminato con l'ok dell'utente): 56 notifiche cancellate su 78, 22 restano; la cancellazione richiede 1,7 ms (scansione sequenziale di una tabella minuscola: indice su `created_at` non necessario ora). Effetto in produzione al primo giro dopo il rilascio (alle 2:00): circa 39 notifiche su 66.
  - **Da verificare dopo il rilascio:** la mattina dopo, contare le notifiche più vecchie di 30 giorni (devono essere 0) e controllare il badge su sito e iPhone.
---

## 2. Fase B — Medio termine: nuove funzioni

### B1. Blocco automatico dei preventivi conclusi, rifiutati e inviati  _(#1)_
- **Stato:** 🧪 In test — 4.8.0 (2026-11-21, branch `claude/project-changes-documentation-e7b724`): da verificare in produzione
- **Piattaforme:** sito · desktop · iPhone
- **Cosa:**
  | Stato del preventivo | Blocco | Chi può sbloccare |
  |---|---|---|
  | Accettato **e** lavori conclusi | automatico, solo lettura | **solo admin**; gli utenti possono **richiedere lo sblocco** |
  | Rifiutato | automatico, solo lettura | solo admin, su richiesta |
  | Inviato | automatico, solo lettura | **l'utente stesso**, in autonomia |
- **Note:** esistono già `isLocked`, `lockedBy`, `lockedAt` e le notifiche `quote_locked`/`quote_unlocked` (`src/lib/db/schema.ts`): partire da lì. Serve un flusso "Richiedi sblocco" → notifica all'admin → approva/rifiuta. ~~Da definire cosa vuol dire "lavori conclusi"~~ → deciso il 2026-11-21: cantiere chiuso con «Concludi lavori» (vedi §5).
- **Dove:** `schema.ts`, `src/lib/permissions/`, `src/lib/notifications.ts`, dashboard, `QuoteEditor.tsx`, editor iPhone.
- **Test specifici:** tutti i passaggi di stato; un utente non può modificare via API un preventivo bloccato (test lato server, non solo interfaccia); richiesta → notifica → sblocco; icona lucchetto visibile in elenco e nell'editor.
- **Analisi DB:** 37 preventivi vivi: con il blocco automatico 25 diventano sola lettura (9 inviati, 9 rifiutati, 7 accettati con lavori conclusi). Il blocco NON si salva per riga: si calcola da `status`, `works_completed_at`, `is_locked` e dal nuovo `lock_override_at` (4 colonne nuove in `quotes`, nessun indice: si leggono sempre per chiave primaria). Migrazione `0018` provata su un ramo Neon di prova.
- **Esito:** "Lavori conclusi" = cantiere chiuso con «Concludi lavori» (`works_completed_at`). Regole in `src/lib/quote-lock.ts` (6 test): inviato → lo sblocca chi può modificarlo; rifiutato, lavori conclusi e blocco manuale → solo admin, gli altri usano **Richiedi sblocco** (notifica agli admin, che approvano sbloccando o rifiutano). Lo sblocco vale finché non cambia lo stato o si concludono i lavori, poi si riblocca da solo; c'è anche «Riblocca». Il server rifiuta le modifiche dei non-admin (423); un inviato bloccato può comunque passare ad accettato/rifiutato. Sito: banner con i tasti, lucchetto accanto al codice, editor tutto in sola lettura tramite `QuoteReadOnlyContext`. iPhone: stesso banner e menu (`lock` in GET /api/quotes/:id).
  - **Verifica in produzione (4.8.0, admin):** sito, PREV-2026-006 (inviato): banner «Preventivo inviato» con Sblocca, lucchetto accanto al codice, titolo, note e descrizioni in sola lettura. ✅ iPhone (simulatore): banner con Sblocca; **Sblocca** rende il preventivo modificabile (`lock_override_at` impostato nel DB) e **Riblocca** dal menu lo riporta bloccato (DB tornato com'era). ✅
  - **Problemi trovati e corretti in 4.8.1 (online dal 21/11):**
    1. sbloccare e ribloccare un «inviato» mandava una notifica al titolare (2 notifiche di prova arrivate a Riccardo Addamo il 21/11): ora si notificano solo i blocchi e gli sblocchi decisi dall'admin;
    2. su iPhone il tasto Sblocca non mostrava l'icona del lucchetto (restava uno spazio vuoto): corretto anche per «Richiedi sblocco».
  - **Verifica nell'uso reale (audit log, 21/11 14:00):** Riccardo Addamo (editor) ha chiesto lo sblocco di PREV-2026-056 (rifiutato) → notifica all'admin → richiesta rifiutata → notifica «Sblocco non concesso» a Riccardo. Il flusso funziona anche da non admin. ✅
  - **Non verificato:** il rifiuto lato server (423) di una modifica fatta via API da un non admin; il percorso «Approva e sblocca».

### B2. Correzione automatica con IA di titoli, note e descrizioni  _(#3)_
- **Stato:** 🧪 In test — 4.8.0 (2026-11-21, branch `claude/project-changes-documentation-e7b724`): da verificare in produzione
- **Piattaforme:** sito · desktop · iPhone
- **Cosa:** dopo un tempo di inattività **scelto dall'utente** (predefinito 3 secondi) l'IA sistema maiuscole iniziali, punteggiatura e refusi in:
  - titolo del preventivo
  - voci / descrizioni
  - note
  In Impostazioni: il tempo di attesa e **un interruttore separato** per ciascun tipo di campo.
- **Note:** la correzione non deve cambiare il significato né le cifre. Deve essere annullabile (Cmd+Z o "Annulla correzione") e mai attiva mentre l'utente sta scrivendo. Correzioni semplici (maiuscola iniziale) in locale senza IA; l'IA solo per il resto, per contenere i costi.
- **Dove:** `src/lib/editor-prefs.ts`, `src/app/(app)/impostazioni/ImpostazioniClient.tsx`, `src/lib/ai/`, `QuoteHeaderForm.tsx`, `QuoteEditor.tsx`.
- **Test specifici:** tempo 1, 3 e 10 s; interruttori spenti → nessuna chiamata; il cursore non salta durante la correzione; numero di chiamate IA per preventivo.
- **Analisi DB:** Nessun impatto sul DB: le preferenze stanno sul dispositivo; le chiamate IA passano da `/api/ai/proofread` (già esistente) con cache per testo, e solo per testi di almeno 3 parole modificati dall'utente (i testi già salvati non si toccano all'apertura).
- **Esito:** Correzioni locali sicure (`src/lib/autocorrect-text.ts`, 6 test: maiuscola iniziale anche negli elenchi, spazi doppi, spazi prima/dopo la punteggiatura; cifre, a capo e marcatori intatti) + IA per refusi e grammatica. Il server scarta la correzione se l'IA cambia cifre o marcatori. Si annulla dalla notifica («Annulla») e il testo annullato non viene più ricorretto. Cursore: nei campi semplici resta al suo posto, nelle descrizioni (editor ricco) la correzione si applica uscendo dal campo. Impostazioni → Assistenza alla scrittura: tre interruttori (titolo, descrizioni, note) e attesa 1–10 s (predefinita 3); sostituisce il vecchio interruttore «Miglioramento automatico» che non era collegato a nulla. iPhone: stessi campi e impostazioni in Profilo.
  - **Non ancora provata nell'uso reale:** scrivere un titolo o una nota, aspettare 3 s e controllare correzione, «Annulla» e numero di chiamate IA (scheda Rete).

### B3. Allegati PDF nel cantiere  _(#11)_
- **Stato:** 🧪 In test — 4.8.0 (2026-11-21, branch `claude/project-changes-documentation-e7b724`): da verificare in produzione
- **Piattaforme:** sito · desktop · iPhone
- **Cosa:** nuova sezione "Documenti" in Gestione Cantieri. Per ogni cantiere si caricano PDF (permessi, progetti, contratti…) che si aprono direttamente nell'app, anche su iPhone, con anteprima.
- **Dove:** nuova scheda accanto a `PhotosTab.tsx`; storage come per le foto (`src/lib/cloudinary.ts` o alternativa); `ios/Dieffe/Native/Sites/`.
- **Test specifici:** PDF grande (20 MB), nome lungo, eliminazione, permessi, apertura offline su iPhone se prevista.
- **Analisi DB:** Nuova tabella `site_documents` (solo riferimenti, ~200 byte a riga) con indice `(site_id, created_at)`: lettura del dettaglio cantiere 0,03 ms (EXPLAIN ANALYZE sul ramo di prova). I file stanno su Cloudinary (tipo raw), non nel DB.
- **Esito:** Scheda **Documenti** (sito, desktop, iPhone): PDF fino a 25 MB caricati direttamente su Cloudinary con firma del server (niente limite dei 4,5 MB delle funzioni Vercel), poi registrati dopo una verifica lato server di esistenza e peso. Anteprima nell'app (sito: finestra con il PDF; iPhone: Quick Look, il file resta in cache e si riapre offline), rinomina (sito), eliminazione (autore o admin), trascinamento dei file sul sito. API: `POST /api/sites/:id/documents/sign`, `POST /api/sites/:id/documents`, `PATCH|DELETE /api/sites/:id/documents/:docId`; `documents` nel dettaglio del cantiere. Verifica in produzione (4.8.0): caricamento, registrazione, rifiuto di file di altre cartelle (400) ed eliminazione OK; l'apertura dall'indirizzo pubblico dava 401 («deny or ACL failure»: l'account Cloudinary blocca la consegna dei PDF). Dalla 4.8.1 i PDF si aprono da `GET /api/sites/:id/documents/:docId/file` (link di download firmato, 15 minuti; `?json=1` per l'iPhone).   - **Verifica in produzione (4.8.1):** il link firmato risponde 200 con `application/pdf` e apertura in linea (non come download); su iPhone (simulatore) il documento si apre in Quick Look. Il file di prova è stato eliminato (0 documenti nel DB). ✅
  - **Corretto in 4.8.2:** su iPhone la selezione dei file, l'anteprima e gli avvisi non partivano perché erano agganciati alla sezione della lista; ora stanno sulla vista del cantiere (`siteDocumentsPresentation`).
  - **Da verificare:** limite reale del piano Cloudinary per i file raw (il gratuito si ferma a 10 MB); PDF da 20 MB; caricamento dall'iPhone vero.

---

## 3. Fase C — Restyling grafico

Da fare insieme, per avere un linguaggio visivo coerente. **Proporre all'utente bozze o mockup prima di implementare.**

### C1. Nuova sezione introduttiva della dashboard  _(#2)_
- **Stato:** 🚀 Pubblicato in 4.9.0 (22/11)
- **Cosa:** ridisegnare "Buongiorno, Admin" + "Consigli per te" + le 4 card numeriche: più bella e soprattutto **più utile e dinamica**. Mostrare le cose importanti del momento: preventivi in scadenza, clienti da richiamare, SAL da fatturare, cantieri attivi oggi, richieste di sblocco (B1). Card cliccabili che portano alla lista filtrata, andamento rispetto al mese prima.
- **Schermata:** `docs/prossime-modifiche/01-dashboard-intro.webp`
- **Dove:** `src/app/(app)/dashboard/WelcomeBriefing.tsx`, `src/app/api/ai/briefing/route.ts`; Home iPhone `ios/Dieffe/Native/Home/`.
- **Mockup:** https://claude.ai/artifact/6VQ77oSy2MuAXPxJiMqc4v (tavole «C1 · Dashboard» e «C1 · Home iPhone»), proposti il 2026-11-21.
- **Analisi DB (2026-11-21, sola lettura in produzione):** tutti i dati ci sono già, **nessuna tabella nuova**.
  - Inviati in attesa: 9, tutti inviati da più di 7 giorni; 3 da oltre 90 giorni.
  - **Scaduti ma ancora «inviati»: 3** (`valid_until` passata): oggi non si vedono da nessuna parte. È il dato più utile da mostrare.
  - In scadenza nei prossimi 14 giorni: 1. Solo 5 inviati su 9 hanno una validità impostata (vedi C3).
  - SAL raggiunti da fatturare: 10 (`reached_at` sì, `invoiced_at` no); da incassare: 0. Quasi tutti a percentuale: l'importo va calcolato dal totale del preventivo come già fa la scheda cantiere.
  - Cantieri aperti: 16 (7 `active`, 9 `pending`). Richieste di sblocco aperte: 0 (`quotes.unlock_requested_at`).
  - Bozze: 5. Accettati a novembre 5, a ottobre 6.
  - ⚠️ **Manca la data di accettazione**: oggi «accettati questo mese» si conta da `updated_at`, che cambia a ogni modifica successiva. Proposta: colonna `quotes.accepted_at` (migrazione + riempimento da `quote_signatures.signed_at` e, dove manca, da `updated_at`), aggiornata dalla rotta di stato e dalla firma pubblica.
  - Query: poche `count(*)` filtrate su `quotes` e `site_milestones`, tabelle piccole: nessun indice nuovo necessario.
- **Esito:** —

### C2. Barra in alto dell'app (intestazione)  _(#5)_
- **Stato:** 🚀 Pubblicato in 4.9.0 (22/11)
- **Cosa:** togliere la scritta "Dieffe Ristrutturazioni" a sinistra e mettere qualcosa di utile. Proposte da valutare con l'utente:
  - ricerca globale (preventivi, clienti, cantieri) con scorciatoia ⌘K;
  - percorso della pagina (es. Preventivi › PREV-2026-062);
  - azione rapida "+ Nuovo".
  Rifinire anche campanella, icona desktop e menu utente.
- **Schermata:** `docs/prossime-modifiche/02-intestazione-app.webp`
- **Dove:** `src/components/shared/Header.tsx`, `Sidebar.tsx`.
- **Mockup:** https://claude.ai/artifact/6VQ77oSy2MuAXPxJiMqc4v (tavola «C2 · Barra in alto»): percorso della pagina a sinistra, ricerca ⌘K al centro, «+ Nuovo», campanella con numero, menu utente con iniziali (il tema passa dentro al menu utente).
- **Analisi DB (2026-11-21):** la ricerca globale legge `quotes` (codice, titolo), `clients` (nome), `sites` (nome, indirizzo): tabelle piccole, basta `ilike` con un limite di 5 risultati per gruppo. Nessuna tabella o indice nuovo.
- **Esito:** —

### C3. Intestazione del preventivo  _(#6)_
- **Stato:** 🚀 Pubblicato in 4.9.0 (22/11)
- **Cosa:** ridisegnare il blocco "Intestazione preventivo" (titolo, codice, cliente, indirizzo cantiere, validità, IVA, note generali): gerarchia più chiara, titolo in evidenza, cliente e indirizzo con icone e collegamenti (scheda cliente, mappa), layout più compatto.
- **Schermata:** `docs/prossime-modifiche/03-intestazione-preventivo.png`
- **Dove:** `src/components/quote-editor/QuoteHeaderForm.tsx`; equivalente iPhone in `ios/Dieffe/Native/Editor/`.
- **Mockup:** https://claude.ai/artifact/6VQ77oSy2MuAXPxJiMqc4v (tavola «C3 · Intestazione preventivo»): titolo grande, codice e stato in alto, quattro riquadri (cliente, cantiere con mappa, validità con scelte rapide, IVA), note sotto con avviso se citano un'IVA diversa da quella scelta.
- **Analisi DB (2026-11-21):** nessuna colonna nuova. Solo 5 inviati su 9 hanno `valid_until`: le scelte rapide «30/60 giorni» servono a riempirla. Il riquadro cantiere usa `quotes.project_address`; «Apri nella mappa» può usare `sites.lat/lng` quando il preventivo ha un cantiere.
- **Esito:** —

---

## 4. Fase D — Lungo termine: progetti grandi

### D1. Sopralluogo con IA vocale (iPhone, visibile anche su macOS)  _(#10)_
- **Stato:** 📋 Da fare — **richiede uno studio e un piano approvato prima di scrivere codice**
- **Piattaforme:** iPhone (registrazione); sito e desktop (consultazione e modifica)
- **Cosa:** nella scheda cantiere, sezione Sopralluogo. Durante il sopralluogo:
  1. si **parla con l'IA** e si spiega qualsiasi cosa;
  2. l'IA **genera il preventivo**, con intestazione (cliente, indirizzo, titolo) e **voci** ricavate dal parlato;
  3. le **foto** scattate durante il sopralluogo vanno in automatico nella sezione Foto del cantiere e sono collegate al preventivo;
  4. l'IA **distingue da sola** cosa è una voce di preventivo e cosa è una nota, e aggiunge le note mentre si parla;
  5. l'IA può intervenire in autonomia sul preventivo (aggiungere, modificare, raggruppare voci), con la possibilità di rivedere e annullare.
- **Studio richiesto (consegnare come documento prima dell'implementazione):**
  - trascrizione: sul telefono o sul server, in tempo reale o a blocchi; funzionamento senza rete in cantiere (registrazione offline, invio in seguito);
  - estrazione strutturata delle voci, collegata al listino prezzi (`src/lib/price-list`);
  - ottimizzazione di costi e latenza: modelli, invii a blocchi, cache, limiti;
  - interfaccia: cosa vede l'utente mentre parla, come conferma o scarta;
  - privacy dell'audio: conservazione e cancellazione.
- **Dove:** `ios/Dieffe/Native/Sites/`, `src/lib/ai/`, `src/lib/sites/`, schema DB (campo sopralluogo già presente in `schema.ts`), editor preventivo.
- **Test specifici:** sopralluogo simulato di 10 minuti con molte voci; rumore di fondo; rete assente e poi di nuovo presente; preventivo risultante controllato a mano; costo IA per sopralluogo.
- **Analisi DB:** — _(da fare prima della progettazione, §0.3)_
- **Esito:** —


### D2. iPhone: menu laterale al posto della scheda "Altro"  _(#17, aggiunta il 2026-11-21)_
- **Stato:** 📋 Da fare — progetto grande: **proporre all'utente un mockup prima di scrivere codice**
- **Piattaforme:** iPhone (il sito e l'app desktop hanno già la barra laterale)
- **Cosa:** un menu laterale che si apre **scorrendo dal bordo sinistro** dell'app, come nell'app Claude per iPhone (schermata di riferimento).
  1. Dentro il menu va **tutto il contenuto della scheda "Altro"**, che va **tolta dalla barra in basso**. Oggi "Altro" (`ios/Dieffe/Native/More/AltroView.swift`) contiene: Profilo (nome, sicurezza, aspetto), Notifiche, Aiuto, App iPhone (Face ID, versione, cache), Gestione Cantieri; sezione Operatività: Lavori extra, Statistiche, Comunicazioni, Cestino; sezione Amministrazione (solo admin): Invia notifica, Utenti, Impostazioni azienda.
  2. In alto il **logo Dieffe**, al posto del titolo "Claude" dell'esempio.
  3. Il **tasto del profilo** va in basso a sinistra, come il cerchio "D" dell'esempio; accanto può stare un'azione principale, come "+ Nuova sessione" nell'esempio (da decidere: "+ Nuovo preventivo"?).
  4. **Vibrazione** (feedback aptico) all'apertura del menu, e alla chiusura se ha senso.
- **Schermata:** `docs/prossime-modifiche/07-menu-laterale-iphone.webp` (app Claude per iPhone).
- **Da decidere con l'utente:**
  - cosa resta nella barra in basso tolto "Altro" (oggi: Home, Clienti, Cantieri, Listino, Altro);
  - se il menu si apre anche con un tasto (es. icona ☰ in alto a sinistra) oltre al gesto, per chi non conosce lo scorrimento;
  - come convivono il gesto dal bordo sinistro e il gesto "indietro" di iOS nelle schermate interne (proposta: menu solo dalle schermate principali delle schede);
  - cosa mostrare nella parte "Recenti" (es. ultimi preventivi e cantieri aperti).
- **Dove:** `ios/Dieffe/App/RootView.swift` (tab bar e presentazioni), `ios/Dieffe/App/AppModel.swift` (`AppTab`, `altroPath`, `open(_ route:)` che oggi manda alla scheda Altro, `showProfile`), `ios/Dieffe/Native/More/AltroView.swift` (contenuto da spostare), `ios/Dieffe/Native/Home/HomeView.swift` (tasto profilo attuale), collegamenti e notifiche che aprono pagine di "Altro" (`NativeDestination`, `AltroRoute`).
- **Test specifici:** apertura e chiusura con il gesto e con il tasto; vibrazione; tutte le voci di "Altro" raggiungibili (admin e non admin); collegamenti dalle notifiche e dai link (es. Cestino, Statistiche) che oggi aprono la scheda Altro; gesto "indietro" ancora funzionante; VoiceOver; tema chiaro e scuro; iPhone piccolo e grande.
- **Analisi DB:** nessun impatto previsto (solo interfaccia iPhone); da confermare se "Recenti" richiede dati nuovi dal server.
- **Esito:** —
---

## 5. Decisioni prese
_(scelte condivise che valgono per tutte le modifiche — aggiungere con data)_

- 2026-11-21 — Ordine di lavoro: Fase A → B → C → D. Dentro ogni fase, nell'ordine scritto.
- 2026-11-21 — Ogni voce va chiusa solo dopo i test funzionali, grafici, di efficienza e del database del §0.2.
- 2026-11-21 — Ogni voce parte con l'analisi del database del §0.3, fatta prima della progettazione e mostrata all'utente.
- 2026-11-21 — "Lavori conclusi" (B1) = cantiere chiuso con «Concludi lavori» (`quotes.works_completed_at`).
- 2026-11-21 — Il blocco dei preventivi si calcola (stato + lavori conclusi + sblocco manuale), non si salva per riga. Bloccato = sola lettura per tutti; l'admin sblocca con un tocco.
- 2026-11-21 — Notifiche di blocco/sblocco al titolare solo per le decisioni dell'admin, non per lo sblocco di routine di un «inviato».
- 2026-11-21 — Inizio lavori automatico (A8): se non è impostato a mano, è il giorno della prima fase completata.
- 2026-11-21 — I PDF del cantiere si aprono solo con link firmati e a tempo (l'account Cloudinary blocca la consegna pubblica dei PDF: non cambiarla).
- 2026-11-21 — La 4.8.0 è segnata `important: true`: il blocco automatico cambia il comportamento per tutti.
- 2026-11-21 — Le notifiche restano 30 giorni dalla creazione, lette o no (A9).
- 2026-11-21 — **Fase C solo su sito e app Mac: l'iPhone non si tocca.**
- 2026-11-21 — C1 approvato. La dashboard non contiene più l'elenco dei preventivi: l'elenco (ricerca, filtri, aperti di recente) sta solo nella pagina **Preventivi**.
- 2026-11-21 — C2 approvato **senza** il tasto «+ Nuovo»: restano notifiche, tema e menu utente; a sinistra il percorso, al centro la ricerca ⌘K.
- 2026-11-21 — C3 approvato con una scelta del cliente migliore (tendina con ricerca) e tutti i campi dell'intestazione modificabili.
- 2026-11-22 — **Le prove non modificano mai i preventivi reali**: si fanno su un ramo Neon di prova (copia del DB) e, anche lì, senza modificare preventivi.
- 2026-11-22 — 4.9.0 **non** segnata `important`: la schermata Novità comparirebbe anche sull'iPhone, che in fase C non si tocca.
- 2026-11-22 — **Cartellini delle novità** (`src/components/shared/FeatureTips.tsx`): fumetto accanto al tasto nuovo («Da adesso l'elenco completo dei preventivi lo trovi qui!»), uno alla volta, solo nei 5 giorni dopo il rilascio e solo finché l'utente non lo chiude (memoria del browser, per utente). Da usare per tutte le novità importanti: `data-tip="…"` sul tasto + una voce in `TIPS`.
- 2026-11-22 — Dashboard corretta a pagina stretta (le colonne uscivano dallo schermo).

## 5b. In sospeso (da controllare)
- **Fase C (4.9.0), 22/11:** provata in locale su un ramo Neon di prova (`prova-fase-c-accepted-at`): migrazione `0019_accepted_at` ok (14 accettati con data; novembre 5, ottobre 6), dashboard, filtri «scaduti/da sollecitare», ricerca ⌘K, intestazione e tendina cliente. Durante la prova il preventivo PREV-2026-038 è stato sbloccato **solo sulla copia**; produzione verificata intatta. Il ramo di prova va eliminato (con l'ok dell'utente).
- **iPhone 17 Pro:** non aggiornato dalla 4.7.0 (telefono non raggiungibile alle 14:46 e alle 14:58); il servizio sul Mac (`agent.sh`) riprova da solo. L'iPhone di Thomas ha la 4.8.2 (build 145); l'iPhone 17 Pro non era raggiungibile neanche alle 15:06.
- **Account non admin:** serve ancora per il rifiuto 423 via API (B1) e per A3 da utente normale. «Richiedi sblocco» è già stato provato da Riccardo.
- **Notifiche di prova** «PREV-2026-006 sbloccato/bloccato» arrivate a Riccardo Addamo il 21/11 (13:54 dai test, 13:57–13:58 da un'altra prova dell'admin) prima della correzione della 4.8.1.

## 6. Fatte
_(spostare qui le voci completate, con versione ed esito)_

- **A1** Riepilogo che non scorre fino in fondo: 4.6.1, 2026-11-21 (dettagli nella voce A1).
- **A2** Tolto il tasto "Riassegna": 4.6.2, 2026-11-21 (dettagli nella voce A2).
- **A3** Tasto "Vai al cantiere" (sito, desktop, iPhone): 4.7.0, 2026-11-21.
- **A4** Archivio cantieri raggiungibile su iPhone: 4.7.0, 2026-11-21.
- **A5** SAL e fasi: studio e 6 bug corretti: 4.7.0 + 4.7.1 (SAL fatturati vecchi mostrati come raggiunti), 2026-11-21.
- **A6** Barra del preventivo compatta e adattiva: 4.7.0, 2026-11-21.
- **A8** Stato del cantiere aggiornato da solo (inizio lavori dalla prima fase): 4.8.1, 2026-11-21.

---

### Corrispondenza con la lista originale dell'utente
| # utente | Voce | # utente | Voce |
|---|---|---|---|
| 1 | B1 | 7 | A1 |
| 2 | C1 | 8 | A5 |
| 3 | B2 | 9 | A4 |
| 4 | A2 | 10 | D1 |
| 5 | C2 | 11 | B3 |
| 6 | C3 | 12 | A3 |
| — | — | 13 | A6 |
| — | — | 14 | A7 |
| — | — | 15 | A8 |
| — | — | 16 | A9 |
| — | — | 17 | D2 |
