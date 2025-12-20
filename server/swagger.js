const swaggerAutogen = require('swagger-autogen')({openapi: '3.0.4'}) //per auto-generare la config swagger

const doc = { //scheletro della configurazione swagger
    info: {
        title: 'FotogramAPI',
        description: 'API di Fotogram'
    },
    host: 'localhost:3000',
};

const outputFile = './swagger-output.json'; //salva la configurazione qua
const routes = ['./endpoints.js']; //processa questi endpoints per generare lo swagger
swaggerAutogen(outputFile, routes, doc); //autogenera la config