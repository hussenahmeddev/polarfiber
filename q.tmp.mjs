import mysql from "mysql2/promise";
const raw=process.env.MYSQL_CA_CERT.replace(/-----(BEGIN|END) CERTIFICATE-----/g,"").replace(/\s+/g,"");
const c=await mysql.createConnection({host:process.env.MYSQL_HOST,port:+process.env.MYSQL_PORT,user:process.env.MYSQL_USER,password:process.env.MYSQL_PASSWORD,database:process.env.MYSQL_DATABASE,ssl:{ca:"-----BEGIN CERTIFICATE-----\n"+raw.match(/.{1,64}/g).join("\n")+"\n-----END CERTIFICATE-----\n"}});
console.log((await c.query(process.argv[2]))[0]); await c.end();
