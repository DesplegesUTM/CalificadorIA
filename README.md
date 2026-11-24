# EvaluadorIA

Aplicacion web monolitica para evaluar resumenes y ensayos academicos con proveedores de inteligencia artificial. Esta construida con Node.js, Express, EJS, Tailwind CSS y Prisma con PostgreSQL.

## Funciones principales

- Gestion de asignaturas, actividades, contexto academico y rubricas.
- Importacion de PDFs individuales y paquetes ZIP exportados desde Moodle.
- Evaluacion individual y masiva con Google Gemini, OpenAI o Claude.
- Puntuacion por criterio, fortalezas, debilidades y recomendaciones.
- Gestion de usuarios y configuracion de proveedores desde el panel de administracion.
- Exportacion profesional de resultados a Excel.
- Metricas y evaluaciones recientes en el dashboard.

## Requisitos

- Node.js 18 o superior.
- PostgreSQL 13 o superior.
- Una API Key valida del proveedor de IA que se vaya a utilizar.

## Instalacion

1. Instale las dependencias:

```powershell
npm install
```

2. Cree y configure el archivo de entorno:

```powershell
Copy-Item .env.example .env
```

3. En `.env`, ubicado en la raiz del proyecto, configure la conexion PostgreSQL local y los secretos:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL="postgresql://postgres:TU_CONTRASENA@localhost:5432/evaluadoria?schema=public"
SESSION_SECRET="secreto-de-sesion-de-al-menos-32-caracteres"
GEMINI_API_KEY="PEGA_AQUI_TU_API_KEY_DE_GEMINI"
GEMINI_MODEL="gemini-3.8-flash"
```

Reemplace `TU_CONTRASENA` por la contrasena de su usuario PostgreSQL. La clave de Gemini se obtiene en Google AI Studio y se pega en `GEMINI_API_KEY` dentro de `.env`; alternativamente, puede guardarla desde **Administracion > Configuracion de IA**, en el campo **API Key** de Google Gemini. No comparta ni suba el archivo `.env`.

4. Cree las tablas, genere el cliente Prisma y cargue los datos de prueba:

```powershell
npm run db:generate
npx prisma db push
npm run db:seed
npm run build:css
```

5. Inicie el servidor:

```powershell
npm run dev
```

Abra `http://localhost:3000`.

## Usuarios de demostracion

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@evaluadoria.com` | `admin123` |
| Docente | `docente@evaluadoria.com` | `docente123` |

Cambie estas credenciales antes de usar el sistema en produccion.
El registro esta disponible desde el enlace **Regístrate** de la pantalla de inicio de sesion; las cuentas publicas se crean con rol de docente.

## Variables de entorno

| Variable | Requerida | Uso |
|---|---|---|
| `DATABASE_URL` | Si | Conexion PostgreSQL |
| `SESSION_SECRET` | Si | Firma segura de sesiones |
| `PORT` | No | Puerto HTTP; predeterminado `3000` |
| `GEMINI_API_KEY` | Para Gemini | Credencial principal de Google Gemini |
| `GEMINI_MODEL` | No | Modelo Gemini; predeterminado `gemini-3.8-flash` |
| `OPENAI_API_KEY` | Opcional | Credencial de OpenAI |
| `ANTHROPIC_API_KEY` | Opcional | Credencial de Anthropic Claude |
| `MAX_FILE_SIZE_MB` | No | Tamano maximo de subida; predeterminado `50` |
| `UPLOAD_DIR` | No | Carpeta de entregas; predeterminado `uploads` |
| `EXPORT_DIR` | No | Carpeta de reportes; predeterminado `exports` |

Las API keys tambien pueden guardarse desde **Administracion > Configuracion de IA**. Las claves almacenadas no se muestran al navegador. El archivo `.env` esta excluido de Git.

## Importacion de archivos Moodle

La aplicacion acepta:

- Un PDF individual desde la pantalla de entregas.
- Un ZIP obtenido con **Descargar todas las entregas** de Moodle.

Estructura esperada dentro del ZIP:

```text
NombreEstudiante_ID_assignsubmission_file_/
  archivo.pdf
```

El nombre del estudiante y el archivo se detectan automaticamente. Revise la vista previa antes de confirmar la importacion para corregir nombres o desmarcar archivos.

## Uso rapido

1. Inicie sesion como docente.
2. Cree una asignatura.
3. Cree una actividad y configure su contexto academico.
4. Agregue una rubrica y sus criterios.
5. Importe uno o varios PDF/ZIP.
6. Revise las entregas y ejecute la evaluacion individual o masiva.
7. Abra el informe detallado y exporte los resultados a Excel.

Los administradores pueden gestionar usuarios y cambiar el proveedor activo en **Administracion**.

## Comandos utiles

```powershell
npm run dev          # Servidor con recarga al detectar cambios
npm start            # Servidor normal
npm run build:css    # Compila Tailwind CSS
npm run db:generate  # Genera el cliente Prisma
npx prisma db push   # Sincroniza el esquema con PostgreSQL
npm run db:seed      # Carga datos de demostracion
npm run db:studio    # Abre Prisma Studio
```

## Estructura

```text
prisma/       Esquema y datos de prueba
public/       CSS y JavaScript del navegador
src/          Controladores, rutas, servicios y middleware
views/        Plantillas EJS
uploads/      Archivos importados
exports/      Reportes Excel generados
```
