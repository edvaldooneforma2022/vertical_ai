const { Client } = require("pg");

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    await client.connect();
    console.log("✅ Conectado ao banco");

    const queries = [
      "SELECT COUNT(*) FROM crm_leads WHERE tenant_id IS NOT NULL;",
      "SELECT COUNT(*) FROM tenant_leads WHERE api_key IS NOT NULL;",
      "SELECT COUNT(*) FROM crm_leads WHERE tenant_id IS NULL;"
    ];

    for (const q of queries) {
      const r = await client.query(q);
      console.log(q, "=>", r.rows[0].count);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

test();
