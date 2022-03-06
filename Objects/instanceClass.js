require('dotenv').config()
const {
    MessageType,
    WAConnection,
    Mimetype
} = require("@adiwajshing/baileys")
const QRCode = require("qrcode")
const {v4: uuidv4} = require('uuid')
const {ErrorHandler} = require("../Exceptions/InvalidNumber.exception")
const fs = require("fs")
const axios = require("axios")
const yargs = require('yargs/yargs')
global.options = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse())

class WhatsAppInstance {

    key = uuidv4();

    tmpMsg = {};

    instance = {
        key: this.key,
        qrcode: "",
    };

    axiosInstance = axios.create({
        baseURL: process.env.WEBHOOK_URL,
        // headers: {
        //   Apikey: process.env.WEBHOOK_KEY,
        // },
    });

    async sendJsonData(data) {
        if (data.messageType == "text") {
            return await this.axiosInstance.post("/sendtextreplies", data);
        } else if (data.messageType == "media") {
            return await this.axiosInstance.post("/sendmediareplies", data);
        } else if (data.messageType == "location") {
            return await this.axiosInstance.post("/sendlocationreplies", data);
        }
    }

    getWhatsAppId(id) {
        return id?.includes("-") ? `${id}@g.us` : `${id}@s.whatsapp.net`;
    }

    async verifyId(id) {
        if (id.includes("@g.us")) {
            return true
        }
        const isRegistered = await this.instance.conn?.isOnWhatsApp(id);
        if (isRegistered) {
            return true;
        }
        throw new ErrorHandler(404, 'Number is not registered on WhatsApp');
    }

    async getInstanceDetails() {
        return {
            instance_key: this.key,
            phone_connected: this.instance.conn?.phoneConnected,
            userData: this.instance.conn?.phoneConnected
                ? this.instance.userData
                : {},
        };
    }

    setHandlers() {
        this.instance.conn?.on("qr", async (qrcode) => {
            this.instance.qrcode = await QRCode.toDataURL(qrcode);
        });

        this.instance.conn?.on("open", (data) => {
            const authInfo = this.instance.conn?.base64EncodedAuthInfo(); // get all the auth info we need to restore this session
            const path = `./Instances/${this.key}.json`;
            // console.log(path);
            fs.writeFileSync(path, JSON.stringify(authInfo, null, "\t"), {
                flag: "w",
            });

            this.instance.userData = data.user;
        });

        this.instance.conn?.on("chat-update", async (data) => {
            if (data.messages) {
                for (const msg of data.messages?.all()) {
                    const newMsg = {
                        instance_key: this.key,
                        phone: this.instance.conn?.user.jid,
                        messageType: "",
                        message: msg,
                    };
                    if (msg.message?.conversation) {
                        newMsg.message = msg;
                        newMsg.messageType = "text";
                    }
                    if (msg.message?.buttonsMessage) {
                        newMsg.message = msg;
                        newMsg.messageType = "button";
                    }
                    if (msg.message?.buttonsResponseMessage) {
                        newMsg.message = msg;
                        newMsg.messageType = "buttonResponse";
                    }
                    if (
                        msg.message?.audioMessage ||
                        msg.message?.imageMessage ||
                        msg.message?.videoMessage ||
                        msg.message?.documentMessage
                    ) {
                        const mediaContent = await this.instance.conn?.downloadMediaMessage(
                            msg
                        );
                        newMsg.message = msg;
                        newMsg.messageType = "media";
                        if (options['fullsize']) {
                            newMsg.base64 = mediaContent?.toString("base64");
                        }
                    }
                    if (msg.message?.locationMessage) {
                        newMsg.message = msg;
                        newMsg.messageType = "location";
                    }
                    if (options['webhook']) {
                        await this.sendJsonData(newMsg);
                    }

                    await this.bot(newMsg);
                    console.log(this.tmpMsg);
                }
            }
        });
        return true;
    }

    async bot(msg) {
        const to = msg.message.key.remoteJid.split('@')[0];

        if (msg.messageType === "text") {
            if (msg.message.message?.conversation === 'UPDATE GUNUNG') {
                const namaGunung = await axios.get('http://localhost:8000/api/gunung')

                if (namaGunung.data.data.length < 1) {
                    await this.sendTextMessage(to, '*Tidak ada data gunung*');
                    return;
                }

                let buttons = [];
                for (let i = 0; i < namaGunung.data.data.length; i++) {
                    buttons.push({
                        buttonId: namaGunung.data.data[i].id,
                        buttonText: {
                            displayText: namaGunung.data.data[i].nama_gunung
                        },
                        type: 1
                    });
                }
                const btnData = {
                    id: to,
                    contentText: "Selamat datang di sistem informasi gunung E-Mountaineering",
                    footerText: "ripala.org",
                    buttons,
                    headerType: 1
                }

                await this.sendButtonMessage(to, btnData)
                return;
            }
        }

        if (msg.messageType === 'buttonResponse') {
            const btnMsg = msg.message.message.buttonsResponseMessage;
            if (!this.tmpMsg.status_pendakian && !this.tmpMsg.id) {
                this.tmpMsg.id = btnMsg.selectedButtonId;
                this.tmpMsg.nama_gunung = btnMsg.selectedDisplayText;
                const btnData = {
                    id: to,
                    contentText: "Silahkan Pilih Status Pendakian Gunung",
                    footerText: "ripala.org",
                    buttons: [
                        {buttonId: 'step2-buka', buttonText: {displayText: 'Buka'}, type: 1},
                        {buttonId: 'step2-tutup', buttonText: {displayText: 'Tutup'}, type: 1}
                    ],
                    headerType: 1
                }

                await this.sendButtonMessage(to, btnData)
            }

            if (btnMsg.selectedButtonId.split('-')[0] === 'step2') {
                this.tmpMsg.status_pendakian = btnMsg.selectedDisplayText;

                const btnData = {
                    id: to,
                    contentText: "Silahkan pilih Cuaca pendakian",
                    footerText: "ripala.org",
                    buttons: [
                        {buttonId: 'step3-cerah', buttonText: {displayText: 'Cerah'}, type: 1},
                        {buttonId: 'step3-berawan', buttonText: {displayText: 'Berawan'}, type: 1},
                        {buttonId: 'step3-mendung', buttonText: {displayText: 'Mendung'}, type: 1},
                        {buttonId: 'step3-gerimis', buttonText: {displayText: 'Gerimis'}, type: 1},
                        {buttonId: 'step3-hujan', buttonText: {displayText: 'Hujan'}, type: 1},
                    ],
                    headerType: 1
                }

                await this.sendButtonMessage(to, btnData)
            }

            if (btnMsg.selectedButtonId.split('-')[0] === 'step3') {
                this.tmpMsg.cuaca = btnMsg.selectedDisplayText;

                const btnData = {
                    id: to,
                    contentText: "Silahkan pilih Status Gunung",
                    footerText: "ripala.org",
                    buttons: [
                        {buttonId: 'step4-aktif', buttonText: {displayText: 'Aktif'}, type: 1},
                        {buttonId: 'step4-nonaktif', buttonText: {displayText: 'Tidak Aktif'}, type: 1},
                    ],
                    headerType: 1
                }

                await this.sendButtonMessage(to, btnData)
            }

            if (btnMsg.selectedButtonId.split('-')[0] === 'step4') {
                this.tmpMsg.status_gunung = btnMsg.selectedDisplayText;

                const response = await axios.post('http://localhost:8000/api/gunung', this.tmpMsg);

                if (response.data.message === 'success') {
                    await this.sendTextMessage(to, 'Terimakasih telah melakukan update data gunung ' + '*' + this.tmpMsg.nama_gunung + '*' + '\n\n' +
                        'Status Pendakian : ' + '*' + this.tmpMsg.status_pendakian + '*' + '\n' +
                        'Cuaca : ' + '*' + this.tmpMsg.cuaca + '*' + '\n' +
                        'Status Gunung : ' + '*' + this.tmpMsg.status_gunung + '*' + '\n\n' +
                        'Silahkan mengirim pesan *UPDATE GUNUNG* untuk melakukan update data gunung lainnya'
                    );
                }
                
                this.tmpMsg = {};
            }
        }
    }

    getAllContacts() {
        const chats = this.instance.conn?.chats;
        const toReturn = [];

        for (const chat of chats?.all()) {
            (chat.messages) = undefined;
            toReturn.push(chat);
        }

        return toReturn;
    }

    async sendMediaFile(
        to,
        caption,
        messageType,
        file
    ) {
        try {
            await this.verifyId(this.getWhatsAppId(to));
        } catch (error) {
            return {error: true, error}
        }
        const data = await this.instance.conn?.sendMessage(
            this.getWhatsAppId(to),
            file.buffer,
            messageType,
            {
                caption: caption,
                thumbnail: null,
            }
        );
        return data;
    }

    async sendMediaURL(
        to,
        type,
        caption,
        fileurl
    ) {
        try {
            await this.verifyId(this.getWhatsAppId(to));
        } catch (error) {
            return {error: true, error}
        }

        let msgType;
        let mimType;

        switch (type) {
            case "image":
                msgType = MessageType.image
                mimType = Mimetype.jpeg
                break;
            case "video":
                msgType = MessageType.video
                mimType = Mimetype.mp4
                break;
            default:
                return {error: true, msg: "msgtype should be video or image"}
        }

        try {
            const data = await this.instance.conn?.sendMessage(
                this.getWhatsAppId(to),
                {url: fileurl},
                msgType,
                {
                    mimetype: mimType,
                    caption: caption
                });
            return data;
        } catch (error) {
            return {error: true, error}
        }
    }

    async sendDocument(
        to,
        messageType,
        file
    ) {
        try {
            await this.verifyId(this.getWhatsAppId(to));
        } catch (error) {
            return {error: true, error}
        }
        const data = await this.instance.conn?.sendMessage(
            this.getWhatsAppId(to),
            file.buffer,
            messageType,
            {
                mimetype: file.mimetype,
                filename: file.name,
            }
        );
        return data;
    }

    async sendTextMessage(to, message) {
        try {
            await this.verifyId(this.getWhatsAppId(to));
        } catch (error) {
            return {error: true, error}
        }
        const data = await this.instance.conn?.sendMessage(
            this.getWhatsAppId(to),
            message,
            MessageType.text
        );
        return data;
    }

    async sendLocationMessage(to, lat, long) {
        try {
            await this.verifyId(this.getWhatsAppId(to));
        } catch (error) {
            return {error: true, error}
        }
        const data = await this.instance.conn?.sendMessage(
            this.getWhatsAppId(to),
            {degreesLatitude: lat, degreesLongitude: long},
            MessageType.location
        );
        return data;
    }

    async isOnWhatsApp(number) {
        const data = await this.instance.conn?.isOnWhatsApp(
            `${number}@s.whatsapp.net`
        );
        return data ? data : {exists: false, jid: `${number}@s.whatsapp.net`};
    }

    async sendVCardMessage(to, cardData) {
        try {
            await this.verifyId(this.getWhatsAppId(to));
        } catch (error) {
            return {error: true, error}
        }
        const vcard =
            "BEGIN:VCARD\n" +
            "VERSION:3.0\n" +
            `FN:${cardData.fullName}\n` +
            `ORG:${cardData.organization};\n` +
            `TEL;type=CELL;type=VOICE;waid=${cardData.phoneNumber}:${cardData.phoneNumber}\n` +
            "END:VCARD";

        const data = await this.instance.conn?.sendMessage(
            this.getWhatsAppId(to),
            {
                displayName: cardData.displayName,
                vcard: vcard,
            },
            MessageType.contact
        );
        return data;
    }

    async sendButtonMessage(to, btnData) {
        try {
            await this.verifyId(this.getWhatsAppId(to));
        } catch (error) {
            return {error: true, error}
        }
        await this.verifyId(this.getWhatsAppId(to));
        const data = await this.instance.conn?.sendMessage(
            this.getWhatsAppId(to),
            btnData,
            MessageType.buttonsMessage
        );
        return data;
    }

    init(whatsappData) {
        const conn = new WAConnection();
        conn.logger.level = 'warn';
        if (whatsappData) {
            const path = `./Instances/${whatsappData}`;
            conn.loadAuthInfo(path);
        }
        conn.version = [3, 3234, 9];
        conn.browserDescription = [
            "whatsappAPI",
            "Chrome",
            "1.0",
        ];
        this.instance.conn = conn;

        this.instance.conn.removeAllListeners("qr");
        this.setHandlers();
        this.instance.conn.connect();
        return this.instance;
    }

    async logout() {
        await this.instance.conn?.logout();
        this.instance.userData = {};
        return {error: false, message: "logout successfull"};
    }

    async resetSession() {
        await this.logout();
        return this.init();
    }

    //Group Functions
    parseParticipants(participants) {
        return participants.map((participant) => this.getWhatsAppId(participant));
    }

    async getAllGroups() {

        const {chats} = this.instance.conn?.loadChats(1000, null);

        const groups =
            chats?.filter((c) =>
                c.jid.includes("@g.us")
            ) ?? [];

        const finalGroups = [];
        groups.map((g) => {
            g.messages = undefined;
            finalGroups.push(g);
        });

        return {groups: finalGroups};
    }

    async getGroupFromId(groupId) {
        const id = this.getWhatsAppId(groupId);
        const group = await this.instance.conn?.chats
            .all()
            .filter((chat) => chat.jid == id);
        try {
            if (group) return await this.instance.conn?.groupMetadata(id);
        } catch (error) {
            return {error: true, message: "requested group was not found"}
        }
    }

    async getAdminGroups(withParticipants) {
        const data = await this.instance.conn?.loadChats(1000, null);
        const groups = data?.chats?.filter((c) => c.jid.includes("@g.us")) ?? [];
        const groupsMetadataArray = [];
        for (const g of groups) {
            const metaData = (await this.instance.conn?.groupMetadata(
                g.jid
            ))
            metaData.messages = undefined;
            groupsMetadataArray.push(metaData);
            await new Promise((r) => setTimeout(r, 1000));
        }
        const adminGroups = groupsMetadataArray.filter((c) =>
            c.participants?.filter(
                (p) => p.jid === this.instance.userData?.jid && p.isAdmin
            ).length == 0
                ? false
                : true
        );
        const finalGroups = [];
        adminGroups.map((g) => {
            g.messages = undefined;
            if (!withParticipants) {
                g.participants = undefined;
            }

            finalGroups.push(g);
        });

        return {groups: finalGroups};
    }

    async addNewParticipant(data) {
        try {
            const res = await this.instance.conn?.groupAdd(
                this.getWhatsAppId(data.group_id),
                this.parseParticipants(data.participants)
            );
            return res;
        } catch {
            return {error: true, message: "unable to add participant, check if you are admin in group"}
        }
    }

    async makeAdmin(data) {
        try {
            const res = await this.instance.conn?.groupMakeAdmin(
                this.getWhatsAppId(data.group_id),
                this.parseParticipants(data.participants)
            );
            return res;
        } catch {
            return {
                error: true,
                message: "unable to promote some participants, check if you are admin in group or participants exists"
            }
        }
    }

    async demoteAdmin(data) {
        try {
            const res = await this.instance.conn?.groupDemoteAdmin(
                this.getWhatsAppId(data.group_id),
                this.parseParticipants(data.participants)
            );
            return res;
        } catch {
            return {
                error: true,
                message: "unable to demote some participants, check if you are admin in group or participants exists"
            }
        }
    }

    async createNewGroup(data) {
        try {
            const res = await this.instance.conn?.groupCreate(
                data.group_name,
                this.parseParticipants(data.new_participants)
            );
            return res;
        } catch {
            return {
                error: true,
                message: "unable to create group, check if all participants have adding to group enabled"
            }
        }
    }

    async leaveGroup(groupId) {
        try {
            const res = await this.instance.conn?.groupLeave(
                this.getWhatsAppId(groupId)
            );
            return res;
        } catch {
            return {error: true, message: "unable to leave group, check if the group exists"}
        }
    }

    async getInviteCodeOfGroup(groupId) {
        try {
            const res = await this.instance.conn?.groupInviteCode(
                this.getWhatsAppId(groupId)
            );
            return res;
        } catch {
            return {error: true, message: "unable to get invite code, check if the group exists"}
        }
    }
}

exports.WhatsAppInstance = WhatsAppInstance
