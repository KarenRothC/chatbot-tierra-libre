const { GoogleSpreadsheet } = require("google-spreadsheet");
const fs = require("fs");
const RESPONSES_SHEET_ID = "1K-BDGuGn5ndCkCx75hwbtAb4tINTmp8R4JefggcJfTs"; //Aquí pondras el ID de tu hoja de Sheets
const CREDENTIALS = JSON.parse(fs.readFileSync("./credenciales.json"));
const { JWT } = require("google-auth-library");
const { getDay } = require("date-fns");

const {
  createBot,
  createProvider,
  createFlow,
  addKeyword,
  addAnswer,
  EVENTS,
} = require("@bot-whatsapp/bot");

const QRPortalWeb = require("@bot-whatsapp/portal");
const BaileysProvider = require("@bot-whatsapp/provider/baileys");
const MockAdapter = require("@bot-whatsapp/database/mock");
const ChatGPTClass = require("./chatgpt.class");
const { PROMPTRESUMEN } = require("./prompt");

const ChatGPTInstance = new ChatGPTClass();

const serviceAccountAuth = new JWT({
  email: CREDENTIALS.client_email,
  key: CREDENTIALS.private_key,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const doc = new GoogleSpreadsheet(RESPONSES_SHEET_ID, serviceAccountAuth);

/*                       Para añadir o eliminar alguna pregunta sigue los siguientes pasos:
1) ➡️ Crea el addAnswer
2) ➡️ Crea la variable del STATUS
3) ➡️ Añade el nombre de la columna de Sheets junto con su variable
                      */

/**
 * Guardar pedido
 * @param {*} data
 */
async function saveOrder(data = {}) {
  //console.log(data);
  await doc.loadInfo();
  const sheet = doc.sheetsByTitle["Hoja 1"]; // the first sheet
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
  //console.log(resumeFormated);
  return resumeFormated;
}

async function updateInventory(categoria, resumeBot) {
  const resumeFormated = formatResumeBot(resumeBot);
  const consultaInventario = consultarInventario(categoria);
  for (let i = 0; i < resumeFormated.length; i++) {
    console.log(consultaInventario.indexOf(resumeFormated[i].producto));
  }
}

// funcion de prueba
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

//FLUJO DE PRUEBA PARA CALCULAR EL PRECIO
const prueba = addKeyword("prueba").addAnswer(
  "a ver el precio",
  null,
  async ({ flowDynamic }) => {
    const consultaInventario = await consultarInventario("Pastelería vegana");
    const productosSeleccionados = [
      { producto: "Muffin Zanahoria Naranja", cantidad: "10" },
      { producto: "Muffin Banana Split Chips de Chocolate", cantidad: "10" },
    ];
    const precioTotal = calcularPrecioTotal(
      productosSeleccionados,
      consultaInventario
    );
    await flowDynamic([
      {
        body: `El precio total es: ${precioTotal} pesos`,
      },
    ]);
  }
);

async function consultarInventario(categoria) {
  await doc.loadInfo();
  let sheet = doc.sheetsByTitle["Hoja 2"]; // AQUÍ DEBES PONER EL NOMBRE DE TU HOJA

  consultaInventario = [];

  const rows = await sheet.getRows();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (row.get("Categoria") === categoria && row.get("Stock") > 0) {
      // AQUÍ LE PEDIMOS A LA FUNCION QUE CONSULTE LOS DATOS QUE QUEREMOS CONSULTAR EJEMPLO:
      const objeto = {
        producto: row.get("Producto"),
        stock: row.get("Stock"),
        valor: row.get("Valor"),
      };
      consultaInventario.push(objeto);
    }
  }
  //console.log("consultaInventario", consultaInventario);
  return consultaInventario;
}

const flowPrincipal = addKeyword(EVENTS.WELCOME)
  .addAnswer("Bienvenido a Tierra Libre!")
  .addAnswer("Te envio el catalogo de productos", {
    media:
      "C:/Users/Usuario/Documents/Chatbot/base-baileys-memory/catalogo-test.png",
  })
  .addAnswer("Si quieres comprar escribe *quiero comprar*");

const flowInventario = addKeyword("Quiero comprar")
  .addAnswer(
    [
      "Escribe el *nombre* de la categoria de productos que te interesa comprar",
      "1. Pastelería vegana",
      "2. Panadería vegana",
    ],
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
      //const currentState = state.getMyState();
      await flowDynamic([
        {
          body: `Espera unos segundos para traerte los productos disponibles de ${ctx.body} 😁`,
        },
      ]);
    }
  )
  .addAction({ delay: 1000 }, async (ctx, { flowDynamic }) => {
    telefono = ctx.from;
    categoria = ctx.body;

    await consultarInventario(categoria);

    const mapeoDeLista = consultaInventario.map((item) => ({
      body: [`*${item.producto}*`, `x: ${item.stock}`].join("\n"),
    }));
    await flowDynamic(mapeoDeLista);
  })
  .addAnswer(
    "Te gustaria pedir alguno de estos productos? Dime cuáles y cuántos",
    { delay: 1000, capture: true },
    async (ctx, { gotoFlow }) => {
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
      //console.log("a ver el mensaje", message);
      //console.log("getcheck: ", getCheck);
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

const flowConfirmarPagar = addKeyword("Si")
  .addAnswer(
    "Porfavor escribe tu nombre y apellido",
    { capture: true },
    async (ctx, { state }) => {
      telefono = ctx.from;
      state.update({ nombre: ctx.body });
    }
  )
  .addAction({ delay: 1000 }, async (ctx, { flowDynamic, state }) => {
    const currentState = state.getMyState();
    await saveOrder({
      fecha: new Date().toDateString(),
      telefono: ctx.from,
      nombre: currentState.nombre,
      valor: currentState.valor,
      pedido: currentState.pedido,
    });
    await flowDynamic( `Gracias ${currentState.nombre} por realizar tu pedido en Tierra Libre, puedes pasar a retirarlo mañana de 10:00 a 18:00 hrs `);
  })
  .addAnswer("Actualizando inventario", null, async (_, { state }) => {
    const currentState = state.getMyState();
    //updateInventory(currentState.categoria, currentState.pedido);
    /*
    console.log(
      "actualizar inventario ",
      updateInventory(currentState.categoria, currentState.pedido)
    );*/
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
        '"cantidad: producto"',
        "[SITUACION] usuario te dice" + ctx.body,
        "productos =" + listado_productos,
        "Tu respondes: solamente el resumen, sin otra palabra",
      ].join(" ");

      const response = await ChatGPTInstance.handleMsgChatGPT(PROMPTRESUMEN2);
      const message = response.text;
      console.log("message BOT", message);
      await state.update({ pedido: message });
      console.log("poto", state.getMyState());
      await flowDynamic(message);
    }
  )
  .addAction(async (_, { flowDynamic, state }) => {
    const currentState = state.getMyState();
    console.log("Aver el current state despues de su definicion", currentState);
    const consultaInventario = await consultarInventario(
      currentState.categoria
    );
    const productosSeleccionados = formatResumeBot(currentState.pedido);
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
    console.log('state despues de agregar valor', state.getMyState())
  })
  .addAnswer("Confirmas? *Si* o *No*", { delay: 1000, capture: true }, null, flowConfirmarPagar);

const main = async () => {
  const adapterDB = new MockAdapter();
  const adapterFlow = createFlow([
    flowPrincipal,
    flowInventario,
    flowResumen,
  ]);
  const adapterProvider = createProvider(BaileysProvider);

  createBot({
    flow: adapterFlow,
    provider: adapterProvider,
    database: adapterDB,
  });

  QRPortalWeb();
};

main();
