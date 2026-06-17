// Web Push (§2): VAPID via the PWA. iOS requires home-screen install.
import webpush from "web-push";
import { config } from "../config.js";
import { q } from "../db.js";

let ready = false;
if (config.vapid.publicKey && config.vapid.privateKey) {
  webpush.setVapidDetails(config.vapid.subject, config.vapid.publicKey, config.vapid.privateKey);
  ready = true;
}

export const pushEnabled = () => ready;
export const publicKey = () => config.vapid.publicKey;

export async function pushToArtist(artistId, payload) {
  if (!ready) return { sent: 0 };
  const subs = await q("SELECT * FROM push_subscriptions WHERE artist_id = $1", [artistId]);
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(s.subscription, JSON.stringify(payload));
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await q("DELETE FROM push_subscriptions WHERE id = $1", [s.id]);
      }
    }
  }
  return { sent };
}
