import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(testDirectory, "../../..");

function readRepositoryFile(relativePath: string): string {
  return readFileSync(resolve(repositoryRoot, relativePath), "utf8");
}

function embeddedLogoPng(): Buffer {
  const logoSvg = readRepositoryFile("docs/assets/logo.svg");
  const match = logoSvg.match(/data:image\/png;base64,([^"]+)/);
  assert.ok(match, "logo.svg must embed the transparent launcher PNG");
  return Buffer.from(match[1], "base64");
}

function pngChunks(png: Buffer): Map<string, Buffer[]> {
  const chunks = new Map<string, Buffer[]>();
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    chunks.set(type, [...(chunks.get(type) ?? []), data]);
    offset += length + 12;
  }
  return chunks;
}

test("branding logo has a fully transparent outer canvas", () => {
  const png = embeddedLogoPng();
  const chunks = pngChunks(png);
  const header = chunks.get("IHDR")?.[0];
  const transparency = chunks.get("tRNS")?.[0];
  const imageData = Buffer.concat(chunks.get("IDAT") ?? []);
  assert.ok(header && transparency && imageData.length > 0);
  assert.equal(header.readUInt32BE(0), 256);
  assert.equal(header.readUInt32BE(4), 256);
  assert.equal(header[8], 8);
  assert.equal(header[9], 3);
  const firstPixelPaletteIndex = inflateSync(imageData)[1];
  assert.equal(transparency[firstPixelPaletteIndex], 0);
});

test("README and native package use the transparent branding logo", () => {
  const readme = readRepositoryFile("README.md");
  const packagingScript = readRepositoryFile("apps/desktop/scripts/package-native-linux.sh");
  assert.match(readme, /docs\/assets\/logo\.svg/);
  assert.match(packagingScript, /logo_svg="\.\.\/\.\.\/docs\/assets\/logo\.svg"/);
  assert.match(packagingScript, /base64 -d > "\$package_dir\/icon\.png"/);
});
