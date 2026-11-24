require('dotenv').config();

const app = require('./src/app');
const { logger } = require('./src/utils/logger');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`🚀 EvaluadorIA corriendo en http://localhost:${PORT}`);
  logger.info(`📚 Entorno: ${process.env.NODE_ENV || 'development'}`);
});
