import { LegalPage } from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Términos y condiciones · Adscaler" };

export default function Terminos() {
  return (
    <LegalPage titulo="Términos y condiciones">
      <p className="muted small">Última actualización: {LEGAL.actualizado}</p>
      <p>Estos términos regulan el uso de {LEGAL.empresa} ({LEGAL.sitio}), servicio operado por {LEGAL.titular}, Chile. Al crear una cuenta o comprar, aceptas estas condiciones.</p>

      <h2>1. Qué es Adscaler</h2>
      <p>Una herramienta online que, a partir de un brief, ayuda a crear la persona, imágenes, prompts de animación, voz y subtítulos para videos publicitarios. Usa servicios de inteligencia artificial de terceros, por lo que los resultados pueden variar y no se garantiza un resultado específico ni que un anuncio venda.</p>

      <h2>2. Tu cuenta</h2>
      <ul>
        <li>Debes ser mayor de 18 años y entregar datos verdaderos.</li>
        <li>Eres responsable de tu contraseña y de lo que se haga con tu cuenta. No puedes compartirla ni revenderla.</li>
      </ul>

      <h2>3. Planes, créditos y pagos</h2>
      <ul>
        <li>Los precios se muestran en pesos chilenos (CLP) con IVA incluido.</li>
        <li>Los pagos se procesan a través de Mercado Pago. Adscaler no almacena los datos de tu tarjeta.</li>
        <li>Cada plan o pack da un número de imágenes y videos, que se usan según lo indicado en la página de Planes.</li>
        <li>Los planes mensuales duran 30 días desde el pago. Al vencer, tu plan no se renueva automáticamente: debes pagar de nuevo para seguir con los beneficios del plan. Los créditos no usados al vencer el plan pueden perderse según lo indicado en la página de Planes.</li>
        <li>Los packs de videos son pagos únicos.</li>
      </ul>

      <h2>4. Devoluciones</h2>
      <p>Por tratarse de un servicio digital que se entrega de inmediato, una vez usados los créditos no hay devolución. Si tuviste un cobro duplicado, un error del sistema o no pudiste usar el servicio por una falla nuestra, escríbenos a {LEGAL.email} dentro de 10 días y lo revisamos para devolverte el monto o reponer tus créditos. Esto no limita los derechos que te da la Ley 19.496 sobre protección de los derechos de los consumidores.</p>

      <h2>5. Uso permitido</h2>
      <p>No puedes usar Adscaler para contenido ilegal, engañoso o fraudulento, para suplantar a personas reales, ni para infringir derechos de terceros. Tú eres responsable de tener los derechos sobre las fotos de producto, guiones y videos de referencia que subas, y de cumplir las reglas de las plataformas donde publiques tus anuncios.</p>

      <h2>6. Contenido que creas</h2>
      <p>El contenido que subes y el que generas con Adscaler es tuyo para tu uso comercial, en la medida que la ley y los términos de los proveedores de IA lo permitan. Nos das permiso para procesarlo con el único fin de entregarte el servicio.</p>

      <h2>7. Disponibilidad y responsabilidad</h2>
      <p>Hacemos lo posible por mantener el servicio disponible, pero puede haber interrupciones por mantención o fallas de proveedores externos. En la medida que la ley lo permita, nuestra responsabilidad se limita al monto que pagaste en los últimos 30 días.</p>

      <h2>8. Suspensión</h2>
      <p>Podemos suspender cuentas que incumplan estos términos o que usen el servicio de forma abusiva.</p>

      <h2>9. Cambios</h2>
      <p>Podemos actualizar estos términos y los precios. Los cambios importantes se avisarán en la web o por correo y no afectan a lo ya pagado.</p>

      <h2>10. Ley aplicable y contacto</h2>
      <p>Se aplica la ley chilena. Para consultas o reclamos escribe a {LEGAL.email}.</p>
    </LegalPage>
  );
}
