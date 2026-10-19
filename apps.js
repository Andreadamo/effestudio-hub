// Elenco app dell'HUB. Per aggiungerne una: copia una riga e cambia i campi.
// area: "staff" (tutti) | "admin" (solo amministrazione)
// mode: "inside" = si apre dentro l'HUB | "browser" = si apre nel browser (pagine Google che richiedono l'account)
window.HUB_APPS = [
  { id: "effeore", area: "staff", mode: "inside", name: "EffeOre", sub: "Ore, PT, schede, pulizie",
    url: "https://andreadamo.github.io/effeore/", icon: "clock" },
  { id: "merch-staff", area: "staff", mode: "inside", name: "Merch Staff", sub: "Scanner, prenotazioni, etichette",
    url: "https://andreadamo.github.io/effestudio-merch/staff.html", icon: "scan" },
  { id: "merch-dash", area: "staff", mode: "inside", name: "Dashboard Merch", sub: "Incassi e magazzino",
    url: "https://andreadamo.github.io/effestudio-merch/dashboard.html", icon: "chart" },
  { id: "merch-cat", area: "staff", mode: "inside", name: "Catalogo Merch", sub: "Pagina prenotazione clienti",
    url: "https://andreadamo.github.io/effestudio-merch/", icon: "shirt" },
  { id: "merch-guida", area: "staff", mode: "inside", name: "Guida Merch", sub: "Vendita e incasso",
    url: "https://andreadamo.github.io/effestudio-merch/staff.html#guida", icon: "book" },

  { id: "effeore-admin", area: "admin", mode: "inside", name: "EffeOre Amministrazione", sub: "Compensi ed export commercialista",
    url: "https://andreadamo.github.io/effeore/dashboard.html", icon: "euro" },
  { id: "contabilita", area: "admin", mode: "browser", name: "Contabilità", sub: "Console · account Effestudio",
    url: "https://script.google.com/macros/s/AKfycbxXHMeAPztpOm2cUiYPC4SmRtXepK9goecd_lvw27c0al1N_DA5pVBXdF5MeltWnPfaZQ/exec", icon: "ledger" },
  { id: "orari", area: "admin", mode: "browser", name: "Orari Trainer", sub: "Turni e assenze",
    url: "https://script.google.com/macros/s/AKfycbw5F0wFet3LpyKTK3vWePLv9x3NWueH6OQAeRC4oe17y-_BIg8tezo1nneyVL6P1C1DqA/exec", icon: "calendar" }
];

// Verifica PIN amministrazione: usa lo stesso PIN amministrazione di EffeOre (controllo sul server)
window.HUB_ADMIN_API = "https://script.google.com/macros/s/AKfycby2-JgsaMQVF-f3jEAjULepaHx2EhQhhxUeUtY5adDkFz63BIuW3EhFmQUvoFMmrmZfGw/exec";
