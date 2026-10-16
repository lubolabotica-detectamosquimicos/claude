# 🌿 LuBo la botica — Lector de ingredientes con semáforo

Web app (lista para crecer a app móvil) que **escanea la etiqueta de ingredientes con la cámara del celular** y
muestra un **semáforo LuBo** (verde / amarillo / rojo) según la lista maestra de LuBo.

> **Regla de oro:** la clasificación es **100 % local**. La foto, el OCR y el semáforo funcionan en el dispositivo,
> sin consultar internet ni bases de datos externas. Funciona sin conexión una vez cargada la app.

---

## Qué hace

| Función | Detalle |
|---|---|
| 📷 Escáner | Captura foto → vista previa → OCR local (Tesseract, español + inglés) → semáforo. Si la cámara está denegada, permite subir/tomar una foto. |
| ⌨️ Texto manual | Escribe un ingrediente o pega la lista → semáforo al instante. **Ilimitado en todos los planes.** |
| 🚦 Semáforo | Verde / Amarillo / Rojo / *Sin datos* (si nada coincide con la base, **nunca** se muestra verde). |
| 📋 Base LuBo | **Fuente única: el Excel de OneDrive** (solo lectura, nunca se modifica). La app se actualiza sola cuando el Excel cambia y recalcula el semáforo. Incluye una copia de arranque para el primer uso sin conexión. |
| 💳 Planes | Free (2 escaneos de cámara/semana) · Mensual · Anual · Aporte voluntario (1 año). Pago con Mercado Pago **verificado por webhook → Firebase**. |
| 🔐 Panel admin | Firebase Auth (correo + contraseña), **se inicia sesión una sola vez**. Estado de la sincronización con OneDrive y revisión de calidad del Excel. |

---

## Arquitectura por capas

```
┌──────────────────────────────────────────────────────────────────────┐
│ 1. INTERACTIVA  (src/components)                                     │
│    ScanScreen · CameraViewfinderModal · FichaTecnicaModal ·          │
│    HistoryScreen · SavedScreen · ProfileScreen · InicioFormModal ·   │
│    AdminPanelModal (carga diferida) · TrafficLightBadge              │
├──────────────────────────────────────────────────────────────────────┤
│ 2. PROCESAMIENTO  (src/services)  — siempre en el dispositivo        │
│    ingredientMatcher → clasifica texto contra la base                │
│    ocrService        → Tesseract local (assets propios)              │
│    productFactory    → análisis → ficha; recalcula si la base cambia │
├──────────────────────────────────────────────────────────────────────┤
│ 3. BACKEND / DATOS                                                   │
│  En el dispositivo:  localVault (base + sesión cifrada) ·            │
│    ingredientSync (mantiene la base = Excel) ·                       │
│    entitlementService (verifica pagos con clave pública)             │
│  En el servidor (Vercel Functions, carpeta /api):                    │
│    /api/ingredients         OneDrive (solo lectura) → lista          │
│    /api/mercadopago-webhook Mercado Pago → Firestore                 │
│    /api/claim-payment       pago aprobado → acceso firmado           │
│  Firebase: Authentication (panel admin) + Firestore (pagos)          │
└──────────────────────────────────────────────────────────────────────┘
```

Las capas solo dependen hacia abajo: la interfaz llama a procesamiento y datos; el procesamiento no conoce la interfaz.
Firebase **no se carga** para escanear: solo cuando se abre el Panel administrativo.

---

## Inicio rápido (tu computador)

Requisitos: **Node.js 20 o superior**.

```bash
npm install            # instala y copia los recursos del OCR a public/ocr (automático)
cp .env.example .env.local   # y rellena tus valores (ver más abajo)
npm run dev            # http://localhost:5173  (solo la app; /api no corre aquí)
```

Para probar también el servidor (`/api`) en local: `npx vercel dev` (necesita las variables privadas). Sin él, `npm run dev` funciona y la app usa la copia de arranque.

Otros comandos: `npm test` (pruebas del motor) · `npm run lint` (tipos) · `npm run build` · `npm run preview`.

> **Cámara:** el navegador solo permite la cámara en **HTTPS** o en `localhost`. En Vercel ya es HTTPS.

---

## Variables de entorno

Dos grupos (detalle comentado en `.env.example`):

**Públicas (`VITE_*`)** — `.env.local` en tu PC y Vercel. Quedan dentro del JavaScript del navegador:

| Variable | Para qué |
|---|---|
| `VITE_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_APP_ID` | Firebase Auth (panel admin). La *apiKey* web es un identificador público. |
| `VITE_ADMIN_EMAILS` | Correos que pueden abrir el panel admin |
| `VITE_ENTITLEMENT_PUBLIC_KEY` | Clave **pública** para verificar los pagos (la genera `npm run keys:generate`) |
| `VITE_PAYMENT_LINK_MONTHLY` / `_ANNUAL` / `_SUPPORT` | Enlaces de pago (opcionales) |
| `VITE_SYNC_INTERVAL_MINUTES` | Frecuencia de revisión del Excel (por defecto 10) |

**Privadas (sin `VITE_`)** — **solo en Vercel**, nunca en GitHub:

| Variable | Para qué |
|---|---|
| `ONEDRIVE_FILE_URL` | Enlace de tu Excel en OneDrive (solo lectura) |
| `MP_ACCESS_TOKEN` | Access Token de **producción** de Mercado Pago |
| `MP_WEBHOOK_SECRET` | Clave secreta del webhook de Mercado Pago |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Cuenta de servicio de Firebase (para Firestore) |
| `ENTITLEMENT_PRIVATE_KEY` | Clave **privada** de firma de accesos (`npm run keys:generate`) |
| `PLAN_PRICE_MONTHLY`, `PLAN_PRICE_ANNUAL`, `SUPPORT_MIN_AMOUNT` | Opcionales (por defecto 6500 / 30000 / 5000 COP) |

> ⚠️ Lo que lleva `VITE_` lo puede ver cualquiera. Las claves privadas jamás llevan ese prefijo. `.gitignore` ya excluye
> `.env*` (salvo `.env.example`) y los JSON de cuentas de servicio.

---

## Configurar Firebase (una sola vez)

1. [console.firebase.google.com](https://console.firebase.google.com) → *Crear proyecto*.
2. *Authentication ▸ Sign-in method* → activa **Correo electrónico/contraseña**.
3. *Authentication ▸ Users* → **Agregar usuario** con tu correo de administrador y una contraseña.
   (No hay registro público: nadie más puede crear cuentas desde la app.)
4. *Authentication ▸ Settings ▸ Authorized domains* → añade tu dominio de Vercel (`xxx.vercel.app` y el dominio propio).
5. *Configuración del proyecto ▸ Tus apps ▸ Web (`</>`)* → copia la config a las variables `VITE_FIREBASE_*`.
6. Pon tu correo en `VITE_ADMIN_EMAILS`.

En la app: **Perfil ▸ Panel administrativo**. Inicias sesión una vez; el dispositivo recuerda la sesión (también sin internet).

---

## Subir a GitHub y desplegar en Vercel

```bash
git init
git add .
git commit -m "LuBo la botica v1.0.0"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/lubo-la-botica.git
git push -u origin main
```

Antes del primer `git push` verifica que **no** se suba nada secreto: `git status` no debe listar `.env.local`
(el `.gitignore` ya lo excluye). Recomendado: repositorio **privado**.

En Vercel: *Add New ▸ Project ▸ Import* el repositorio. Vercel detecta Vite y usa `npm run build`
(`vercel.json` ya incluye cabeceras de seguridad y permiso de cámara). Añade las variables de entorno y despliega.
El paso `postinstall` copia los recursos del OCR automáticamente.

---

## Base de ingredientes: el Excel de OneDrive es la única fuente

**Cómo funciona**

1. Tú editas el Excel en OneDrive (la app **nunca** lo modifica: solo hace descargas de lectura).
2. `/api/ingredients` (servidor) lee el Excel y calcula un *hash* de su contenido.
3. La app lo consulta al abrirse, cada 10 min, al volver a la pestaña y al recuperar la conexión. Si el contenido cambió,
   reemplaza su copia local y **recalcula el semáforo** de lo que ya está en pantalla, el historial y los favoritos.
4. La clasificación siempre es local: sin conexión se usa la última copia sincronizada. La primera vez que alguien abre la app sin
   internet se usa la copia de arranque incluida en el código.

**Configurarlo**

1. En OneDrive: Compartir → **"Cualquier persona con el enlace puede ver"** (solo ver, no editar).
2. En Vercel: variable `ONEDRIVE_FILE_URL` = ese enlace.
3. Pruébalo desde tu PC antes de desplegar:
   ```bash
   ONEDRIVE_FILE_URL="https://1drv.ms/x/c/..." npm run check:onedrive
   ```
   Debe mostrar cuántos ingredientes hay por color. Si falla, el mensaje indica el motivo (p. ej. enlace privado).

**Formato del Excel** (primera hoja con estos encabezados): `Categoria_Color · Químico · Uso principal · Riesgo funcional o Beneficio · Nivel de toxisidad (%) · Producto donde se usa más`.
Colores válidos: Verde, Amarillo, Rojo (cualquier otro se trata como Rojo por seguridad). Una lista con menos de 20 filas se considera dañada y se ignora.
El Panel administrativo muestra el estado, el conteo por color y los términos que apuntan a colores distintos.

> Los cambios del Excel llegan a los usuarios en minutos, sin volver a desplegar. La copia de arranque (`src/data/initialIngredients.ts`)
> solo se usa si nunca hubo sincronización.

---

## Pagos: Mercado Pago → webhook → Firebase

```
Usuario paga con el enlace ─► Mercado Pago ─► POST /api/mercadopago-webhook
                                                  │ valida firma + consulta el pago real a la API de MP
                                                  ▼
                                        Firestore: payments/{id}  (aprobado / reembolsado…)
Usuario escribe correo + nº de operación ─► POST /api/claim-payment
                                                  │ pago aprobado + mismo correo + no vencido
                                                  ▼
                       acceso FIRMADO (ECDSA) ─► la app lo verifica con la clave pública ─► plan activo
```

| Plan | Cómo se reconoce | Duración |
|---|---|---|
| Mensual | pago de $6.500 COP | 30 días |
| Anual | pago de $30.000 COP | 365 días |
| Aporte voluntario | cualquier otro pago aprobado ≥ $5.000 COP | 365 días |

* Sin acceso firmado válido **no se activa ningún plan** (no se puede fabricar uno editando el navegador).
* Reembolso o contracargo → el webhook marca el pago y deja de ser reclamable.
* Cada pago se puede activar en máx. 5 dispositivos. El acceso se revalida cada vez que se abre la app.
* Un aporte voluntario de exactamente $6.500 o $30.000 se interpreta como plan mensual/anual.

### Configuración (una sola vez)

1. **Claves de firma:** `npm run keys:generate` → pega la privada en `ENTITLEMENT_PRIVATE_KEY` (Vercel) y la pública en `VITE_ENTITLEMENT_PUBLIC_KEY`.
2. **Firestore:** Firebase Console ▸ *Firestore Database* ▸ crear (modo producción) ▸ pestaña *Reglas* ▸ pega `firestore.rules` (bloquea todo acceso desde navegadores).
3. **Cuenta de servicio:** Firebase ▸ Configuración ▸ *Cuentas de servicio* ▸ *Generar nueva clave privada*. Del JSON copia `project_id`, `client_email` y `private_key` a las variables `FIREBASE_*` de Vercel (la clave con los saltos de línea como `\n`). **No subas ese JSON a GitHub.**
4. **Mercado Pago:** [mercadopago.com.co/developers](https://www.mercadopago.com.co/developers) ▸ *Tus integraciones* ▸ crea una aplicación ▸
   - *Credenciales de producción* ▸ **Access Token** → `MP_ACCESS_TOKEN`.
   - *Webhooks* ▸ URL de producción `https://TU-DOMINIO/api/mercadopago-webhook`, evento **Pagos** ▸ guarda ▸ copia la **Clave secreta** → `MP_WEBHOOK_SECRET`.
   - Usa **Simular notificación** para comprobar que responde 200.
5. **Prueba real:** haz un pago pequeño con tu enlace, confirma que aparece en Firestore (`payments`) y actívalo desde la app con tu correo y número de operación.

> ⚠️ **Verifica en tu primera prueba real** que Mercado Pago notifica los pagos hechos con tus *enlaces de pago* (algunas cuentas
> los notifican solo por IPN). Si no llega nada: en Mercado Pago activa también *Notificaciones IPN* con la misma URL (el servidor ya
> acepta ese formato) o crea los cobros desde la API en lugar de enlaces fijos.

---

## Seguridad: lo que sí y lo que no garantiza

* ✅ Sin llaves, PIN ni correos de dueño en el código. Secretos solo en variables privadas del servidor.
* ✅ OneDrive: solo lectura, el enlace nunca llega al navegador.
* ✅ Pagos: la fuente de verdad es la API de Mercado Pago; los accesos van firmados y se verifican en el dispositivo.
* ✅ Firestore cerrado a navegadores (`firestore.rules`); solo el servidor lo usa.
* ⚠️ La bóveda local usa una llave aleatoria por dispositivo: protege de lecturas casuales, no de quien controla su navegador.
  Por eso lo que importa (el plan) depende de la **firma**, no del cifrado local.
* ⚠️ El panel admin valida con Firebase + `VITE_ADMIN_EMAILS`; solo muestra estado, no edita datos.

---

## Pruebas

```bash
npm test
```

83 pruebas: motor de clasificación (falsos positivos históricos, estado *Sin datos*, E-números, OCR, integridad de la base),
lectura del Excel de OneDrive, webhook de Mercado Pago (firma, plan por monto, reembolsos, IPN), reclamo de pagos y accesos
firmados (incluida la manipulación).

---

## Estructura

```
├─ public/ocr/            ← (generado) worker, núcleo WASM y modelos spa/eng del OCR
├─ api/                   ← Vercel Functions (servidor)
│  ├─ ingredients.ts · mercadopago-webhook.ts · claim-payment.ts
│  └─ _lib/               ← onedrive · mercadopago · entitlement · store (Firestore)
├─ scripts/
│  ├─ copy-ocr-assets.mjs · generate-entitlement-keys.mjs · check-onedrive.ts
│  └─ test-matcher.ts · test-api.ts · fixtures/
├─ src/
│  ├─ components/         ← capa interactiva
│  ├─ services/           ← procesamiento y datos
│  ├─ config/             ← env.ts, plans.ts
│  ├─ data/               ← base LuBo, datos de muestra
│  ├─ types/
│  └─ App.tsx · main.tsx · index.css
├─ firestore.rules · firebase.json
├─ .env.example · .gitignore · vercel.json · vite.config.ts · tsconfig.json
```

`StorePreview.tsx` y `data/productSuggestions.ts` corresponden a la futura fase de **sugerencias y venta de producto**:
están en el repositorio pero todavía no se muestran en la app.

---

## Solución de problemas

* **“Permiso de cámara denegado”** → actívalo en el candado de la barra de direcciones, o usa el botón de galería para subir una foto.
* **El OCR no encuentra texto** → acércate a la lista de ingredientes, buena luz, sin reflejos. Puedes corregir el texto leído antes de clasificar.
* **Avisos `EBADENGINE` al instalar** → son advertencias del SDK de Firebase; no afectan (corre en el navegador).
* **“La lista no se actualiza”** → abre el Panel administrativo ▸ *Sincronizar ahora*: el mensaje explica el motivo. Revisa `ONEDRIVE_FILE_URL` con `npm run check:onedrive`.
* **“Los pagos verificados aún no están configurados”** → falta `VITE_ENTITLEMENT_PUBLIC_KEY` (y volver a desplegar).
* **“Firebase no está configurado”** → faltan las variables `VITE_FIREBASE_*` (ver arriba) y hay que reiniciar `npm run dev`.

---

© LuBo la botica · Certificación Vida sin Químicos
