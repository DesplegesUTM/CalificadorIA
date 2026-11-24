'use strict';

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...');

  // ========== USUARIOS ==========
  const adminPassword = await bcrypt.hash('admin123', 12);
  const teacherPassword = await bcrypt.hash('docente123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@evaluadoria.com' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@evaluadoria.com',
      password: adminPassword,
      role: 'ADMIN',
    },
  });

  const teacher = await prisma.user.upsert({
    where: { email: 'docente@evaluadoria.com' },
    update: {},
    create: {
      name: 'Prof. María González',
      email: 'docente@evaluadoria.com',
      password: teacherPassword,
      role: 'TEACHER',
    },
  });

  console.log('✅ Usuarios creados');

  // ========== ASIGNATURAS ==========
  const subject1 = await prisma.subject.upsert({
    where: { code: 'COMP-101' },
    update: {},
    create: {
      name: 'Comprensión y Producción de Textos',
      code: 'COMP-101',
      description: 'Desarrollo de habilidades de lectura crítica y escritura académica',
      userId: teacher.id,
    },
  });

  const subject2 = await prisma.subject.upsert({
    where: { code: 'INV-201' },
    update: {},
    create: {
      name: 'Metodología de Investigación',
      code: 'INV-201',
      description: 'Fundamentos del proceso de investigación científica',
      userId: teacher.id,
    },
  });

  console.log('✅ Asignaturas creadas');

  // ========== ACTIVIDAD DE EJEMPLO ==========
  let activity = await prisma.academicActivity.findFirst({
    where: { title: 'Resumen sobre Inteligencia Artificial', userId: teacher.id },
  });

  if (!activity) {
    activity = await prisma.academicActivity.create({
      data: {
        title: 'Resumen sobre Inteligencia Artificial',
        description: 'Los estudiantes deben elaborar un resumen analítico sobre los conceptos fundamentales de la inteligencia artificial.',
        objectives: '1. Identificar los conceptos clave de la IA\n2. Sintetizar información de múltiples fuentes\n3. Expresar ideas con claridad y coherencia',
        instructions: 'Elabore un resumen de 300-500 palabras sobre los fundamentos de la inteligencia artificial. Incluya definiciones, aplicaciones y reflexión crítica.',
        userId: teacher.id,
        subjectId: subject1.id,
      },
    });
  }

  // Contexto académico
  await prisma.academicContext.upsert({
    where: { activityId: activity.id },
    update: {},
    create: {
      activityId: activity.id,
      description: 'Actividad de síntesis sobre inteligencia artificial para estudiantes de primer año.',
      objectives: 'Desarrollar la capacidad de síntesis y análisis crítico sobre temas de tecnología emergente.',
      instructions: 'El resumen debe contener: introducción al tema, desarrollo con conceptos clave, y conclusión reflexiva. Mínimo 300 palabras.',
      baseText: 'La inteligencia artificial (IA) es la simulación de procesos de inteligencia humana por parte de sistemas informáticos. Estos procesos incluyen el aprendizaje (la adquisición de información y reglas para el uso de la información), el razonamiento (usar las reglas para llegar a conclusiones aproximadas o definitivas), y la autocorrección.',
      additionalInfo: 'Se valorará el uso de vocabulario técnico apropiado y la coherencia argumentativa del texto.',
    },
  });

  // Rúbrica de ejemplo
  let rubric = await prisma.rubric.findUnique({ where: { activityId: activity.id } });
  if (!rubric) {
    rubric = await prisma.rubric.create({
      data: {
        activityId: activity.id,
        name: 'Rúbrica de Evaluación de Resúmenes',
        description: 'Criterios para evaluar resúmenes y ensayos académicos',
        totalScore: 100,
        criteria: {
          create: [
            {
              name: 'Estructura y organización',
              description: 'El texto presenta una estructura clara con introducción, desarrollo y conclusión. Las ideas están organizadas lógicamente.',
              maxScore: 20,
              order: 0,
              levels: JSON.stringify([
                { name: 'Excelente', description: 'Estructura perfectamente definida y coherente', scorePercentage: 100 },
                { name: 'Bueno', description: 'Estructura clara con algunas inconsistencias menores', scorePercentage: 75 },
                { name: 'Regular', description: 'Estructura parcialmente definida', scorePercentage: 50 },
                { name: 'Insuficiente', description: 'Carece de estructura organizada', scorePercentage: 25 },
              ]),
            },
            {
              name: 'Ortografía y gramática',
              description: 'El texto no presenta errores ortográficos ni gramaticales. El vocabulario es apropiado y variado.',
              maxScore: 20,
              order: 1,
              levels: JSON.stringify([
                { name: 'Excelente', description: 'Sin errores, vocabulario rico y preciso', scorePercentage: 100 },
                { name: 'Bueno', description: 'Máximo 2-3 errores menores', scorePercentage: 75 },
                { name: 'Regular', description: '4-7 errores que no afectan la comprensión', scorePercentage: 50 },
                { name: 'Insuficiente', description: 'Múltiples errores que dificultan la comprensión', scorePercentage: 25 },
              ]),
            },
            {
              name: 'Comprensión del tema',
              description: 'El texto demuestra comprensión profunda del tema. Se identifican correctamente los conceptos clave.',
              maxScore: 25,
              order: 2,
              levels: JSON.stringify([
                { name: 'Excelente', description: 'Comprensión profunda y análisis crítico', scorePercentage: 100 },
                { name: 'Bueno', description: 'Buena comprensión con análisis básico', scorePercentage: 75 },
                { name: 'Regular', description: 'Comprensión parcial del tema', scorePercentage: 50 },
                { name: 'Insuficiente', description: 'Comprensión superficial o incorrecta', scorePercentage: 25 },
              ]),
            },
            {
              name: 'Redacción y coherencia',
              description: 'Las ideas se expresan con claridad. El texto es fluido, coherente y bien cohesionado.',
              maxScore: 20,
              order: 3,
            },
            {
              name: 'Síntesis y originalidad',
              description: 'El estudiante logra sintetizar la información con sus propias palabras. No es una copia literal de las fuentes.',
              maxScore: 15,
              order: 4,
            },
          ],
        },
      },
    });
  }

  // ========== CONFIGURACIÓN IA ==========
  const existingConfig = await prisma.aIProviderConfiguration.findFirst({
    where: { provider: 'GEMINI' },
  });

  if (!existingConfig) {
    await prisma.aIProviderConfiguration.create({
      data: {
        name: 'Google Gemini (Principal)',
        provider: 'GEMINI',
        model: 'gemini-3.8-flash',
        apiKey: process.env.GEMINI_API_KEY || null,
        isDefault: true,
        isActive: true,
        status: process.env.GEMINI_API_KEY ? 'active' : 'unconfigured',
      },
    });

    await prisma.aIProviderConfiguration.create({
      data: {
        name: 'OpenAI GPT-4o',
        provider: 'OPENAI',
        model: 'gpt-4o',
        isDefault: false,
        isActive: false,
        status: 'unconfigured',
      },
    });

    await prisma.aIProviderConfiguration.create({
      data: {
        name: 'Anthropic Claude',
        provider: 'CLAUDE',
        model: 'claude-3-5-sonnet-20241022',
        isDefault: false,
        isActive: false,
        status: 'unconfigured',
      },
    });
  }

  console.log('✅ Configuración de IA creada');

  // ========== ESTUDIANTES Y ENTREGAS DE EJEMPLO ==========
  const students = [
    { fullName: 'Ana Martínez López', email: 'ana.martinez@estudiante.edu', studentId: '2024001' },
    { fullName: 'Carlos Rodríguez Pérez', email: 'carlos.rodriguez@estudiante.edu', studentId: '2024002' },
    { fullName: 'Sofía Hernández García', email: 'sofia.hernandez@estudiante.edu', studentId: '2024003' },
  ];

  for (const s of students) {
    const student = await prisma.student.upsert({
      where: { email: s.email },
      update: {},
      create: s,
    }).catch(async () => {
      return await prisma.student.findFirst({ where: { fullName: s.fullName } });
    });

    // Verificar si ya tiene entrega
    const existingSubmission = await prisma.submission.findFirst({
      where: { studentId: student.id, activityId: activity.id },
    });

    if (!existingSubmission) {
      await prisma.submission.create({
        data: {
          studentId: student.id,
          activityId: activity.id,
          title: activity.title,
          originalFile: `resumen_ia_${s.studentId}.pdf`,
          storedFile: `ejemplo_${s.studentId}.pdf`,
          fileSize: 102400,
          mimeType: 'application/pdf',
          textContent: `La inteligencia artificial (IA) representa una de las innovaciones tecnológicas más significativas del siglo XXI. En esencia, la IA busca replicar la capacidad cognitiva humana en máquinas, permitiéndoles aprender, razonar y resolver problemas de manera autónoma.\n\nUno de los pilares fundamentales de la IA es el aprendizaje automático (machine learning), donde los sistemas analizan grandes volúmenes de datos para identificar patrones y mejorar su rendimiento sin ser programados explícitamente. El aprendizaje profundo (deep learning), una subdisciplina del machine learning, utiliza redes neuronales artificiales para procesar información de manera similar al cerebro humano.\n\nLas aplicaciones de la IA son vastas y transformadoras: desde asistentes virtuales como Siri y Alexa, hasta sistemas de diagnóstico médico, vehículos autónomos y herramientas de traducción automática. En el campo educativo, la IA permite personalizar el aprendizaje según las necesidades individuales de cada estudiante.\n\nSin embargo, el avance de la IA también plantea interrogantes éticos importantes: la privacidad de los datos, el sesgo algorítmico y el impacto en el empleo son temas que requieren reflexión crítica. Es fundamental desarrollar marcos regulatorios que garanticen un uso responsable y equitativo de estas tecnologías.\n\nEn conclusión, la inteligencia artificial es una herramienta poderosa con el potencial de transformar positivamente múltiples aspectos de la vida humana, siempre que se desarrolle y aplique con responsabilidad, transparencia y consideración hacia los valores humanos fundamentales.`,
          status: 'PENDING',
        },
      });
    }
  }

  console.log('✅ Estudiantes y entregas de ejemplo creadas');
  console.log('\n🎉 ¡Seed completado exitosamente!\n');
  console.log('📋 Credenciales de acceso:');
  console.log('   👤 Admin: admin@evaluadoria.com / admin123');
  console.log('   👤 Docente: docente@evaluadoria.com / docente123');
  console.log('\n⚠️  Recuerde configurar su API Key de Gemini en:');
  console.log('   → Panel de Administración → Configuración de IA\n');
}

main()
  .catch(e => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
