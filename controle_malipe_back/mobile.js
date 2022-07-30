const express = require("express");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const baseLink = "/app";
const fs = require("fs");
const path = require("path");
const secret = require("./secret/hash.json");

function dateToString(datahora, formato = null) {
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

function codigoAleatorioAlphaNum(tamanho = 10) {
    let firstAscii = 32;
    let lastAscii = 127;

    let novaSenha = [];
    for (let i = 0; i < tamanho; i++) {
        novaSenha.push(Math.floor(Math.random() * (lastAscii - firstAscii - 1)) + firstAscii + 1);
    }

    return String.fromCharCode(...novaSenha);
}

function codigoAleatorioHex(tamanho = 10) {
    return crypto.randomBytes(Math.ceil(tamanho / 2)).toString("hex");
}

async function hashSenha(senha) {
    return await bcrypt.hash(senha, 8).catch((err) => {
        throw err;
    });
}

async function randomHashSenha(tamanho = 10) {
    let novaSenha = codigoAleatorioHex(tamanho);

    return {
        senha: novaSenha,
        hash: await hashSenha(novaSenha),
    };
}

function beginWeek(date = new Date()) {
    return new Date(date.valueOf() - date.getDay() * 24 * 60 * 60 * 1000);
}

function endWeek(date = new Date()) {
    return new Date(date.valueOf() + (6 - date.getDay()) * 24 * 60 * 60 * 1000);
}

function addDay(qtd, date = new Date()) {
    return new Date(date.valueOf() + qtd * 24 * 60 * 60 * 1000);
}

function extractB64(data64) {
    // Extraindo a extensão do arquivo da string completa
    const extensao = data64.substring(data64.indexOf("/") + 1, data64.indexOf(";base64"));

    // Extraindo base64 da string completa
    const fileType = data64.substring("data:".length, data64.indexOf("/"));
    const regex = new RegExp(`^data:${fileType}\/${extensao};base64,`, "gi");

    return data64.replace(regex, "");
}

function validateToken(req, res, next) {
    let token = req.headers["x-access-token"];

    if (!token) {
        res.send({ erro: true, mensagem: "Token não foi enviado na requisição." });
        return;
    }

    jwt.verify(token, secret.hash, (err, decoded) => {
        if (err) {
            res.send({ erro: true, mensagem: "Token de autenticação inválido." });
            return;
        }

        req.email = decoded.email;
        next();
    });
}

module.exports = function (app = express(), con = {}) {
    app.get(`${baseLink}/login`, (req, res) => {
        let inputEmail = req.query.email;
        let inputSenha = req.query.senha;

        con.query(
            `SELECT u.senha
                FROM usuario AS u 
                WHERE '${inputEmail}'=u.email`,
            (err, rows) => {
                if (!err) {
                    if (rows.length === 1) {
                        let hashSenha = rows[0].senha;

                        bcrypt.compare(inputSenha, hashSenha, (err, resp) => {
                            if (err) {
                                console.log(err);
                                res.send({
                                    erro: err,
                                    mensagem: "Erro inesperado.",
                                });
                            } else {
                                if (resp) {
                                    con.query(
                                        `SELECT *
                                            FROM usuario AS u 
                                            WHERE '${inputEmail}'=u.email`,
                                        (err, rows) => {
                                            if (err) {
                                                console.log(err);
                                                res.send({
                                                    erro: err,
                                                    mensagem: "Erro inesperado.",
                                                });
                                            } else {
                                                let usuarioBanco = JSON.parse(
                                                    JSON.stringify(rows[0])
                                                );
                                                usuarioBanco.token = jwt.sign(
                                                    { email: usuarioBanco.email },
                                                    secret.hash,
                                                    {
                                                        expiresIn: "8h", // expires in 8h
                                                    }
                                                );
                                                usuarioBanco.senhaNormal = inputSenha;
                                                res.send(usuarioBanco);
                                            }
                                        }
                                    );
                                } else {
                                    res.send({
                                        invalido: true,
                                        mensagem: "Login ou senha inválidos.",
                                    });
                                }
                            }
                        });
                    } else if (rows.length < 1) {
                        res.send({
                            invalido: true,
                            mensagem: "Login ou senha inválidos.",
                        });
                    } else {
                        res.send({
                            erro: true,
                            mensagem: "Erro inesperado.",
                        });
                    }
                } else {
                    console.log(err);
                    res.send({
                        erro: err,
                        mensagem: "Erro inesperado.",
                    });
                }
            }
        );
    });

    app.get(`${baseLink}/requerirSenha`, (req, res) => {
        try {
            let email = req.query.email;

            randomHashSenha(12).then(({ hash: hashAleatorio, senha: novaSenha }) => {
                con.query(
                    `UPDATE usuario AS u 
                        SET u.senha='${hashAleatorio}'
                        WHERE u.email='${email}'`,
                    (err, rows) => {
                        if (!err) {
                            if (rows.affectedRows === 1) {
                                let transporter = nodemailer.createTransport({
                                    service: "Outlook365",
                                    auth: {
                                        user: "suporte@directy.com.br",
                                        pass: "#xx%%HmOOpV3",
                                    },
                                });

                                let mailOptions = {
                                    from: "suporte@directy.com.br",
                                    to: email,
                                    subject: "Redefinição de Senha - iNspe",
                                    html: `
                                        <p>Seu pedido de redefinição de senha foi atendido.</p>
                                        <p>Nova senha: <b>${novaSenha}</b></p>
                                    `,
                                };

                                transporter.sendMail(mailOptions, (err) => {
                                    if (err) {
                                        throw err;
                                    } else {
                                        console.log(`Email enviado para: ${email}`);
                                        res.send({
                                            mensagem: "Senha alterada com sucesso!",
                                        });
                                    }
                                });
                            } else {
                                res.send({
                                    invalido: true,
                                    mensagem: "Nenhum email relacionado encontrado.",
                                });
                            }
                        } else {
                            throw err;
                        }
                    }
                );
            });
        } catch (err) {
            console.log(err);
            res.send({
                erro: err,
                mensagem: "Erro inesperado, contate o administrador do sistema.",
            });
        }

        // bcrypt.compare(
        //     "12345",
        //     "$2a$08$Bkx1hm66Zs7EQ9Et8T2kZu.qWHB79kc2hydf.bjeEUodpi.DTy1w2",
        //     (err, res) => {
        //         if (err) {
        //             console.log("aaaaaaaaa");
        //             console.log(err);
        //         } else {
        //             console.log("salve");
        //             console.log(res);
        //         }
        //     },
        //     (pct) => {
        //         console.log(pct);
        //     }
        // );
    });

    app.put(`${baseLink}/alterarSenha`, validateToken, (req, res) => {
        try {
            let email = req.body.email;

            hashSenha(req.body.novaSenha).then((hashNovaSenha) => {
                con.query(
                    `UPDATE usuario AS u 
                        SET u.senha='${hashNovaSenha}'
                        WHERE u.email='${email}'`,
                    (err, rows) => {
                        if (!err) {
                            if (rows.affectedRows === 1) {
                                let transporter = nodemailer.createTransport({
                                    service: "Outlook365",
                                    auth: {
                                        user: "suporte@directy.com.br",
                                        pass: "#xx%%HmOOpV3",
                                    },
                                });

                                let mailOptions = {
                                    from: "suporte@directy.com.br",
                                    to: email,
                                    subject: "Alteração de Senha - iNspe",
                                    html: `
                                <p>Sua senha foi alterada com sucesso.</p>
                            `,
                                };

                                transporter.sendMail(mailOptions, (err) => {
                                    if (err) {
                                        throw err;
                                    } else {
                                        console.log(`Email enviado para: ${email}`);
                                        res.send({
                                            mensagem: "Senha alterada com sucesso!",
                                        });
                                    }
                                });
                            } else {
                                res.send({
                                    invalido: true,
                                    mensagem: "Nenhum email relacionado encontrado.",
                                });
                            }
                        } else {
                            throw err;
                        }
                    }
                );
            });
        } catch (err) {
            console.log(err);
            res.send({
                erro: err,
                mensagem: "Erro inesperado, contate o administrador do sistema.",
            });
        }
    });

    app.get(`${baseLink}/rotas/:id`, validateToken, (req, res) => {
        try {
            let id = req.params.id;
            let dataHoje = new Date();
            let onDays = [1, 2, 3, 4, 5];
            let visibleDays = 10;
            let weeksUsed = Math.ceil(visibleDays / onDays.length);
            let dataInicio = beginWeek(dataHoje);
            let dataFinal = endWeek(addDay(7 * (weeksUsed - 1), dataHoje));
            let dataInicioString = `${dateToString(dataInicio, "yyyy-mm-dd").substring(
                0,
                10
            )} 00:00:00`;
            let dataFinalString = `${dateToString(dataFinal, "yyyy-mm-dd").substring(
                0,
                10
            )} 23:59:59`;

            con.query(
                `SELECT 
                    a.datahora_fim, 
                    a.datahora_inicio, 
                    a.id AS id_agenda, 
                    a.id_rota, 
                    a.id_inspecao, 
                    a.id_justificativa, 
                    a.id_usuario, 
                    r.nome,
                    i.area,
                    i.desvio_identificado,
                    i.acao_imediata,
                    i.acao_preventiva,
                    i.datahora_inicio AS checkin,
                    i.datahora_fim AS checkout,
                    i.prazo,
                    j.tipo,
                    j.motivo,
                    j.datahora_inicio AS dh_inicio_just,
                    j.datahora_fim AS dh_fim_just
                FROM agenda AS a
                INNER JOIN rota AS r
                    ON a.id_rota = r.id
                LEFT JOIN inspecao AS i
                    ON a.id_inspecao = i.id
                LEFT JOIN justificativa AS j
                    ON a.id_justificativa = j.id
                WHERE a.datahora_inicio >= '${dataInicioString}'
                AND a.datahora_inicio <= '${dataFinalString}'   
                AND a.id_usuario = ${id};
                `,
                (err, rows) => {
                    if (!err) {
                        if (Array.isArray(rows)) {
                            res.send(rows);
                        } else {
                            throw { erro: "Não foi retornado um array" };
                        }
                    } else {
                        throw err;
                    }
                }
            );
        } catch (err) {
            console.log(err);
            res.send({
                erro: err,
                mensagem: "Erro inesperado, contate o administrador do sistema.",
            });
        }
    });

    app.get(`${baseLink}/galeria`, validateToken, (req, res) => {
        try {
            let id_inspecao = req.query.id_inspecao;
            let id_aparelhos = req.query.id_aparelhos;
            let id_frente = req.query.id_frente;

            let tipos = [
                ...(id_inspecao ? [`g.id_inspecao = ${id_inspecao}`] : []),
                ...(id_aparelhos ? [`g.id_checklist_aparelhos = ${id_aparelhos}`] : []),
                ...(id_frente ? [`g.id_checklist_frente = ${id_frente}`] : []),
            ];

            con.query(
                `SELECT 
                    g.link,
                    g.altura,
                    g.largura
                FROM galeria AS g
                WHERE ${tipos.join(" OR ")};
                `,
                (err, rows) => {
                    if (!err) {
                        if (Array.isArray(rows)) {
                            res.send(rows);
                        } else {
                            throw { erro: "Não foi retornado um array" };
                        }
                    } else {
                        throw err;
                    }
                }
            );
        } catch (err) {
            console.log(err);
            res.send({
                erro: err,
                mensagem: "Erro inesperado, contate o administrador do sistema.",
            });
        }
    });

    app.post(`${baseLink}/inspecao`, validateToken, (req, res) => {
        let id_agenda = req.body.id_agenda;
        let area = req.body.area;
        let desvio_identificado = req.body.desvio_identificado;
        let acao_imediata = req.body.acao_imediata;
        let acao_preventiva = req.body.acao_preventiva;
        let responsavel = req.body.responsavel;
        let fotos = req.body.fotos;
        let datahora_inicio = dateToString(new Date(req.body.datahora_inicio), "yyyy-mm-dd");
        let datahora_fim = dateToString(new Date(req.body.datahora_fim), "yyyy-mm-dd");
        let prazo = dateToString(new Date(req.body.prazo), "yyyy-mm-dd");

        con.query(
            `   
                INSERT INTO
                    inspecao(
                        area,
                        desvio_identificado,
                        acao_imediata,
                        acao_preventiva,
                        responsavel, 
                        datahora_inicio,
                        datahora_fim,
                        prazo
                    ) 
                    VALUE(
                        '${area}',
                        '${desvio_identificado}',
                        '${acao_imediata}',
                        '${acao_preventiva}',
                        ${responsavel},
                        '${datahora_inicio}',
                        '${datahora_fim}',
                        '${prazo}'
                    );
            `,
            (err, rows) => {
                if (!err) {
                    con.query(
                        `SELECT id FROM inspecao 
                            ORDER BY id DESC LIMIT 0, 1`,
                        (err, rows) => {
                            let id_inspecao = rows[0].id;
                            if (!err) {
                                con.query(
                                    `UPDATE agenda
                                        SET 
                                            id_inspecao = ${id_inspecao}
                                        WHERE id = ${id_agenda}`,
                                    (err) => {
                                        if (!err) {
                                            let fotosBanco = [];
                                            let horario = Date.now();
                                            let diretorioSalvar = "./public/arquivos/";
                                            let diretorioSalvarCompleto =
                                                path.resolve(diretorioSalvar);
                                            if (!fs.existsSync(diretorioSalvarCompleto)) {
                                                fs.mkdirSync(diretorioSalvarCompleto, {
                                                    recursive: true,
                                                });
                                            }

                                            fotos.forEach((ft, i) => {
                                                let arquivo = ft.base64;
                                                let altura = ft.altura;
                                                let largura = ft.largura;
                                                let nome = `inspecaoId_${id_inspecao}_foto_${
                                                    i + 1
                                                }.jpeg`;
                                                let diretorioRelativo = `${diretorioSalvar}${horario}_${nome}`;
                                                let diretorioCompleto =
                                                    path.resolve(diretorioRelativo);

                                                fs.writeFileSync(
                                                    diretorioCompleto,
                                                    extractB64(arquivo),
                                                    "base64"
                                                );

                                                fotosBanco.push({
                                                    link: diretorioRelativo.slice(1),
                                                    altura: altura,
                                                    largura: largura,
                                                });
                                            });

                                            if (fotosBanco.length > 0) {
                                                con.query(
                                                    `INSERT INTO
                                                    galeria(
                                                        link,
                                                        altura,
                                                        largura,
                                                        id_inspecao
                                                    ) 
                                                    VALUES ${fotosBanco
                                                        .map(
                                                            (ft) => `(
                                                                '${ft.link}',
                                                                ${ft.altura},
                                                                ${ft.largura},
                                                                ${id_inspecao}
                                                            )`
                                                        )
                                                        .join(",")};
                                                `,
                                                    (err, rows) => {
                                                        if (!err) {
                                                            res.send(rows);
                                                        } else {
                                                            console.log(err);
                                                            res.send(err);
                                                        }
                                                    }
                                                );
                                            } else {
                                                res.send(rows);
                                            }
                                        } else {
                                            console.log(err);
                                            res.send(err);
                                        }
                                    }
                                );
                            } else {
                                console.log(err);
                                res.send(err);
                            }
                        }
                    );
                } else {
                    console.log(err);
                    res.send(err);
                }
            }
        );
    });

    app.post(`${baseLink}/justificativa`, validateToken, (req, res) => {
        let tipo = req.body.tipo;
        let motivo = req.body.motivo;
        let bodyDataInicio = new Date(req.body.datahora_inicio);
        let bodyDataFim = new Date(req.body.datahora_fim);
        let datahora_inicio = dateToString(bodyDataInicio, "yyyy-mm-dd");
        let datahora_fim = dateToString(bodyDataFim, "yyyy-mm-dd");
        let userId = req.body.userId;

        if (bodyDataInicio < bodyDataFim) {
            con.query(
                `INSERT INTO 
                    justificativa(
                        tipo,
                        motivo,
                        datahora_inicio,
                        datahora_fim
                    )
                    VALUES(
                        '${tipo}',
                        '${motivo}',
                        '${datahora_inicio}',
                        '${datahora_fim}'
                    );                 
                  `,
                (err, rows) => {
                    if (!err) {
                        con.query(
                            `SELECT id 
                                FROM justificativa 
                                ORDER BY id 
                                DESC LIMIT 0, 1`,
                            (err, rows) => {
                                let justificativa_id = rows[0].id;
                                if (!err) {
                                    con.query(
                                        `UPDATE agenda
                                            SET id_justificativa = ${justificativa_id}
                                            WHERE ${userId} = id_usuario
                                            AND (
                                                ('${datahora_inicio}' >= datahora_inicio AND '${datahora_inicio}' < datahora_fim) 
                                                OR ('${datahora_fim}' > datahora_inicio AND '${datahora_fim}' <= datahora_fim)
                                                OR ('${datahora_inicio}' < datahora_inicio AND '${datahora_fim}' > datahora_fim)
                                            );`,
                                        (err, rows) => {
                                            if (!err) {
                                                res.send(rows);
                                            } else {
                                                console.log(err);
                                                res.send(err);
                                            }
                                        }
                                    );
                                } else {
                                    console.log(err);
                                    res.send(err);
                                }
                            }
                        );
                    } else {
                        console.log(err);
                        res.send(err);
                    }
                }
            );
        } else {
            res.send({ erro: "Datas incoerentes" });
        }
    });
};