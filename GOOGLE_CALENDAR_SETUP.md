# 🗓️ Google Calendar API Setup Guide

This guide walks you through getting your **Google Calendar API Key** and **Calendar ID** so Mail Mind can automatically push exam dates, deadlines, and events to your Google Calendar.

---

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top left → **New Project**
3. Name it something like `MailMind Calendar` → Click **Create**
4. Make sure your new project is selected in the dropdown

---

## Step 2: Enable the Google Calendar API

1. In the Google Cloud Console, go to **APIs & Services** → **Library**
   - Direct link: https://console.cloud.google.com/apis/library
2. Search for **Google Calendar API**
3. Click on it → Click **Enable**

---

## Step 3: Create an API Key

1. Go to **APIs & Services** → **Credentials**
   - Direct link: https://console.cloud.google.com/apis/credentials
2. Click **+ Create Credentials** → **API Key**
3. Your API key will be generated (looks like `AIzaSyB1a2c3d4e5f6g7h8i9...`)
4. **Copy it** — you'll paste this in Mail Mind Settings

### (Optional) Restrict Your API Key
For security, you can restrict the key:
1. Click **Edit** on your new API key
2. Under **API restrictions**, select **Restrict key**
3. Select **Google Calendar API** from the dropdown
4. Click **Save**

---

## Step 4: Find Your Calendar ID

Your Calendar ID is what tells the API *which* calendar to add events to.

### For your primary calendar:
- Your Calendar ID is simply your **Gmail email address**
  - Example: `pushkaladlakha@gmail.com`

### For a specific calendar:
1. Open [Google Calendar](https://calendar.google.com/)
2. On the left sidebar, hover over the calendar you want → Click the **⋮** (three dots) → **Settings and sharing**
3. Scroll down to **Integrate calendar**
4. Copy the **Calendar ID**
   - It looks like: `abc123@group.calendar.google.com`

---

## Step 5: Paste in Mail Mind

1. Open Mail Mind → Go to **Settings**
2. Scroll to the **Calendar Integration** section
3. Paste your **Google Calendar API Key** in the first field
4. Paste your **Calendar ID** (your Gmail or the calendar-specific ID) in the second field
5. Click **Connect Google Calendar**
6. You should see a green **Connected** badge ✅

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "API key not valid" | Make sure the Google Calendar API is enabled in your project |
| "Calendar not found" | Double-check your Calendar ID — try using your Gmail address |
| "Permission denied" | Make sure the API key isn't restricted to wrong APIs |
| Events not appearing | Check if "Auto-sync extracted dates" toggle is ON in Settings |

---

## Quick Summary

| What you need | Where to get it |
|---------------|----------------|
| **API Key** | Google Cloud Console → APIs & Services → Credentials → Create API Key |
| **Calendar ID** | Your Gmail address, OR Google Calendar → Settings → Integrate calendar |

---

## Security Note

- Your API key is stored locally in your browser (or Firebase if connected)
- It is **never** sent to any third-party server
- You can delete/regenerate your key anytime from Google Cloud Console
- For extra safety, restrict the key to only the Google Calendar API
