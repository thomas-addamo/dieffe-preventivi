// ─────────────────────────────────────────────────────────────────────────────
// Guida all'uso di Dieffe Preventivi: è il "manuale" che l'assistente del
// pulsante Aiuto usa per rispondere. Aggiornarla quando si aggiunge o si
// sposta una funzione.
// ─────────────────────────────────────────────────────────────────────────────

export const APP_GUIDE = `
DIEFFE PREVENTIVI — guida rapida (web, telefono e app per Mac/Windows)

NAVIGAZIONE
- Computer: barra laterale a sinistra (si comprime con il pulsante in alto; passando il mouse si riapre). Telefono: barra in basso (Home, Clienti, +, Profilo, Altro).
- "Novità" accanto a una voce = pagina appena aggiunta.

DASHBOARD
- In alto: saluto, cosa è in sospeso (bozze, preventivi inviati senza risposta, accettati) e consigli.
- Numeri generali, "Aperti di recente", archivio preventivi con ricerca, filtri per stato/cliente e ordinamento.
- I lavori extra di un preventivo si aprono dalla tendina "+N extra" sulla sua riga.
- "Nuovo preventivo" crea un preventivo; "Importa da file" lo crea da PDF/Word/Excel con l'AI.

EDITOR PREVENTIVO
- Intestazione: titolo, cliente, cantiere, validità, IVA, note.
- Sezioni (A, B, C…) trascinabili; sezioni opzionali (incluse o no nel totale); prezzo "a corpo" di sezione.
- Voci: descrizione formattabile (grassetto, elenchi…), U.M., quantità, prezzo, sconto %, immagini. Scrivendo la descrizione compaiono le voci del listino; l'AI suggerisce il prezzo spiegando da dove viene (listino, storico, mercato) e può migliorare il testo. "Salva nel listino" aggiunge la voce al listino.
- Pannello Riepilogo: sconto generale, IVA, condizioni di pagamento (con modelli pronti), totale.
- Esporta: PDF (anteprima o scarica), Excel, CSV, backup JSON. Da telefono il PDF si condivide o si salva su File.
- Condividi: link pubblico per il cliente (con PIN facoltativo e scadenza); il cliente può accettare e firmare online, e tu ricevi una notifica.
- Salvataggio automatico. L'amministratore può bloccare un preventivo o riassegnarlo a un altro utente.
- Assistente edilizia (pulsante viola in basso a destra nell'editor): domande tecniche e sui prezzi dei tuoi preventivi.

LAVORI EXTRA
- Per lavorazioni chieste in più rispetto a un preventivo: pagina "Lavori extra" → "Nuovo lavoro extra" → scegli il preventivo; oppure dall'editor il pulsante "Lavoro extra".
- Il lavoro extra è un preventivo separato (codice es. PREV-2026-014-E1) con le stesse intestazioni e un importo proprio; nel PDF è marcato "EXTRA PREVENTIVO".

CLIENTI
- Elenco con contatti, numero di preventivi e valore accettato; tocca un cliente per la scheda (modifica, elimina, preventivi collegati).

CREA COMUNICAZIONE
- Lettere su carta intestata a clienti, condòmini, amministratori, architetti: destinatari, oggetto, testo formattato (dimensione, colori, allineamento, elenchi…), luogo/data, firmatario e timbro Dieffe. Salva, anteprima e PDF; l'Archivio conserva quelle salvate (riapri, duplica, elimina).

LISTINO
- Catalogo per categorie e sottocategorie con codici gerarchici (es. PAV.02.05) e uso nei preventivi.
- Riordino automatico ogni notte (o "Riordina ora"): unisce i doppioni con l'AI ed elimina le voci non usate da N mesi; "Fissa" una voce per non perderla mai.
- Ricerca AI nel listino e nello storico; importa/esporta Excel.

ALTRO
- Statistiche: andamento, conversione e valore dei preventivi.
- Cestino: preventivi eliminati, recuperabili per 30 giorni.
- Notifiche: campanella in alto; notifiche push attivabili dal Profilo/Impostazioni.
- Impostazioni: tema, password; per l'admin dati azienda, logo, numerazione, IVA e condizioni predefinite, AI.
- Amministrazione (solo admin): utenti e ruoli, invio notifiche, audit log, sessioni attive.
- Ruoli: amministratore (tutto), editor (crea e modifica), sola lettura (consulta).
- Aiuto: questo pulsante; dalla scheda "Scrivi all'amministratore" puoi segnalare problemi o fare richieste.
`.trim();
