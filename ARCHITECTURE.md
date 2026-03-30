# Arquitectura y Diseño de Sistema: Powerbud

## 1. Visión General
**Powerbud** es una plataforma integral de fitness y nutrición diseñada para dispositivos móviles (iOS y Android). Conecta a entrenadores con sus clientes, ofreciendo herramientas avanzadas para el seguimiento del progreso, asignación de rutinas y planes nutricionales. Además, incorpora inteligencia artificial (Google Gemini) para potenciar las capacidades de los entrenadores, automatizando la creación de rutinas personalizadas.

## 2. Componentes Principales

La arquitectura sigue un modelo cliente-servidor moderno, basado en microservicios o un monolito modular empaquetado en contenedores.

*   **Frontend (Aplicaciones Móviles):** Desarrolladas en tecnologías nativas o multiplataforma (como React Native o Flutter) para garantizar presencia tanto en la App Store (iOS) como en la Google Play Store (Android).
*   **Backend (API REST):** Construido en **Node.js con Express** (basado en la estructura actual del proyecto). Este servidor actuará como el "cerebro" central, gestionando la lógica de negocio, la autenticación y las conexiones a servicios externos.
*   **Base de Datos Relacional (PostgreSQL):** Una base de datos robusta, estructurada y escalable. Ideal para mantener la integridad de los datos relacionales (ej. un entrenador tiene muchos clientes, un cliente tiene muchas medidas).
*   **Almacenamiento de Archivos (Amazon S3):** Utilizado exclusivamente para guardar archivos multimedia pesados: fotos de perfil, videos demostrativos de ejercicios, fotos de progreso de los clientes, etc. S3 es infinitamente escalable y económico para este propósito.

## 3. Gestión de Usuarios y Permisos

El sistema implementará un control de acceso basado en roles (RBAC):

*   **Rol Entrenador:**
    *   Puede crear y configurar su perfil profesional.
    *   Gestión de su cartera de clientes (invitar, aceptar o dar de baja).
    *   Crear, leer, actualizar y eliminar (CRUD) rutinas y planes de nutrición para sus clientes.
    *   Acceso al panel de "IA Entrenadora" para generar rutinas base.
    *   Visualizar el progreso y métricas de sus entrenados.
*   **Rol Cliente (Entrenado):**
    *   Puede ver únicamente las rutinas y dietas asignadas por su entrenador.
    *   Registrar el cumplimiento de sus tareas diarias.
    *   Ingresar sus medidas corporales, peso y fotos de progreso (que se suben a S3).
*   **Seguridad:** Se utilizarán JSON Web Tokens (JWT) para la autenticación en la API. Cada vez que un usuario (entrenador o cliente) intente acceder a un recurso, el backend verificará su token y su rol antes de devolver información de la base de datos de PostgreSQL.

## 4. Servicio de IA: "La IA Entrenadora" (Google Gemini)

Para ofrecer rutinas inteligentes, el backend se integrará con la API de **Google Gemini**.

*   **Funcionamiento:** El entrenador (o el sistema de forma automatizada) enviará parámetros específicos del cliente (edad, peso, objetivo: hipertrofia/pérdida de grasa, lesiones, días disponibles) al backend.
*   **Procesamiento:** El backend construirá un *prompt* detallado y estructurado, combinando estos parámetros con las directrices y filosofía de entrenamiento de Powerbud. Este prompt se enviará a Gemini.
*   **Respuesta:** Gemini devolverá una propuesta de rutina estructurada en formato JSON.
*   **Revisión:** El entrenador podrá revisar, ajustar y finalmente aprobar esta rutina antes de que sea visible para el cliente en la app móvil. Esto asegura calidad y un toque humano.

## 5. Infraestructura de Pagos (Colombia y LatAm)

Dado el enfoque en Colombia y Latinoamérica, y el requerimiento de usar **PSE**, se integrará una pasarela de pagos regional (como **ePayco** o **Wompi**, ya que MercadoPago no es la opción ideal si buscas exclusividad o mejor experiencia nativa con PSE en Colombia).

*   **Modelo de Negocio:** Suscripciones mensuales (pagos recurrentes).
*   **Flujo:**
    1.  El usuario selecciona el plan de suscripción en la app.
    2.  El backend genera una intención de pago y se comunica con la pasarela (ej. ePayco).
    3.  El usuario es redirigido a la pasarela segura para completar el pago vía PSE (o tarjeta de crédito).
    4.  **Webhooks:** La pasarela de pago enviará una notificación (webhook) al backend de Powerbud confirmando si el pago fue exitoso o rechazado.
    5.  El backend actualiza el estado de la suscripción en PostgreSQL de forma automática, otorgando o revocando acceso.

## 6. Infraestructura, Escalabilidad y Despliegue (Docker)

Para garantizar que Powerbud esté siempre disponible y pueda manejar picos de tráfico (escalabilidad), utilizaremos **Docker** y servicios en la nube (como AWS, Google Cloud o DigitalOcean).

*   **Contenedores (Docker):** El código del backend en Node.js se empaquetará en una imagen de Docker. Esto garantiza que la aplicación se ejecute exactamente igual en el entorno de desarrollo que en producción.
*   **Orquestación:** Para producción, se usarán servicios de contenedores gestionados (como AWS ECS, Google Cloud Run o un clúster de Kubernetes). Estos servicios permiten:
    *   **Auto-escalado:** Si muchos usuarios se conectan al mismo tiempo, el sistema automáticamente "clonará" el contenedor de Node.js para repartir la carga. Cuando el tráfico baje, se reducirán los contenedores para ahorrar costos.
    *   **Alta Disponibilidad:** Si un contenedor falla, el orquestador lo reinicia automáticamente sin afectar a los usuarios.
*   **Base de Datos Gestionada:** PostgreSQL no vivirá en un contenedor simple, sino en un servicio gestionado (como AWS RDS o Google Cloud SQL). Esto asegura copias de seguridad automáticas (backups), actualizaciones de seguridad y facilidad para escalar el almacenamiento sin intervención manual.

## 7. Flujo de Actualizaciones y Mantenimiento (CI/CD)

Para actualizar las bases de datos y la aplicación de forma segura sin tiempos de inactividad (*zero-downtime deployments*):

1.  **Integración Continua (CI):** Cada vez que se hacen cambios en el código, se ejecutan pruebas automáticas para asegurar que nada se haya roto.
2.  **Entrega Continua (CD):** Si las pruebas pasan, se construye una nueva imagen de Docker automáticamente y se sube a un registro privado.
3.  **Despliegue Blue/Green:** El orquestador en la nube levanta los nuevos contenedores con la actualización. Una vez que están listos, el tráfico de los usuarios se enruta hacia la nueva versión. Esto asegura que la plataforma siempre esté disponible durante las actualizaciones.
