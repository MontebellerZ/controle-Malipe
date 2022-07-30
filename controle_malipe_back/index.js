const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql");
const app = express();
const PORT = process.env.PORT || 62209;

const con = mysql.createConnection({
    host: "162.214.121.73",
    port: "3306",
    user: "inspe",
    password: "JF9d@Rb@w7E1",
    database: "inspe_testes",
});
con.connect((err) => {
    if (err) console.log(err);
    else console.log("Conectado ao banco de dados.");
});

app.use("/public", express.static("public"));

app.use(bodyParser.json({ limit: "2024mb" }));
app.use(
    bodyParser.urlencoded({
        extended: true,
        type: "application/json",
        limit: "2024mb",
    })
);
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,PUT,PATCH,POST,DELETE");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    next();
});

setInterval(() => {
    con.query(`SELECT 1`, (err, rows) => {
        console.log("Preventing disconnect.");
    });
}, 60000);

require("./mobile")(app, con);
require("./web")(app, con);

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
