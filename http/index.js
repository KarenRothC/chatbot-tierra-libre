const express = require("express");
const routes = require("./routes/chatwoot-hook");

class ServerHttp {
  app;
  port = process.env.PORT ?? 3003;
  providerWs;
  constructor(_providerWs) {
    this.providerWs = _providerWs;
  }

  buildApp = () => {
    return this.app = express()
      .use(express.json())
      .use((req, _, next) => {
        req.providerWs = this.providerWs;
        next();
      })
      .use(routes)
      .listen(this.port, () =>
        console.log(`Listo por http://localhost:${this.port}`)
      );
  };

  // inicio la app
  start() {
    this.buildApp();
  };
}
module.exports = ServerHttp;
