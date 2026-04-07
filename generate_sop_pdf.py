"""Generate the Content Repurposing Pipeline SOP as a PDF for Skool."""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether
)
import os

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "instagram_output")
os.makedirs(OUTPUT_DIR, exist_ok=True)
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "Content_Repurposing_Pipeline_SOP.pdf")

# Brand colors
DARK_BG = HexColor("#1a1a2e")
ACCENT = HexColor("#0f7dff")
ACCENT_LIGHT = HexColor("#e8f4ff")
DARK_TEXT = HexColor("#1a1a1a")
GRAY_TEXT = HexColor("#555555")
WHITE = HexColor("#ffffff")
LIGHT_GRAY = HexColor("#f5f5f5")
BORDER_GRAY = HexColor("#dddddd")


def build_styles():
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        "CoverTitle", parent=styles["Title"],
        fontSize=28, leading=34, textColor=DARK_BG,
        alignment=TA_CENTER, spaceAfter=8
    ))
    styles.add(ParagraphStyle(
        "CoverSubtitle", parent=styles["Normal"],
        fontSize=14, leading=18, textColor=GRAY_TEXT,
        alignment=TA_CENTER, spaceAfter=30
    ))
    styles.add(ParagraphStyle(
        "SectionHeader", parent=styles["Heading1"],
        fontSize=20, leading=24, textColor=DARK_BG,
        spaceBefore=20, spaceAfter=10,
        borderWidth=0, borderPadding=0
    ))
    styles.add(ParagraphStyle(
        "StepHeader", parent=styles["Heading2"],
        fontSize=15, leading=19, textColor=ACCENT,
        spaceBefore=14, spaceAfter=6
    ))
    styles.add(ParagraphStyle(
        "SubStep", parent=styles["Heading3"],
        fontSize=12, leading=15, textColor=DARK_BG,
        spaceBefore=8, spaceAfter=4
    ))
    styles.add(ParagraphStyle(
        "Body", parent=styles["Normal"],
        fontSize=10.5, leading=15, textColor=DARK_TEXT,
        spaceAfter=6
    ))
    styles.add(ParagraphStyle(
        "BulletCustom", parent=styles["Normal"],
        fontSize=10.5, leading=15, textColor=DARK_TEXT,
        leftIndent=20, spaceAfter=4,
        bulletIndent=8, bulletFontSize=10
    ))
    styles.add(ParagraphStyle(
        "CodeBlock", parent=styles["Normal"],
        fontSize=9, leading=13, textColor=DARK_TEXT,
        fontName="Courier", backColor=LIGHT_GRAY,
        leftIndent=12, rightIndent=12,
        spaceBefore=4, spaceAfter=8,
        borderWidth=1, borderColor=BORDER_GRAY, borderPadding=8
    ))
    styles.add(ParagraphStyle(
        "Note", parent=styles["Normal"],
        fontSize=10, leading=14, textColor=ACCENT,
        leftIndent=12, rightIndent=12,
        spaceBefore=6, spaceAfter=8,
        backColor=ACCENT_LIGHT,
        borderWidth=1, borderColor=ACCENT, borderPadding=8
    ))
    styles.add(ParagraphStyle(
        "Footer", parent=styles["Normal"],
        fontSize=8, leading=10, textColor=GRAY_TEXT,
        alignment=TA_CENTER
    ))
    return styles


def make_table(headers, rows, col_widths=None):
    data = [headers] + rows
    if col_widths is None:
        col_widths = [None] * len(headers)
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), DARK_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("FONTSIZE", (0, 1), (-1, -1), 9.5),
        ("LEADING", (0, 0), (-1, -1), 13),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 1), (-1, -1), WHITE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT_GRAY]),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER_GRAY),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t


def hr():
    return HRFlowable(width="100%", thickness=1, color=BORDER_GRAY, spaceBefore=10, spaceAfter=10)


def build_pdf():
    doc = SimpleDocTemplate(
        OUTPUT_PATH, pagesize=letter,
        topMargin=0.75 * inch, bottomMargin=0.75 * inch,
        leftMargin=0.75 * inch, rightMargin=0.75 * inch
    )
    s = build_styles()
    story = []

    # ── COVER PAGE ──
    story.append(Spacer(1, 1.5 * inch))
    story.append(Paragraph("Content Repurposing Pipeline", s["CoverTitle"]))
    story.append(Paragraph("Automated Video Clipping + Social Media Posting", s["CoverSubtitle"]))
    story.append(hr())
    story.append(Spacer(1, 0.3 * inch))
    story.append(Paragraph(
        "Turn your long-form videos (workshops, Q&amp;A sessions, jam sessions) into "
        "short-form clips (Reels, Shorts, TikToks) automatically using AI -- then review "
        "and post them with one click.",
        s["Body"]
    ))
    story.append(Spacer(1, 0.3 * inch))

    cover_table = make_table(
        ["", ""],
        [
            ["Tools Required", "Google Drive, Reap.video, n8n, GHL (or IG Graph API)"],
            ["Difficulty", "Intermediate (API keys + n8n flow building)"],
            ["Time to Build", "2-3 hours following this guide"],
            ["Monthly Cost", "~$15/mo (Reap Creator plan) + free tiers for everything else"],
            ["What You Get", "Automated clip generation from every video you record"],
        ],
        col_widths=[1.8 * inch, 5.0 * inch]
    )
    story.append(cover_table)

    story.append(Spacer(1, 0.5 * inch))
    story.append(Paragraph("SolnestAI Community", s["CoverSubtitle"]))
    story.append(Paragraph("Built with Claude Code", s["Footer"]))
    story.append(PageBreak())

    # ── TABLE OF CONTENTS ──
    story.append(Paragraph("Table of Contents", s["SectionHeader"]))
    story.append(hr())
    toc_items = [
        "1. Pipeline Overview -- How It All Connects",
        "2. Prerequisites -- Accounts &amp; API Keys",
        "3. Step 1: Set Up Google Drive Folders",
        "4. Step 2: Get Your Reap.video API Key",
        "5. Step 3: Build the n8n Automation Flow",
        "6. Step 4: Set Up the Review Process",
        "7. Step 5: Connect Instagram Posting",
        "8. Step 6: Test End-to-End",
        "9. Troubleshooting &amp; FAQ",
        "10. Quick Reference Card",
    ]
    for item in toc_items:
        story.append(Paragraph(item, s["Body"]))
    story.append(PageBreak())

    # ── SECTION 1: PIPELINE OVERVIEW ──
    story.append(Paragraph("1. Pipeline Overview", s["SectionHeader"]))
    story.append(hr())
    story.append(Paragraph(
        "This pipeline automates the most time-consuming part of content creation: "
        "turning your long-form videos into short-form clips ready for social media.",
        s["Body"]
    ))
    story.append(Spacer(1, 0.15 * inch))
    story.append(Paragraph("The Flow", s["StepHeader"]))

    flow_data = [
        ["Stage", "What Happens", "Tool"],
        ["1. Drop", "You drop a video file into a Google Drive folder", "Google Drive"],
        ["2. Trigger", "n8n detects the new file automatically", "n8n"],
        ["3. Upload", "n8n sends the video to Reap.video API", "Reap.video API"],
        ["4. Clip", "Reap AI analyzes the video and generates short clips with captions", "Reap.video"],
        ["5. Notify", "Webhook fires when clips are ready", "n8n Webhook"],
        ["6. Download", "n8n downloads all generated clips to a Review folder", "n8n + Google Drive"],
        ["7. Review", "You get a Slack/email notification with clip previews to approve/reject", "Slack or Email"],
        ["8. Post", "Approved clips are posted to Instagram via GHL or IG API", "GHL / IG Graph API"],
    ]
    t = Table(flow_data, colWidths=[0.7 * inch, 3.5 * inch, 1.8 * inch], repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), DARK_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("LEADING", (0, 0), (-1, -1), 13),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 1), (-1, -1), WHITE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT_GRAY]),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER_GRAY),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(t)

    story.append(Spacer(1, 0.15 * inch))
    story.append(Paragraph(
        "<b>Your only manual step is reviewing the clips.</b> Everything else is automated.",
        s["Note"]
    ))
    story.append(PageBreak())

    # ── SECTION 2: PREREQUISITES ──
    story.append(Paragraph("2. Prerequisites", s["SectionHeader"]))
    story.append(hr())
    story.append(Paragraph("You need these accounts and tools set up before building:", s["Body"]))

    prereq_table = make_table(
        ["Tool", "What You Need", "Cost"],
        [
            ["Google Drive", "A Google account with Drive access", "Free"],
            ["Reap.video", "Creator plan account + API key", "~$15/mo (or $59 lifetime on AppSumo)"],
            ["n8n", "Self-hosted n8n server OR n8n Cloud account", "Free (self-hosted) or $20/mo (cloud)"],
            ["GHL / IG API", "GoHighLevel account with social posting OR Meta Business account with IG Graph API", "Included with GHL / Free"],
            ["Slack (optional)", "For review notifications", "Free"],
        ],
        col_widths=[1.3 * inch, 3.2 * inch, 2.2 * inch]
    )
    story.append(prereq_table)

    story.append(Spacer(1, 0.15 * inch))
    story.append(Paragraph("API Keys You Will Need", s["StepHeader"]))
    story.append(Paragraph("<bullet>&bull;</bullet> <b>Reap.video API Key</b> -- from Profile > Settings > API Keys in the Reap dashboard", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> <b>Google Drive credentials</b> -- OAuth2 or Service Account for n8n", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> <b>Slack Webhook URL</b> (optional) -- for review notifications", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> <b>Instagram Graph API token</b> OR <b>GHL API key</b> -- for posting", s["BulletCustom"]))
    story.append(PageBreak())

    # ── SECTION 3: GOOGLE DRIVE SETUP ──
    story.append(Paragraph("3. Step 1: Set Up Google Drive Folders", s["SectionHeader"]))
    story.append(hr())
    story.append(Paragraph("Create this folder structure in your Google Drive:", s["Body"]))
    story.append(Spacer(1, 0.1 * inch))
    story.append(Paragraph(
        "Content Pipeline/<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;01 - Raw Videos/&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"
        "<i>(drop your recordings here)</i><br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;02 - Processing/&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"
        "<i>(n8n moves files here while Reap processes)</i><br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;03 - Clips Ready/&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"
        "<i>(AI-generated clips land here for review)</i><br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;04 - Approved/&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"
        "<i>(clips you approve go here)</i><br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;05 - Posted/&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"
        "&nbsp;&nbsp;&nbsp;&nbsp;<i>(clips that have been published)</i><br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;06 - Rejected/&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"
        "<i>(clips you skip)</i>",
        s["CodeBlock"]
    ))

    story.append(Spacer(1, 0.1 * inch))
    story.append(Paragraph(
        "<b>Why this structure?</b> Each folder represents a stage in the pipeline. "
        "Files move through the folders as they progress. This gives you a clear visual "
        "status of every video at a glance -- no database needed.",
        s["Note"]
    ))
    story.append(PageBreak())

    # ── SECTION 4: REAP API KEY ──
    story.append(Paragraph("4. Step 2: Get Your Reap.video API Key", s["SectionHeader"]))
    story.append(hr())

    story.append(Paragraph("4a. Create your Reap.video account", s["SubStep"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Go to reap.video and sign up", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Choose the Creator plan ($15/mo) or grab the AppSumo lifetime deal ($59) if available", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> The free tier gives 60 credits/month (= 60 min of video) which is enough to test", s["BulletCustom"]))

    story.append(Paragraph("4b. Generate your API key", s["SubStep"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Log in to Reap dashboard", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Go to Profile > Settings > API Keys", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Click 'Create API Key'", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Copy the key and save it securely -- you will need it in n8n", s["BulletCustom"]))

    story.append(Paragraph("4c. Set up webhook (optional but recommended)", s["SubStep"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Go to Profile > Settings > Webhooks", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Add your n8n webhook URL (you will create this in Step 3)", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> This lets Reap notify n8n when clips are ready instead of polling", s["BulletCustom"]))

    story.append(Spacer(1, 0.1 * inch))
    story.append(Paragraph("Reap.video API Quick Reference", s["StepHeader"]))

    api_table = make_table(
        ["Endpoint", "Method", "Purpose"],
        [
            ["POST /automation/get-upload-url", "POST", "Get a presigned URL to upload your video"],
            ["PUT {uploadUrl}", "PUT", "Upload the raw video file (max 5 GB)"],
            ["POST /automation/create-clips", "POST", "Start AI clipping (returns projectId)"],
            ["GET /automation/get-project-status", "GET", "Check if clips are ready"],
            ["GET /automation/get-project-clips", "GET", "Download the generated clips"],
        ],
        col_widths=[2.5 * inch, 0.7 * inch, 3.5 * inch]
    )
    story.append(api_table)

    story.append(Spacer(1, 0.1 * inch))
    story.append(Paragraph(
        "Base URL: https://public.reap.video/api/v1<br/>"
        "Auth: Bearer token in Authorization header<br/>"
        "Rate limit: 10 requests/minute per API key",
        s["CodeBlock"]
    ))
    story.append(PageBreak())

    # ── SECTION 5: N8N FLOW ──
    story.append(Paragraph("5. Step 3: Build the n8n Automation Flow", s["SectionHeader"]))
    story.append(hr())
    story.append(Paragraph(
        "This is the core of the pipeline. You will build one n8n workflow with two triggers "
        "that handle the entire process.",
        s["Body"]
    ))

    story.append(Paragraph("Flow A: New Video --> Upload --> Clip", s["StepHeader"]))
    story.append(Spacer(1, 0.05 * inch))

    story.append(Paragraph("Node 1: Google Drive Trigger", s["SubStep"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Type: Google Drive Trigger", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Event: File Created", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Folder: '01 - Raw Videos'", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Poll interval: Every 5 minutes", s["BulletCustom"]))

    story.append(Paragraph("Node 2: Move to Processing", s["SubStep"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Type: Google Drive (Move File)", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Move the file from '01 - Raw Videos' to '02 - Processing'", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> This prevents re-triggering on the same file", s["BulletCustom"]))

    story.append(Paragraph("Node 3: Get Upload URL from Reap", s["SubStep"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Type: HTTP Request", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Method: POST", s["BulletCustom"]))
    story.append(Paragraph(
        "URL: https://public.reap.video/api/v1/automation/get-upload-url<br/>"
        "Headers: Authorization: Bearer YOUR_REAP_API_KEY<br/>"
        "Body (JSON): { \"filename\": \"{{$node['Google Drive Trigger'].json.name}}\" }",
        s["CodeBlock"]
    ))

    story.append(Paragraph("Node 4: Download Video from Google Drive", s["SubStep"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Type: Google Drive (Download File)", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> File ID: from the trigger node", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> This downloads the file binary so n8n can upload it to Reap", s["BulletCustom"]))

    story.append(Paragraph("Node 5: Upload Video to Reap", s["SubStep"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Type: HTTP Request", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Method: PUT", s["BulletCustom"]))
    story.append(Paragraph(
        "URL: {{$node['Get Upload URL'].json.uploadUrl}}<br/>"
        "Headers: Content-Type: video/mp4<br/>"
        "Body: Binary data from the Download node",
        s["CodeBlock"]
    ))

    story.append(Paragraph("Node 6: Create Clipping Project", s["SubStep"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Type: HTTP Request", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Method: POST", s["BulletCustom"]))
    story.append(Paragraph(
        "URL: https://public.reap.video/api/v1/automation/create-clips<br/>"
        "Headers: Authorization: Bearer YOUR_REAP_API_KEY<br/>"
        "Body (JSON):<br/>"
        "{<br/>"
        "&nbsp;&nbsp;\"uploadId\": \"{{$node['Get Upload URL'].json.id}}\",<br/>"
        "&nbsp;&nbsp;\"genre\": \"talking\",<br/>"
        "&nbsp;&nbsp;\"exportResolution\": 1080,<br/>"
        "&nbsp;&nbsp;\"exportOrientation\": \"portrait\",<br/>"
        "&nbsp;&nbsp;\"reframeClips\": true,<br/>"
        "&nbsp;&nbsp;\"captionsPreset\": \"system_beasty\",<br/>"
        "&nbsp;&nbsp;\"enableHighlights\": true,<br/>"
        "&nbsp;&nbsp;\"clipDurations\": [[15, 30], [30, 60]]<br/>"
        "}",
        s["CodeBlock"]
    ))

    story.append(Paragraph("Node 7: Save Project ID", s["SubStep"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Type: Set node -- save the projectId for the webhook flow to reference", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Store: projectId, original filename, Google Drive file ID", s["BulletCustom"]))

    story.append(PageBreak())

    story.append(Paragraph("Flow B: Webhook --> Download Clips --> Notify", s["StepHeader"]))
    story.append(Spacer(1, 0.05 * inch))

    story.append(Paragraph("Node 1: Webhook Trigger", s["SubStep"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Type: Webhook", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Method: POST", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Path: /reap-clips-ready", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> This URL is what you set in Reap's webhook settings", s["BulletCustom"]))
    story.append(Paragraph(
        "<b>Alternative (no webhook):</b> Use a Schedule Trigger that runs every 10 minutes "
        "and polls GET /automation/get-project-status for all active projects. The webhook "
        "approach is cleaner but polling works too.",
        s["Note"]
    ))

    story.append(Paragraph("Node 2: Check Status", s["SubStep"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Type: IF node", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Condition: status === 'completed'", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> If not completed (failed/expired), send error notification and stop", s["BulletCustom"]))

    story.append(Paragraph("Node 3: Get Clips from Reap", s["SubStep"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Type: HTTP Request", s["BulletCustom"]))
    story.append(Paragraph(
        "GET https://public.reap.video/api/v1/automation/get-project-clips"
        "?projectId={{$json.projectId}}&amp;page=1&amp;pageSize=100",
        s["CodeBlock"]
    ))

    story.append(Paragraph("Node 4: Loop Through Clips", s["SubStep"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Type: Split In Batches (loop over clips array)", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> For each clip: download the video from clipUrl", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Upload each clip to Google Drive folder '03 - Clips Ready'", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Name format: [OriginalVideo]_clip01_[viralityScore].mp4", s["BulletCustom"]))

    story.append(Paragraph("Node 5: Send Review Notification", s["SubStep"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Type: Slack (Send Message) or Email (Send)", s["BulletCustom"]))
    story.append(Paragraph(
        "Message example:<br/>"
        "\"5 new clips ready for review!<br/>"
        "Source: Workshop_March_2026.mp4<br/>"
        "Clips are in Google Drive > Content Pipeline > 03 - Clips Ready<br/>"
        "Review and move approved clips to 04 - Approved\"",
        s["CodeBlock"]
    ))
    story.append(PageBreak())

    # ── SECTION 6: REVIEW PROCESS ──
    story.append(Paragraph("6. Step 4: Set Up the Review Process", s["SectionHeader"]))
    story.append(hr())
    story.append(Paragraph(
        "The review step is intentionally manual. AI-generated clips are good but not perfect -- "
        "you should always watch each clip before posting to make sure it starts and ends cleanly, "
        "the caption is accurate, and it represents your brand well.",
        s["Body"]
    ))
    story.append(Spacer(1, 0.1 * inch))

    story.append(Paragraph("Review Workflow", s["StepHeader"]))
    story.append(Paragraph("<bullet>&bull;</bullet> <b>1.</b> Get notification (Slack/email) that new clips are ready", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> <b>2.</b> Open Google Drive > '03 - Clips Ready'", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> <b>3.</b> Watch each clip (they are 15-60 seconds each)", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> <b>4.</b> For each clip, decide:", s["BulletCustom"]))
    story.append(Paragraph("&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;APPROVE: Move to '04 - Approved' folder", s["BulletCustom"]))
    story.append(Paragraph("&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;REJECT: Move to '06 - Rejected' folder", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> <b>5.</b> That is it -- the posting flow handles the rest", s["BulletCustom"]))

    story.append(Spacer(1, 0.1 * inch))
    story.append(Paragraph("Review Checklist (Per Clip)", s["StepHeader"]))

    review_table = make_table(
        ["Check", "What to Look For"],
        [
            ["Clean start", "Does the clip start at the beginning of a sentence/thought?"],
            ["Clean end", "Does it end naturally, not mid-word?"],
            ["Captions", "Are the auto-captions accurate? Any wrong words?"],
            ["Content", "Is this a genuinely interesting/useful moment?"],
            ["Brand safe", "Nothing embarrassing, off-topic, or low energy?"],
            ["Hook", "Does the first 2 seconds grab attention?"],
        ],
        col_widths=[1.5 * inch, 5.2 * inch]
    )
    story.append(review_table)

    story.append(Spacer(1, 0.1 * inch))
    story.append(Paragraph(
        "<b>Pro tip:</b> Review clips in batches. A 60-min workshop typically generates "
        "10-15 clips. You can review all of them in 5-10 minutes.",
        s["Note"]
    ))
    story.append(PageBreak())

    # ── SECTION 7: INSTAGRAM POSTING ──
    story.append(Paragraph("7. Step 5: Connect Instagram Posting", s["SectionHeader"]))
    story.append(hr())
    story.append(Paragraph(
        "Once clips are in the '04 - Approved' folder, another n8n flow picks them up and posts to Instagram.",
        s["Body"]
    ))

    story.append(Paragraph("Option A: Post via GoHighLevel (Recommended if you have GHL)", s["StepHeader"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Use n8n's HTTP Request node to call GHL's Social Media Posting API", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> GHL handles the Instagram connection, scheduling, and publishing", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> You can set posts to 'draft' in GHL for a final review before publishing", s["BulletCustom"]))

    story.append(Paragraph("Option B: Post via Instagram Graph API", s["StepHeader"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Requires a Meta Business account + Facebook Page linked to your IG", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> Upload video to a public URL first (use Google Drive shared link)", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> POST to IG Content Publishing API to create the Reel", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> More setup but no GHL dependency", s["BulletCustom"]))

    story.append(Spacer(1, 0.1 * inch))
    story.append(Paragraph("Posting Flow (n8n)", s["StepHeader"]))
    story.append(Paragraph("<bullet>&bull;</bullet> <b>Trigger:</b> Google Drive Trigger watching '04 - Approved' folder", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> <b>Generate caption:</b> Use Claude API to write an engaging caption from the clip's metadata (topic, title from Reap)", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> <b>Post:</b> Send to GHL or IG API", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> <b>Move:</b> Move the clip from '04 - Approved' to '05 - Posted'", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> <b>Log:</b> Append a row to a Google Sheet with: date, clip name, platform, caption, post URL", s["BulletCustom"]))
    story.append(PageBreak())

    # ── SECTION 8: TESTING ──
    story.append(Paragraph("8. Step 6: Test End-to-End", s["SectionHeader"]))
    story.append(hr())

    story.append(Paragraph("Test Checklist", s["StepHeader"]))
    story.append(Paragraph("<bullet>&bull;</bullet> <b>1.</b> Drop a short test video (2-5 min) into '01 - Raw Videos'", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> <b>2.</b> Verify n8n triggers and moves the file to '02 - Processing'", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> <b>3.</b> Verify the video uploads to Reap successfully", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> <b>4.</b> Wait for Reap to process (usually 3-10 minutes)", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> <b>5.</b> Verify webhook fires and clips download to '03 - Clips Ready'", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> <b>6.</b> Verify you get a Slack/email notification", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> <b>7.</b> Move a clip to '04 - Approved' and verify it posts to IG", s["BulletCustom"]))
    story.append(Paragraph("<bullet>&bull;</bullet> <b>8.</b> Verify the clip moves to '05 - Posted' after publishing", s["BulletCustom"]))

    story.append(Spacer(1, 0.15 * inch))
    story.append(Paragraph(
        "<b>Start small.</b> Use a 2-3 minute test video first. Once the full pipeline works, "
        "then drop your first real 60-min workshop recording.",
        s["Note"]
    ))
    story.append(PageBreak())

    # ── SECTION 9: TROUBLESHOOTING ──
    story.append(Paragraph("9. Troubleshooting &amp; FAQ", s["SectionHeader"]))
    story.append(hr())

    faq_table = make_table(
        ["Problem", "Solution"],
        [
            ["n8n doesn't trigger when I add a file",
             "Check the Google Drive Trigger polling interval. Also verify the OAuth credentials are still valid."],
            ["Reap upload fails (413 or timeout)",
             "File may exceed 5 GB limit. Compress with HandBrake first. Also check n8n's execution timeout settings."],
            ["Reap returns 'invalid' status",
             "Video may be too short (min 2 min) or corrupted. Try re-exporting from your recording software."],
            ["Clips have bad audio/captions",
             "Set the 'language' parameter explicitly in create-clips. Poor source audio = poor captions."],
            ["Webhook never fires",
             "Check the webhook URL in Reap settings. Must be HTTPS. Test with webhook.site first."],
            ["Instagram posting fails",
             "IG Graph API tokens expire every 60 days. Refresh them. GHL handles this automatically."],
            ["Rate limited by Reap",
             "Reap allows 10 req/min. Add a Wait node (2 sec) between API calls in loops."],
            ["n8n runs out of memory on large videos",
             "Increase n8n's memory limit. For self-hosted: set N8N_DEFAULT_BINARY_DATA_MODE=filesystem"],
        ],
        col_widths=[2.5 * inch, 4.2 * inch]
    )
    story.append(faq_table)
    story.append(PageBreak())

    # ── SECTION 10: QUICK REFERENCE ──
    story.append(Paragraph("10. Quick Reference Card", s["SectionHeader"]))
    story.append(hr())

    story.append(Paragraph("Reap.video API Endpoints", s["StepHeader"]))
    story.append(Paragraph(
        "Base URL: https://public.reap.video/api/v1<br/><br/>"
        "POST /automation/get-upload-url<br/>"
        "&nbsp;&nbsp;Body: {\"filename\": \"video.mp4\"}<br/>"
        "&nbsp;&nbsp;Returns: uploadUrl, id<br/><br/>"
        "PUT {uploadUrl}<br/>"
        "&nbsp;&nbsp;Headers: Content-Type: video/mp4<br/>"
        "&nbsp;&nbsp;Body: raw binary<br/><br/>"
        "POST /automation/create-clips<br/>"
        "&nbsp;&nbsp;Body: {\"uploadId\": \"...\", \"genre\": \"talking\", ...}<br/>"
        "&nbsp;&nbsp;Returns: projectId, status<br/><br/>"
        "GET /automation/get-project-status?projectId=...<br/>"
        "&nbsp;&nbsp;Returns: status (processing/completed/failed)<br/><br/>"
        "GET /automation/get-project-clips?projectId=...&amp;page=1&amp;pageSize=100<br/>"
        "&nbsp;&nbsp;Returns: clips[] with clipUrl, viralityScore, title, duration",
        s["CodeBlock"]
    ))

    story.append(Spacer(1, 0.15 * inch))
    story.append(Paragraph("Google Drive Folder Map", s["StepHeader"]))

    folder_table = make_table(
        ["Folder", "Purpose", "Files Move Here When..."],
        [
            ["01 - Raw Videos", "Drop zone", "You record a new video"],
            ["02 - Processing", "In-flight", "n8n picks it up and sends to Reap"],
            ["03 - Clips Ready", "Review queue", "Reap finishes generating clips"],
            ["04 - Approved", "Ready to post", "You approve a clip"],
            ["05 - Posted", "Archive", "The clip is published to Instagram"],
            ["06 - Rejected", "Skip pile", "You reject a clip"],
        ],
        col_widths=[1.5 * inch, 1.5 * inch, 3.7 * inch]
    )
    story.append(folder_table)

    story.append(Spacer(1, 0.15 * inch))
    story.append(Paragraph("Reap create-clips Parameters", s["StepHeader"]))

    params_table = make_table(
        ["Parameter", "Value", "Notes"],
        [
            ["genre", "\"talking\"", "Use for workshops, Q&A, jam sessions"],
            ["exportResolution", "1080", "1080p for IG Reels / YT Shorts"],
            ["exportOrientation", "\"portrait\"", "9:16 for Reels/Shorts/TikTok"],
            ["reframeClips", "true", "AI reframes landscape to portrait"],
            ["captionsPreset", "\"system_beasty\"", "Bold animated captions"],
            ["enableHighlights", "true", "Highlight key words in captions"],
            ["clipDurations", "[[15,30],[30,60]]", "Generate 15-30s and 30-60s clips"],
        ],
        col_widths=[1.8 * inch, 1.8 * inch, 3.1 * inch]
    )
    story.append(params_table)

    story.append(Spacer(1, 0.4 * inch))
    story.append(hr())
    story.append(Paragraph(
        "Built with Claude Code | SolnestAI Community | solnestai.com",
        s["Footer"]
    ))

    # Build the PDF
    doc.build(story)
    print(f"PDF saved to: {OUTPUT_PATH}")


if __name__ == "__main__":
    build_pdf()
