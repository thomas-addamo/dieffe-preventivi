# D1 — Sopralluogo con IA vocale: studio (2026-11-22)

> Documento di studio richiesto dalla voce D1 di `PROSSIME-MODIFICHE.md`.
> Scelte del §8 fatte dall'utente il 2026-11-22 (§10). Si parte con D1a.

## 1. Cosa c'è già (analisi del codice e del database, sola lettura)

| Cosa | Stato attuale | Conseguenza per D1 |
|---|---|---|
| App iPhone | SwiftUI, **iOS 26 minimo** (`ios/project.yml`) | Si può usare la trascrizione Apple sul telefono (`SpeechAnalyzer` / `SpeechTranscriber`, iOS 26): italiano, **senza rete**, gratuita, testo in tempo reale. |
| IA sul server | Groq (`gpt-oss-120b`, `gpt-oss-20b`, `qwen3.6-27b`, rotazione automatica) + Gemini Flash (`src/lib/ai/`) | L'estrazione delle voci usa i modelli che già paghiamo. Groq offre anche la trascrizione Whisper (`whisper-large-v3-turbo`) come riserva. |
| Listino | **1.096 voci attive** in 22 categorie, con ricerca per somiglianza (`src/lib/price-list/similarity.ts`, `src/lib/ai/rag.ts`) | Ogni voce detta si abbina a una voce di listino: prezzo e unità di misura arrivano dal listino, non inventati. |
| Import da file | `/api/quotes/import`: già trasforma un testo in sezioni e voci di preventivo | Il formato di uscita e i controlli si riusano. |
| Preventivi | 37 preventivi, in media **15 voci** ciascuno | Un sopralluogo tipico produce 10–25 voci: dimensione gestibile in una sola richiesta all'IA. |
| Foto del cantiere | Tabella `site_photos` (0 foto oggi), legata **obbligatoriamente** a un cantiere | Problema: vedi §2. |
| "Sopralluogo" nel DB | Esiste solo come **tipo di evento del calendario** (`site_events.type = 'sopralluogo'`, 0 eventi) | Non c'è un posto dove salvare il parlato, le note e lo stato del sopralluogo: serve una tabella nuova (§6). |

## 2. Il nodo principale: il sopralluogo viene **prima** del cantiere

Oggi un cantiere nasce da un preventivo **inviato o accettato** (`syncSites`). Il sopralluogo invece si fa **prima** del preventivo: quindi
"nella scheda cantiere, sezione Sopralluogo" funziona solo per i **lavori extra** su un cantiere già aperto.

**Proposta:**
- Il sopralluogo si avvia da **"+ Nuovo" → Sopralluogo** (e dalla scheda cliente). Crea subito una **bozza di preventivo**, che si riempie mentre si parla.
- Da un cantiere aperto, **"Sopralluogo"** crea invece un **lavoro extra** di quel cantiere.
- Le **foto** restano legate al preventivo (`quote_id`). Quando il preventivo diventa un cantiere, compaiono da sole nella sezione **Foto** del cantiere: si aggiunge `quote_id` a `site_photos` e `site_id` diventa facoltativo finché il cantiere non esiste.

## 3. Trascrizione

| Opzione | Pro | Contro |
|---|---|---|
| **A. Sul telefono (consigliata)** — `SpeechTranscriber` iOS 26 | Gratis; funziona **senza rete**; testo in diretta; l'audio non lascia il telefono | Qualità leggermente inferiore con molto rumore |
| B. Sul server — Groq Whisper a blocchi di 30 s | Qualità alta con rumore e termini tecnici | Serve rete; costo per minuto; l'audio viaggia |
| C. Mista | A in diretta; se il testo è incerto, quel blocco si rimanda a B quando c'è rete | Più complessa |

**Proposta:** A subito; C solo se le prove in cantiere (rumore di flessibile, martello) danno troppi errori. L'audio si tiene sul telefono fino alla fine del sopralluogo, per un'eventuale ritrascrizione, poi si cancella.

## 4. Estrazione delle voci (cosa fa l'IA)

- Il telefono manda il **nuovo testo** ogni ~40 secondi, o a una pausa lunga. Insieme manda lo **stato attuale** della bozza in forma compatta.
- Il server chiede all'IA un JSON di **operazioni**, non un preventivo intero:
  `set_header` (cliente, indirizzo, titolo), `add_section`, `add_item` (descrizione, quantità, unità), `update_item`, `move_item`, `add_note`, `ignore`.
- Ogni `add_item` passa dal **listino**: si prende la voce più simile. Prezzo e unità arrivano dal listino, segnati come "da listino"; se non c'è nulla di simile, la voce si segna "**prezzo da definire**". L'IA non inventa prezzi.
- **Voce o nota?** L'IA classifica da sola: "c'è umidità di risalita sul muro nord" → nota; "rifare l'intonaco del muro nord, circa 12 metri quadri" → voce più nota.
- Ogni operazione resta nel **registro del sopralluogo**: si può annullare una per una o tutte insieme (punto 5 della richiesta).

## 5. Costi e tempi (stima)

- 10 minuti di parlato ≈ 1.500 parole ≈ 2.500 token di testo.
- ~15 invii × (≈2.000 token di contesto + 600 di risposta) ≈ **40.000 token per sopralluogo**. Con Groq (piano attuale: 200.000 token al giorno per modello, con rotazione su 3 modelli) ci stanno **una decina di sopralluoghi al giorno**, a costo zero.
- La trascrizione sul telefono è gratuita. Whisper come riserva costa pochi centesimi per sopralluogo.
- Tempo di risposta: le voci compaiono **2–4 secondi** dopo la frase.
- **Senza rete:** il testo e le foto si salvano sul telefono; l'estrazione parte da sola al ritorno della rete, con un solo invio per tutto il testo.

## 6. Database (proposta, da confermare §0.3)

- **Tabella nuova `surveys`:**
  - `id`, `quote_id`, `site_id` (facoltativo, se fatto su un cantiere aperto), `user_id`;
  - `status` (`recording` | `processing` | `review` | `done`);
  - `transcript` (testo);
  - `ops` (jsonb: registro delle operazioni, per annullarle);
  - `started_at`, `ended_at`;
  - `ai_tokens` (costo).
- **`site_photos`:** si aggiunge `quote_id`; `site_id` diventa facoltativo. Quando il cantiere nasce, `syncSites` assegna `site_id` alle foto dei suoi preventivi.
- **Nessuna modifica** a `quotes`, `quote_sections` e `quote_items`: il sopralluogo scrive voci normali nella bozza.
- Tabelle piccole: nessun problema di prestazioni.

## 7. Interfaccia

**iPhone, durante il sopralluogo**
- In alto:
  - il **testo in diretta**, le ultime righe;
  - un indicatore "sto ascoltando" o "in pausa".
- Al centro, la **bozza che si costruisce**:
  - le voci nuove si illuminano per un attimo;
  - ogni voce ha "annulla";
  - le note stanno in una lista a parte.
- In basso: tasto grande **📷 Foto**, poi **Pausa** e **Fine**.
- Le foto si collegano alla frase detta in quel momento: diventano la didascalia, per esempio "bagno, piatto doccia".

**Alla fine**
- Schermata **Rivedi** con l'elenco delle voci, le note e le foto.
- Si possono togliere le voci sbagliate con un gesto.
- "**Apri nel preventivo**" porta all'editor normale.

**Sito e Mac**
- Nel preventivo, una sezione **Sopralluogo** in sola lettura, con:
  - il testo trascritto;
  - le note;
  - le foto;
  - il registro di cosa ha fatto l'IA.

## 8. Scelte da fare con l'utente

1. **Da dove si avvia:** "+ Nuovo → Sopralluogo", che crea una bozza di preventivo, e dal cantiere, che crea un lavoro extra (proposta §2)?
2. **Foto prima del cantiere:** legarle al preventivo e passarle al cantiere quando nasce (proposta §2)?
3. **Autonomia dell'IA:** le voci entrano subito nella bozza, con possibilità di annullare (proposta), oppure restano proposte da confermare una per una?
4. **Prezzi:** solo da listino, con "prezzo da definire" se manca (proposta), oppure anche stime dell'IA segnate come tali?
5. **Conservazione:** l'audio si cancella a fine sopralluogo. Il testo trascritto si tiene **90 giorni** dopo che il preventivo è accettato o rifiutato (proposta), oppure per sempre?

## 9. Piano di lavoro (dopo l'approvazione)

| Passo | Contenuto | Rilascio |
|---|---|---|
| D1a | Tabella `surveys`, avvio del sopralluogo su iPhone, trascrizione sul telefono, note e foto collegate, sezione Sopralluogo su sito e Mac. **Ancora senza IA sulle voci.** | 4.10 |
| D1b | Estrazione delle voci a blocchi con abbinamento al listino, schermata Rivedi, funzionamento senza rete. | 4.11 |
| D1c | Interventi autonomi dell'IA (raggruppa, correggi, sposta) con registro e annulla. | 4.12 |

**Test (§0.2 più quelli della voce D1):**
- sopralluogo simulato di 10 minuti con 20 voci;
- registrazione con rumore di cantiere;
- rete assente e poi di nuovo presente;
- confronto a mano con un preventivo vero;
- costo in token per sopralluogo;
- VoiceOver.

Le prove si fanno su un **ramo Neon di prova**, senza mai modificare i preventivi reali.

## 10. Scelte dell'utente (2026-11-22)

1. **Avvio:** da «+ Nuovo → Sopralluogo» e dalla scheda cliente → bozza di preventivo; da un cantiere aperto → lavoro extra di quel cantiere.
2. **Voci:** entrano subito nella bozza, ognuna annullabile; a fine sopralluogo la schermata Rivedi.
3. **Prezzi:** l'IA **non** prende prezzi dal listino e **non** li stima. Li mette solo se l'utente li dice a voce durante il sopralluogo; gli altri li definisce l'utente dopo, nell'editor. (Il listino può servire solo per descrizione e unità di misura.)
4. **Foto:** legate al preventivo, passano da sole alle Foto del cantiere quando il cantiere nasce.
5. **Testo trascritto:** si cancella **a fine revisione** (niente memoria sprecata). Quindi prima di cancellarlo tutto ciò che serve deve essere già nel preventivo (voci e note). L'audio si cancella dal telefono a fine sopralluogo.
6. **Nuova richiesta:** anche **dopo** la revisione si deve poter continuare a parlare all'IA sul preventivo per chiedere modifiche o aggiunte → diventa un **comando vocale nel preventivo**, disponibile sempre (passo D1c).
7. **Piano:** approvato; si parte con **D1a**.

### Piano aggiornato
| Passo | Contenuto |
|---|---|
| D1a | Tabella `surveys`, `quote_id` in `site_photos`; avvio del sopralluogo su iPhone (da Nuovo, cliente, cantiere); trascrizione sul telefono; foto collegate; schermata Rivedi con il testo modificabile che si salva nelle note del preventivo; poi il testo si cancella. Sul sito e sul Mac: foto del sopralluogo nel preventivo. |
| D1b | Voci create dall'IA mentre si parla (prezzi solo se detti), annulla per voce, funzionamento senza rete. |
| D1c | Comando vocale nel preventivo (anche dopo il sopralluogo): l'IA aggiunge, modifica, raggruppa voci e note su richiesta, con annulla. |
