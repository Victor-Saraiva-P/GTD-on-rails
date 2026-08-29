import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseSupabaseConnectionText,
  buildSupabaseJdbcUrl
} from "../src/features/bootstrap/supabaseConnectionParams.ts";

describe("parseSupabaseConnectionText", () => {
  it("parses key-value parameters copied from Supabase dashboard", () => {
    const raw = `
host: aws-1-sa-east-1.pooler.supabase.com
port: 5432
database: postgres
user: postgres.gqcputglxtdfpvdhzuun
`;
    const result = parseSupabaseConnectionText(raw);
    assert.deepEqual(result, {
      host: "aws-1-sa-east-1.pooler.supabase.com",
      port: "5432",
      database: "postgres",
      user: "postgres.gqcputglxtdfpvdhzuun"
    });
  });

  it("parses capitalized key-value parameters with password", () => {
    const raw = `
Host: aws-0-us-east-1.pooler.supabase.com
Port: 6543
Database: my_database
User: postgres.abcdefghijklm
Password: secret-password-123
`;
    const result = parseSupabaseConnectionText(raw);
    assert.deepEqual(result, {
      host: "aws-0-us-east-1.pooler.supabase.com",
      port: "6543",
      database: "my_database",
      user: "postgres.abcdefghijklm",
      password: "secret-password-123"
    });
  });

  it("parses key-value parameters with equal signs and alternative aliases", () => {
    const raw = `
host = aws-1-sa-east-1.pooler.supabase.com
port = 5432
dbname = my_app_db
username = postgres.tenant123
pass = my-secret-pass
`;
    const result = parseSupabaseConnectionText(raw);
    assert.deepEqual(result, {
      host: "aws-1-sa-east-1.pooler.supabase.com",
      port: "5432",
      database: "my_app_db",
      user: "postgres.tenant123",
      password: "my-secret-pass"
    });
  });

  it("parses postgresql connection URI and ignores template password placeholder", () => {
    const raw = "postgres://postgres.gqcputglxtdfpvdhzuun:[YOUR-PASSWORD]@aws-1-sa-east-1.pooler.supabase.com:5432/postgres";
    const result = parseSupabaseConnectionText(raw);
    assert.deepEqual(result, {
      host: "aws-1-sa-east-1.pooler.supabase.com",
      port: "5432",
      database: "postgres",
      user: "postgres.gqcputglxtdfpvdhzuun"
    });
  });

  it("parses postgresql connection URI with actual password", () => {
    const raw = "postgresql://postgres.myproject:realpass123@aws-0-us-west-1.pooler.supabase.com:5432/postgres";
    const result = parseSupabaseConnectionText(raw);
    assert.deepEqual(result, {
      host: "aws-0-us-west-1.pooler.supabase.com",
      port: "5432",
      database: "postgres",
      user: "postgres.myproject",
      password: "realpass123"
    });
  });

  it("parses JSON payload of connection parameters", () => {
    const raw = JSON.stringify({
      host: "aws-1-sa-east-1.pooler.supabase.com",
      port: 5432,
      database: "postgres",
      user: "postgres.gqcputglxtdfpvdhzuun"
    });
    const result = parseSupabaseConnectionText(raw);
    assert.deepEqual(result, {
      host: "aws-1-sa-east-1.pooler.supabase.com",
      port: "5432",
      database: "postgres",
      user: "postgres.gqcputglxtdfpvdhzuun"
    });
  });

  it("parses psql CLI command string", () => {
    const raw = "psql -h aws-1-sa-east-1.pooler.supabase.com -p 5432 -d postgres -U postgres.gqcputglxtdfpvdhzuun";
    const result = parseSupabaseConnectionText(raw);
    assert.deepEqual(result, {
      host: "aws-1-sa-east-1.pooler.supabase.com",
      port: "5432",
      database: "postgres",
      user: "postgres.gqcputglxtdfpvdhzuun"
    });
  });

  it("returns null for plain non-connection strings", () => {
    assert.equal(parseSupabaseConnectionText(""), null);
    assert.equal(parseSupabaseConnectionText("   "), null);
    assert.equal(parseSupabaseConnectionText("random text here"), null);
  });
});

describe("buildSupabaseJdbcUrl", () => {
  it("builds standard Supavisor session JDBC URL with defaults", () => {
    const url = buildSupabaseJdbcUrl({
      host: "aws-1-sa-east-1.pooler.supabase.com"
    });
    assert.equal(url, "jdbc:postgresql://aws-1-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=verify-full&stringType=unspecified");
  });

  it("cleans host with jdbc prefix and path", () => {
    const url = buildSupabaseJdbcUrl({
      host: "jdbc:postgresql://aws-1-sa-east-1.pooler.supabase.com:5432/postgres",
      port: "5432",
      database: "postgres"
    });
    assert.equal(url, "jdbc:postgresql://aws-1-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=verify-full&stringType=unspecified");
  });

  it("cleans host with postgres URI scheme and custom port", () => {
    const url = buildSupabaseJdbcUrl({
      host: "postgresql://aws-0-us-west-1.pooler.supabase.com/postgres",
      port: "5432",
      database: "custom_db"
    });
    assert.equal(url, "jdbc:postgresql://aws-0-us-west-1.pooler.supabase.com:5432/custom_db?sslmode=verify-full&stringType=unspecified");
  });

  it("cleans host with embedded port and trailing slash", () => {
    const url = buildSupabaseJdbcUrl({
      host: "aws-1-sa-east-1.pooler.supabase.com:5432/",
      port: "5432",
      database: "postgres"
    });
    assert.equal(url, "jdbc:postgresql://aws-1-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=verify-full&stringType=unspecified");
  });
});
