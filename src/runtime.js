async function startServer({ createApp, pool, config, checkSchema = async () => {}, prepareUploads = async () => {}, ...dependencies }) {
  let server;
  let timer;
  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    clearInterval(timer);
    try {
      if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    } finally { await pool.end(); }
  }
  try {
    const connection = await pool.getConnection();
    try { await connection.ping(); } finally { connection.release(); }
    await checkSchema(pool);
    await prepareUploads();
    const app = createApp({ pool, config, ...dependencies });
    if (app.locals.cleanupUploads) {
      await app.locals.cleanupUploads();
      timer = setInterval(() => app.locals.cleanupUploads().catch(() => {
        dependencies.logger?.error({ event: "upload_cleanup_failed" });
      }), 3600000);
      timer.unref();
    }
    server = await new Promise((resolve, reject) => {
      const listener = app.listen(config.port ?? Number(config.PORT || 3000), config.host || config.HOST || "0.0.0.0", () => resolve(listener));
      listener.once("error", reject);
    });
    return { server, close };
  } catch (error) {
    await close();
    throw error;
  }
}
module.exports = { startServer };
