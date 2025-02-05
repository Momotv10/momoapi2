const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());

// تحديد مسار الجلسة باستخدام المسار المخصص في Render
const sessionPath = process.env.RENDER_INTERNAL_PATH || path.join(__dirname, '.wwebjs_auth');

// إنشاء المجلد إذا لم يكن موجوداً
if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath, { recursive: true });
}

// إعداد عميل WhatsApp
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "whatsapp-client",
        dataPath: sessionPath
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
        ]
    }
});

let qrCodeImageUrl = null;

client.on('qr', async (qr) => {
    console.log("✅ QR Code generated. Generating image...");
    qrCodeImageUrl = await qrcode.toDataURL(qr);
    console.log("✅ QR Code image generated");
});

client.on('authenticated', (session) => {
    console.log('✅ Client authenticated');
});

client.on('auth_failure', (error) => {
    console.error('❌ Authentication failed:', error);
});

client.on('ready', () => {
    console.log('✅ WhatsApp Client is ready!');
});

app.post('/send', async (req, res) => {
    const { phone, message } = req.body;

    if (!phone || !message) {
        return res.status(400).json({ success: false, error: "رقم الهاتف والرسالة مطلوبان!" });
    }

    try {
        await client.sendMessage(`${phone}@c.us`, message);
        res.json({ success: true, message: "✅ تم إرسال الرسالة!" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/qrcode', (req, res) => {
    if (!qrCodeImageUrl) {
        return res.status(404).json({ success: false, error: "QR Code not generated yet." });
    }
    res.send(`<img src="${qrCodeImageUrl}" alt="QR Code" />`);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});

process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Closing client...');
    await client.destroy();
    process.exit(0);
});

client.initialize();
