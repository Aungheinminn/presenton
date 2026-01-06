/**
 * Build-time script to generate JSON schema files for all presentation templates.
 * Run this script with: npx tsx scripts/generate-template-schemas.ts
 * 
 * This generates static JSON files that can be served by the /api/template endpoint
 * without needing to dynamically import React components (which can fail in SSR).
 */

import * as fs from "fs/promises";
import * as path from "path";

// We need to mock React and recharts to prevent SSR errors
const mockReact = {
  FC: () => null,
  createElement: () => null,
  useState: () => [null, () => {}],
  useEffect: () => {},
  useRef: () => ({ current: null }),
  useCallback: (fn: any) => fn,
  useMemo: (fn: any) => fn(),
};

// Mock problematic modules before importing templates
const originalRequire = require;

// This script should be run with tsx which handles TypeScript
async function generateSchemas() {
  const templatesDir = path.join(process.cwd(), "presentation-templates");
  const outputDir = path.join(process.cwd(), "public", "template-schemas");

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  // Get all template group directories
  const items = await fs.readdir(templatesDir, { withFileTypes: true });
  const templateGroups = items
    .filter((item) => item.isDirectory())
    .map((dir) => dir.name);

  console.log(`Found template groups: ${templateGroups.join(", ")}`);

  for (const groupName of templateGroups) {
    const groupDir = path.join(templatesDir, groupName);
    const files = await fs.readdir(groupDir);

    // Filter for .tsx layout files
    const layoutFiles = files.filter(
      (file) =>
        file.endsWith(".tsx") &&
        !file.startsWith(".") &&
        !file.includes(".test.") &&
        !file.includes(".spec.")
    );

    console.log(`Processing ${groupName}: ${layoutFiles.length} layout files`);

    const slides: any[] = [];

    for (const fileName of layoutFiles) {
      try {
        const filePath = path.join(groupDir, fileName);
        const content = await fs.readFile(filePath, "utf-8");
        const file = fileName.replace(".tsx", "").replace(".ts", "");

        // Extract metadata using regex
        const layoutIdMatch = content.match(
          /export\s+const\s+layoutId\s*=\s*['"`]([^'"`]+)['"`]/
        );
        const layoutId = layoutIdMatch
          ? layoutIdMatch[1]
          : file.toLowerCase().replace(/layout$/, "");

        const layoutNameMatch = content.match(
          /export\s+const\s+layoutName\s*=\s*['"`]([^'"`]+)['"`]/
        );
        const layoutName = layoutNameMatch
          ? layoutNameMatch[1]
          : file.replace(/([A-Z])/g, " $1").trim();

        const layoutDescriptionMatch = content.match(
          /export\s+const\s+layoutDescription\s*=\s*['"`]([^'"`]+)['"`]/
        );
        const layoutDescription = layoutDescriptionMatch
          ? layoutDescriptionMatch[1]
          : `${layoutName} layout for presentations`;

        // Try to import the module to get the schema
        try {
          const modulePath = `../presentation-templates/${groupName}/${file}`;
          const module = await import(modulePath);

          if (module.Schema) {
            const z = await import("zod");
            const jsonSchema = z.toJSONSchema(module.Schema, {
              override: (ctx: any) => {
                delete ctx.jsonSchema.default;
              },
            });

            const uniqueKey = `${groupName}:${layoutId}`;

            slides.push({
              id: uniqueKey,
              name: layoutName,
              description: layoutDescription,
              json_schema: jsonSchema,
            });

            console.log(`  ✓ ${fileName}`);
          } else {
            console.log(`  ⚠ ${fileName}: No Schema export found`);
          }
        } catch (importError) {
          console.log(`  ✗ ${fileName}: ${(importError as Error).message}`);
          
          // Still add the slide with metadata only
          const uniqueKey = `${groupName}:${layoutId}`;
          slides.push({
            id: uniqueKey,
            name: layoutName,
            description: layoutDescription,
            json_schema: null,
            error: (importError as Error).message,
          });
        }
      } catch (error) {
        console.error(`Error processing ${fileName}:`, error);
      }
    }

    // Read settings.json if it exists
    let settings: any = null;
    const settingsPath = path.join(groupDir, "settings.json");
    try {
      const settingsContent = await fs.readFile(settingsPath, "utf-8");
      settings = JSON.parse(settingsContent);
    } catch {
      settings = {
        description: `${groupName} presentation layouts`,
        ordered: false,
        default: false,
      };
    }

    // Write the output JSON file
    const output = {
      name: groupName,
      ordered: settings?.ordered ?? false,
      slides: slides.filter((s) => s.json_schema !== null),
    };

    const outputPath = path.join(outputDir, `${groupName}.json`);
    await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
    console.log(`Wrote ${outputPath}`);
  }

  console.log("\nDone generating template schemas!");
}

generateSchemas().catch(console.error);
