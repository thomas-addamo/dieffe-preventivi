# Prossime modifiche — Dieffe Preventivi

> **File condiviso tra tutte le sessioni di Claude su questo progetto.**
> Ogni sessione lo legge **per intero** prima di iniziare e lo aggiorna quando prende in carico o chiude una voce.
> Schermate di riferimento: `docs/prossime-modifiche/`.

---

## 0. Regole per tutte le sessioni

### 0.1 Come si lavora una voce
1. Leggi tutto il file: cosa è in programma, cosa è già in lavorazione, le decisioni prese (§5).
2. Prendi **la prima voce `📋 Da fare` della fase più alta** in ordine, salvo diversa indicazione dell'utente.
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
  - **Da verificare dopo il deploy:** l'editor in produzione senza il tasto (admin e utente normale). Build Xcode non necessaria: in Swift è cambiato solo un commento.

### A3. Tasto "Vai al cantiere" su ogni preventivo  _(#12)_
- **Stato:** 📋 Da fare
- **Piattaforme:** sito · desktop · iPhone
- **Cosa:** ogni preventivo ha un tasto che apre la scheda cantiere collegata. Se il cantiere non esiste ancora, il tasto spiega come crearlo, oppure lo crea se il preventivo è accettato.
- **Dove:** `QuoteEditor.tsx` (barra azioni), `src/lib/sites/`, `ios/Dieffe/Native/Editor/QuoteEditorView.swift` → `Sites/SiteDetailView.swift`.
- **Test specifici:** preventivo con cantiere, senza cantiere e in bozza; ritorno indietro corretto su iPhone.
- **Analisi DB:** — _(da fare prima della progettazione, §0.3)_
- **Esito:** —

### A4. iPhone: mostrare i lavori archiviati e finiti  _(#9)_
- **Stato:** 📋 Da fare
- **Piattaforme:** iPhone (allineare a macOS)
- **Cosa:** su iPhone non si vedono in nessun modo i lavori archiviati e conclusi, che invece su macOS si vedono. Aggiungere un filtro o una sezione "Archiviati / Conclusi" con gli stessi criteri del sito.
- **Dove:** `ios/Dieffe/Native/Sites/SitesView.swift`, `ios/Dieffe/Native/Quotes/`, `ios/Dieffe/Data/Models.swift`; confrontare con il filtro web in `src/app/(app)/cantieri/` e `preventivi/`.
- **Test specifici:** gli stessi conteggi su macOS e iPhone; si apre un lavoro archiviato; i filtri restano dopo il riavvio dell'app.
- **Analisi DB:** — _(da fare prima della progettazione, §0.3)_
- **Esito:** —

### A5. SAL e avanzamenti del cantiere: studio e correzione dei bug  _(#8)_
- **Stato:** 📋 Da fare
- **Piattaforme:** sito · desktop · iPhone
- **Cosa:** in ogni cantiere SAL e avanzamenti hanno bug seri. A volte non sono cliccabili e non sono collegati tra loro: per esempio un SAL "a fine Demolizioni" deve risultare raggiunto quando la fase Demolizioni è completata, e viceversa.
  1. **Studio di funzionalità:** mappare il flusso attuale (fasi → milestone SAL → fatturato → incassato) e scrivere in questa voce come funziona oggi e come deve funzionare.
  2. Elencare i bug trovati con i passi per riprodurli.
  3. Correggere, rendere coerenti i totali (Totale SAL, Da fatturare, Fatturato, Da incassare, barre %) e rendere tutti gli elementi cliccabili.
- **Schermata:** `docs/prossime-modifiche/05-sal-fatture.webp`. Esempio da verificare: due SAL segnati come "Fatturato" ma la card Fatturato mostra 0,00 €.
- **Dove:** `src/app/(app)/cantieri/[id]/MilestonesTab.tsx`, `PhasesTab.tsx`, `site-api.ts`, `src/lib/sites/`, `ios/Dieffe/Native/Sites/SiteSections.swift`.
- **Test specifici:** completare o annullare una fase e controllare l'aggiornamento del SAL; segnare e togliere Fatturato e Incassato e controllare card e barre; IVA corretta; stessi valori su sito e iPhone; aggiornamento senza ricaricare la pagina.
- **Analisi DB:** — _(da fare prima della progettazione, §0.3)_
- **Esito:** —

### A6. Barra dei tasti del preventivo che esce dalla pagina  _(#13, aggiunta il 2026-11-21)_
- **Stato:** 📋 Da fare
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
- **Analisi DB:** — _(da fare prima della progettazione, §0.3; prevedibilmente nessun impatto)_
- **Esito:** —

---

## 2. Fase B — Medio termine: nuove funzioni

### B1. Blocco automatico dei preventivi conclusi, rifiutati e inviati  _(#1)_
- **Stato:** 📋 Da fare
- **Piattaforme:** sito · desktop · iPhone
- **Cosa:**
  | Stato del preventivo | Blocco | Chi può sbloccare |
  |---|---|---|
  | Accettato **e** lavori conclusi | automatico, solo lettura | **solo admin**; gli utenti possono **richiedere lo sblocco** |
  | Rifiutato | automatico, solo lettura | solo admin, su richiesta |
  | Inviato | automatico, solo lettura | **l'utente stesso**, in autonomia |
- **Note:** esistono già `isLocked`, `lockedBy`, `lockedAt` e le notifiche `quote_locked`/`quote_unlocked` (`src/lib/db/schema.ts`): partire da lì. Serve un flusso "Richiedi sblocco" → notifica all'admin → approva/rifiuta. Da definire con l'utente: cosa vuol dire esattamente "lavori conclusi" (cantiere chiuso? tutte le fasi completate?).
- **Dove:** `schema.ts`, `src/lib/permissions/`, `src/lib/notifications.ts`, dashboard, `QuoteEditor.tsx`, editor iPhone.
- **Test specifici:** tutti i passaggi di stato; un utente non può modificare via API un preventivo bloccato (test lato server, non solo interfaccia); richiesta → notifica → sblocco; icona lucchetto visibile in elenco e nell'editor.
- **Analisi DB:** — _(da fare prima della progettazione, §0.3)_
- **Esito:** —

### B2. Correzione automatica con IA di titoli, note e descrizioni  _(#3)_
- **Stato:** 📋 Da fare
- **Piattaforme:** sito · desktop · iPhone
- **Cosa:** dopo un tempo di inattività **scelto dall'utente** (predefinito 3 secondi) l'IA sistema maiuscole iniziali, punteggiatura e refusi in:
  - titolo del preventivo
  - voci / descrizioni
  - note
  In Impostazioni: il tempo di attesa e **un interruttore separato** per ciascun tipo di campo.
- **Note:** la correzione non deve cambiare il significato né le cifre. Deve essere annullabile (Cmd+Z o "Annulla correzione") e mai attiva mentre l'utente sta scrivendo. Correzioni semplici (maiuscola iniziale) in locale senza IA; l'IA solo per il resto, per contenere i costi.
- **Dove:** `src/lib/editor-prefs.ts`, `src/app/(app)/impostazioni/ImpostazioniClient.tsx`, `src/lib/ai/`, `QuoteHeaderForm.tsx`, `QuoteEditor.tsx`.
- **Test specifici:** tempo 1, 3 e 10 s; interruttori spenti → nessuna chiamata; il cursore non salta durante la correzione; numero di chiamate IA per preventivo.
- **Analisi DB:** — _(da fare prima della progettazione, §0.3)_
- **Esito:** —

### B3. Allegati PDF nel cantiere  _(#11)_
- **Stato:** 📋 Da fare
- **Piattaforme:** sito · desktop · iPhone
- **Cosa:** nuova sezione "Documenti" in Gestione Cantieri. Per ogni cantiere si caricano PDF (permessi, progetti, contratti…) che si aprono direttamente nell'app, anche su iPhone, con anteprima.
- **Dove:** nuova scheda accanto a `PhotosTab.tsx`; storage come per le foto (`src/lib/cloudinary.ts` o alternativa); `ios/Dieffe/Native/Sites/`.
- **Test specifici:** PDF grande (20 MB), nome lungo, eliminazione, permessi, apertura offline su iPhone se prevista.
- **Analisi DB:** — _(da fare prima della progettazione, §0.3)_
- **Esito:** —

---

## 3. Fase C — Restyling grafico

Da fare insieme, per avere un linguaggio visivo coerente. **Proporre all'utente bozze o mockup prima di implementare.**

### C1. Nuova sezione introduttiva della dashboard  _(#2)_
- **Stato:** 📋 Da fare
- **Cosa:** ridisegnare "Buongiorno, Admin" + "Consigli per te" + le 4 card numeriche: più bella e soprattutto **più utile e dinamica**. Mostrare le cose importanti del momento: preventivi in scadenza, clienti da richiamare, SAL da fatturare, cantieri attivi oggi, richieste di sblocco (B1). Card cliccabili che portano alla lista filtrata, andamento rispetto al mese prima.
- **Schermata:** `docs/prossime-modifiche/01-dashboard-intro.webp`
- **Dove:** `src/app/(app)/dashboard/WelcomeBriefing.tsx`, `src/app/api/ai/briefing/route.ts`; Home iPhone `ios/Dieffe/Native/Home/`.
- **Analisi DB:** — _(da fare prima della progettazione, §0.3)_
- **Esito:** —

### C2. Barra in alto dell'app (intestazione)  _(#5)_
- **Stato:** 📋 Da fare
- **Cosa:** togliere la scritta "Dieffe Ristrutturazioni" a sinistra e mettere qualcosa di utile. Proposte da valutare con l'utente:
  - ricerca globale (preventivi, clienti, cantieri) con scorciatoia ⌘K;
  - percorso della pagina (es. Preventivi › PREV-2026-062);
  - azione rapida "+ Nuovo".
  Rifinire anche campanella, icona desktop e menu utente.
- **Schermata:** `docs/prossime-modifiche/02-intestazione-app.webp`
- **Dove:** `src/components/shared/Header.tsx`, `Sidebar.tsx`.
- **Analisi DB:** — _(da fare prima della progettazione, §0.3)_
- **Esito:** —

### C3. Intestazione del preventivo  _(#6)_
- **Stato:** 📋 Da fare
- **Cosa:** ridisegnare il blocco "Intestazione preventivo" (titolo, codice, cliente, indirizzo cantiere, validità, IVA, note generali): gerarchia più chiara, titolo in evidenza, cliente e indirizzo con icone e collegamenti (scheda cliente, mappa), layout più compatto.
- **Schermata:** `docs/prossime-modifiche/03-intestazione-preventivo.png`
- **Dove:** `src/components/quote-editor/QuoteHeaderForm.tsx`; equivalente iPhone in `ios/Dieffe/Native/Editor/`.
- **Analisi DB:** — _(da fare prima della progettazione, §0.3)_
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

---

## 5. Decisioni prese
_(scelte condivise che valgono per tutte le modifiche — aggiungere con data)_

- 2026-11-21 — Ordine di lavoro: Fase A → B → C → D. Dentro ogni fase, nell'ordine scritto.
- 2026-11-21 — Ogni voce va chiusa solo dopo i test funzionali, grafici, di efficienza e del database del §0.2.
- 2026-11-21 — Ogni voce parte con l'analisi del database del §0.3, fatta prima della progettazione e mostrata all'utente.

## 6. Fatte
_(spostare qui le voci completate, con versione ed esito)_

- **A1** Riepilogo che non scorre fino in fondo: 4.6.1, 2026-11-21 (dettagli nella voce A1).
- **A2** Tolto il tasto "Riassegna": 4.6.2, 2026-11-21 (dettagli nella voce A2).

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
