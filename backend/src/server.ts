import { buildApp } from './app';

async function main() {
  const app = await buildApp();

  const PORT = Number(process.env.PORT) || 3000;

  try {
    // Host 0.0.0.0 is required for Docker networking
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();