import { NextResponse } from "next/server";
import puppeteer from "puppeteer";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const groupName = searchParams.get("group");

  if (!groupName) {
    return NextResponse.json({ error: "Missing group name" }, { status: 400 });
  }

  // Use NEXTJS_URL environment variable, defaulting to localhost:3000 for development
  const nextjsUrl = process.env.NEXTJS_URL || "http://localhost:3000";
  
  const schemaPageUrl = `${nextjsUrl}/schema?group=${encodeURIComponent(
    groupName
  )}`;

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-web-security",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        "--disable-features=TranslateUI",
        "--disable-ipc-flooding-protection",
      ],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    page.setDefaultNavigationTimeout(60000);
    page.setDefaultTimeout(60000);
    await page.goto(schemaPageUrl, {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    // Wait for either data-layouts or data-error to appear
    await page.waitForSelector("[data-layouts], [data-error]", { timeout: 60000 });

    // Check if there was an error
    const errorElement = await page.$("[data-error]");
    if (errorElement) {
      const errorMessage = await errorElement.evaluate((el) =>
        el.getAttribute("data-error")
      );
      return NextResponse.json(
        { error: errorMessage || "Unknown error loading template" },
        { status: 500 }
      );
    }

    // Wait for data-settings as well
    await page.waitForSelector("[data-settings]", { timeout: 60000 });

    const { dataLayouts, dataGroupSettings } = await page.evaluate(() => {
      const layoutsEl = document.querySelector("[data-layouts]");
      const settingsEl = document.querySelector("[data-settings]");
      return {
        dataLayouts: layoutsEl?.getAttribute("data-layouts") || "[]",
        dataGroupSettings: settingsEl?.getAttribute("data-settings") || "null",
      };
    });

    let slides, groupSettings;
    try {
      slides = JSON.parse(dataLayouts || "[]");
    } catch (e) {
      slides = [];
    }
    try {
      groupSettings = JSON.parse(dataGroupSettings || "null");
    } catch (e) {
      groupSettings = null;
    }

    const response = {
      name: groupName,
      ordered: groupSettings?.ordered ?? false,
      slides: slides.map((slide: any) => ({
        id: slide.id,
        name: slide.name,
        description: slide.description,
        json_schema: slide.json_schema,
      })),
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("Error fetching template schema:", err);
    return NextResponse.json(
      { 
        error: "Failed to fetch or parse client page",
        details: err instanceof Error ? err.message : String(err),
        url: schemaPageUrl
      },
      { status: 500 }
    );
  } finally {
    if (browser) await browser.close();
  }
}
