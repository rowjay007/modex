import app from './app';
import { connectToDatabase } from './config/database';

const PORT = process.env.PORT || 3002;

const startServer = async () => {
  try {
    console.log('🔵 Initializing services...');
    await connectToDatabase();
    console.log('✅ Services initialized successfully.');

    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
      console.log(`📚 API Documentation available at http://localhost:${PORT}/docs`);
    });

    const gracefulShutdown = (signal: string) => {
      console.log(`
${signal} received. Shutting down gracefully...`);
      server.close(() => {
        console.log('🔴 Server closed.');
        // Add any cleanup logic here (e.g., close db connection)
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('🔴 Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
