import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// LÊ VARIÁVEIS DE AMBIENTE DO RENDER
const PAGSEGURO_EMAIL = process.env.PAGSEGURO_EMAIL;
const PAGSEGURO_TOKEN = process.env.PAGSEGURO_TOKEN;
const PHP_WEBHOOK = process.env.PHP_WEBHOOK_URL;

if (!PAGSEGURO_EMAIL || !PAGSEGURO_TOKEN || !PHP_WEBHOOK) {
  console.error("❌ ERRO: Variáveis de ambiente não configuradas no Render.");
}

app.post("/notify", async (req, res) => {
    try {
        const notificationCode = req.body.notificationCode;
        const notificationType = req.body.notificationType;

        console.log("Recebido do PagSeguro:", req.body);

        // Valida
        if (!notificationCode || notificationType !== "transaction") {
            console.log("Ignorando notificação inválida");
            return res.status(200).send("IGNORED");
        }

        // Faz consulta ao PagSeguro
        const url = `https://ws.pagseguro.uol.com.br/v2/transactions/notifications/${notificationCode}?email=${encodeURIComponent(PAGSEGURO_EMAIL)}&token=${encodeURIComponent(PAGSEGURO_TOKEN)}`;

        console.log("Consultando PagSeguro:", url);

        const response = await fetch(url, {
            method: "GET",
            headers: { "Content-Type": "application/xml" }
        });

        const xmlText = await response.text();
        console.log("XML recebido:\n", xmlText);

        // Converte XML → JSON
        const xml2js = await import("xml2js");
        const parser = new xml2js.Parser({ explicitArray: false });

        const xmlJson = await parser.parseStringPromise(xmlText);

        const trans = xmlJson.transaction;

        // PEGA OS CAMPOS IMPORTANTES
        const finalJson = {
            reference: trans.reference,
            status: trans.status,
            lastEventDate: trans.lastEventDate,
            senderEmail: trans.sender?.email ?? null,
            grossAmount: trans.grossAmount ?? null,
            paymentMethod: trans.paymentMethod?.type ?? null
        };

        console.log("JSON final enviado ao PHP:", finalJson);

        // ENVIA JSON PARA O PHP
        await fetch(PHP_WEBHOOK, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(finalJson)
        });

        res.status(200).send("OK");
    } catch (e) {
        console.error("ERRO NO PROXY:", e);
        res.status(500).send("ERROR");
    }
});

app.get("/", (req, res) => res.send("PagSeguro Proxy Online!"));

app.listen(10000, () => console.log("Server ON port 10000"));
