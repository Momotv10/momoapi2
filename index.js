const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());

// مسار حفظ الجلسة
const sessionPath = path.join(__dirname, '.wwebjs_auth');

// مسار حفظ الملف التلقائي
const outputPath = path.join(__dirname, 'output');
if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
}

// تحقق مما إذا كانت الجلسة محفوظة
const isSessionSaved = fs.existsSync(sessionPath);

// إعداد عميل WhatsApp
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: sessionPath // تحديد مسار حفظ الجلسة
    }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// متغير لتخزين QR Code كصورة
let qrCodeImageUrl = null;

// توليد QR Code كصورة (فقط إذا لم تكن الجلسة محفوظة)
client.on('qr', async (qr) => {
    if (!isSessionSaved) {
        console.log("✅ QR Code generated. Generating image...");

        // إنشاء QR Code كصورة
        const qrCodeImage = await qrcode.toDataURL(qr);
        qrCodeImageUrl = qrCodeImage;

        console.log("✅ QR Code image generated. Use the following URL to scan:");
        console.log(qrCodeImageUrl); // هذا هو رابط الصورة
    }
});

// التأكد من أن العميل جاهز
client.on('ready', () => {
    console.log('✅ WhatsApp Client is ready!');

    // إنشاء ملف تلقائيًا عند جاهزية العميل
    const fileContent = `This file was created automatically at ${new Date().toISOString()}`;
    const filePath = path.join(outputPath, 'auto_created_file.txt');

    fs.writeFileSync(filePath, fileContent);
    console.log(`✅ File created at: ${filePath}`);

    // رفع الملف إلى GitHub تلقائيًا (اختياري)
    uploadFileToGitHub(filePath);
});

// API لإرسال رسالة
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

// API للحصول على QR Code كصورة
app.get('/qrcode', (req, res) => {
    if (!qrCodeImageUrl) {
        return res.status(404).json({ success: false, error: "QR Code not generated yet." });
    }
    res.send(`<img src="${qrCodeImageUrl}" alt="QR Code" />`);
});

// تشغيل السيرفر
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});

// تهيئة العميل
client.initialize();

// دالة لرفع الملف إلى GitHub
const uploadFileToGitHub = (filePath) => {
    const simpleGit = require('simple-git');
    const git = simpleGit();

    git.add(filePath)
        .commit('Auto-created file added')
        .push('origin', 'main', (err) => {
            if (err) {
                console.error('❌ Failed to upload file to GitHub:', err);
            } else {
                console.log('✅ File uploaded to GitHub successfully');
            }
        });
};
