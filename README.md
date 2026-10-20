# Adscaler · del brief a Flow

App para crear anuncios con IA: subes el brief y te entrega el personaje, las imágenes de cada toma y los prompts de animación listos para pegar en Google Flow.

## Cómo abrirla en tu computador

1. Instala **Node.js 22** (https://nodejs.org) si no lo tienes.
2. Abre una terminal en esta carpeta y corre:
   ```
   npm install
   npm run dev
   ```
3. Abre **http://localhost:3000** en el navegador.

Sin claves funciona en **modo demo**: los prompts y las imágenes son de ejemplo, pero puedes recorrer todo el flujo.

## Activar la IA de verdad

1. Copia `.env.example` y renómbralo como `.env.local`.
2. Pega tus claves:
   - `GEMINI_API_KEY` → https://aistudio.google.com/apikey (lee el brief, los videos y las fotos del producto; escribe los prompts). Necesita facturación activa.
   - `OPENAI_API_KEY` → https://platform.openai.com/api-keys (genera las imágenes con GPT Image en calidad baja)
3. Reinicia con `npm run dev`.

## El flujo

1. **Producto**: fotos reales, qué es, oferta, lo que nunca se dice y los avatares (la IA te propone 3).
2. **Nuevo video**: UGC o B-roll, avatar, brief (.docx o texto) y videos de referencia.
3. **Personaje** (solo UGC): 2 opciones sobre fondo liso y apruebas una.
4. **Primera toma**: se genera con el personaje y las fotos del producto como referencia. Si te gusta, se generan las demás.
5. **Entrega**: cada toma con su imagen y su prompt de animación con botón para copiar, más un ZIP con todo.

## Dónde está cada cosa

- `lib/prompts.ts` → **el cerebro**: las instrucciones de entender el brief, escribir prompts e hiperrealismo. Pega tu markdown de Gemini en `METODO_PROPIO`.
- `lib/gemini.ts` → el cerebro en 2 pasos: (1) entiende el brief, los videos de referencia y las fotos del producto; (2) escribe el prompt del personaje y los de cada toma. Aquí también salen los avatares.
- `lib/images.ts` → generación de imágenes con GPT Image (calidad baja por defecto, referencias achicadas, créditos por calidad).
- `app/` → pantallas. `data/` → base de datos y archivos subidos (se crea solo).

## Cómo cuida el costo de las imágenes

- Calidad **baja** por defecto (~US$0,03 por toma con personaje y producto como referencia, según las pruebas).
- Las fotos de referencia se achican antes de enviarlas (`REF_MAX_PX_PRODUCT`, `REF_MAX_PX_PERSONA`) y solo se manda la primera foto del producto (`MAX_PRODUCT_REFS`).
- Cada toma tiene la casilla **Mayor calidad** (calidad media, gasta 3 créditos). Sirve para reintentar una toma que salió mal.
- El personaje se genera sobre fondo liso para que su cuarto no aparezca en las demás tomas.

## Lo que falta para venderla

- Cuentas de usuario (login) y que cada persona vea solo lo suyo.
- Cobro mensual (Mercado Pago o Flow.cl) y límite de imágenes por plan.
- Subirla a internet (Vercel + Supabase en vez de la carpeta `data/`).
