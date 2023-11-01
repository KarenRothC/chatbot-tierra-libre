const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const apiBaseUrl = "";
const apiVersion = "v1";
const accountId = "1";
const token = "";
const inboxId = 1;

//envio de imagenes
const enviarimagenes = async (filePath, name, phone, msg = "", message_type = "") => {
    try {
        if (!phone) {
            console.log("El número de teléfono no está definido.");
            return null;
        }

        const formattedPhoneNumber = `+${phone}`;
        const conversationsUrl = buildApiUrl("conversations");

        // Obtener información de conversaciones existentes
        const response = await fetch(conversationsUrl, {
            method: "GET",
            headers: headers
        });

        if (!response.ok) {
            console.error("Error al obtener la información de conversaciones:", response.statusText);
            return null;
        }

        const responseData = await response.json();
        let foundId = null;

        // Buscar si ya existe una conversación con el número de teléfono
        responseData.data.payload.forEach((conversation) => {
            if (conversation.meta.sender.phone_number === formattedPhoneNumber) {
                foundId = conversation.id;
            }
        });

        if (!foundId) {
            console.log("No se encontró un ID asociado al número de teléfono. Creando un contacto...");

            // Crear un contacto si no existe
            const contactData = {
                name: name || "contact 1",
                phone_number: formattedPhoneNumber,
                source_id: formattedPhoneNumber
            };

            const createContactUrl = buildApiUrl("contacts");
            const createContactResponse = await fetch(createContactUrl, {
                method: "POST",
                headers: headers,
                body: JSON.stringify(contactData)
            });

            if (!createContactResponse.ok) {
                console.error("Error al crear un contacto:", createContactResponse.statusText);
                return null;
            }

            const createContactData = await createContactResponse.json();
            const createdContactId = createContactData.payload.contact.id;

            const conversationData = {
                inbox_id: inboxId,
                contact_id: createdContactId
            };

            // Crear una nueva conversación
            const sendConversationUrl = buildApiUrl("conversations");
            const sendConversationResponse = await fetch(sendConversationUrl, {
                method: "POST",
                headers: headers,
                body: JSON.stringify(conversationData)
            });

            if (sendConversationResponse.ok) {
                const sendConversationData = await sendConversationResponse.json();
                console.log("Respuesta exitosa al enviar la conversación:", sendConversationData);
                await enviarimagenes(filePath, name, phone, msg, message_type);
            } else {
                console.error("Error en la solicitud al enviar la conversación:", sendConversationResponse.statusText);
            }
        } else {
            console.log("ID asociado al número de teléfono:", foundId);
        }

        // Enviar la imagen como mensaje
        const sendMessageUrl = buildApiUrl(`conversations/${foundId}/messages`);
        let data = new FormData();
        data.append('attachments[]', fs.createReadStream(filePath));
        data.append('private', 'true'); // Este es un comentario
        data.append('content', 'test audio');
        data.append('message_type', 'incoming');
        data.append('file_type', 'audio');

        const config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: sendMessageUrl,
            headers: {
                'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary',
                'api_access_token': 'EJNDEuV8MRM6CEVSghL3GhiN',
                ...data.getHeaders()
            },
            data: data
        };

        const sendMessageResponse = await axios.request(config);

        if (sendMessageResponse.status === 200) {
            console.log("Respuesta exitosa al enviar el mensaje:", sendMessageResponse.data);
        } else {
            console.error("Error en la solicitud al enviar el mensaje:", sendMessageResponse.statusText);
            //console.error("El path es:", filePath);
        }

        return foundId;
    } catch (error) {
        console.error("Error al obtener la información de conversaciones o al enviar el mensaje:", error.message);
        return null;
    }
};