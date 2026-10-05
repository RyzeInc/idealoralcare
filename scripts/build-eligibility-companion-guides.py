"""Render the source-grounded eligibility companion guides as PDF, HTML, and Markdown.
Run with Python 3 + reportlab + svglib. No production services are contacted.
"""
from pathlib import Path
from html import escape
import base64
import io
import json
import re
import shutil
import zipfile
import math

from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from svglib.svglib import svg2rlg
from reportlab.graphics import renderPDF

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/eligibility-companion"
OUT.mkdir(parents=True, exist_ok=True)
ASSETS = OUT / "assets"
ASSETS.mkdir(exist_ok=True)
DATE = "October 5, 2026"
VERSION = "v0.17.5"
PORTAL = "https://www.getidealoh.com/employer/upload"
ADMIN = "https://www.getidealoh.com/admin/eligibility/intake"
FILES = "https://www.getidealoh.com/admin/eligibility"
NAVY, BLUE, TEAL, INK, MUTED = "#14324B", "#155EAD", "#087E8B", "#233C50", "#536575"
PALE, LINE, GREEN = "#F3F7FA", "#DCE5ED", "#287A49"

font_dir = Path("/System/Library/Fonts/Supplemental")
if not (font_dir / "Arial.ttf").exists():
    font_dir = Path(__import__("os").environ.get("IDEAL_GUIDE_FONT_DIR", "."))
pdfmetrics.registerFont(TTFont("Arial", str(font_dir / "Arial.ttf")))
pdfmetrics.registerFont(TTFont("Arial-Bold", str(font_dir / "Arial Bold.ttf")))
pdfmetrics.registerFontFamily("Arial", normal="Arial", bold="Arial-Bold")
LOGO = ROOT / "public/ideal-oral-health-logo.png"
logo_uri = "data:image/png;base64," + base64.b64encode(LOGO.read_bytes()).decode()
STYLES = {
    "body": ParagraphStyle("body", fontName="Arial", fontSize=10.2, leading=14.8, textColor=HexColor(INK)),
    "small": ParagraphStyle("small", fontName="Arial", fontSize=8.4, leading=11.5, textColor=HexColor(MUTED)),
    "heading": ParagraphStyle("heading", fontName="Arial-Bold", fontSize=12.2, leading=16, textColor=HexColor(NAVY)),
    "title": ParagraphStyle("title", fontName="Arial-Bold", fontSize=28, leading=31, textColor=HexColor(NAVY)),
    "table": ParagraphStyle("table", fontName="Arial", fontSize=9.1, leading=12.8, textColor=HexColor(INK)),
    "tablehead": ParagraphStyle("tablehead", fontName="Arial-Bold", fontSize=9.1, leading=12.8, textColor=white),
}

def text(x, y, value, size=22, color=INK, bold=False):
    return f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}" font-family="Arial, sans-serif" font-weight="{700 if bold else 400}">{escape(value)}</text>'

def rect(x,y,w,h,fill=PALE,stroke=LINE,r=12):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}"/>'

def arrow(x1,y1,x2,y2):
    angle=math.atan2(y2-y1,x2-x1)
    ux,uy=math.cos(angle),math.sin(angle)
    bx,by=x2-10*ux,y2-10*uy
    return f'<path d="M{x1} {y1} L{x2} {y2}" stroke="{BLUE}" stroke-width="3" fill="none"/><polygon points="{x2},{y2} {bx-5*uy},{by+5*ux} {bx+5*uy},{by-5*ux}" fill="{BLUE}"/>'

def circle(x,y,n):
    return f'<circle cx="{x}" cy="{y}" r="17" fill="{BLUE}"/>' + text(x-6,y+7,str(n),20,"#FFFFFF",True)

def svg(name, height, parts, title, description):
    result = f'<svg xmlns="http://www.w3.org/2000/svg" width="1048" height="{height}" viewBox="0 0 1048 {height}" role="img" aria-labelledby="title desc"><title id="title">{escape(title)}</title><desc id="desc">{escape(description)}</desc><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="{BLUE}"/></marker></defs><rect width="1048" height="{height}" rx="16" fill="#FFFFFF"/>' + "".join(parts) + "</svg>"
    result=result.replace('id="title"',f'id="{name}-title"').replace('id="desc"',f'id="{name}-desc"').replace('aria-labelledby="title desc"',f'aria-labelledby="{name}-title {name}-desc"').replace('id="arrow"',f'id="{name}-arrow"').replace('url(#arrow)',f'url(#{name}-arrow)')
    (ASSETS / (name + ".svg")).write_text(result)
    return name

svg("workflow",270,
    [rect(16,y,174,48,PALE) + text(30,y+31,label,18,NAVY,True) for y,label in [(20,"Browser upload"),(87,"Email attachment"),(154,"HTTPS automation")]] +
    [f'<path d="M190 {y} L213 {y} L213 111 L244 111" stroke="{BLUE}" stroke-width="2.5" fill="none"/>' for y in [44,111,178]] +
    [rect(x,75,w,74,fill) + text(x+15,104,title,23,NAVY,True) + text(x+15,131,subtitle,18,MUTED) for x,w,title,subtitle,fill in [(244,162,"Review","Preview + check",PALE),(440,162,"Approve","Save for import",PALE),(636,162,"Process","Add / update",PALE),(834,196,"Verify","Counts + issues","#EDF7F1")]] +
    [arrow(a,111,b,111) for a,b in [(406,436),(602,632),(798,830)]] +
    [rect(244,184,786,65,"#FFF7E5","#EDD59A"),text(261,211,"Separate next steps: member invitations and vendor delivery",21,NAVY,True),text(261,239,"A receipt, approval, or completed import does not confirm benefit activation.",18,INK)],
    "Three intake methods, one staff workflow", "Browser, email and HTTPS files converge on staff review, approval, processing and verification. Member invitations and vendor delivery are separate steps.")
svg("organization-workflow",150,
    [rect(x,22,228,85, "#EDF7F1" if i==3 else PALE) + circle(x+27,48,i+1) + text(x+52,54,title,23,NAVY,True) + text(x+16,84,sub,19,MUTED) for i,(x,title,sub) in enumerate([(14,"Prepare","Use the agreed template"),(278,"Submit","Use one upload method"),(542,"Save receipt","Received for review"),(806,"Ideal reviews","Watch status / follow-up")])] +
    [arrow(a,64,b,64) for a,b in [(242,274),(506,538),(770,802)]] +
    [text(18,138,"Submission confirms delivery. Ideal confirms the next steps for your organization.",20,INK)],
    "Your submission journey", "Prepare a roster, submit it, save its receipt and wait for Ideal review. A receipt is not confirmation of coverage.")
svg("portal-walkthrough",460,
    [rect(14,14,692,429,"#FFFFFF"), rect(14,14,692,46,PALE),text(34,45,"Ideal Oral Health · Employer uploads",23,NAVY,True),text(40,98,"Submit an eligibility file",29,NAVY,True),
     circle(52,139,1),text(82,147,"Organization",20,NAVY,True),rect(82,158,559,39,"#FFFFFF"),text(96,185,"Example Organization",22),
     circle(52,222,2),text(82,230,"Roster date (optional)",20,NAVY,True),rect(82,241,248,35,"#FFFFFF"),text(95,267,"2026-10-05",21),
     circle(52,297,3),text(82,305,"Eligibility file",20,NAVY,True),text(82,333,"Choose File   example-eligibility.csv",21),text(82,357,"Download a blank CSV template",20,BLUE),
     circle(52,391,4),rect(82,371,232,38,BLUE,BLUE),text(98,397,"Submit for review",21,"#FFFFFF",True),
     circle(679,419,5),rect(340,371,304,54,"#EDF7F1","#B5D7C2"),text(355,393,"Received for review",21,GREEN,True),text(355,416,"Receipt: [submission ID]",18),
     text(741,42,"Follow these callouts",25,NAVY,True)] +
    [circle(754,y,n)+text(784,y+7,title,21,NAVY,True)+text(741,y+39,sub,18,MUTED) for n,y,title,sub in [(1,86,"Confirm organization","Only your approved groups appear."),(2,163,"Set the roster date","Use the file’s as-of date, if known."),(3,240,"Choose your file","CSV, XLSX, TXT or JSON; ≤10 MB."),(4,317,"Submit once","Stay on the page until it finishes."),(5,394,"Keep the receipt","Check Recent submissions below.")]],
    "Annotated employer upload screen", "Illustrated interface using example data, with callouts for organization, roster date, file selection, submission and receipt. The real screen can vary.")
svg("access-walkthrough",310,
    [rect(14,14,655,280,"#FFFFFF"),text(36,49,"Employer intake",28,NAVY,True),text(36,86,"Review queue",21,MUTED),rect(210,59,166,38,"#EAF2FC"),text(224,86,"Upload access",21,BLUE,True),
     text(36,126,"Authorize a contact",25,NAVY,True),circle(45,166,1),text(76,173,"Organization   Example Organization",21),
     circle(45,209,2),text(76,216,"Email   people@example.org",21),
     circle(45,252,3),text(76,259,"☑ Browser uploads    ☑ Email attachments",20),
     text(711,47,"Onboarding sequence",25,NAVY,True),
     text(711,96,"1   Choose the correct organization",21,INK,True),text(711,135,"2   Approve the exact contact address",21,INK,True),text(711,174,"3   Enable the agreed methods",21,INK,True),
     rect(711,201,320,91,"#EDF7F1","#B5D7C2"),text(729,229,"Save upload access",22,GREEN,True),text(729,257,"Then copy the assigned address",18),text(729,280,"from Approved contacts.",18)],
    "Annotated Upload access screen", "Illustration showing the organization selector, approved contact email and independent Browser uploads and Email attachments permissions. Saving creates or updates contact access.")
svg("review-walkthrough",300,
    [rect(14,15,478,270,"#FFFFFF"),text(34,51,"Review queue",28,NAVY,True),text(34,87,"Show: Awaiting review",21,MUTED),rect(34,108,438,90,PALE),text(48,139,"Example Organization · example.csv",21,NAVY,True),text(48,168,"people@example.org · submitted",20),rect(34,216,125,39,BLUE,BLUE),text(54,243,"Preview",22,"#FFFFFF",True),text(183,243,"Reject",22,MUTED),
     arrow(494,149,530,149),rect(542,15,490,270,"#FFFFFF"),text(564,51,"Review eligibility file",27,NAVY,True),
     text(564,92,"1 primary member · 2 dependents",22),text(564,126,"0 parsing issues · 0 validation issues",21,GREEN),
     rect(564,146,444,52,PALE),text(579,179,"Sample members: Jane Example",21),
     rect(564,217,161,38,BLUE,BLUE),text(580,243,"Approve file",22,"#FFFFFF",True),text(754,243,"Close",22,MUTED)],
    "Annotated review queue and preview", "Example queue and staff preview. Approval is a separate action from processing. Missing-field warnings require explicit acknowledgement when present.")
svg("family-example",232,
    [rect(12,16,1024,188,"#FFFFFF"),rect(12,16,1024,44,NAVY,NAVY,0)] +
    [text(x,45,label,19,"#FFFFFF",True) for x,label in [(25,"Employee name"),(241,"Employee DOB"),(420,"Employee ID"),(579,"Covered person"),(795,"Covered DOB"),(943,"Relation")]] +
    [rect(13,y,1022,44, "#EAF5F5" if i%2==0 else "#FFFFFF",LINE,0) + "".join(text(x,y+29,value,19,TEAL if x<579 else INK,x==420) for x,value in zip([25,241,420,579,795,943],["Jane Example","1990-01-01","EMP-001",person,dob,rel])) for i,(y,person,dob,rel) in enumerate([(61,"Jane Example","1990-01-01","Employee"),(108,"Sam Example","1991-04-15","Spouse"),(155,"Alex Example","2018-06-10","Child")])] +
    [text(20,225,"Repeat the employee’s identity. Change the covered person and relationship on each row.",20,INK)],
    "One family, three roster rows", "A fictitious employee, spouse and child share the employee identity on each row while covered person fields differ. Names are combined here; the CSV has separate first and last name columns.")
svg("email-routing",216,
    [rect(14,25,266,118,PALE),text(31,58,"Approved sender",23,NAVY,True),text(31,94,"people@example.org",23,TEAL,True),text(31,125,"Exact address Ideal authorized",17,MUTED),
     arrow(283,85,320,85),rect(333,25,388,118,PALE),text(351,58,"Assigned organization address",23,NAVY,True),text(351,92,"eligibility+org-example",23,TEAL,True),text(351,121,"@getidealoh.com",23,TEAL,True),
     arrow(724,85,761,85),rect(774,25,259,118,"#EDF7F1","#B5D7C2"),text(793,58,"Ideal review queue",23,NAVY,True),text(793,94,"Receipt after acceptance",19),text(793,125,"No automatic coverage change",17,MUTED),
     rect(14,162,1019,42,"#FFF7E5","#EDD59A"),text(30,189,"Example only. Use your assigned plus-address in full, including the +org-… portion.",21,NAVY,True)],
    "How organization email routing works", "An authorized sender emails attachments to their assigned Gmail plus-address. Accepted files enter the Ideal review queue and receive a receipt. The example address is not a real organization alias.")

def paragraph(value):
    return {"type":"p", "text":value}
def section(title, text):
    return {"type":"section","title":title,"text":text}
def callout(title,text,tone="blue"):
    return {"type":"callout","title":title,"text":text,"tone":tone}
def steps(items):
    return {"type":"steps","items":items}
def diagram(name,caption):
    return {"type":"diagram","name":name,"caption":caption}
def table(headers, rows, widths):
    return {"type":"table","headers":headers,"rows":rows,"widths":widths}
def page(title, subtitle, blocks):
    return {"title":title,"subtitle":subtitle,"blocks":blocks}

PM = {
 "slug":"program-manager-guide","title":"Program Manager companion guide","audience":"INTERNAL · PROGRAM MANAGER","share":"Internal operational guide",
 "pages":[
 page("Run eligibility intake", "A practical companion for onboarding organizations, reviewing rosters, and verifying the next steps.", [
    callout("Start here",f'Open <a href="{ADMIN}" color="{BLUE}"><b>Operations → Employer Intake</b></a>. Intake is the delivery and review stage; invitations and vendor fulfillment remain separate.'),
    diagram("workflow","The shared workflow. Browser, Google Workspace email, and automated HTTPS submissions enter the same review queue."),
    table(["Owner","What they do"],[
     ["Organization contact","Prepares the agreed roster, submits it, keeps the receipt, and corrects source data."],
     ["Program Manager / authorized staff","Authorizes contacts, checks counts and organization, approves or rejects, starts processing, and verifies outcomes."],
     ["Technical administrator","Keeps sign-in, the Gmail intake script, and automation available; manages technical setup and credential issues."]
    ],[.29,.71]),
    callout("Four milestones to keep separate","<b>Received → approved → processed → invited / delivered.</b> None is a substitute for confirmation of the next milestone.","amber"),
    paragraph("Agree a submission cadence, roster format, review turnaround, and exception contact with each organization. These are program arrangements; the system does not set a review SLA.")
 ]),
 page("Onboard an organization", "Give each contact only the organizations and delivery methods they need.", [
    diagram("access-walkthrough","Illustrated UI with fictitious data. Save the contact, then use Approved contacts to obtain the assigned email address."),
    steps([
     ["Check the destination","The organization and its site must be active; its account must be active or onboarding. Set its Organization Code in Hierarchy before approving a roster."],
     ["Authorize the exact email","In <b>Upload access → Authorize a contact</b>, choose Organization, enter Email, select Browser uploads and/or Email attachments from this exact address, then click <b>Save upload access</b>."],
     ["Share the upload details","Send the portal link, approved sign-in/sender address, template, assigned email address if enabled, agreed cadence, and your support contact. Complete the onboarding card in the Organization guide."],
     ["Verify the first submission","Ask for a fictitious test roster first. Browser users must verify their approved sign-in email. Email-only contacts do not need a portal account to send; enable browser access if they need portal history."]
    ]),
    callout("Brokers and contact changes","Authorize each organization separately for a broker. Revoke the old contact when staff change; revocation also invalidates unfinished upload sessions. Reassigned email addresses may require a technical access reset. Do not share a former contact’s login.")
 ]),
 page("Review before approval", "Check the destination and roster before allowing member records to change.", [
    diagram("review-walkthrough","Illustration, not a live screenshot. The review dialog uses the exact Preview and Approve file labels."),
    steps([
     ["Find the submission","Use <b>Review queue → Show: Awaiting review</b>. It shows up to 100 oldest pending submissions. Confirm organization, sender, filename, roster date if supplied, and receipt ID."],
     ["Preview and compare","Click <b>Preview</b>. Compare primary and dependent counts with the organization’s expected totals. Check sample members and the displayed parsing and validation issues. Intake allows files up to 10 MB; the importer caps files at 10,000 primaries."],
     ["Resolve issues or approve deliberately","Zero primaries, parsing issues, or the member limit block approval. Request a corrected source file when needed. Missing-field warnings require the explicit acknowledgement checkbox; accept them only after assessing effects on invitations and vendor fulfillment."],
     ["Approve or reject","Click <b>Approve file</b> to create the linked Eligibility Files record. Or click <b>Reject</b>, enter a reason visible to the organization, and confirm <b>Reject and delete attachment</b>. Rejection schedules source-file deletion."]
    ]),
    callout("After approval, change the filter","The approved row leaves Awaiting review. Switch <b>Show → Latest 100 submissions</b> to find <b>Process approved file</b>. Use Eligibility Files to follow an older approved file.","amber"),
    paragraph("Suggested rejection note: “Please use the agreed template and include a birth date for each employee. Upload a corrected file for review.” Keep names, birth dates, and other member details out of review notes.")
 ]),
 page("Process and verify", "Finish the import, then decide which follow-up actions the program needs.", [
    steps([
     ["Start the approved import","In Latest 100 submissions, click <b>Process approved file</b>. Processing starts separately from approval. Follow the processing status or open <b>Eligibility Files</b>."],
     ["Verify counts and errors",f'At <a href="{FILES}" color="{BLUE}"><b>Eligibility Files</b></a>, find the linked upload in Upload History. Check final status, new/updated counts, and row issues. Spot-check a few members in the correct organization. A partial result needs review before closing the task.'],
     ["Grant member access when appropriate","On the processed file’s row, click <b>Grant Access</b>. Review the member list, select the members ready to invite, then click <b>Send invite to N member(s)</b>. Members without email cannot be invited through this action. Confirm the invitation result."],
     ["Coordinate vendor delivery","Follow Ideal’s vendor delivery procedure. A generated/downloaded file is not proof of delivery. Confirm the actual send result or vendor receipt before telling the organization that fulfillment is complete."]
    ]),
    table(["Processing status","Program Manager action"],[
     ["uploaded","Approved; awaiting processing. Start the import when ready."],
     ["validating / processing","In progress. Monitor; avoid starting a second import."],
     ["completed","Import finished. Check counts and any reported issues before follow-up."],
     ["completed_with_errors","Review row issues; some members may have been imported. Correct affected data."],
     ["failed","Investigate first. Retry processing after the cause is fixed; escalate persistent failures."]
    ],[.32,.68]),
    callout("Removals are a separate workflow","Omitting a person from a roster does not terminate them. Term Date is not an automated termination instruction in this importer. Follow the approved member-status procedure; address billing and vendor updates separately where applicable.","amber")
 ]),
 page("Email and automation", "Use the assigned address; keep mailbox and automation operations with the technical owner.", [
    diagram("email-routing","Current email intake runs in the dedicated Google Workspace eligibility mailbox. The alias shown here is fictitious."),
    section("What to tell organizations","Email the original attachment from the exact approved sender to the complete assigned plus-address. The plain eligibility@getidealoh.com mailbox address does not identify an organization. Use one organization’s alias per submission. Supported attachments: CSV, XLSX, TXT or JSON; at most five supported attachments, each ≤10 MB. Gmail’s overall message limits still apply."),
    section("Email is checked periodically","When installed, the Gmail script is scheduled every five minutes. Accepted files enter the queue and the sender is emailed a receipt; this is not an instantaneous delivery or review promise. Gmail filtering and sender-domain authentication are required. Forwarded messages, group mail, or unapproved senders can be refused without a reply."),
    section("If receipt delivery looks wrong","Check Ideal’s queue before asking for another upload. A receipt email can fail even after the file is received. Confirm the sender and exact alias. If email fails for several organizations, escalate to the technical owner to check the Gmail script’s trigger/executions and mailbox. A “settings present” message in the admin screen does not confirm that the script is running."),
    section("For payroll automation","In Upload access, create an automated upload credential for one organization, with a descriptive label and 1–365 day expiry. Copy it once and share through the approved secure channel. The technical owner supplies the HTTPS endpoint/client instructions. Rotate by creating a replacement, updating the job, then revoking the old key."),
    callout("Keep the inbox purpose-specific","The dedicated eligibility mailbox is for file intake. Handled or refused messages are moved to Trash; Gmail normally purges Trash after 30 days. Do not use it for human support conversations.")
 ]),
 page("Daily reference & handoff", "A short operating routine and a message you can adapt for every organization.", [
    table(["Check","Action"],[
     ["Each workday","Review pending files; compare counts; resolve corrections; process approved files; follow exceptions to closure."],
     ["No organization / no access","Verify the approved email and organization grant. Ask the user to verify that email and check access again."],
     ["Rejected / expired","Explain the correction or expiry; request a fresh submission. Unreviewed source files expire after 30 days."],
     ["Already received","Find the existing receipt. Do not change dates merely to force a duplicate import."],
     ["Vendor ID belongs to another organization","Stop and verify the roster with the sender; escalate the ID conflict. Do not bypass organization isolation."],
     ["Failed automation","Check expiry/revocation, file size and format. Involve the technical owner; do not ask for keys in email."]
    ],[.33,.67]),
    callout("Welcome message · replace every bracketed field",
      f'<b>Subject:</b> [Organization] eligibility submission instructions<br/><br/>'
      f'Your approved contact address is [email]. Submit your roster at <a href="{PORTAL}" color="{BLUE}">{PORTAL}</a>. [If enabled: You may also attach the file to [assigned organization email address].]<br/><br/>'
      'Use the attached blank CSV template or the format agreed with Ideal. Send files up to 10 MB. Our agreed schedule is [cadence]; the review turnaround is [agreed turnaround]. Keep your submission receipt.<br/><br/>'
      'A receipt confirms delivery for review. Ideal will confirm any corrections and next steps. Send questions to [Program Manager contact], using your organization name and receipt ID; keep member information out of the subject and message body.'),
    paragraph("Retention and handling: rejected attachments are deleted; pending files expire after 30 days. Approved files follow Ideal’s separate retention policy. Handle downloaded rosters through the approved data-handling process."),
 ])
 ]}
ORG = {
 "slug":"organization-guide","title":"Organization submission guide","audience":"ORGANIZATION CONTACTS","share":"Share with employers, brokers, and payroll contacts",
 "pages":[
 page("Send your eligibility roster", "Your guide to preparing a file, submitting it to Ideal, and checking what happens next.", [
    callout("Start with the upload portal",f'<a href="{PORTAL}" color="{BLUE}"><b>{PORTAL}</b></a><br/>Use the email address Ideal approved for your organization. Creating an account alone does not give upload access.'),
    {"type":"fields","title":"Your upload details · Ideal completes before sharing","fields":[
      ["organization","Organization"],["sender","Approved contact / sender email"],["assigned_email","Assigned organization email address (if enabled)"],["contact","Program Manager / support contact"],["cadence","Agreed submission schedule"],["turnaround","Agreed review turnaround"]]},
    diagram("organization-workflow","Your delivery receipt confirms that the file reached the review queue. It does not confirm member coverage or benefit activation."),
    table(["Option","Use it when"],[
     ["Browser portal","You want a guided upload and recent submission history. Recommended for manual submissions."],
     ["Email attachments","Ideal enabled your sender address and provided an organization-specific recipient address."],
     ["Automated HTTPS upload","Your payroll/HR team arranged an organization credential and technical setup with Ideal."]
    ],[.30,.70]),
    paragraph("Use one delivery option per submission. Confirm enabled methods and your schedule with Ideal.")
 ]),
 page("Prepare a clean roster", "Download the blank CSV template from the portal, or use the file layout agreed with your Program Manager.", [
    diagram("family-example","Fictitious example. Names are combined for readability; the CSV template has separate first-name and last-name columns."),
    steps([
     ["Use one row per covered person","Enter Employee, Spouse, or Child in <b>Covered Member Relationship</b>. Repeat the employee’s first/last name, Employee DOB and Employee ID on each family row; enter each covered person’s own name and DOB."],
     ["Keep identifiers and dates consistent","A stable Employee ID helps match updates to the same person. Keep headers unchanged. Use YYYY-MM-DD dates, such as 2026-10-05. Preserve leading zeros in identifiers and ZIP codes. The blank template does not ask for SSNs."],
     ["Check the whole file","Confirm expected employee and dependent counts, names, birth dates and the agreed contact/address fields. Confirm effective dates with your Program Manager. Keep each family together when splitting files."],
     ["Save in an accepted format","CSV, XLSX, TXT or JSON; maximum 10 MB per file. A recognized extension alone does not guarantee the layout can be processed. Avoid macros and encrypted/password-protected workbooks. Use UTF-8 when exporting CSV or other text."]
    ]),
    callout("For removals and changes","Tell your Program Manager about terminations through the agreed process. Leaving someone out of a new roster, or filling Term Date, does not automatically terminate their membership.","amber"),
    paragraph("Suggested filename: Example-Org_Eligibility_2026-10-05.csv. Use your organization name and roster date; avoid member names, birth dates or other personal details in filenames.")
 ]),
 page("Upload in the browser", "Sign in with your approved email, choose the correct organization, and keep the receipt.", [
    diagram("portal-walkthrough","Illustrated walkthrough with example data. Use the labels on your live screen; its appearance may vary."),
    steps([
     ["Sign in and verify your email","Open the portal. Create an account if needed and complete email verification. If no organization appears, ask your Program Manager to confirm the approved address, then use <b>check access again</b>."],
     ["Choose and submit","Confirm Organization. Add the optional Roster date if you know the file’s as-of date. Choose your file, then click <b>Submit for review</b>. Wait for the receipt before leaving the page."],
     ["Check Recent submissions","Keep the receipt ID for follow-up. Submitted means awaiting review. Approved; awaiting processing means Ideal accepted the file but has not started the import. Completed refers to the import; Ideal confirms benefit and access next steps separately."]
    ]),
    callout("“This file was already received.”","Keep the existing receipt and check its status. You do not need to upload the same file by another method. For a correction, submit a corrected file. Use the true roster date rather than changing it to force another submission."),
    paragraph("Rejected: correct and resubmit. Expired: unreviewed after 30 days; contact your Program Manager about resubmitting.")
 ]),
 page("Email, automation & help", "Choose the delivery method enabled by Ideal, then confirm the submission was received.", [
    diagram("email-routing","This address is an illustration. Copy the actual assigned address from your onboarding card, the portal, or your Program Manager."),
    steps([
     ["For email, use your approved sender","Attach the original file to a new message from the exact address Ideal approved. Use the full assigned recipient, including the +org-… portion. Do not send only to the plain eligibility@ mailbox. Avoid forwarding another person’s message or sending from a different shared/group address unless Ideal approved it."],
     ["Send attachments, then check for a receipt","At most five supported attachments per message, each up to 10 MB; your email provider’s message limit also applies. Use a subject such as “Example Organization — eligibility roster — 2026-10-05.” Do not put member details in the subject/body or send cloud-drive links instead of attachments. Email is checked periodically; allow a few minutes."],
     ["No receipt? Check before resending","Check Recent submissions if you have portal access. If the file appears, keep that receipt even if the email reply is missing. Otherwise confirm sender, assigned recipient, file size and format; use the portal or ask your Program Manager for help. Refused email may receive no reply."]
    ]),
    section("If your payroll/HR system sends files automatically","Ask your Program Manager for automated HTTPS access and an organization-specific credential. Your IT team configures the endpoint and receipt checks with Ideal. Keep the credential in your secret store. This is HTTPS file delivery; an SFTP-only export needs a separately agreed connection."),
    callout("What to send when asking for help","Organization name, receipt ID if available, submission time/method, and the error message. Keep member data and credentials out of ordinary support messages. If Ideal needs a corrected roster, submit it through the approved intake method."),
    paragraph("Completed with errors or Failed? Contact your Program Manager to confirm the next steps.")
 ])
 ]}

GUIDES = [PM, ORG]
(OUT / "guide-content.json").write_text(json.dumps(GUIDES, indent=2, ensure_ascii=False) + "\n")

def pdf_text(c, s, x, top, width, kind="body"):
    p=Paragraph(s,STYLES[kind])
    w,h=p.wrap(width,1000)
    p.drawOn(c,x,792-top-h)
    return h

def pdf_box(c,x,top,w,h,fill=PALE,stroke=None):
    c.setFillColor(HexColor(fill))
    c.setStrokeColor(HexColor(stroke or fill))
    c.roundRect(x,792-top-h,w,h,8,stroke=1,fill=1)

def write_pdf(guide):
    path=OUT/(guide["slug"]+".pdf")
    c=canvas.Canvas(str(path),pagesize=(612,792),pageCompression=1)
    c.setTitle(guide["title"])
    c.setAuthor("Ideal Oral Health")
    c.setSubject("Eligibility intake companion guide — " + DATE)
    for i,p in enumerate(guide["pages"],1):
        c.setFillColor(HexColor(BLUE)); c.rect(0,784,612,8,fill=1,stroke=0)
        c.drawImage(str(LOGO),44,721,width=100,height=39.1,mask="auto")
        pdf_text(c,guide["audience"],330,31,238,"small")
        pdf_text(c,"ELIGIBILITY INTAKE · " + DATE,330,45,238,"small")
        y=84
        y+=pdf_text(c,p["title"],44,y,524,"title")+8
        y+=pdf_text(c,p["subtitle"],44,y,524,"body")+14
        for b in p["blocks"]:
            kind=b["type"]
            if kind=="p":
                y+=pdf_text(c,b["text"],44,y,524)+10
            elif kind=="section":
                y+=pdf_text(c,b["title"],44,y,524,"heading")+5
                y+=pdf_text(c,b["text"],44,y,524)+12
            elif kind=="callout":
                color="#FFF7E5" if b["tone"]=="amber" else "#EAF2FC"
                head=Paragraph(b["title"],STYLES["heading"]); _,hh=head.wrap(496,1000)
                body=Paragraph(b["text"],STYLES["body"]); _,bh=body.wrap(496,1000)
                h=hh+bh+31
                pdf_box(c,44,y,524,h,color)
                head.drawOn(c,58,792-y-12-hh); body.drawOn(c,58,792-y-19-hh-bh)
                y+=h+12
            elif kind=="steps":
                for n,(title,body) in enumerate(b["items"],1):
                    c.setFillColor(HexColor(BLUE));c.circle(54,792-y-9,10,fill=1,stroke=0)
                    c.setFillColor(white);c.setFont("Arial-Bold",10);c.drawCentredString(54,792-y-12.5,str(n))
                    y+=pdf_text(c,title,75,y,493,"heading")+3
                    y+=pdf_text(c,body,75,y,493)+10
                y+=1
            elif kind=="diagram":
                drawing=svg2rlg(str(ASSETS/(b["name"]+".svg")))
                diagram_width=498 if b["name"]=="portal-walkthrough" else 524
                scale=diagram_width/drawing.width
                h=drawing.height*scale
                drawing.scale(scale,scale)
                renderPDF.draw(drawing,c,44+(524-diagram_width)/2,792-y-h)
                y+=h+5
                y+=pdf_text(c,b["caption"],44,y,524,"small")+12
            elif kind=="table":
                data=[[Paragraph(escape(t),STYLES["tablehead"]) for t in b["headers"]]]
                data.extend([[Paragraph(t,STYLES["table"]) for t in row] for row in b["rows"]])
                tab=Table(data,colWidths=[524*f for f in b["widths"]],hAlign="LEFT")
                tab.setStyle(TableStyle([
                    ("BACKGROUND",(0,0),(-1,0),HexColor(NAVY)),
                    ("ROWBACKGROUNDS",(0,1),(-1,-1),[HexColor(PALE),white]),
                    ("VALIGN",(0,0),(-1,-1),"TOP"),
                    ("LEFTPADDING",(0,0),(-1,-1),10),("RIGHTPADDING",(0,0),(-1,-1),10),
                    ("TOPPADDING",(0,0),(-1,-1),8),("BOTTOMPADDING",(0,0),(-1,-1),8),
                    ("LINEBELOW",(0,0),(-1,-1),.4,HexColor(LINE))
                ]))
                _,h=tab.wrap(524,1000);tab.drawOn(c,44,792-y-h);y+=h+12
            elif kind=="fields":
                y+=pdf_text(c,b["title"],44,y,524,"heading")+8
                fields=b["fields"]
                for row in [fields[:2], fields[2:3], fields[3:4], fields[4:]]:
                    width=524 if len(row)==1 else 255
                    for j,(name,label) in enumerate(row):
                        x=44+j*269
                        pdf_text(c,label,x,y,width,"small")
                        c.acroForm.textfield(name=name,tooltip=label,x=x,y=792-y-33,width=width,height=20,
                             fontName="Helvetica",fontSize=9,borderWidth=.6,borderColor=HexColor(LINE),
                             fillColor=HexColor(PALE),textColor=HexColor(INK),forceBorder=True,maxlen=150)
                    y+=38
                y+=6
            if y>735:
                raise ValueError(f"Page overflow: {guide['slug']} page {i}, {b['type']}, bottom {y:.1f}, {b.get('text', '')[:70]}")
        c.setStrokeColor(HexColor(LINE));c.line(44,45,568,45)
        pdf_text(c,"Ideal Oral Health · " + guide["share"],44,752,432,"small")
        pdf_text(c,f"{i} / {len(guide['pages'])}",530,752,38,"small")
        c.showPage()
    c.save()
    return path

def inline_html(s):
    return re.sub(r' color="[^"]+"',"",s).replace("<br/>","<br>")
CSS = """
:root{--navy:#14324B;--blue:#155EAD;--ink:#233C50;--muted:#536575;--line:#DCE5ED;--pale:#F3F7FA}
*{box-sizing:border-box}body{margin:0;background:#E8EEF3;color:var(--ink);font:14px/1.52 Arial,sans-serif}
.toolbar{position:sticky;top:0;background:var(--navy);color:white;z-index:1;padding:12px 24px;display:flex;align-items:center;gap:20px;justify-content:space-between}
.toolbar a,.toolbar button{color:white;background:transparent;border:1px solid #8DA6BC;padding:7px 12px;border-radius:5px;text-decoration:none;font:inherit;cursor:pointer}
.toolbar span{font-size:13px}.pages{padding:24px}.page{max-width:850px;margin:0 auto 24px;background:white;padding:38px 54px;box-shadow:0 5px 28px #14324b18;border-top:8px solid var(--blue);break-after:page}
header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;color:var(--muted);font-size:10px;letter-spacing:.06em}header img{width:140px}header span{text-align:right}
h1{font-size:34px;line-height:1.1;color:var(--navy);margin:0 0 10px;letter-spacing:-.02em}.subtitle{margin:0 0 22px;color:var(--muted)}h2{font-size:17px;color:var(--navy);margin:16px 0 5px}p{margin:0 0 13px}a{color:var(--blue);overflow-wrap:anywhere}
.callout{padding:15px 18px;border-radius:8px;background:#EAF2FC;margin:0 0 18px}.callout.amber{background:#FFF7E5}.callout h2{margin:0 0 7px}.callout p{margin:0}
figure{margin:0 0 18px}figure svg{width:100%;height:auto;display:block}figcaption{font-size:11px;color:var(--muted);margin-top:5px}
ol{padding:0;list-style:none;counter-reset:step;margin:0 0 18px}ol li{position:relative;padding-left:36px;margin:0 0 13px;counter-increment:step}ol li:before{content:counter(step);position:absolute;left:0;top:1px;border-radius:50%;width:23px;height:23px;text-align:center;background:var(--blue);color:white;font-weight:bold;font-size:12px;line-height:23px}ol strong{display:block;color:var(--navy)}ol p{margin:3px 0 0}
table{width:100%;border-collapse:collapse;margin:0 0 18px;font-size:12px}th{background:var(--navy);color:white;text-align:left}td,th{padding:10px;border-bottom:1px solid var(--line);vertical-align:top}tbody tr:nth-child(odd){background:var(--pale)}
.fields{margin-bottom:20px;display:grid;grid-template-columns:1fr 1fr;gap:3px 14px}.fields h2,.fields .wide{grid-column:1/-1}.fields label{display:block;font-size:12px;color:var(--muted);margin:7px 0 0}.fields input{display:block;width:100%;height:31px;font:14px Arial;color:var(--ink);border:1px solid var(--line);background:var(--pale);padding:5px;border-radius:3px}
footer{border-top:1px solid var(--line);margin-top:24px;padding-top:9px;display:flex;justify-content:space-between;color:var(--muted);font-size:10px}
@media(max-width:600px){.toolbar{position:static;display:block}.toolbar span{display:block;margin-bottom:10px}.page{padding:22px}.pages{padding:10px}h1{font-size:29px}header img{width:100px}}
@page{size:letter;margin:0}
@media print{body{background:white;font-size:10pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}.toolbar{display:none}.pages{padding:0}.page{box-shadow:none;max-width:none;width:8.5in;height:11in;margin:0;padding:24pt 44pt;overflow:visible;border-top:6pt solid var(--blue)}header{margin-bottom:14pt}header img{width:100pt}h1{font-size:28pt}.subtitle{margin-bottom:14pt}h2{font-size:12pt;margin-top:10pt}p{margin-bottom:8pt}.callout{padding:10pt;margin-bottom:9pt}figure{margin-bottom:9pt}figcaption{font-size:8pt}ol{margin-bottom:9pt}ol li{margin-bottom:7pt}table{font-size:9pt;margin-bottom:10pt}td,th{padding:6pt}.fields{margin-bottom:9pt}.fields input{height:20pt;font-size:10pt}.fields label{font-size:8pt}footer{margin-top:12pt;font-size:8pt}}
"""
def write_html(guide):
    chunks=[]
    for n,p in enumerate(guide["pages"],1):
        blocks=[]
        for b in p["blocks"]:
            k=b["type"]
            if k=="p": blocks.append("<p>"+inline_html(b["text"])+"</p>")
            elif k=="section":blocks.append("<h2>"+escape(b["title"])+"</h2><p>"+inline_html(b["text"])+"</p>")
            elif k=="callout":blocks.append(f'<aside class="callout {b["tone"]}"><h2>{escape(b["title"])}</h2><p>{inline_html(b["text"])}</p></aside>')
            elif k=="steps":blocks.append("<ol>"+"".join(f'<li><strong>{escape(t)}</strong><p>{inline_html(s)}</p></li>' for t,s in b["items"])+"</ol>")
            elif k=="diagram":blocks.append("<figure>"+(ASSETS/(b["name"]+".svg")).read_text()+"<figcaption>"+escape(b["caption"])+"</figcaption></figure>")
            elif k=="table":blocks.append("<table><thead><tr>"+"".join("<th>"+escape(t)+"</th>" for t in b["headers"])+"</tr></thead><tbody>"+"".join("<tr>"+"".join("<td>"+inline_html(t)+"</td>" for t in row)+"</tr>" for row in b["rows"])+"</tbody></table>")
            elif k=="fields":blocks.append('<div class="fields"><h2>'+escape(b["title"])+"</h2>"+"".join(f'<label class="{"wide" if name in ["assigned_email", "contact"] else ""}" for="{name}">{escape(label)}<input id="{name}" type="text" maxlength="150" autocomplete="off"></label>' for name,label in b["fields"])+"</div>")
        chunks.append(f'<section class="page" id="page-{n}"><header><img src="{logo_uri}" alt="Ideal Oral Health"><span>{guide["audience"]}<br>ELIGIBILITY INTAKE · {DATE}</span></header><h1>{escape(p["title"])}</h1><p class="subtitle">{escape(p["subtitle"])}</p>'+"".join(blocks)+f'<footer><span>Ideal Oral Health · {guide["share"]}</span><span>{n} / {len(guide["pages"])}</span></footer></section>')
    result=f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{escape(guide["title"])}</title><style>{CSS}</style></head><body><nav class="toolbar"><span>{escape(guide["title"])} · Offline viewing / printing</span><div><a href="{guide["slug"]}.pdf">Download PDF</a> <button type="button" onclick="window.print()">Print / Save as PDF</button></div></nav><main class="pages">'+"".join(chunks)+"</main></body></html>"
    (OUT/(guide["slug"]+".html")).write_text(result)

def markdown(s):
    s=re.sub(r'<a href="([^"]+)"(?: color="[^"]+")?>(.*?)</a>',r'[\2](\1)',s)
    s=s.replace("<b>","**").replace("</b>","**").replace("<br/>","\n\n")
    return re.sub("<[^>]+>","",s)
def write_markdown(guide):
    lines=["# "+guide["title"],"",f"Ideal Oral Health · {DATE} · {guide['share']}",""]
    for p in guide["pages"]:
        lines.extend(["## "+p["title"],"",p["subtitle"],""])
        for b in p["blocks"]:
            k=b["type"]
            if k=="p":lines.extend([markdown(b["text"]),""])
            elif k in ["section","callout"]:lines.extend(["### "+b["title"],"",markdown(b["text"]),""])
            elif k=="steps":
                for i,(title,body) in enumerate(b["items"],1):lines.extend([f"{i}. **{title}.** "+markdown(body)])
                lines.append("")
            elif k=="diagram":lines.extend([f'![{b["caption"]}](assets/{b["name"]}.svg)',"",b["caption"],""])
            elif k=="table":
                lines.extend(["| "+" | ".join(b["headers"])+" |","| "+" | ".join("---" for _ in b["headers"])+" |"])
                lines.extend("| "+" | ".join(markdown(t).replace("|","/") for t in row)+" |" for row in b["rows"]);lines.append("")
            elif k=="fields":
                lines.extend(["### "+b["title"],""])
                lines.extend("- **"+label+":** ______________________________" for _,label in b["fields"]);lines.append("")
    (OUT/(guide["slug"]+".md")).write_text("\n".join(lines)+"\n")

if __name__ == "__main__":
    for guide in GUIDES:
        print(write_pdf(guide))
        write_html(guide)
        write_markdown(guide)
    shutil.copyfile(ROOT/"public/eligibility-template.csv",OUT/"eligibility-template.csv")
    with zipfile.ZipFile(OUT/"organization-onboarding-kit.zip", "w", zipfile.ZIP_DEFLATED) as kit:
        for name in ["organization-guide.pdf", "organization-guide.html", "organization-guide.md", "eligibility-template.csv"]:
            kit.write(OUT/name,name)
        for name in ["organization-workflow", "family-example", "portal-walkthrough", "email-routing"]:
            kit.write(ASSETS/(name+".svg"),"assets/"+name+".svg")
        kit.writestr("START-HERE.txt", "Ideal Oral Health — Organization onboarding kit\n\nOpen organization-guide.pdf or organization-guide.html.\nIdeal completes the six upload-detail fields on page 1 before sharing.\nUse eligibility-template.csv as the blank roster template.\nThe sample email alias and names in illustrations are fictitious.\nUse only the actual organization address provided by your Program Manager.\nThe HTML works offline; entered field values are not saved on reload.\nThis kit contains organization-facing instructions only.\n")
    # Only organization-facing materials are published without authentication.
    public_guides = ROOT/"public/guides/eligibility"
    public_guides.mkdir(parents=True, exist_ok=True)
    for name in ["organization-guide.pdf", "organization-guide.html", "organization-onboarding-kit.zip", "eligibility-template.csv"]:
        shutil.copyfile(OUT/name, public_guides/name)
