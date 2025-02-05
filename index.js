const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');
const path = require('path');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

// إعداد عميل WhatsApp
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth',
        clientId: 'whatsapp-session'
    }),
    restartOnAuthFail: true,
    puppeteer: {
        headless: true,
        executablePath: puppeteer.executablePath(),
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--disable-gpu',
            '--no-zygote',
            '--single-process'
        ]
    }
});

let qrCodeImageUrl = null;
let isClientReady = false;

client.on('qr', async (qr) => {
    try {
        qrCodeImageUrl = await qrcode.toDataURL(qr);
        console.log("✅ تم إنشاء رمز QR بنجاح");
    } catch (err) {
        console.error("❌ خطأ في إنشاء رمز QR:", err);
    }
});

client.on('ready', () => {
    isClientReady = true;
    console.log('✅ تم تسجيل الدخول بنجاح!');
    
    // إعادة تشغيل كل 4 ساعات
    setInterval(async () => {
        console.log('🔄 جاري إعادة تشغيل البوت...');
        await client.destroy();
        await client.initialize();
        console.log('✅ تم إعادة تشغيل البوت بنجاح!');
    }, 4 * 60 * 60 * 1000); // 4 ساعات
});

client.on('disconnected', () => {
    isClientReady = false;
    console.log('❌ تم قطع الاتصال');
});

// مسار للتحقق من حالة السيرفر
app.get('/', (req, res) => {
    res.send('السيرفر يعمل! 👋');
});

app.get('/qrcode', (req, res) => {
    if (isClientReady) {
        return res.send('تم تسجيل الدخول بالفعل');
    }
    if (!qrCodeImageUrl) {
        return res.status(404).send("الرجاء الانتظار... جاري إنشاء رمز QR");
    }
    res.send(`<img src="${qrCodeImageUrl}" alt="QR Code">`);
});

app.post('/send', async (req, res) => {
    if (!isClientReady) {
        return res.status(403).json({ error: "الرجاء تسجيل الدخول أولاً" });
    }

    const { phone, message } = req.body;
    if (!phone || !message) {
        return res.status(400).json({ error: "الرجاء إدخال رقم الهاتف والرسالة" });
    }

    try {
        const formattedPhone = phone.replace(/[^\d]/g, '');
        await client.sendMessage(`${formattedPhone}@c.us`, message);
        res.json({ success: true, message: "✅ تم إرسال الرسالة بنجاح" });
    } catch (error) {
        console.error('❌ خطأ:', error);
        res.status(500).json({ error: "حدث خطأ في إرسال الرسالة" });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 تم تشغيل السيرفر على المنفذ ${PORT}`);
    client.initialize().catch(err => {
        console.error('❌ خطأ في التهيئة:', err);
    });
});
