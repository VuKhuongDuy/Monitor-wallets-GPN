import { getMetrictEvm } from "./metricsEvm";
import { getMetrictSvm } from "./metricsSvm";
import express from 'express'

const app = express();
const port = 8080;

app.get('/metrics', async (req, res) => {
    try {
        let metrics = "";

        metrics += (await getMetrictEvm("./config/evm-config.json"))
        metrics += "\n\n"
        metrics += (await getMetrictSvm('./config/svm-config.json'))
        metrics += "\n\n"

        res.set('Content-Type', 'text/plain');
        res.send(metrics);
    } catch (error) {
        console.error("Error fetching balances:", error);
        res.status(500).send("Error fetching balances");
    }
});

app.listen(port, () => {
    console.log(`Wallet balance exporter running at http://localhost:${port}/metrics`);
});
