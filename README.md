# Effestudio HUB

Un'unica app installabile (PWA) che raccoglie le web app di Effestudio Training Center.

- Le app restano nei loro repository (`effeore`, `effestudio-merch`): l'HUB le apre al suo interno.
- Ogni app mantiene il suo accesso (email + PIN per EffeOre, PIN staff per il merch).
- Sezione **Amministrazione**: si sblocca con il PIN amministrazione di EffeOre (verificato dal server).
- Pagine Google che richiedono l'account Effestudio (Contabilità, Orari Trainer) si aprono nel browser.

- `prezzi.html`: prezziario servizi per lo staff (prezzi nell'elenco `LISTINO` in cima allo script).

Aggiungere un'app: una riga in `apps.js`.
