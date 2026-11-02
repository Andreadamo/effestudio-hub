// Avviso del giorno prima all'incaricato pulizie (chiamata ogni sera da pg_cron)
import webpush from "npm:web-push@3.6.7";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const rpc = async (fn: string, args: unknown) => {
  const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`${fn}: ${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
};

Deno.serve(async (req) => {
  try {
    const { secret } = await req.json().catch(() => ({}));
    const job = await rpc("pul_push_job", { p_secret: secret });
    webpush.setVapidDetails(job.vapid.subject, job.vapid.public, job.vapid.private);
    const sent: { person: string; role: string }[] = [];
    const gone: string[] = [];
    for (const t of job.targets || []) {
      const body = JSON.stringify({
        title: "🧽 Domani sei l'incaricato pulizie",
        body: t.imp
          ? "Giorno impresa: controlla solo saponi e carta. Apri Check Pulizie per la checklist."
          : "Spogliatoi, cestini, desk e sala. Apri Check Pulizie per la checklist.",
        url: "/effestudio-hub/?app=pulizie",
        tag: "pulizie-" + job.date,
      });
      let ok = false;
      for (const s of t.subs || []) {
        try { await webpush.sendNotification(s, body, { TTL: 43200 }); ok = true; }
        catch (e) { const c = (e as { statusCode?: number }).statusCode; if (c === 404 || c === 410) gone.push(s.endpoint); }
      }
      if (ok) sent.push({ person: t.person, role: t.role });
    }
    await rpc("pul_push_done", { p_secret: secret, p_date: job.date, sent, gone });
    return Response.json({ date: job.date, targets: (job.targets || []).length, sent: sent.length, gone: gone.length });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 400 });
  }
});
