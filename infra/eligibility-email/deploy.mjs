// Run deliberately after configuring AWS and the matching Convex secret.
// Secrets go through a permissions-restricted parameter file, never CLI arguments.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const directory = fileURLToPath(new URL(".", import.meta.url));
const required = [
  "AWS_REGION",
  "ELIGIBILITY_INBOUND_DOMAIN",
  "ELIGIBILITY_CONVEX_SITE_URL",
  "ELIGIBILITY_EMAIL_BRIDGE_SECRET",
];
for (const name of required)
  if (!process.env[name]) throw new Error(`Set ${name} before deploying.`);
if (
  !/^https:\/\/[a-z0-9.-]+\.convex\.site$/.test(
    process.env.ELIGIBILITY_CONVEX_SITE_URL,
  )
)
  throw new Error("Use the Convex HTTP action URL ending in .convex.site.");
if (process.env.ELIGIBILITY_EMAIL_BRIDGE_SECRET.length < 32)
  throw new Error("Use a bridge secret with at least 32 characters.");
const region = process.env.AWS_REGION;
const stack = process.env.ELIGIBILITY_EMAIL_STACK ?? "ideal-eligibility-email";
const aws = (...args) =>
  execFileSync("aws", [...args, "--region", region], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
const account = JSON.parse(aws("sts", "get-caller-identity")).Account;
// First deployment publishes identity/DNS outputs. The second creates the
// receiving rule after domain verification; preserve that setting on updates.
let enableReceiptRule = process.env.ELIGIBILITY_ENABLE_RECEIPT_RULE;
if (
  enableReceiptRule !== undefined &&
  !["true", "false"].includes(enableReceiptRule)
)
  throw new Error("ELIGIBILITY_ENABLE_RECEIPT_RULE must be true or false.");
if (enableReceiptRule === undefined) {
  try {
    const prior = JSON.parse(
      execFileSync(
        "aws",
        [
          "cloudformation",
          "describe-stacks",
          "--stack-name",
          stack,
          "--region",
          region,
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      ),
    );
    enableReceiptRule =
      prior.Stacks[0].Parameters.find(
        (p) => p.ParameterKey === "EnableReceiptRule",
      )?.ParameterValue ?? "false";
  } catch (error) {
    if (!String(error.stderr).includes("does not exist"))
      throw new Error(
        "Could not check the existing email stack; verify AWS permissions before retrying.",
      );
    enableReceiptRule = "false";
  }
}
if (enableReceiptRule === "true") {
  const identity = JSON.parse(
    aws(
      "sesv2",
      "get-email-identity",
      "--email-identity",
      process.env.ELIGIBILITY_INBOUND_DOMAIN,
    ),
  );
  if (!identity.VerifiedForSendingStatus)
    throw new Error(
      "Verify the SES domain identity using the first deployment's DNS records before enabling the receipt rule.",
    );
}
const bucket = `ideal-eligibility-artifacts-${account}-${region}`;
execFileSync("npm", ["ci"], { cwd: directory, stdio: "inherit" });
execFileSync("node", ["build.mjs"], { cwd: directory, stdio: "inherit" });
try {
  aws("s3api", "head-bucket", "--bucket", bucket);
} catch {
  const args = ["s3api", "create-bucket", "--bucket", bucket];
  if (region !== "us-east-1")
    args.push("--create-bucket-configuration", `LocationConstraint=${region}`);
  aws(...args);
}
aws(
  "s3api",
  "put-public-access-block",
  "--bucket",
  bucket,
  "--public-access-block-configuration",
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true",
);
aws(
  "s3api",
  "put-bucket-encryption",
  "--bucket",
  bucket,
  "--server-side-encryption-configuration",
  JSON.stringify({
    Rules: [{ ApplyServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" } }],
  }),
);
const zip = join(directory, "dist/bridge.zip");
const key = `bridge/${createHash("sha256").update(readFileSync(zip)).digest("hex")}.zip`;
aws("s3", "cp", zip, `s3://${bucket}/${key}`);
const temporary = mkdtempSync(join(tmpdir(), "ideal-email-parameters-"));
try {
  const params = {
    InboundDomain: process.env.ELIGIBILITY_INBOUND_DOMAIN,
    ConvexSiteUrl: process.env.ELIGIBILITY_CONVEX_SITE_URL,
    BridgeSecret: process.env.ELIGIBILITY_EMAIL_BRIDGE_SECRET,
    CodeBucket: bucket,
    CodeKey: key,
    AlertEmail: process.env.ELIGIBILITY_ALERT_EMAIL ?? "",
    EnableReceiptRule: enableReceiptRule,
  };
  const parameterFile = join(temporary, "parameters.json");
  writeFileSync(
    parameterFile,
    JSON.stringify(
      Object.entries(params).map(([ParameterKey, ParameterValue]) => ({
        ParameterKey,
        ParameterValue,
      })),
    ),
    { mode: 0o600 },
  );
  aws(
    "cloudformation",
    "deploy",
    "--stack-name",
    stack,
    "--template-file",
    join(directory, "template.yaml"),
    "--capabilities",
    "CAPABILITY_IAM",
    "--parameter-overrides",
    `file://${parameterFile}`,
    "--no-fail-on-empty-changeset",
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
console.log(
  aws(
    "cloudformation",
    "describe-stacks",
    "--stack-name",
    stack,
    "--query",
    "Stacks[0].Outputs",
    "--output",
    "table",
  ),
);
console.log(
  enableReceiptRule === "true"
    ? "Receiving rule created. Check existing mail routes before activating the rule set. See docs/eligibility-intake.md."
    : "Add the DNS records and verify the identity, then rerun with ELIGIBILITY_ENABLE_RECEIPT_RULE=true. See docs/eligibility-intake.md.",
);
