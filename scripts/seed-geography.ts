import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type GazetteerRow = Record<string, string>;

const STATE_GAZETTEER =
  "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gazetteer.zip";

function parsePipeDelimited(input: string): GazetteerRow[] {
  const lines = input.trim().split(/\r?\n/);
  const headers = lines[0].split("|").map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = line.split("|").map((value) => value.trim());
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

async function main() {
  const tmpDir = path.join(process.cwd(), "tmp");
  const outputPath = path.join(tmpDir, "census-geography-source.json");

  console.log("Census/Gazetteer ingestion placeholder");
  console.log(`Source index: ${STATE_GAZETTEER}`);
  console.log("Download the current state, county, place, and county subdivision Gazetteer files.");
  console.log("Transform them into states/counties/municipalities rows matching supabase/schema.sql.");

  await mkdir(tmpDir, { recursive: true });
  await writeFile(
    outputPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: STATE_GAZETTEER,
        parserReady: Boolean(parsePipeDelimited)
      },
      null,
      2
    )
  );
  console.log(`Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
