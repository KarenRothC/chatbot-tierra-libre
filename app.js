require("dotenv").config();
const { GoogleSpreadsheet } = require("google-spreadsheet");
const fs = require("fs");
const RESPONSES_SHEET_ID = "1K-BDGuGn5ndCkCx75hwbtAb4tINTmp8R4JefggcJfTs"; //ID de la hoja de Sheets
const { JWT } = require("google-auth-library");
const { getDay } = require("date-fns");

const {
  createBot,
  createProvider,
  createFlow,
  addKeyword,
  addAnswer,
  addAction,
  EVENTS,
} = require("@bot-whatsapp/bot");

const BaileysProvider = require("@bot-whatsapp/provider/baileys");
const MockAdapter = require("@bot-whatsapp/database/mock");
const ChatGPTClass = require("./chatgpt.class");
const ServerHttp = require("./http");
const { sendMessageChatWoot } = require("./services/chatwoot");
const { sleep } = require("./utils/sleep");

const ChatGPTInstance = new ChatGPTClass();

const serviceAccountAuth = new JWT({
  email: process.env.CLIENT_EMAIL,
  key: process.env.PRIVATE_KEY,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const doc = new GoogleSpreadsheet(RESPONSES_SHEET_ID, serviceAccountAuth);

/**
 * Guardar pedido en la sheet Pedidos
 * @param {*} data
 */
async function saveOrder(data = {}) {
  await doc.loadInfo();
  const sheet = doc.sheetsByTitle["Pedidos"];
  const order = await sheet.addRow({
    fecha: data.fecha,
    telefono: data.telefono,
    nombre: data.nombre,
    valor: data.valor,
    pedido: data.pedido,
  });

  return order;
}

function formatResumeBot(resumeBot) {
  let resumeFormated = [];
  const separadoPorComa = resumeBot.split(", ");
  for (let i = 0; i < separadoPorComa.length; i++) {
    separadoPorPuntos = separadoPorComa[i].split(": ");
    resumeFormated.push({
      producto: separadoPorPuntos[1],
      cantidad: separadoPorPuntos[0],
    });
  }
  return resumeFormated;
}

function calcularPrecioTotal(productosSeleccionados, consultaInventario) {
  let precioTotal = 0;

  for (const productoSeleccionado of productosSeleccionados) {
    const productoEnInventario = consultaInventario.find(
      (p) => p.producto === productoSeleccionado.producto
    );

    if (productoEnInventario) {
      const cantidadDeseada = parseInt(productoSeleccionado.cantidad);
      const precioUnitario = parseFloat(productoEnInventario.valor);

      precioTotal += cantidadDeseada * precioUnitario;
    } else {
      console.log(
        `El producto ${productoSeleccionado.producto} no se encuentra en la base de datos`
      );
    }
  }

  return precioTotal;
}

// Funcion que actualiza inventario
async function updateInventory(compraCliente) {
  await doc.loadInfo();
  let sheet = doc.sheetsByTitle["Inventario"];
  const rows = await sheet.getRows();

  for (const compra of compraCliente) {
    const productoDeseado = compra.producto;
    const cantidadDeseada = parseInt(compra.cantidad);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (
        row.get("Producto") === productoDeseado &&
        row.get("Stock") >= cantidadDeseada
      ) {
        row.set("Stock", row.get("Stock") - cantidadDeseada);
        row.save();
      }
    }
  }
  return true;
}

//FLUJO DE PRUEBA PARA ACTUALIZAR INVENTARIO
const prueba = addKeyword("prueba").addAction(
  async (_, { state, flowDynamic }) => {
    const currentState = state.getMyState();
    const compraCliente = formatResumeBot(currentState.pedido);
    const updated = await updateInventory(compraCliente);
    console.log(updated);
    const MESSAGE = "Actualizando inventarioo";
    await sendMessageChatWoot(MESSAGE, "incoming");
  }
);

async function consultarInventario(categoria) {
  await doc.loadInfo();
  let sheet = doc.sheetsByTitle["Inventario"];

  consultaInventario = [];

  const rows = await sheet.getRows();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (row.get("Categoria") === categoria && row.get("Stock") > 0) {
      // AQUÍ LE PEDIMOS A LA FUNCION QUE CONSULTE LOS DATOS QUE QUEREMOS CONSULTAR
      const objeto = {
        producto: row.get("Producto"),
        stock: row.get("Stock"),
        valor: row.get("Valor"),
      };
      consultaInventario.push(objeto);
    }
  }
  return consultaInventario;
}

const flowPrincipal = addKeyword(["Hola", "ole"])
  .addAction(async (ctx, { flowDynamic }) => {
    const CLIENT_MESSAGE = ctx.body;
    const BOT_MESSAGE = "Bienvenido a *Tierra Libre*!";
    await sendMessageChatWoot(CLIENT_MESSAGE, "incoming");
    await sendMessageChatWoot(BOT_MESSAGE, "outgoing");
    await sleep(2000);
    await flowDynamic(BOT_MESSAGE);
  })
  .addAction(async (_, { flowDynamic }) => {
    await sleep(2000);
    const MESSAGE = "Te envio el catalogo de productos";
    await sendMessageChatWoot(MESSAGE, "outgoing");
    await flowDynamic([
      {
        body: `${MESSAGE}`,
        media: `./catalogo-test.png`,
      },
    ]);
  })
  .addAction(async (_, { flowDynamic }) => {
    sleep(2000);
    const MESSAGE = "Si quieres comprar escribe *Quiero comprar*";
    await sendMessageChatWoot(MESSAGE, "outgoing");
    await flowDynamic(MESSAGE);
  });

const flowInventario = addKeyword("Quiero comprar")
  .addAction(async (ctx, { flowDynamic }) => {
    const CLIENT_MESSAGE = ctx.body;
    await sendMessageChatWoot(CLIENT_MESSAGE, "incoming");
  })
  .addAction(async (_, { flowDynamic }) => {
    const BOT_MESSAGE =
      "Escribe el *nombre* de la categoria de productos que te interesa comprar:\n 1. Pastelería vegana\n 2. Panadería vegana";
    await sendMessageChatWoot(BOT_MESSAGE, "outgoing");
    await flowDynamic(BOT_MESSAGE);
  })
  .addAction(
    { capture: true },
    async (ctx, { flowDynamic, fallBack, state }) => {
      telefono = ctx.from;

      if (
        !ctx.body.includes("Pastelería vegana") &&
        !ctx.body.includes("Panadería vegana")
      ) {
        return fallBack();
      }
      state.update({ categoria: ctx.body });
      const CLIENT_MESSAGE = ctx.body;
      const BOT_MESSAGE = `Espera unos segundos para traerte los productos disponibles de ${ctx.body} 😁`;
      await sendMessageChatWoot(CLIENT_MESSAGE, "incoming");
      await sendMessageChatWoot(BOT_MESSAGE, "outgoing");
      await flowDynamic(BOT_MESSAGE);
    }
  )
  .addAction(async (ctx, { flowDynamic }) => {
    telefono = ctx.from;
    categoria = ctx.body;

    await consultarInventario(categoria);

    const mapeoDeLista = consultaInventario.map((item) => ({
      body: [`*${item.producto}*`, `x: ${item.stock}`].join("\n"),
    }));
    await sendMessageChatWoot(mapeoDeLista, "outgoing");
    await flowDynamic(mapeoDeLista);
  })
  .addAnswer(
    "Te gustaria pedir alguno de estos productos? Dime cuáles y cuántos",
    { delay: 2000, capture: true },
    async (ctx, { gotoFlow }) => {
      await sendMessageChatWoot(
        "Te gustaria pedir alguno de estos productos? Dime cuáles y cuántos",
        "outgoing"
      );
      const listado_productos =
        "[" +
        consultaInventario
          .map((item) => `{ producto: ${item.producto}, stock: ${item.stock} }`)
          .join(",") +
        "]";
      const PROMPT_INVENTARIO = [
        "Olvida todo lo anterior",
        "\nPor favor, verifica si un producto similar o igual al que el cliente ha solicitado existe en el {inventario}.",
        "\nEl inventario se compone de los siguientes productos = " +
          listado_productos,
        "\nEl cliente ha solicitado = " + ctx.body,
        "\nResponde solo con:'EXISTE' o 'NO_EXISTE'",
      ].join(" ");
      const response = await ChatGPTInstance.handleMsgChatGPT(
        PROMPT_INVENTARIO
      );
      const message = response.text;
      const EXISTE = "EXISTE";
      const getCheck = EXISTE.trim()
        .replace("\n", "")
        .replace(".", "")
        .replace(" ", "");
      if (getCheck.includes("NO_EXISTE")) {
        return gotoFlow(flowEmpty);
      } else {
        return gotoFlow(flowResumen);
      }
    }
  );

const flowEmpty = addKeyword(EVENTS.ACTION).addAnswer(
  ["El producto no existe o no hay stock", "Porfavor escribe *Quiero comprar*"],
  null,
  async (_, { gotoFlow }) => {
    return gotoFlow(flowInventario);
  }
);

const flowConfirmarPagar = addKeyword(EVENTS.ACTION)
  .addAnswer(
    "Porfavor escribe tu nombre y apellido",
    { capture: true },
    async (ctx, { flowDynamic, state }) => {
      telefono = ctx.from;
      await state.update({ nombre: ctx.body });
      flowDynamic("Gracias por escribir tu nombre");
    }
  )
  .addAction(async (ctx, { flowDynamic, state }) => {
    const currentState = state.getMyState();
    await saveOrder({
      fecha: new Date().toDateString(),
      telefono: ctx.from,
      nombre: currentState.nombre,
      valor: currentState.valor,
      pedido: currentState.pedido,
    });
    await flowDynamic(
      `Gracias ${currentState.nombre} por realizar tu pedido en Tierra Libre, puedes pasar a retirarlo mañana de 10:00 a 18:00 hrs `
    );
  })
  .addAnswer("Inventario actualizado", null, async (_, { state }) => {
    const currentState = state.getMyState();
    const compraCliente = formatResumeBot(currentState.pedido);
    const updated = await updateInventory(compraCliente);
    console.log(updated);
  });

const flowResumen = addKeyword("resumen")
  .addAnswer(
    "Te dejo un resumen de tu pedido",
    { delay: 1000 },
    async (ctx, { flowDynamic, state }) => {
      const listado_productos =
        "[" +
        consultaInventario
          .map((item) => `{ producto: ${item.producto}, stock: ${item.stock} }`)
          .join(",") +
        "]";
      const PROMPTRESUMEN2 = [
        "Eres el encargado de interpretar los {productos} que quiere comprar el usuario y entregarle un resumen de su elección en el siguiente formato:",
        '\n"cantidad: producto, cantidad: producto, cantidad: producto, cantidad: producto, cantidad: producto" ',
        "\n no olvides poner los dos puntos ':' entre la cantidad y el producto",
        "\n[SITUACION] usuario te dice = " + ctx.body,
        "\nproductos = " + listado_productos,
        "\nTu respondes: solamente el resumen, sin otra palabra",
      ].join(" ");

      console.log(PROMPTRESUMEN2);

      const response = await ChatGPTInstance.handleMsgChatGPT(PROMPTRESUMEN2);
      const message = response.text;
      await state.update({ pedido: message });
      await flowDynamic(message);
    }
  )
  .addAction(async (_, { flowDynamic, state }) => {
    const currentState = state.getMyState();
    const consultaInventario = await consultarInventario(
      currentState.categoria
    );
    const productosSeleccionados = formatResumeBot(currentState.pedido);
    console.log("productosSeleccionados", productosSeleccionados);
    const precioTotal = calcularPrecioTotal(
      productosSeleccionados,
      consultaInventario
    );
    state.update({ valor: precioTotal, ...currentState });
    await flowDynamic([
      {
        body: `El precio total es: ${precioTotal} pesos`,
      },
    ]);
  })
  .addAnswer(
    "Confirmas? *Si* o *No*",
    { delay: 1000, capture: true },
    async (ctx, { gotoFlow, flowDynamic }) => {
      if (ctx.body.toLowerCase() === "si") {
        await gotoFlow(flowConfirmarPagar);
      } else {
        await flowDynamic(`Perfecto`);
        await gotoFlow(flowInventario);
      }
    }
  );

const main = async () => {
  const adapterDB = new MockAdapter();
  const adapterFlow = createFlow([
    flowPrincipal,
    flowInventario,
    flowResumen,
    flowEmpty,
    flowConfirmarPagar,
    prueba,
  ]);

  const adapterProvider = createProvider(BaileysProvider);

  await createBot({
    flow: adapterFlow,
    provider: adapterProvider,
    database: adapterDB,
  });

  const server = new ServerHttp(adapterProvider);

  server.start();
};

main();
