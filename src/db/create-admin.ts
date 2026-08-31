/**
 * Creates the first admin account. There is no public signup, so this is
 * how the very first user gets in; everyone after that arrives by invite.
 *
 *   npm run admin:create
 *
 * The password is typed here on your machine, hashed with bcrypt, and only
 * the hash is stored. Nothing is echoed to the terminal or written to logs.
 */
import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "./index";
import { users } from "./schema";

/** Reads a line without echoing it back to the terminal. */
async function askHidden(prompt: string): Promise<string> {
  stdout.write(prompt);

  return new Promise((resolve, reject) => {
    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();

    let value = "";

    const done = (result: string) => {
      if (stdin.isTTY) stdin.setRawMode(wasRaw ?? false);
      stdin.pause();
      stdin.removeListener("data", onData);
      stdout.write("\n");
      resolve(result);
    };

    const onData = (chunk: Buffer) => {
      for (const byte of chunk) {
        if (byte === 13 || byte === 10) return done(value); // enter
        if (byte === 3) {
          // ctrl-c
          if (stdin.isTTY) stdin.setRawMode(wasRaw ?? false);
          stdout.write("\n");
          return reject(new Error("Cancelled"));
        }
        if (byte === 127 || byte === 8) {
          value = value.slice(0, -1); // backspace
          continue;
        }
        value += String.fromCharCode(byte);
      }
    };

    stdin.on("data", onData);
  });
}

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });

  const name = (await rl.question("Name: ")).trim();
  const email = (await rl.question("Email: ")).trim().toLowerCase();
  rl.close();

  if (!name || !email.includes("@")) {
    console.error("Need a name and a valid email.");
    process.exit(1);
  }

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    console.error(`${email} already has an account.`);
    process.exit(1);
  }

  const password = await askHidden("Password (min 10 chars, hidden): ");
  if (password.length < 10) {
    console.error("Password must be at least 10 characters.");
    process.exit(1);
  }

  const confirm = await askHidden("Confirm password: ");
  if (password !== confirm) {
    console.error("Passwords do not match.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db
    .insert(users)
    .values({ name, email, passwordHash, role: "admin" })
    .returning({ id: users.id, email: users.email });

  console.log(`\nAdmin created: ${user.email}`);
  console.log("Sign in at http://localhost:3000/login");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed:", err.message ?? err);
    process.exit(1);
  });
