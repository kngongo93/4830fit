/**
 * Prints what the connected database user is actually allowed to do, then
 * attempts the migration and reports the failure in full.
 *
 * Diagnostic only, and deliberately always exits 0: App Platform serves a
 * job's run logs only while its deployment is alive, so a job that exits
 * non-zero destroys the output needed to read it. Remove once the managed
 * database's permissions are understood.
 */
import "dotenv/config";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("DOCTOR: DATABASE_URL is not set");
    return;
  }

  const sql = postgres(url, {
    max: 1,
    ssl: url.includes("sslmode=require") ? "require" : undefined,
  });

  try {
    const [identity] = await sql.unsafe<
      { usr: string; db: string; search_path: string; version: string }[]
    >(`select current_user as usr,
              current_database() as db,
              current_setting('search_path') as search_path,
              version() as version`);
    console.log("DOCTOR identity:", JSON.stringify(identity, null, 2));

    const [privs] = await sql.unsafe<Record<string, boolean>[]>(
      `select has_database_privilege(current_user, current_database(), 'CREATE') as db_create,
              has_database_privilege(current_user, current_database(), 'CONNECT') as db_connect,
              has_schema_privilege(current_user, 'public', 'CREATE') as public_create,
              has_schema_privilege(current_user, 'public', 'USAGE') as public_usage`,
    );
    console.log("DOCTOR privileges:", JSON.stringify(privs, null, 2));

    const schemas = await sql.unsafe<{ nspname: string; owner: string }[]>(
      `select n.nspname, pg_get_userbyid(n.nspowner) as owner
         from pg_namespace n
        where n.nspname not like 'pg_%' and n.nspname <> 'information_schema'`,
    );
    console.log("DOCTOR schemas:", JSON.stringify(schemas));

    const roles = await sql.unsafe<{ role: string }[]>(
      `select r.rolname as role from pg_auth_members m
         join pg_roles r on r.oid = m.roleid
         join pg_roles u on u.oid = m.member
        where u.rolname = current_user`,
    );
    console.log("DOCTOR member_of:", JSON.stringify(roles));

    // Can the user actually create a table in public?
    try {
      await sql.unsafe(`create table if not exists __fit_doctor_probe (id int)`);
      console.log("DOCTOR create_table_in_public: OK");
      await sql.unsafe(`drop table if exists __fit_doctor_probe`);
    } catch (err) {
      console.log("DOCTOR create_table_in_public: FAILED", (err as Error).message);
    }

    const existing = await sql.unsafe<{ table_name: string }[]>(
      `select table_name from information_schema.tables where table_schema = 'public'`,
    );
    console.log("DOCTOR existing_public_tables:", JSON.stringify(existing.map((t) => t.table_name)));
  } catch (err) {
    console.log("DOCTOR fatal:", err);
  } finally {
    await sql.end();
  }
}

main()
  .catch((err) => console.log("DOCTOR threw:", err))
  .finally(() => process.exit(0));
