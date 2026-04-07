# Content Repurposing Pipeline — Build Guide
## Step-by-Step in Claude Code

*Use this guide to build the pipeline in a live session (workshop or jam session).*
*Estimated build time: 2-3 hours*

---

## What We're Building

An automated pipeline that:
1. Watches a Google Drive folder for new video uploads
2. Sends them to Reap.video AI to generate short clips with captions
3. Downloads the clips back to Google Drive for review
4. Notifies you via Slack when clips are ready
5. Posts approved clips to Instagram automatically

**Stack:** Google Drive + Reap.video API + n8n + GHL (or IG Graph API) + Claude API

---

## Pre-Session Setup (Do This Before the Build)

### Accounts needed:
- [ ] Google account with Google Drive
- [ ] Reap.video account (Creator plan or free tier to test)
- [ ] n8n instance (self-hosted or cloud at n8n.io)
- [ ] Slack workspace (for notifications)
- [ ] GHL account OR Meta Business account (for IG posting)

### API keys to have ready:
- [ ] Reap.video API key (Profile > Settings > API Keys)
- [ ] Google OAuth credentials (for n8n Google Drive nodes)
- [ ] Slack webhook URL (Slack > Apps > Incoming Webhooks)
- [ ] GHL API key OR Instagram Graph API token

---

## Build Step 1: Google Drive Folder Structure
**Time: 5 minutes**

Create these folders in Google Drive:

```
Content Pipeline/
    01 - Raw Videos/
    02 - Processing/
    03 - Clips Ready/
    04 - Approved/
    05 - Posted/
    06 - Rejected/
```

Each folder = a stage in the pipeline. Videos move through folders as they progress.

**Verify:** Open Google Drive and confirm all 6 folders exist.

---

## Build Step 2: Test Reap.video API Manually
**Time: 10 minutes**

Before building the n8n flow, test the API directly to make sure your key works.

### 2a. Test getting an upload URL

```bash
curl -X POST https://public.reap.video/api/v1/automation/get-upload-url \
  -H "Authorization: Bearer YOUR_REAP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"filename": "test.mp4"}'
```

**Expected:** JSON response with `uploadUrl` and `id`

### 2b. Test creating a clip project (use a YouTube URL for quick testing)

```bash
curl -X POST https://public.reap.video/api/v1/automation/create-clips \
  -H "Authorization: Bearer YOUR_REAP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceUrl": "https://www.youtube.com/watch?v=SOME_SHORT_VIDEO",
    "genre": "talking",
    "exportResolution": 1080,
    "exportOrientation": "portrait",
    "reframeClips": true,
    "captionsPreset": "system_beasty",
    "clipDurations": [[15, 30], [30, 60]]
  }'
```

**Expected:** JSON with `id` (projectId) and `status: "processing"`

### 2c. Poll for status

```bash
curl "https://public.reap.video/api/v1/automation/get-project-status?projectId=YOUR_PROJECT_ID" \
  -H "Authorization: Bearer YOUR_REAP_API_KEY"
```

**Expected:** Status progresses through: queued → prepped → draft → processing → finalizing → completed

### 2d. Get the generated clips

```bash
curl "https://public.reap.video/api/v1/automation/get-project-clips?projectId=YOUR_PROJECT_ID&page=1&pageSize=100" \
  -H "Authorization: Bearer YOUR_REAP_API_KEY"
```

**Expected:** Array of clip objects with `clipUrl`, `viralityScore`, `title`, `duration`

**Verify:** Download one `clipUrl` in your browser — it should be a short video clip with captions.

---

## Build Step 3: Create the n8n Upload Flow
**Time: 30 minutes**

This flow watches Google Drive and sends new videos to Reap.

### Open n8n and create a new workflow: "Content Pipeline - Upload & Clip"

### Node 1: Google Drive Trigger
- **Type:** Google Drive Trigger
- **Event:** File Created
- **Folder:** Select your "01 - Raw Videos" folder
- **Poll interval:** Every 5 minutes

### Node 2: Move to Processing
- **Type:** Google Drive (Move/Rename)
- **Operation:** Move File
- **File ID:** `{{ $json.id }}`
- **Target Folder:** "02 - Processing"

*Why: Prevents the trigger from picking up the same file again.*

### Node 3: Get Reap Upload URL
- **Type:** HTTP Request
- **Method:** POST
- **URL:** `https://public.reap.video/api/v1/automation/get-upload-url`
- **Authentication:** Header Auth
  - Name: `Authorization`
  - Value: `Bearer YOUR_REAP_API_KEY`
- **Body (JSON):**
```json
{
  "filename": "{{ $('Google Drive Trigger').item.json.name }}"
}
```

### Node 4: Download Video from Drive
- **Type:** Google Drive (Download)
- **File ID:** `{{ $('Move to Processing').item.json.id }}`
- **Output:** Binary data

### Node 5: Upload to Reap
- **Type:** HTTP Request
- **Method:** PUT
- **URL:** `{{ $('Get Reap Upload URL').item.json.uploadUrl }}`
- **Content Type:** `video/mp4`
- **Body:** Binary data from Node 4
- **Timeout:** 600 seconds (large files take time)

### Node 6: Create Clipping Project
- **Type:** HTTP Request
- **Method:** POST
- **URL:** `https://public.reap.video/api/v1/automation/create-clips`
- **Authentication:** Same header auth as Node 3
- **Body (JSON):**
```json
{
  "uploadId": "{{ $('Get Reap Upload URL').item.json.id }}",
  "genre": "talking",
  "exportResolution": 1080,
  "exportOrientation": "portrait",
  "reframeClips": true,
  "captionsPreset": "system_beasty",
  "enableHighlights": true,
  "clipDurations": [[15, 30], [30, 60]]
}
```

### Node 7: Send "Processing Started" Notification
- **Type:** Slack (Send Message)
- **Channel:** Your content channel
- **Message:**
```
🎬 New video submitted for clipping!
File: {{ $('Google Drive Trigger').item.json.name }}
Project ID: {{ $('Create Clipping Project').item.json.id }}
Status: Processing... You'll be notified when clips are ready.
```

**Verify:** Drop a short test video (2-3 min MP4) into "01 - Raw Videos". Watch n8n execute. Confirm the video moves to "02 - Processing" and you get a Slack message.

---

## Build Step 4: Create the n8n Webhook/Download Flow
**Time: 30 minutes**

This flow fires when Reap finishes processing and downloads the clips.

### Create a new workflow: "Content Pipeline - Download Clips"

### Option A: Webhook (Recommended)

#### Node 1: Webhook Trigger
- **Type:** Webhook
- **HTTP Method:** POST
- **Path:** `/reap-clips-ready`
- **Response Mode:** Immediately

*Copy the webhook URL and add it to Reap dashboard: Profile > Settings > Webhooks*

### Option B: Polling (If webhook isn't possible)

#### Node 1: Schedule Trigger
- **Type:** Schedule Trigger
- **Interval:** Every 10 minutes

#### Node 1b: Get All Projects
- **Type:** HTTP Request
- **URL:** `https://public.reap.video/api/v1/automation/get-all-projects?page=1&pageSize=10`
- **Filter:** Only process projects with status "completed" that haven't been handled yet

### Continuing from either option:

#### Node 2: Check Status
- **Type:** IF
- **Condition:** `{{ $json.status }}` equals `completed`
- **True:** Continue to Node 3
- **False:** If "failed" or "expired", send error notification to Slack

#### Node 3: Get Clips
- **Type:** HTTP Request
- **Method:** GET
- **URL:** `https://public.reap.video/api/v1/automation/get-project-clips?projectId={{ $json.projectId }}&page=1&pageSize=100`
- **Authentication:** Same Reap bearer token

#### Node 4: Loop Through Clips
- **Type:** Split In Batches
- **Input:** `{{ $json.clips }}`
- **Batch Size:** 1

#### Node 5: Download Clip Video
- **Type:** HTTP Request
- **Method:** GET
- **URL:** `{{ $json.clipUrl }}`
- **Response Format:** Binary (file)

#### Node 6: Upload Clip to Google Drive
- **Type:** Google Drive (Upload)
- **Folder:** "03 - Clips Ready"
- **File Name:** `{{ $json.title }}_score{{ $json.viralityScore }}.mp4`
- **Binary Data:** From Node 5

#### Node 7: Wait Between Clips
- **Type:** Wait
- **Duration:** 2 seconds
- **Why:** Respect Reap's 10 req/min rate limit

#### Node 8: Send Review Notification (after loop completes)
- **Type:** Slack (Send Message)
- **Message:**
```
✅ Clips ready for review!
Source: [original video name]
Clips generated: {{ $('Get Clips').item.json.totalClips }}
📁 Review them: Google Drive > Content Pipeline > 03 - Clips Ready
Move approved clips to "04 - Approved" when ready.
```

**Verify:** Wait for your test video from Step 3 to finish processing. Confirm clips appear in "03 - Clips Ready" and you get a Slack notification.

---

## Build Step 5: Create the n8n Posting Flow
**Time: 30 minutes**

This flow watches the "04 - Approved" folder and posts to Instagram.

### Create a new workflow: "Content Pipeline - Post to IG"

#### Node 1: Google Drive Trigger
- **Type:** Google Drive Trigger
- **Event:** File Created
- **Folder:** "04 - Approved"
- **Poll interval:** Every 5 minutes

#### Node 2: Download the Clip
- **Type:** Google Drive (Download)
- **File ID:** `{{ $json.id }}`

#### Node 3: Generate Caption with Claude
- **Type:** HTTP Request
- **Method:** POST
- **URL:** `https://api.anthropic.com/v1/messages`
- **Headers:**
  - `x-api-key: YOUR_ANTHROPIC_API_KEY`
  - `anthropic-version: 2023-06-01`
  - `Content-Type: application/json`
- **Body:**
```json
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 500,
  "messages": [{
    "role": "user",
    "content": "Write an Instagram Reel caption for a clip titled '{{ $('Google Drive Trigger').item.json.name }}'. The account is @ryan_le5 — a pilot who builds AI agents to run his businesses. Keep it under 150 words. Include a hook in the first line, value in the middle, and a CTA at the end pointing to 'link in bio' for the SolnestAI community. Include 10-15 relevant hashtags. No emoji overload."
  }]
}
```

#### Node 4: Post to Instagram (via GHL)
- **Type:** HTTP Request
- **Method:** POST
- **URL:** GHL Social Media Posting endpoint
- **Body:** Include the video file and the generated caption

*Alternative: Use Instagram Graph API Container + Publish endpoints*

#### Node 5: Move to Posted
- **Type:** Google Drive (Move)
- **Move the clip from "04 - Approved" to "05 - Posted"

#### Node 6: Log to Google Sheet
- **Type:** Google Sheets (Append Row)
- **Spreadsheet:** "Content Pipeline Log"
- **Row data:** Date, clip filename, platform, caption, post URL

**Verify:** Move a clip from "03 - Clips Ready" to "04 - Approved". Watch the flow trigger, generate a caption, and post.

---

## Build Step 6: End-to-End Test
**Time: 15 minutes**

Run through the entire pipeline with a real (short) video:

1. [ ] Record a 3-5 minute video (or use an existing one)
2. [ ] Drop it into "01 - Raw Videos"
3. [ ] Watch n8n Flow 1 trigger → file moves to "02 - Processing" → Slack notification
4. [ ] Wait 5-10 minutes for Reap to process
5. [ ] Watch n8n Flow 2 trigger → clips land in "03 - Clips Ready" → Slack notification
6. [ ] Review clips in Google Drive
7. [ ] Move 1-2 good clips to "04 - Approved"
8. [ ] Watch n8n Flow 3 trigger → caption generated → posted to IG → file moves to "05 - Posted"
9. [ ] Check Instagram — your Reel should be live
10. [ ] Check the Google Sheet log

**If all 10 steps work, your pipeline is live.**

---

## Configuration Reference

### Reap.video create-clips Parameters

| Parameter | Recommended Value | Why |
|-----------|-------------------|-----|
| genre | "talking" | Best for workshops, Q&A, jam sessions |
| exportResolution | 1080 | Standard HD for Reels |
| exportOrientation | "portrait" | 9:16 for IG Reels / YT Shorts |
| reframeClips | true | Auto-crops landscape to portrait |
| captionsPreset | "system_beasty" | Bold, animated captions |
| enableHighlights | true | Keywords pop in the captions |
| clipDurations | [[15,30],[30,60]] | Mix of quick hooks and longer clips |
| topics | ["AI agents", "automation"] | Guide the AI to find relevant moments |

### n8n Environment Variables (Self-Hosted)

```
N8N_DEFAULT_BINARY_DATA_MODE=filesystem  # Prevents memory issues with large videos
EXECUTIONS_TIMEOUT=3600                   # 1 hour timeout for long uploads
```

### Rate Limits to Respect

| Service | Limit | How to Handle |
|---------|-------|---------------|
| Reap.video API | 10 req/min | Add 2s Wait nodes between API calls |
| Google Drive API | 12,000 req/min | Not a concern for this pipeline |
| Instagram Graph API | 200 posts/day | Not a concern (you'll post 3-5/week) |

---

## What to Build Next

Once the basic pipeline is running, here are upgrades to add:

1. **Multi-platform posting** — Add TikTok and YouTube Shorts as additional outputs
2. **A/B caption testing** — Generate 2 captions per clip, post both, compare engagement
3. **Engagement tracking** — Pull IG insights back into your Google Sheet to see which clips perform best
4. **Automatic topic extraction** — Use Claude to analyze the full video transcript and suggest topics for Reap
5. **Thumbnail generation** — Use Claude's vision to pick the best frame for the Reel cover

---

*Built with Claude Code | SolnestAI Community*
