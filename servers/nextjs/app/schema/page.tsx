import { promises as fs } from "fs";
import path from "path";
import * as z from "zod";
import { ImageSchema, IconSchema } from "@/presentation-templates/defaultSchemes";

interface LayoutInfo {
  id: string;
  name?: string;
  description?: string;
  json_schema: any;
  templateID: string;
}

interface TemplateSetting {
  description: string;
  ordered: boolean;
  default?: boolean;
}

// Helper to extract metadata from file content using regex
function extractMetadataFromContent(content: string, fileName: string) {
  const layoutIdMatch = content.match(
    /export\s+const\s+layoutId\s*=\s*['"`]([^'"`]+)['"`]/
  );
  const layoutNameMatch = content.match(
    /export\s+const\s+layoutName\s*=\s*['"`]([^'"`]+)['"`]/
  );
  const layoutDescriptionMatch = content.match(
    /export\s+const\s+layoutDescription\s*=\s*['"`]([^'"`]+)['"`]/
  );

  const file = fileName.replace(".tsx", "").replace(".ts", "");
  
  return {
    layoutId: layoutIdMatch
      ? layoutIdMatch[1]
      : file.toLowerCase().replace(/layout$/, ""),
    layoutName: layoutNameMatch
      ? layoutNameMatch[1]
      : file.replace(/([A-Z])/g, " $1").trim(),
    layoutDescription: layoutDescriptionMatch
      ? layoutDescriptionMatch[1]
      : `${file} layout for presentations`,
  };
}

// Server Component - data is fetched at request time
export default async function SchemaPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const params = await searchParams;
  const templateID = params.group;

  if (!templateID) {
    return <div data-error="No templateID provided">No templateID provided</div>;
  }

  try {
    // Get the path to the template directory
    const templatesDirectory = path.join(
      process.cwd(),
      "presentation-templates"
    );

    // Read all directories in the presentation-templates directory
    const items = await fs.readdir(templatesDirectory, { withFileTypes: true });

    // Filter for directories (layout templates) and exclude files
    const templateDirectories = items
      .filter((item) => item.isDirectory())
      .map((dir) => dir.name);

    if (!templateDirectories.includes(templateID)) {
      return (
        <div data-error={`Template '${templateID}' not found`}>
          Error: Template '{templateID}' not found
        </div>
      );
    }

    // Get files for this template
    const templatePath = path.join(templatesDirectory, templateID);
    const templateFiles = await fs.readdir(templatePath);

    // Filter for .tsx files and exclude any non-layout files
    const layoutFiles = templateFiles.filter(
      (file) =>
        file.endsWith(".tsx") &&
        !file.startsWith(".") &&
        !file.includes(".test.") &&
        !file.includes(".spec.") &&
        file !== "settings.json"
    );

    // Read settings.json if it exists
    let settings: TemplateSetting | null = null;
    const settingsPath = path.join(templatePath, "settings.json");
    try {
      const settingsContent = await fs.readFile(settingsPath, "utf-8");
      settings = JSON.parse(settingsContent) as TemplateSetting;
    } catch {
      settings = {
        description: `${templateID} presentation layouts`,
        ordered: false,
        default: false,
      };
    }

    // Load each layout file
    const layouts: LayoutInfo[] = [];

    for (const fileName of layoutFiles) {
      const file = fileName.replace(".tsx", "").replace(".ts", "");
      const filePath = path.join(templatePath, fileName);
      
      try {
        // First, read the file content to extract metadata
        const content = await fs.readFile(filePath, "utf-8");
        const metadata = extractMetadataFromContent(content, fileName);

        // Try to dynamically import the layout module
        let module: any;
        try {
          module = await import(
            `@/presentation-templates/${templateID}/${file}`
          );
        } catch (importErr) {
          // If import fails (e.g., due to recharts SSR issues),
          // log the error and skip this layout
          console.error(`Failed to import ${fileName}:`, importErr);
          continue;
        }

        if (!module.Schema) {
          console.warn(`No Schema export found in ${fileName}`);
          continue;
        }

        // Convert Zod schema to JSON schema
        const jsonSchema = z.toJSONSchema(module.Schema, {
          override: (ctx) => {
            delete ctx.jsonSchema.default;
          },
        });

        const uniqueKey = `${templateID}:${metadata.layoutId}`;

        layouts.push({
          id: uniqueKey,
          name: metadata.layoutName,
          description: metadata.layoutDescription,
          json_schema: jsonSchema,
          templateID: templateID,
        });
      } catch (err) {
        console.error(`Error loading layout ${fileName}:`, err);
      }
    }

    return (
      <div>
        <div data-layouts={JSON.stringify(layouts)}>
          <pre>{JSON.stringify(layouts, null, 2)}</pre>
        </div>
        <div data-settings={JSON.stringify(settings)}>
          <pre>{JSON.stringify(settings, null, 2)}</pre>
        </div>
      </div>
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return <div data-error={errorMessage}>Error: {errorMessage}</div>;
  }
}
