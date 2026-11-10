# Gestione Cantieri — contratto delle API

Le stesse API servono il sito, l'app desktop (Mac/Windows, che carica il sito) e
l'app iPhone (`ios/Dieffe/Data/SiteModels.swift`). I numeri (avanzamento, SAL,
ritardo, costi) li calcola **solo il server** (`metrics.ts`): i client li
mostrano così come arrivano.

## Regola di compatibilità

Le app iPhone già installate non si aggiornano tutte insieme, quindi:

1. **Mai** rinominare o togliere un campo, né cambiarne il tipo.
2. I campi nuovi si **aggiungono** e su iPhone si dichiarano opzionali (`let x: T?`).
3. Le stringhe "a valori fissi" (`status`, `health`, `trigger`, `type`…) possono
   ricevere valori nuovi: l'app li tratta come sconosciuti senza bloccarsi.
4. Un comportamento nuovo passa da un parametro nuovo (es. `toIndex`), quello
   vecchio resta valido (es. `move`).

## Interruttore

`src/lib/features.ts` → `FEATURES.sites = { web, ios }`, ciascuno `"off" | "admin" | "all"`.
L'iPhone lo riceve da `GET /api/app/home` come `features.sites: Bool` (già
calcolato per l'utente). Con la funzione spenta le API rispondono `503 { maintenance: true }`.

## Endpoint

| Metodo | Percorso | Cosa fa |
|---|---|---|
| GET | `/api/sites` | Dashboard: cantieri **in corso**, `upcoming`, `totals` (+ `archived`), `pendingWork`. Risponde subito; allineamento e preparazione proseguono dopo la risposta. |
| GET | `/api/sites/archive` | Archivio: `{ sites: SiteListItem[] }` con `archivedAt`, `archiveReason`. |
| POST | `/api/sites/process` | Avanza a mano un lotto del lavoro in sospeso → `{ remaining }` (lo usa l'iPhone; il sito non serve più che lo chiami). |
| GET | `/api/sites/:id` | Dettaglio: `site`, `quotes`, `phases`, `milestones`, `events`, `notes`, `photos`, `metrics`, `setupPending`, `insightsStale`. |
| PATCH | `/api/sites/:id` | Tempi e costi (`name`, `startDate`, `plannedEndDate`, `dailyCost`, `penaltyPerDay`, `marginPct`, `lat`/`lng`, `reschedule`). |
| DELETE | `/api/sites/:id` | Eliminazione definitiva (solo admin, solo cantieri in archivio). |
| POST | `/api/sites/:id/complete` | Lavori conclusi → **archivio** (`archiveReason: "completed"`). |
| POST | `/api/sites/:id/reopen` | Riapre un cantiere concluso. `409` se archiviato per preventivo ritirato. |
| POST | `/api/sites/:id/insights` | Consigli IA (`{ force? }`), rigenerati solo se i dati cambiano. |
| POST | `/api/sites/:id/{phases,milestones,events,notes}` | Crea. |
| PATCH | `/api/sites/:id/{entity}/:itemId` | Modifica. Fasi: `done`, `move` (±1), `toIndex` (trascinamento), `note`, `durationDays`, `weight`. Note: `body` (autore o admin). SAL: `reached`, `invoiced`, `invoiceNumber`, `paid`… |
| DELETE | `/api/sites/:id/{entity}/:itemId` | Elimina (note: autore o admin). |
| POST | `/api/sites/:id/photos` | Foto (multipart `file`, `caption?`, `phaseId?`). JPEG/PNG/WebP, max 4 MB: ridimensionare prima (lato lungo 2.000 px). |
| PATCH / DELETE | `/api/sites/:id/photos/:photoId` | Didascalia/fase; elimina (autore o admin). |

Con un cantiere **in archivio** tutte le modifiche rispondono `409 { archived: true }`:
si consulta soltanto, finché non si riapre.

## Ciclo di vita

```
preventivo inviato ──► cantiere "pending" ──accettato──► "active"
        ▲                                                   │
        │ torna inviato/accettato             bozza/rifiutato/cestinato
        │                                                   ▼
   archivio "withdrawn" ◄──── (vuoto? eliminato) ──── archivio "withdrawn"
                                                            
"active" ──Concludi lavori / cron (tutto fatto e fatturato da 7 gg)──► archivio "completed"
archivio "completed" ──Riapri──► "active"      archivio ──Elimina (admin)──► eliminato
```

Campi aggiunti nella 4.5.0 (tutti opzionali per l'iPhone): `site.archivedAt`,
`site.archiveReason`, `SiteListItem.archivedAt/archiveReason`, `totals.archived`,
`notes[].updatedAt`, `notes[].userId`, `photos[]`.
