import {
  type Browser,
  expect,
  type Locator,
  type Page,
  test,
} from "@playwright/test";

// The critical end-to-end workflow of docs/14 §58, through the real UI with
// three signed-in test accounts. It runs only when they are configured
// (README → Testing → Browser tests), and it writes real records — an asset
// named "E2E …", one request and one maintenance request — into the project
// the app points at, so use a test project or accept those rows. At the end
// the asset is returned and retired, so it leaves the active lists.

const accounts = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL,
    password: process.env.E2E_ADMIN_PASSWORD,
  },
  technician: {
    email: process.env.E2E_TECHNICIAN_EMAIL,
    password: process.env.E2E_TECHNICIAN_PASSWORD,
  },
  student: {
    email: process.env.E2E_STUDENT_EMAIL,
    password: process.env.E2E_STUDENT_PASSWORD,
  },
};
type Role = keyof typeof accounts;

const configured = Object.values(accounts).every(
  (account) => account.email && account.password,
);

/** A 1×1 PNG, as a technician's evidence photo. */
const PHOTO = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

async function signedIn(browser: Browser, role: Role): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(accounts[role].email!);
  await page.getByLabel("Password").fill(accounts[role].password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
  return page;
}

/** Picks the option whose text contains `text` (labels include codes/emails). */
async function choose(select: Locator, text: string) {
  const option = select.locator("option", { hasText: text }).first();
  await expect(option).toBeAttached({ timeout: 10_000 });
  await select.selectOption((await option.getAttribute("value"))!);
}

test.describe("critical workflow (docs/14 §58)", () => {
  test.skip(
    !configured,
    "Set the E2E_* test account variables to run (README → Testing).",
  );
  test.setTimeout(180_000);

  test("asset_to_qr_to_request_to_repair_to_audit", async ({ browser }) => {
    const admin = await signedIn(browser, "admin");
    const student = await signedIn(browser, "student");
    const technician = await signedIn(browser, "technician");
    const name = `E2E Projector ${Date.now()}`;
    let assetId = "";
    let requestNumber = "";

    await test.step("admin creates an asset registered at Vyas / VY001", async () => {
      await admin.goto("/admin/assets/new");
      await admin.getByLabel("Asset name").fill(name);
      await choose(admin.getByLabel("Category"), "Projector");
      await choose(admin.getByLabel("Registered building"), "Vyas");
      await choose(admin.getByLabel("Registered room"), "VY001");
      await admin.getByRole("button", { name: "Create asset" }).click();
      await expect(admin).toHaveURL(/\/assets\/AST-\d{4}-\d+/);
      assetId = /\/assets\/(AST-\d{4}-\d+)/.exec(admin.url())![1];
      await expect(admin.getByRole("heading", { name })).toBeVisible();
    });

    await test.step("anyone scanning the QR code sees the asset", async () => {
      const visitor = await browser.newPage();
      await visitor.goto(`/asset/${assetId}`);
      await expect(visitor.getByRole("heading", { name })).toBeVisible();
      await expect(visitor.getByText("Vyas / VY001")).toBeVisible();
      await visitor.close();
    });

    await test.step("student requests it for Vivekananda / VK404", async () => {
      await student.goto(`/assets/${assetId}/request`);
      await choose(
        student.getByLabel("Building", { exact: true }),
        "Vivekananda",
      );
      await choose(student.getByLabel("Room", { exact: true }), "VK404");
      await student.getByRole("button", { name: "Submit request" }).click();
      await expect(student).toHaveURL(new RegExp(`/assets/${assetId}`));
      await expect(student.getByText("VK404").first()).toBeVisible();
      // The asset's home location does not change.
      await expect(student.getByText(/Vyas/).first()).toBeVisible();
    });

    await test.step("student reports a problem", async () => {
      await student.goto(`/assets/${assetId}/report`);
      await student
        .getByLabel("What is the problem?")
        .fill("E2E: the lamp flickers and turns off after a few minutes.");
      await student.getByRole("radio", { name: "Medium" }).check();
      await student.getByRole("button", { name: "Submit report" }).click();
      await expect(student).toHaveURL(/\/maintenance\/MR-\d{4}-\d+/);
      requestNumber = /\/maintenance\/(MR-\d{4}-\d+)/.exec(student.url())![1];
    });

    await test.step("admin assigns the technician", async () => {
      await admin.goto(`/maintenance/${requestNumber}`);
      await choose(
        admin.getByLabel("Technician", { exact: true }),
        accounts.technician.email!,
      );
      await admin.getByRole("button", { name: "Assign technician" }).click();
      await expect(admin.getByLabel("Hand over to")).toBeVisible();
    });

    await test.step("technician starts work, uploads evidence and logs the repair", async () => {
      await technician.goto(`/maintenance/${requestNumber}`);
      await technician.getByRole("button", { name: "Start work" }).click();
      await expect(technician.getByLabel("What was done?")).toBeVisible();

      await choose(technician.getByLabel("What is it?"), "Photo");
      await technician.getByLabel("File", { exact: true }).setInputFiles({
        name: "lamp.png",
        mimeType: "image/png",
        buffer: PHOTO,
      });
      await technician.getByRole("button", { name: "Upload file" }).click();
      await expect(technician.getByText("lamp.png").first()).toBeVisible({
        timeout: 20_000,
      });

      await choose(technician.getByLabel("Entry type"), "Repair");
      await technician
        .getByLabel("Note", { exact: true })
        .fill("E2E: replaced the lamp.");
      await technician.getByRole("button", { name: "Add note" }).click();
      await expect(
        technician.getByText("E2E: replaced the lamp.").first(),
      ).toBeVisible();
    });

    await test.step("technician resolves the request", async () => {
      await technician
        .getByLabel("What was done?")
        .fill("E2E: new lamp fitted and tested for an hour.");
      await technician.getByRole("button", { name: "Resolve request" }).click();
      await expect(technician.getByText("Resolved").first()).toBeVisible();
    });

    await test.step("student returns the asset", async () => {
      await student.goto(`/assets/${assetId}`);
      await student.getByRole("button", { name: "Return asset" }).click();
      await student
        .getByRole("dialog")
        .getByRole("button", { name: "Return asset" })
        .click();
      await expect(student.getByText("Available").first()).toBeVisible();
    });

    await test.step("audit events exist for every step", async () => {
      await admin.goto(`/admin/audit-logs?reference=${assetId}`);
      for (const event of [
        "Asset created",
        "Asset assigned",
        "Asset returned",
      ]) {
        await expect(admin.getByText(event).first()).toBeVisible();
      }
      await admin.goto(`/admin/audit-logs?reference=${requestNumber}`);
      for (const event of [
        "Problem reported",
        "Technician assigned",
        "Work started",
        "Evidence uploaded",
        "Work note added",
        "Request resolved",
      ]) {
        await expect(admin.getByText(event).first()).toBeVisible();
      }
    });

    await test.step("signed-in pages fit a phone screen", async () => {
      const pages: Array<[Page, string]> = [
        [student, "/dashboard"],
        [student, `/assets/${assetId}`],
        [student, `/assets/${assetId}/report`],
        [student, `/maintenance/${requestNumber}`],
        [technician, "/technician/maintenance"],
        [admin, "/admin"],
        [admin, "/admin/assets"],
        [admin, "/admin/maintenance"],
        [admin, "/admin/audit-logs"],
        [admin, "/admin/users"],
      ];
      for (const [page, route] of pages) {
        await page.setViewportSize({ width: 375, height: 800 });
        await page.goto(route);
        const sideways = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth + 1,
        );
        expect(sideways, `${route} scrolls sideways on a phone`).toBe(false);
        await page.setViewportSize({ width: 1280, height: 720 });
      }
    });

    await test.step("admin retires the test asset", async () => {
      await admin.goto(`/assets/${assetId}`);
      await admin.getByLabel("Change status to").selectOption("RETIRED");
      await admin.getByRole("button", { name: "Retire asset…" }).click();
      await admin
        .getByRole("dialog")
        .getByRole("button", { name: "Retire asset" })
        .click();
      await expect(admin.getByText("Retired").first()).toBeVisible();
    });
  });
});
