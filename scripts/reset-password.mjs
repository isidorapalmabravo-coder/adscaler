// Cambia la contraseña de una cuenta de esta computadora (por si la olvidaste).
// Uso:  node scripts/reset-password.mjs tucorreo@gmail.com nuevaClave123
import fs from "fs";
import path from "path";
import crypto from "crypto";

const [email, pass] = process.argv.slice(2);
if (!email || !pass || pass.length < 8) {
  console.log("Uso: node scripts/reset-password.mjs tucorreo@gmail.com nuevaClave   (mínimo 8 caracteres)");
  process.exit(1);
}
const file = path.join(process.env.DATA_DIR || path.join(process.cwd(), "data"), "db.json");
const db = JSON.parse(fs.readFileSync(file, "utf8"));
const u = (db.users || []).find((x) => x.email === email.trim().toLowerCase());
if (!u) {
  console.log("No hay una cuenta con ese correo. Cuentas:", (db.users || []).map((x) => x.email).join(", ") || "(ninguna)");
  process.exit(1);
}
u.salt = crypto.randomBytes(16).toString("hex");
u.passHash = crypto.scryptSync(pass, u.salt, 64).toString("hex");
u.disabled = undefined;
fs.writeFileSync(file, JSON.stringify(db, null, 2));
console.log("Listo: ya puedes entrar con", u.email);
