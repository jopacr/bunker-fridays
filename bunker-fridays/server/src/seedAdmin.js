// Create or update an admin account from the command line:
//   node src/seedAdmin.js admin@bunkerstratford.com "a strong password"
// or via env: ADMIN_EMAIL / ADMIN_PASSWORD with `npm run seed:admin`.
// TOTP enrollment happens in-app after first sign-in (Knowledge tab → Security).

import { q } from "./db.js";
import { hashPassword } from "./auth/passwords.js";
import { uid } from "./db.js";

const email = (process.argv[2] || process.env.ADMIN_EMAIL || "").toLowerCase().trim();
const password = process.argv[3] || process.env.ADMIN_PASSWORD || "";

if (!email || !password) {
  console.error("Usage: node src/seedAdmin.js <email> <password>");
  process.exit(1);
}
if (password.length < 10) {
  console.error("Pick a password of at least 10 characters.");
  process.exit(1);
}

const pwHash = await hashPassword(password);
const [existing] = await q("SELECT id FROM admin_users WHERE email = $1", [email]);
if (existing) {
  await q("UPDATE admin_users SET pw_hash = $2 WHERE id = $1", [existing.id, pwHash]);
  console.log(`Updated password for admin ${email}.`);
} else {
  await q("INSERT INTO admin_users (id, email, pw_hash) VALUES ($1,$2,$3)", [uid(), email, pwHash]);
  console.log(`Created admin ${email}. Sign in at the desk, then enrol TOTP under Security.`);
}
process.exit(0);
