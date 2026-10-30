// Tech's review-sheet scripts (4.5, Review sheet). Run from the backend repo:
//
//   npm run ops -- setup                                   one-time: tabs, dropdown, protected columns
//   npm run ops -- sync          --event <id>              Raw export, Review and Payment issues tabs
//   npm run ops -- decide        --event <id> --by <name>  show what the new decisions would do
//   npm run ops -- decide        --event <id> --by <name> --apply
//   npm run ops -- messages      --event <id>              rebuild the Messages tab right before sending
//   npm run ops -- mark-sent     --by <name> --from-sheet  mark the ticked Messages rows sent
//   npm run ops -- mark-sent     --by <name> --ids <id,id>
//   npm run ops -- retry-refunds --event <id>              finish refunds that have no refund_id
//   npm run ops -- resolve       --checkout <id>           after the events team contacted the student
//
// Needs the backend's .secret/.env plus REVIEW_SHEET_ID and
// GOOGLE_APPLICATION_CREDENTIALS (a service account the sheet is shared with as
// an editor). --event defaults to OPS_EVENT_ID.
import { runDecisions } from "./decisions";
import { markSent, markSentFromSheet, resolveIssue, retryRefunds } from "./payments";
import {
  locateColumns,
  MESSAGES_HEADER,
  REVIEW_HEADER,
  syncMessages,
  syncPaymentIssues,
  syncReviewSheet,
  TABS,
} from "./reviewSheet";
import { GoogleSheet, setUpReviewSheet } from "./sheet";

export const parseArgs = (argv: string[]) => {
  const [command, ...rest] = argv;
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (!arg.startsWith("--")) throw new Error(`Unexpected argument ${arg}`);
    const next = rest[i + 1];
    if (next === undefined || next.startsWith("--")) flags[arg.slice(2)] = true;
    else flags[arg.slice(2)] = rest[++i];
  }
  return { command, flags };
};

const required = (value: string | true | undefined, name: string) => {
  if (typeof value !== "string" || !value) throw new Error(`${name} is required`);
  return value;
};

export const main = async (argv: string[]) => {
  const { command, flags } = parseArgs(argv);
  const sheet = () => new GoogleSheet(required(process.env.REVIEW_SHEET_ID, "REVIEW_SHEET_ID"));
  const event = () => required(flags.event ?? process.env.OPS_EVENT_ID, "--event");
  let failed = false;

  switch (command) {
    case "setup": {
      const cols = locateColumns(REVIEW_HEADER);
      await setUpReviewSheet(required(process.env.REVIEW_SHEET_ID, "REVIEW_SHEET_ID"), {
        tabs: TABS,
        reviewHeader: REVIEW_HEADER,
        reviewerColumns: { decision: cols.decision, reopen: cols.reopen, notes: cols.notes },
        messagesHeader: MESSAGES_HEADER,
      });
      console.log("Review sheet set up.");
      break;
    }
    case "sync": {
      const s = sheet();
      const review = await syncReviewSheet(s, event());
      const issues = await syncPaymentIssues(s, event());
      console.log(`Review: ${review.applicants} applicants, ${review.added} added, ${review.cellsRefreshed} cells refreshed.`);
      console.log(`Payment issues: ${issues.issues} open, ${issues.missingRefunds} without a refund id.`);
      if (issues.missingRefunds) console.log("Run retry-refunds for the ones without a refund id.");
      break;
    }
    case "decide": {
      const result = await runDecisions(sheet(), event(), {
        reviewer: required(flags.by, "--by"),
        apply: flags.apply === true,
      });
      // Sheet rows are 0-based here; people read them 1-based
      const list = (label: string, items: { row: number }[]) => {
        if (items.length) console.log(`${label}: rows ${items.map((i) => i.row + 1).join(", ")}`);
      };
      console.log(`${result.runId}${result.applied ? "" : " (dry run: nothing changed; add --apply)"}`);
      list("Accept", result.accept);
      list("Reject", result.reject);
      list("Re-open", result.reopen);
      list("Already done, stamp only", result.repair);
      for (const n of [...result.errors, ...result.waiting, ...result.conflicts]) console.log(`Row ${n.row + 1}: ${n.message}`);
      if (result.applied) {
        console.log(`Stamped ${result.stamped.length} rows.`);
        console.log("Not finished until each new Accepted and Rejected message is sent or noted: run messages next.");
      }
      failed = result.errors.length > 0 || result.conflicts.length > 0;
      break;
    }
    case "messages": {
      const { due } = await syncMessages(sheet(), event());
      console.log(`Messages: ${due} due. Tick Sent for each one that goes out, then run mark-sent --from-sheet.`);
      break;
    }
    case "mark-sent": {
      const by = required(flags.by, "--by");
      const result =
        flags["from-sheet"] === true
          ? await markSentFromSheet(sheet(), by)
          : await markSent(required(flags.ids, "--ids").split(","), by);
      console.log(`Marked ${result.marked.length} sent.`);
      if (result.alreadyMarkedOrUnknown.length) {
        console.log(`Already marked or unknown: ${result.alreadyMarkedOrUnknown.join(", ")}`);
      }
      break;
    }
    case "retry-refunds": {
      const results = await retryRefunds(event());
      for (const r of results) console.log(`${r.checkoutId}: ${r.refundId ?? `not refunded (${r.error})`}`);
      if (!results.length) console.log("Every payment issue has a refund id.");
      failed = results.some((r) => r.error);
      break;
    }
    case "resolve":
      await resolveIssue(required(flags.checkout, "--checkout"));
      console.log("Resolved.");
      break;
    default:
      throw new Error(`Unknown command ${command ?? "(none)"}; see the top of src/ops/cli.ts`);
  }
  return failed ? 1 : 0;
};

if (require.main === module) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
