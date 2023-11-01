const API_CHATWOOT = 'https://chatwoot-production-18e7.up.railway.app'
require("dotenv").config();

const sendMessageChatWoot = async (msg = "", message_type = "") => {
    var myHeaders = new Headers();
    myHeaders.append("api_access_token", process.env.CHATWOOT_KEY);
    myHeaders.append("Content-type", "application/json")

    var raw = JSON.stringify({
        content: msg,
        message_type: message_type,
        private: true,
        content_attributes: {},
    });
    console.log("raw", raw)
    var requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw,
    };

    const dataRaw = await fetch (
        `${API_CHATWOOT}/api/v1/accounts/2/conversations/24/messages`,
        requestOptions
    );
    const data = await dataRaw.json();
    console.log("data", data)
    return data;
    
}

module.exports = { sendMessageChatWoot };