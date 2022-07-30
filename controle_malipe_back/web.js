const baseLink = "/portal";

function dateToString(datahora, formato = null) {
    datahora = new Date(datahora);
    let dia = datahora.getDate().toString().padStart(2, "0");
    let mes = (datahora.getMonth() + 1).toString().padStart(2, "0");
    let ano = datahora.getFullYear().toString().padStart(4, "0");
    let hora = datahora.getHours().toString().padStart(2, "0");
    let minuto = datahora.getMinutes().toString().padStart(2, "0");
    let segundo = datahora.getSeconds().toString().padStart(2, "0");

    switch (formato) {
        case "yyyy/mm/dd":
            return `${ano}/${mes}/${dia} ${hora}:${minuto}:${segundo}`;
        case "yyyy-mm-dd":
            return `${ano}-${mes}-${dia} ${hora}:${minuto}:${segundo}`;

        case "dd/mm/yyyy":
            return `${dia}/${mes}/${ano} ${hora}:${minuto}:${segundo}`;
        case "dd-mm-yyyy":
            return `${dia}-${mes}-${ano} ${hora}:${minuto}:${segundo}`;

        default:
            return `${ano}/${mes}/${dia} ${hora}:${minuto}:`;
    }
}

module.exports = function (app, con) {
    // ------------------------------- ROTAS ----------------------------------------
    app.get(`${baseLink}/rotas`, (req, res) => {
        con.query(`SELECT * FROM rota WHERE ${req.params}`, (err, rows) => {
            if (!err) {
                res.send(rows);
            } else {
                console.log(err);
                res.send(err);
            }
        });
    });

    app.post(`${baseLink}/rotas`, (req, res) => {
        con.query(
            `INSERT INTO 
                  rota(
                      nome
                  ) 
                  VALUES (
                      '${req.body.nome}'
                  )`,
            (err, rows) => {
                if (!err) {
                    res.send(rows);
                } else {
                    console.log(err);
                    res.send(err);
                }
            }
        );
    });

    // ------------------------------- AGENDA ----------------------------------------

    //find all
    app.get(`${baseLink}/agenda`, (req, res) => {
        con.query(`SELECT * FROM agenda`, (err, rows) => {
            if (!err) {
                res.send(rows);
            } else {
                console.log(err);
                res.send(err);
            }
        });
    });

    //find agenda por usuario
    app.get(`/app/agenda/:id_usuario`, (req, res) => {
        con.query(
            `SELECT * FROM agenda WHERE id_usuario = '${req.params.id_usuario}'`,
            (err, rows) => {
                if (!err) {
                    res.send(rows);
                } else {
                    console.log(err);
                    res.send(err);
                }
            }
        );
    });

    //post nova agenda para um usuario
    app.post(`${baseLink}/agenda`, (req, res) => {
        //requisição body
        let id_usuario = req.body.id_usuario;
        let id_rota = req.body.id_rota;
        let datahora_inicio = dateToString(
            req.body.datahora_inicio,
            "yyyy-mm-dd"
        );
        let datahora_fim = dateToString(req.body.datahora_fim, "yyyy-mm-dd");

        con.query(
            `INSERT INTO
                  agenda(
                      id_usuario,
                      id_rota,
                      datahora_inicio,	
                      datahora_fim
                  ) 
                  VALUE(
                      ${id_usuario},
                      ${id_rota},
                      '${datahora_inicio}',
                      '${datahora_fim}'
                      )`,
            (err, rows) => {
                if (!err) {
                    res.send(rows);
                } else {
                    console.log(err);
                    res.send(err);
                }
            }
        );
    });
};
