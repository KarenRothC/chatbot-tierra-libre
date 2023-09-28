require('dotenv').config()
const { } = require('@bot-whatsapp/bot');


class ChatGPTClass{
  queue = []; 
  optionsGPT = { model: "gpt-3.5-turbo" };
  openai = undefined;

  constructor() {
    this.init().then();
  }

  /**
   * Esta funciona inicializa la logica del chatgpt
   */
  init = async () => {
    const { ChatGPTAPI } = await import("chatgpt");
    this.openai = new ChatGPTAPI(
        {
            apiKey: process.env.OPENAI_API_KEY
        }
    );
  };

    /**
   * Manejador de mensajes
   * envia mensajes a whatsapp
   */
      /**
   * this.openai.sendMessage = es el equivalente a ir a la pagina de chatgpt y escribirle un mensaje
   * envia mensajes a whatsapp
   */
    
      handleMsgChatGPT = async (body) => {
        const interaccionChatGPT = await this.openai.sendMessage(body, {
          conversationId: !this.queue.length
            ? undefined
            : this.queue[this.queue.length - 1].conversationId,
          parentMessageId: !this.queue.length
            ? undefined
            : this.queue[this.queue.length - 1].id,
        });
    
        this.queue.push(interaccionChatGPT);
        return interaccionChatGPT
      };
}

module.exports = ChatGPTClass;