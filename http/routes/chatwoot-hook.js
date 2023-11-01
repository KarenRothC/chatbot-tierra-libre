const express = require("express");
const { createReadStream } = require("fs");
const { join } = require("path");

const router = express.Router();

// Controller
const chatWootHook = async (req, res) => {
  const providerWs = req.providerWs;
  const body = req.body;
  if (body?.private) {
    res.send(null);
    return;
  }
  const phone = body?.conversation?.meta?.sender?.phone_number.replace("+", "");
  console.log(phone);
  await providerWs.sendText(`${phone}@s.whatsapp.net`, body.content);
  console.log("body.content", body.content);
  res.send(body);
};

// Router
router.post("/chatwoot-hook", chatWootHook);

// Ruta para acceder al codigo QR
router.get("/get-qr", async (_, res) => {
  const YOUR_PATH_QR = join(process.cwd(), `bot.qr.png`);
  const fileStream = createReadStream(YOUR_PATH_QR);

  res.writeHead(200, { "Content-Type": "image/png" });
  fileStream.pipe(res);
});

module.exports = router;
