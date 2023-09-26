const { GoogleSpreadsheet } = require("google-spreadsheet");
const fs = require("fs");
const RESPONSES_SHEET_ID = "1K-BDGuGn5ndCkCx75hwbtAb4tINTmp8R4JefggcJfTs"; //Aquí pondras el ID de tu hoja de Sheets
const CREDENTIALS = JSON.parse(fs.readFileSync("./credenciales.json"));
const { JWT } = require("google-auth-library");
const { getDay } = require ("date-fns");

const {
  createBot,
  createProvider,
  createFlow,
  addKeyword,
  addAnswer,
  EVENTS
} = require("@bot-whatsapp/bot");

const QRPortalWeb = require("@bot-whatsapp/portal");
const BaileysProvider = require("@bot-whatsapp/provider/baileys");
const MockAdapter = require("@bot-whatsapp/database/mock");
const ChatGPTClass = require("./chatgpt.class");
const { PROMPT } = require("./prompt")

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
 async function saveOrder (data = {})  {
  console.log(data)
  await doc.loadInfo();
  const sheet = doc.sheetsByTitle["Hoja 1"]; // the first sheet
  const order = await sheet.addRow({
    fecha: data.fecha,
    telefono: data.telefono,
    nombre: data.nombre,
    pedido: data.pedido,
  });

  return order
};



/*const flowPrueba = addKeyword('prueba')
.addAnswer('Mensaje', null,
  async (ctx, { flowDynamic }) => {
    state = {
      nombre: 'Karen Roth',
      pedido: ' Pan de molde ingral x2 y pan pita integral x20'
    }

  
  await saveOrder({
    fecha: new Date().toDateString(),
    telefono: ctx.from,
    nombre: state.nombre,
    pedido: state.pedido,
  });
  await flowDynamic({
    body: `Gracias ${state.nombre} por realizar tu pedido en Tierra Libre, puedes pasar a retirarlo manana en la panaderia de 10:00 a 18:00 hrs `
  })
}
 )*/

async function consultarInventario(categoria) {
  await doc.loadInfo();
  let sheet = doc.sheetsByTitle["Hoja 2"]; // AQUÍ DEBES PONER EL NOMBRE DE TU HOJA

  consultados = [];

  const rows = await sheet.getRows();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (row.get("Categoria") === categoria && row.get("Stock") > 0) {
      // AQUÍ LE PEDIMOS A LA FUNCION QUE CONSULTE LOS DATOS QUE QUEREMOS CONSULTAR EJEMPLO:
      const objeto = {
        producto: row.get("Producto"),
        stock: row.get("Stock")
      };
     consultados.push(objeto)
    }
  }
  console.log(consultados)
  return consultados;
}

const flowGenerarPedido = addKeyword('Listo')
 .addAction(
  async (ctx, { state, flowDynamic }) => {
    const currentState = state.getMyState();
  await saveOrder({
    fecha: new Date().toDateString(),
    telefono: ctx.from,
    nombre: currentState.nombre,
    pedido: currentState.pedido,
  });
  await flowDynamic({
    body: `Gracias ${currentState.nombre} por realizar tu pedido en Tierra Libre, puedes pasar a retirarlo manana en la panaderia de 10:00 a 18:00 hrs `
  })
}
 )

const flowConfirmarPagar = addKeyword('si confirmo') 
  .addAnswer('Porfavor escribe tu nombre y apellido',
  {capture: true},
  async(ctx, { state }) => {
    telefono = ctx.from;
    state.update({ nombre: ctx.body });
  }
  )
  .addAnswer('Perfecto, te dejo el link de pago ...')
  .addAnswer('Cuando realices el pago escribe *Listo*', null, null, flowGenerarPedido)


const flowPrincipal = addKeyword(EVENTS.WELCOME)
  .addAnswer("Hola! Bienvenido a Tierra Libre", null, async() => {
    await ChatGPTInstance.handleMsgChatGPT(PROMPT)
  })
  .addAnswer(
    "Te envio el catalogo de productos",
  {
    media: 'C:/Users/Usuario/Documents/Chatbot/base-baileys-memory/catalogo-test.png'
  })
  .addAnswer('Si quieres comprar escribe *quiero comprar*')


  const flowInventario = addKeyword('Quiero comprar')
  .addAnswer([
    "Escribe el *nombre* de la categoria de productos que te interesa comprar",
    "1. Pastelería vegana",
    "2. Panadería vegana"
  ], 
  { capture:true },
  async(ctx, {flowDynamic, fallBack, state}) => {
    telefono = ctx.from;
    state.update({ categoria: ctx.body });

    if(!ctx.body.includes('Pastelería vegana') && !ctx.body.includes('Panadería vegana')){
      return fallBack();
    }
    const currentState = state.getMyState();
    await flowDynamic([
      {
        body: `Espera unos segundos para traerte los productos disponibles de ${currentState.categoria} 😁`,
      },
    ]);
  }
  )
  .addAction(
    { delay: 1000 },
    async (ctx, { flowDynamic }) => {
      telefono = ctx.from;
      categoria = ctx.body;

      await consultarInventario(categoria);
 
      const mapeoDeLista = consultados.map(item => ({body: [ `*${item.producto}*`, `x: ${item.stock}`].join('\n')}))
      await flowDynamic(
        mapeoDeLista
      );
    }
  )
  .addAnswer(
    "Te gustaria pedir alguno de estos productos? dime cuales y cuantos",
    { delay:1000, capture : true },
    async(ctx, {fallBack, state}) => {
      state.update({ pedido: ctx.body });
      const response = await ChatGPTInstance.handleMsgChatGPT(ctx.body);
      const message = response.text;
      if(ctx.body.toUpperCase() !== 'si confirmo'){
        await fallBack(message);
      }
    }, [flowConfirmarPagar]
  )

const main = async () => {
  const adapterDB = new MockAdapter();
  const adapterFlow = createFlow([flowPrincipal, flowInventario]);
  const adapterProvider = createProvider(BaileysProvider);

  createBot({
    flow: adapterFlow,
    provider: adapterProvider,
    database: adapterDB,
  });

  QRPortalWeb();
};

main();
