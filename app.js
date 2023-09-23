const { GoogleSpreadsheet } = require("google-spreadsheet");
const fs = require("fs");
const RESPONSES_SHEET_ID = "1K-BDGuGn5ndCkCx75hwbtAb4tINTmp8R4JefggcJfTs"; //Aquí pondras el ID de tu hoja de Sheets
const CREDENTIALS = JSON.parse(fs.readFileSync("./credenciales.json"));
const { JWT } = require("google-auth-library");

const {
  createBot,
  createProvider,
  createFlow,
  addKeyword,
  addAnswer,
} = require("@bot-whatsapp/bot");

const QRPortalWeb = require("@bot-whatsapp/portal");
const BaileysProvider = require("@bot-whatsapp/provider/baileys");
const MockAdapter = require("@bot-whatsapp/database/mock");

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



async function consultarInventario(categoria) {
  await doc.loadInfo();
  let sheet = doc.sheetsByTitle["Hoja 2"]; // AQUÍ DEBES PONER EL NOMBRE DE TU HOJA

  consultados = [
  ];

  const rows = await sheet.getRows();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (row.get("Categoria") === categoria && row.get("Stock") > 0) {
      // AQUÍ LE PEDIMOS A LA FUNCION QUE CONSULTE LOS DATOS QUE QUEREMOS CONSULTAR EJEMPLO:
      consultados["Producto"] = row.get("Producto");
      consultados["Stock"] = row.get("Stock"); 
    }
  }
  console.log(consultados)
  return consultados;
}

let STATUS = {};

const flowHola = addKeyword("Hola")
  .addAnswer("Hola! Bienvenido a Tierra Libre")
  .addAnswer(
    "Para comenzar escribe el nombre de la categoria de productos que te interesa comprar"
  )

  .addAnswer([
    "1. Pastelería vegana",
    "2. Panadería vegana"
  ], 
  { capture:true },
  async(ctx, {flowDynamic}) => {
    telefono = ctx.body;
    categoria = STATUS[telefono] = { ...STATUS[telefono], categoria: ctx.body };
    await flowDynamic([
      {
        body: `Perfecto espera unos segundos para traerte los productos disponibles de ${STATUS[telefono].categoria} 😁`,
      },
    ]);
  }
  )

  .addAnswer(
    ["Según la categoria tengo los siguientes productos:"],
    { delay: 1000 },
    async (ctx, { flowDynamic }) => {
      telefono = ctx.from;
      categoria = ctx.body;

      await consultarInventario(categoria);

      const Producto = consultados["Producto"];
      const Stock = consultados["Stock"];
 
      await flowDynamic(
        `- *Producto*: ${Producto}\n- *Stock*: ${Stock}\n`
      );
    }
  )


  /*.addAnswer(
    "Dime tu nombre",
    { capture: true },
    async (ctx, { flowDynamic }) => {
      telefono = ctx.from;
      nombre = STATUS[telefono] = { ...STATUS[telefono], nombre: ctx.body };
      flowDynamic();
    }
  )

  .addAnswer(
    "Dime tus apellidos",
    { capture: true },
    async (ctx, { flowDynamic }) => {
      telefono = ctx.from;
      apellidos = STATUS[telefono] = {
        ...STATUS[telefono],
        apellidos: ctx.body,
      }; //Variable del STATUS
      console.log(STATUS[telefono].sexo);
      flowDynamic();
    }
  )
  .addAnswer(
    "¿Qué edad tienes?",
    { capture: true },
    async (ctx, { flowDynamic }) => {
      telefono = ctx.from;
      edad = STATUS[telefono] = { ...STATUS[telefono], edad: ctx.body }; //Variable del STATUS

      /////////////////////       ESTA FUNCION AÑADE UNA FILA A SHEETS    /////////////////////////
      ingresarDatos();
      async function ingresarDatos() {
        console.log(STATUS[telefono].sexo);
        let rows = [
          {
            // Ejemplo: // CABECERA DE SHEET : VARIABLE        //                             ➡️   Paso 3 - Aquí añades las variables creadas

            Nombre: STATUS[telefono].nombre,
            Apellidos: STATUS[telefono].apellidos,
            Telefono: telefono,
            Edad: STATUS[telefono].edad,
          },
        ];
        console.log("rows", rows);

        await doc.loadInfo();
        let sheet = doc.sheetsByIndex[0];
        for (let index = 0; index < rows.length; index++) {
          const row = rows[index];
          await sheet.addRow(row);
        }
      }

      await flowDynamic([
        {
          body: `Perfecto ${STATUS[telefono].nombre}, espero que te haya parecido sencillo el formulario 😁`,
        },
      ]);
      await flowDynamic([
        {
          body: `Puedes consultar tus datos escribiendo *Consultar mis datos* o haciendo clic aquí:`,
          buttons: [{ body: "🔍 Consultar mis datos 🔍" }],
        },
      ]);
    }
  );

//////////////////////////// FLUJO PARA CONSULTAR DATOS /////////////////////////////////////////////////////////

async function consultarDatos(telefono) {
  await doc.loadInfo();
  let sheet = doc.sheetsByTitle["Hoja 1"]; // AQUÍ DEBES PONER EL NOMBRE DE TU HOJA

  consultados = [];

  const rows = await sheet.getRows();
  //console.log("YAPO", rows)
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (row.get("Telefono") === telefono) {
      // AQUÍ LE PEDIMOS A LA FUNCION QUE CONSULTE LOS DATOS QUE QUEREMOS CONSULTAR EJEMPLO:
      consultados["Nombre"] = row.get("Nombre");
      consultados["Apellidos"] = row.get("Apellidos"); // consultados['EL NOMBRE QUE QUIERAS'] = row.NOMBRE DE LA COLUMNA DE SHEET
      consultados["Telefono"] = row.get("Telefono");
      consultados["Edad"] = row.get("Edad");
    }
  }

  console.log("consultados", consultados);
  return consultados;
}

const flowConsultar = addKeyword(
  "Consultar mis datos",
  "🔍 Consultar mis datos 🔍"
)
  .addAnswer([
    "Dame unos segundo, estoy buscando tus datos dentro del sistema... 🔍",
  ])
  .addAnswer(
    ["Según el teléfono del cuál me estas escribiendo, tengo estos datos:"],
    { delay: 3000 },
    async (ctx, { flowDynamic }) => {
      telefono = ctx.from;

      await consultarDatos(telefono);

      // AQUI DECLARAMOS LAS VARIABLES CON LOS DATOS QUE NOS TRAEMOS DE LA FUNCION         VVVVVVVVV
      const Nombre = consultados["Nombre"];
      const Apellidos = consultados["Apellidos"];
      const Telefono = consultados["Telefono"];
      const Edad = consultados["Edad"];

      await flowDynamic(
        `- *Nombre*: ${Nombre}\n- *Apellidos*: ${Apellidos}\n- *Telefono*: ${Telefono}\n- *Edad*: ${Edad}`
      );
    }
  );

/////////////////////       ESTA FUNCION CONSULTA LOS DATOS DE UNA FILA !SEGÚN EL TELÉFONO!    /////////////////////////
*/

const main = async () => {
  const adapterDB = new MockAdapter();
  const adapterFlow = createFlow([flowHola]);
  const adapterProvider = createProvider(BaileysProvider);

  createBot({
    flow: adapterFlow,
    provider: adapterProvider,
    database: adapterDB,
  });

  QRPortalWeb();
};

main();

/*const API = 'https://fakestoreapi.com/products';

const flowLista = addKeyword(['lista']) 
    .addAnswer('Genial, te envío la lista de productos en unos segundos', null, 
    async (ctx, {flowDynamic}) => {
        let contador = 1;
        const respuesta = await axios(API)

        for (const item of respuesta.data) {
            if(contador>4) break;
            contador++
            flowDynamic({body:item.title, media:item.image})
        }
    }
    )
    
const flowHumano = addKeyword(['humano']) 
    .addAnswer('En breve te contactaremos...')

const flowPrincipal = addKeyword(['hola', 'ole', 'alo', 'ola', 'buenas'])
    .addAnswer(['*Bienvenido a Tierra Libre*', 'Espero que estes teniendo un buen dia'])
    .addAnswer(
        [
            'Escribe *lista* para enviarte la lista de productos',
            'Escribe *humano* para contactar contigo'
        ],
         null, 
         null, 
         [flowLista, flowHumano])




const flowDespedida = addKeyword(['chao', 'nos vemos'])
    .addAnswer(['chao nos vemoooo'])

*/
/**
 * Esta es la funcion importante es la que realmente inicia
 * el chatbot.
 */
