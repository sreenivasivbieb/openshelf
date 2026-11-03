import { CsvError, parse } from "csv-parse/sync";
import { z } from "zod";
import { ProductRow, type ColumnOverrides } from "../schemas/product.schema";
import type { RowError } from "../schemas/merchant.schema";
import { COLUMN_MEANINGS, mapColumns, type CanonicalColumn } from "../domain/column-mapping";
import { parseNumberCell, parseTextCell, skuFromName } from "../domain/csv-cells";
import { sanitizeForAgents } from "../domain/firewall-rules";
import type { LlmClient } from "../integrations/llm/llm-client";
import { AppError } from "../shared/errors";
import { dataBlock, MAPPING_SYSTEM } from "./prompts";

export const MAX_CATALOG_ROWS = 5000;

const NUMBER_COLUMNS: ReadonlySet<CanonicalColumn> = new Set([
  "price",
  "stock",
  "shipping_days",
  "return_days",
  "rating_avg",
  "review_count",
]);

export interface IngestionReport {
  headers: string[];
  mapping: Record<string, CanonicalColumn>;
  unmapped: string[];
  missingRequired: CanonicalColumn[];
  suggestions: Record<string, CanonicalColumn>;
  totalRows: number; // non-blank data rows
  rows: ProductRow[];
  errors: RowError[];
}

export interface IngestionOptions {
  /** Ask the LLM (when configured) to suggest columns for unmapped headers. Preview only. */
  suggestMappings?: boolean;
}

export interface IngestionService {
  parse(
    csv: string,
    overrides?: ColumnOverrides,
    options?: IngestionOptions,
  ): Promise<IngestionReport>;
}

const ALL_COLUMNS = Object.keys(COLUMN_MEANINGS) as CanonicalColumn[];
const SAMPLE_VALUES = 3;
const MappingOutput = z.object({
  suggestions: z.array(z.object({ header: z.string(), column: z.string() })),
});

/**
 * Step 9 mapping suggestions: only for unmapped headers, only to columns nothing is mapped to yet, each
 * column at most once. Suggestions only; the merchant applies them on the review screen (never automatic).
 */
async function suggestColumns(
  llm: LlmClient,
  headers: string[],
  columns: (CanonicalColumn | null)[],
  unmapped: string[],
  dataRows: { cells: string[] }[],
): Promise<Record<string, CanonicalColumn>> {
  const mapped = new Set(columns);
  const open = ALL_COLUMNS.filter((column) => !mapped.has(column));
  if (!open.length || !unmapped.length) return {};

  const samples = unmapped.map((header) => {
    const index = headers.indexOf(header);
    const values = dataRows
      .map(({ cells }) => parseTextCell(cells[index]))
      .filter((value): value is string => value !== undefined)
      .slice(0, SAMPLE_VALUES)
      .map((value) => sanitizeForAgents(value, 60));
    return { header, samples: values };
  });

  let output: z.infer<typeof MappingOutput>;
  try {
    output = await llm.generateObject({
      task: "mapping",
      system: MAPPING_SYSTEM,
      prompt: dataBlock("columns", {
        allowed_columns: open.map((name) => ({ name, meaning: COLUMN_MEANINGS[name] })),
        headers: samples,
      }),
      schema: MappingOutput,
      effort: "low",
    });
  } catch {
    return {};
  }

  const unmappedSet = new Set(unmapped);
  const openSet = new Set<string>(open);
  const suggestions = new Map<string, CanonicalColumn>();
  for (const { header, column } of output.suggestions) {
    if (!unmappedSet.has(header) || suggestions.has(header) || !openSet.has(column)) continue;
    if ([...suggestions.values()].includes(column as CanonicalColumn)) continue;
    suggestions.set(header, column as CanonicalColumn);
  }
  return Object.fromEntries(suggestions);
}

/** Comma, semicolon (European Excel) or tab: whichever splits the header row most. */
export function detectDelimiter(csv: string): "," | ";" | "\t" {
  const header = csv.split(/\r?\n/, 1)[0] ?? "";
  const count = (d: string) => header.split(d).length - 1;
  return ([",", ";", "\t"] as const).reduce((best, d) => (count(d) > count(best) ? d : best), ",");
}

function readCsv(csv: string): string[][] {
  try {
    return parse(csv, {
      bom: true,
      delimiter: detectDelimiter(csv),
      relax_column_count: true, // row width is checked below, with a row number
      relax_quotes: true, // 12" vase
      skip_empty_lines: false, // keep record index == spreadsheet row
    });
  } catch (err) {
    if (err instanceof CsvError)
      throw new AppError("INVALID_CSV", `Could not read the CSV: ${err.message}`, 400);
    throw err;
  }
}

/**
 * FR-01, FR-02. CSV -> header mapping -> per-row cell parsing -> ProductRow validation.
 * Every problem carries the spreadsheet row number and the merchant's own header name.
 */
export function createIngestionService(deps: { llm: LlmClient | null }): IngestionService {
  return {
    async parse(csv, overrides = {}, options = {}) {
      const [headerCells, ...records] = readCsv(csv);
      if (!headerCells || headerCells.every((cell) => !cell.trim())) {
        throw new AppError("INVALID_CSV", "The file is empty or has no header row.", 400);
      }
      const headers = headerCells.map((cell) => cell.trim());
      const { columns, mapping, unmapped, missingRequired } = mapColumns(headers, overrides);

      const dataRows = records
        .map((cells, i) => ({ cells, row: i + 2 })) // header is spreadsheet row 1
        .filter(({ cells }) => cells.some((cell) => cell.trim()));
      if (dataRows.length > MAX_CATALOG_ROWS) {
        throw new AppError(
          "TOO_MANY_ROWS",
          `A catalog upload can have at most ${MAX_CATALOG_ROWS} products.`,
          413,
        );
      }

      const suggestions =
        options.suggestMappings && deps.llm
          ? await suggestColumns(deps.llm, headers, columns, unmapped, dataRows)
          : {};

      const report: IngestionReport = {
        headers,
        mapping,
        unmapped,
        missingRequired,
        suggestions,
        totalRows: dataRows.length,
        rows: [],
        errors: [],
      };
      if (missingRequired.length) return report; // rows cannot be validated without required columns

      const headerOf = (column: string) =>
        headers[columns.indexOf(column as CanonicalColumn)] ?? column;
      const skuIsGenerated = !columns.includes("sku");
      const firstRowOfSku = new Map<string, number>();

      for (const { cells, row } of dataRows) {
        if (cells.length > headers.length) {
          report.errors.push({
            row,
            column: "(row)",
            message: `has ${cells.length} cells but the header has ${headers.length}; put quotes around cells that contain the delimiter`,
          });
          continue;
        }

        const input: Record<string, unknown> = {};
        columns.forEach((column, i) => {
          if (column)
            input[column] = NUMBER_COLUMNS.has(column)
              ? parseNumberCell(cells[i])
              : parseTextCell(cells[i]);
        });
        if (input.sku === undefined && typeof input.name === "string")
          input.sku = skuFromName(input.name);

        const parsed = ProductRow.safeParse(input);
        if (!parsed.success) {
          for (const issue of parsed.error.issues) {
            report.errors.push({
              row,
              column: headerOf(String(issue.path[0] ?? "(row)")),
              message: issue.message,
            });
          }
          continue;
        }

        const { sku } = parsed.data;
        const firstRow = firstRowOfSku.get(sku);
        if (firstRow !== undefined) {
          report.errors.push({
            row,
            column: headerOf("sku"),
            message: skuIsGenerated
              ? `same name as row ${firstRow}; add a SKU column or make product names unique`
              : `duplicate SKU "${sku}" (first used on row ${firstRow})`,
          });
          continue;
        }
        firstRowOfSku.set(sku, row);
        report.rows.push(parsed.data);
      }
      return report;
    },
  };
}
