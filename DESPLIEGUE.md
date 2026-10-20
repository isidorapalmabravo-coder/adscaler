# Publicar Adscaler (GitHub + Railway + dominio)

## 1. Subir el proyecto a GitHub
1. Entra a github.com, crea una cuenta y un repositorio **privado** llamado `adscaler` (sin README).
2. En la terminal, dentro de esta carpeta:
   ```
   git init
   git add .
   git commit -m "Adscaler"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/adscaler.git
   git push -u origin main
   ```
3. Revisa en github.com que NO aparezcan las carpetas `data/` ni archivos `.env` / `claves.env`. Si aparecen, avísame antes de seguir.

## 2. Crear el servicio en Railway
1. railway.com → New Project → Deploy from GitHub repo → elige `adscaler`.
2. En el servicio: **Settings → Volumes → Add Volume**, montado en `/data`.
3. **Variables** (cópialas desde tu `.env.local`, nunca las pegues en chats ni en GitHub):
   - `OPENAI_API_KEY`, `GEMINI_API_KEY` (claves NUEVAS para producción, no las de prueba)
   - `DATA_DIR` = `/data`
   - `SESSION_SECRET` = un texto largo al azar (30+ caracteres)
   - `INVITE_CODE` = el código que darás a tus alumnos
   - `FREE_IMAGE_LIMIT` = `22`
   - `NODE_ENV` = `production`
4. **Settings → Networking → Generate Domain** para tener una dirección de prueba.

## 3. Primera cuenta
Abre la dirección y entra a `/registro`: la primera cuenta es la administradora. Hazlo tú antes de compartir el link.
Tus productos actuales viven en la carpeta `data/` de tu Mac; para llevarlos, avísame y los subo al disco del servidor.

## 4. Dominio propio
En Railway: Settings → Networking → Custom Domain → escribe tu dominio. Railway te muestra un registro CNAME para pegar en el panel donde compraste el dominio (DNS). Tarda de minutos a unas horas.

## Copias de seguridad
La app guarda una copia diaria de la base en `/data/backups` (las últimas 14). Descarga una copia de vez en cuando por si acaso.
