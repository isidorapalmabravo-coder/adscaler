import { LegalPage } from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Política de privacidad · Adscaler" };

export default function Privacidad() {
  return (
    <LegalPage titulo="Política de privacidad">
      <p className="muted small">Última actualización: {LEGAL.actualizado}</p>
      <p>{LEGAL.titular} es responsable del tratamiento de tus datos en {LEGAL.empresa} ({LEGAL.sitio}), conforme a la legislación chilena de protección de datos personales.</p>

      <h2>1. Qué datos recogemos</h2>
      <ul>
        <li><strong>Cuenta:</strong> nombre, correo y contraseña (guardada de forma cifrada).</li>
        <li><strong>Contenido que subes:</strong> briefs, guiones, fotos de producto, videos de referencia y lo que generas con la herramienta.</li>
        <li><strong>Pagos:</strong> el estado y monto de tu compra. Los datos de tu tarjeta los maneja Mercado Pago y nosotros no los vemos ni guardamos.</li>
        <li><strong>Uso técnico:</strong> registros básicos para seguridad y para arreglar errores.</li>
      </ul>

      <h2>2. Para qué los usamos</h2>
      <ul>
        <li>Darte acceso y entregarte el servicio (crear imágenes, prompts, voces y videos).</li>
        <li>Procesar tus pagos y activar tu plan o créditos.</li>
        <li>Darte soporte y avisarte cambios importantes.</li>
        <li>Mantener la seguridad y evitar abusos.</li>
      </ul>
      <p>No vendemos tus datos ni usamos tu contenido para publicidad de terceros.</p>

      <h2>3. Con quién los compartimos</h2>
      <p>Solo con proveedores necesarios para operar el servicio: Mercado Pago (pagos), proveedores de inteligencia artificial como Google (Gemini) y OpenAI, que reciben tu contenido para generar los resultados, y Railway (alojamiento). Estos proveedores pueden estar fuera de Chile.</p>

      <h2>4. Cuánto tiempo los guardamos</h2>
      <p>Mientras tu cuenta esté activa. Si pides borrarla, eliminamos tus datos y contenido, salvo lo que debamos conservar por obligaciones legales o tributarias.</p>

      <h2>5. Tus derechos</h2>
      <p>Puedes pedir acceso, rectificación, eliminación u oposición al uso de tus datos escribiendo a {LEGAL.email}. Respondemos lo antes posible.</p>

      <h2>6. Seguridad y cookies</h2>
      <p>Usamos medidas razonables para proteger tus datos. Usamos solo una cookie de sesión necesaria para mantenerte conectado; no usamos cookies de publicidad.</p>

      <h2>7. Cambios y contacto</h2>
      <p>Podemos actualizar esta política y publicaremos la nueva versión aquí. Contacto: {LEGAL.email}.</p>
    </LegalPage>
  );
}
