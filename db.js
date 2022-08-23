async function connect() {
    if (global.connection && global.connection.state !== 'disconnected')
        return global.connection;

    const mysql = require("mysql2/promise");
    const connection = await mysql.createConnection("mysql://empren06_admin:Enga1a2a3a4@ns973.hostgator.com.br:3306/empren06_database");
    console.log("Conectou no MySQL!");
    global.connection = connection;
    return connection;
}

connect();

async function selectCustomers() {
    const conn = await connect();
    const [rows] = await conn.query('SELECT * FROM `tb_admin.pedidos`;');
    return rows;
}

async function insertCustomer(customer) {
    const conn = await connect();
    const sql = 'INSERT INTO `tb_admin.pedidos` VALUES (null,?,?,?,?,?,?,?,?,?,?);';
    const values = [customer.titulo, customer.codigoProduto, customer.codigoPedido, customer.quantidade, customer.preco, customer.descontoValor, customer.descontoTipo, customer.envio, customer.capa, JSON.stringify(customer)];
    return await conn.query(sql, values);
}

async function recuperarPedido(pedido, referencia) {
    const conn = await connect();
    // const [rows] = await conn.query('SELECT * FROM `tb_admin.pedidos` WHERE `cod_pedido` = ? AND `cod_referencia` = ? ORDER BY `cod_produto` ASC;');
    const sql = 'SELECT * FROM `tb_admin.pedidos` WHERE `cod_pedido` = ? AND `cod_referencia` = ?;';
    const values = [pedido, referencia];
    try {
        const [dadosRecuperados] = await conn.query(sql, values);
        const [rows] = await conn.query('SELECT * FROM `tb_admin.pedidos` WHERE `cod_pedido` = ?;', pedido);
        return ({status: "success", dados_recuperados: rows});
    } catch (error) {
        return ({status: "error", message: error});
    }

    return rows;
}

async function cadastrarPedido(pedido) {
    try {
        await pedido.dados_pedido.map((dataRequest) => {
            try {
                (async () => {
                    const conn = await connect();
                    const sql = 'INSERT INTO `tb_admin.pedidos` VALUES (null,?,?,?,?,?,?,?,?,?,?,NOW(),NOW(),?);';
                    const values = [dataRequest.titulo, dataRequest.id, pedido.dados_cobranca.id, pedido.dados_cobranca.externalReference, dataRequest.quantidade, dataRequest.precoTabela, dataRequest.desconto, "PERCENTUAL", "ONLINE", dataRequest.capa, JSON.stringify(dataRequest)];
                    await conn.query(sql, values);
                })()
            } catch (error) {
                return ({status: "error", message: error.meessage});
            }
        })
        return ({status: "success", object: "DB", message: "Pedido cadastrado com sucesso!"});
    } catch (error) {
        return ({status: "error", message: error.meessage});
    }
}

module.exports = { insertCustomer, selectCustomers, cadastrarPedido, recuperarPedido };
