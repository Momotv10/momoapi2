const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');
const fs = require('fs');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());

// إعداد اتصال MySQL
const dbConfig = {
host: 'sql203.ezyro.com',
user: 'ezyro_36024098',
password: 'ah580270',
database: 'ezyro_36024098_moos'
};

async function getSession() {
const connection = await mysql.createConnection(dbConfig);
const [rows] = await connection.execute("SELECT session_data FROM whatsapp_sessions ORDER BY id DESC LIMIT 1");
await connection.end();
return rows.length > 0 ? rows[0].session_data : null;
}

async function saveSession(sessionData) {
const connection = await mysql.createConnection(dbConfig);
await connection.execute("INSERT INTO whatsapp_sessions (session_data) VALUES (?)", [sessionData]);
await connection.end();
}

// إعداد عميل WhatsApp
const client = new Client({
authStrategy: new LocalAuth(),
puppeteer: {
headless: true,
args: ['--no-sandbox', '--disable-setuid-sandbox']
}
});

// تخزين QR Code
let qrCodeImageUrl = null;

client.on('qr', async (qr) => {
console.log("✅ QR Code generated. Scan it to log in.");
qrCodeImageUrl = await qrcode.toDataURL(qr);
});

client.on('ready', async () => {
console.log('✅ WhatsApp Client is ready!');

const sessionData = JSON.stringify(client.options.authStrategy);
await saveSession(sessionData);
console.log("✅ Session saved to MySQL!");
});

app.get('/qrcode', (req, res) => {
if (!qrCodeImageUrl) {
return res.status(404).json({ success: false, error: "QR Code غير متوفر." });
}
res.send(`<img src="${qrCodeImageUrl}" alt="QR Code" />`);
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

// تشغيل السيرفر
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
console.log(`🚀 Server is running on port ${PORT}`);
});

// استرجاع الجلسة من MySQL قبل تشغيل العميل
getSession().then(sessionData => {
if (sessionData) {
console.log("✅ تم استرجاع الجلسة من MySQL!");
fs.writeFileSync('./session.json', sessionData);
}
client.initialize();
});
