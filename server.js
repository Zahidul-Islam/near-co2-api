const express = require("express");
const serverless = require("serverless-http");
const cors = require("cors");
const bodyParser = require("body-parser");

require("dotenv").config();

const { Client } = require("pg");

const app = express();

const connectionString = process.env.DB_URL;
const port = process.env.PORT;
const queryText = `select t.transaction_hash, t.receipt_conversion_gas_burnt, t.receipt_conversion_tokens_burnt, ta.action_kind
from transactions t 
inner join transaction_actions ta on t.transaction_hash = ta.transaction_hash  
where signer_account_id = $1::text;
  `;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const client = new Client({
  connectionString,
});
client.connect();

app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

app.get("/:accountId", async (req, res) => {
  const result = await client.query({
    name: "fetch-transactions",
    text: queryText,
    values: [req.params.accountId],
  });

  const transactions = result?.rows?.map((tx) => {
    const receiptConversionGasBurnt = parseFloat(
      tx.receipt_conversion_gas_burnt
    );
    const tGas = receiptConversionGasBurnt / Math.pow(10, 12);
    const kWms = tGas * Math.pow(6, -7);
    const kWH = kWms * 1000 * 3600;
    const co2PerkWh = kWH * 7.09 * Math.pow(10, -4);

    return {
      ...tx,
      receipt_conversion_gas_burnt: parseFloat(tx.receipt_conversion_gas_burnt),
      receipt_conversion_tokens_burnt: parseFloat(
        tx.receipt_conversion_tokens_burnt
      ),
      co2PerkWh,
    };
  });

  const totalCO2PerkWh = transactions
    .map((tx) => tx.co2PerkWh)
    .reduce((cur, acc) => acc + cur, 0);

  const offsetCost = totalCO2PerkWh * 4.5;

  res.json({
    transactions,
    totalCO2PerkWh,
    offsetCost,
    count: transactions.length,
    ratings: Math.floor(Math.random() * 5) + 1,
  });
});

if (process.env.NODE_ENV === "development") {
  app.listen(port, () => {
    console.log(`App running on port ${port}.`);
  });
}

module.exports.handler = serverless(app);
