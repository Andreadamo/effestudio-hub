# Effestudio HUB

Un'unica app installabile (PWA) che raccoglie le web app di Effestudio Training Center.

- Le app restano nei loro repository (`effeore`, `effestudio-merch`): l'HUB le apre al suo interno.
- Ogni app mantiene il suo accesso (email + PIN per EffeOre, PIN staff per il merch).
- Sezione **Amministrazione**: si sblocca con il PIN amministrazione di EffeOre (verificato dal server).
- Pagine Google che richiedono l'account Effestudio (Contabilità, Orari Trainer) si aprono nel browser.

- `prezzi.html`: prezziario servizi per lo staff (prezzi nell'elenco `LISTINO` in cima allo script).

Aggiungere un'app: una riga in `apps.js`.

## Aggiornamenti
- Ogni app con cache (HUB, EffeOre, Merch) ha la versione in `sw.js` → `const CACHE = 'nome-vN'`.
- **A ogni modifica dell'app aumentare N** (es. `effeore-v15` → `effeore-v16`): è così che l'HUB capisce che c'è una nuova versione.
- In home l'HUB confronta la versione online con quella salvata sul telefono e mostra "Aggiorna" solo per le app cambiate.
- EffeOre e Merch Staff installate da sole mostrano lo stesso avviso con il tasto "Aggiorna".
- Orari Trainer e Contabilità non hanno cache: sono sempre all'ultima versione.
