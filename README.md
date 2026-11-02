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

## Monitoraggio Pulizie (`pulizie/`)
- `pulizie/staff.html` → **Check Pulizie** (Staff): checklist incaricato del giorno, controllo di chi apre/chiude, avviso push il giorno prima.
- `pulizie/` → **Monitoraggio Pulizie** (Amministrazione, PIN pulizie): dettaglio giorno, calendario, registro, multe (decurtate dal compenso), impostazioni e giorni impresa.
- Turni calcolati dagli Orari Trainer (sede Cecina Center): apertura = primo turno, chiusura = ultimo, incaricato a rotazione tra chi è in sede.
- Dati: Supabase progetto `spring-league`, schema `pulizie` (accesso solo via funzioni `pul_*`, vedi `pulizie/supabase/schema.sql`).
- Accesso staff: nome + PIN personale (generato in Impostazioni → PIN personali); persona e ora delle registrazioni le decide il server.
- Turni tutti a rotazione: apertura (chi inizia entro le 10:00, mai chi ha fatto il controllo la sera prima), controllo serale (chi finisce dopo le 19:30), incaricato (mai chi fa il controllo serale).
- Foto consigliata (o obbligatoria da Impostazioni) per ogni ✗; scadenza incaricato 18:00; 1 dimenticanza/ritardo al mese tollerata; presenze fisse fuori orario (Impostazioni).
- Primo accesso: nome + email → approvazione in Impostazioni → PIN via email (web app Apps Script dell'account Effestudio, codice non nel repo perché contiene il segreto).
- Notifiche: edge function `pulizie-avviso` via pg_cron (UTC): 17:00 domani sei l'incaricato · 15:00 lun-ven promemoria incaricato · 19:30 lun-ven promemoria controllo serale.
- Schema: `pulizie/supabase/schema.sql` + `pulizie/supabase/v2.sql` + `pulizie/supabase/v3.sql`.
