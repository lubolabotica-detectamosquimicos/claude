/**
 * Genera el par de claves para firmar/verificar los derechos de acceso (ECDSA P-256).
 *   node scripts/generate-entitlement-keys.mjs
 *
 *  • PRIVADA → variable ENTITLEMENT_PRIVATE_KEY en Vercel (secreta; NUNCA en GitHub ni en VITE_*).
 *  • PÚBLICA → variable VITE_ENTITLEMENT_PUBLIC_KEY (puede ser pública).
 * Ejecútalo UNA sola vez y guarda la privada en un gestor de contraseñas. Si la cambias, los
 * accesos ya emitidos dejan de ser válidos.
 */
import { generateKeyPairSync } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const priv = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString().trim();
const pub = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

console.log('\n=== ENTITLEMENT_PRIVATE_KEY  (secreta · solo Vercel) ===');
console.log(priv.replace(/\n/g, '\\n'));
console.log('\n=== VITE_ENTITLEMENT_PUBLIC_KEY  (pública) ===');
console.log(pub);
console.log('\nCopia cada valor a Vercel ▸ Settings ▸ Environment Variables.\n');
