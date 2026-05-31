import { Email, EmailCategory, EmailKind, ExtractedDate } from "./mock-data";

// 1. Clean email body (strip signatures, quoted replies, unnecessary headers)
export function cleanEmailBody(body: string): string {
  if (!body) return "";

  // Split into lines
  const lines = body.split(/\r?\n/);
  const cleanedLines: string[] = [];

  // Common signatures indicators
  const signatureRegex = /^(thanks|regards|yours|cheers|best|sincerely|warm|thank\s+you)/i;

  for (const line of lines) {
    const trimmed = line.trim();

    // Remove quoted replies (lines starting with '>')
    if (trimmed.startsWith(">")) {
      continue;
    }

    // Stop parsing if we hit a signature marker
    if (signatureRegex.test(trimmed)) {
      break;
    }

    cleanedLines.push(line);
  }

  return cleanedLines.join("\n").trim();
}

// 2. Mock ML Classifier layer (returns important vs low_priority)
export function classifyEmail(subject: string, body: string): EmailCategory {
  const text = `${subject} ${body}`.toLowerCase();
  
  // Important keywords
  const importantKeywords = [
    "exam", "quiz", "mid-sem", "finals", "submission", "deadline", 
    "registration", "placement", "interview", "shortlist", "urgent",
    "required", "mandatory", "compulsory", "briefing", "office of",
    "dean", "professor", "prof."
  ];

  const isImportant = importantKeywords.some((keyword) => text.includes(keyword));
  return isImportant ? "important" : "low_priority";
}

// 3. Mock Gemini large language model summarizer
export function summarizeWithGemini(
  subject: string,
  sender: string,
  cleanedBody: string,
  category: EmailCategory
): {
  summary: string;
  kind: EmailKind;
  priorityScore: number;
  extractedDates: ExtractedDate[];
  tags: string[];
} {
  const text = `${subject} ${cleanedBody}`.toLowerCase();
  let summary = "";
  let kind: EmailKind = "academic";
  let priorityScore = 50;
  let extractedDates: ExtractedDate[] = [];
  let tags: string[] = [];

  const now = new Date();
  const isoDate = (daysFromNow: number, hour = 9) => {
    const d = new Date(now);
    d.setDate(d.getDate() + daysFromNow);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };

  if (category === "important") {
    // Determine Kind
    if (text.includes("exam") || text.includes("quiz")) {
      kind = "exam";
      priorityScore = 95;
      summary = `Quiz announcement. Surprising quiz scheduled during the next lecture session. Prepare course topics.`;
      extractedDates = [{ date: isoDate(2, 9), label: "Surprise Lecture Quiz", location: "LH-3" }];
      tags = ["Quiz", "Important", "CS301"];
    } else if (text.includes("interview") || text.includes("placement") || text.includes("shortlist")) {
      kind = "academic";
      priorityScore = 97;
      summary = `Mandatory interview schedule for placement candidates shortlisted. Guidelines and dress codes attached.`;
      extractedDates = [{ date: isoDate(1, 10), label: "placement FTE Interviews", location: "Placement Cell" }];
      tags = ["Placement", "Interview", "FTE"];
    } else if (text.includes("inspection") || text.includes("maintenance") || text.includes("warden")) {
      kind = "admin";
      priorityScore = 86;
      summary = `Compulsory Hostel Room Safety Inspection scheduled. Wardens will verify electrical connections. Residents must be present.`;
      extractedDates = [{ date: isoDate(3, 10), label: "Room Safety Inspection", location: "Hostel 4" }];
      tags = ["Hostel", "Inspection", "Admin"];
    } else {
      kind = "academic";
      priorityScore = 80;
      summary = `Academic update concerning course track and registrations. Please review guidelines.`;
      tags = ["Academic", "Updates"];
    }
  } else {
    // Low priority
    priorityScore = 20;
    if (text.includes("valorant") || text.includes("gaming") || text.includes("techfest")) {
      kind = "event";
      priorityScore = 32;
      summary = "TechFest Valorant Championship registration closes tonight. Cash prize.";
      tags = ["TechFest", "Gaming", "Event"];
    } else if (text.includes("yoga") || text.includes("mindful") || text.includes("wellness")) {
      kind = "event";
      priorityScore = 25;
      summary = "Morning Yoga & Meditation session to reduce exams stress.";
      tags = ["Wellness", "Yoga", "Session"];
    } else if (text.includes("zomato") || text.includes("discount") || text.includes("coupon")) {
      kind = "promo";
      priorityScore = 18;
      summary = "Flat student discount code available for late night delivery.";
      tags = ["Promo", "Discount", "Zomato"];
    } else {
      kind = "newsletter";
      summary = "General announcement bulletin. No immediate action required.";
      tags = ["Ambient", "Newsletter"];
    }
  }

  return {
    summary,
    kind,
    priorityScore,
    extractedDates,
    tags,
  };
}

// 4. Mock pool of 5 new un-synced emails for presentation testing
const NEW_EMAILS_POOL = [
  {
    id: "incoming-1",
    sender: "Prof. Anil Kumar",
    senderEmail: "anilk@cse.iitd.ac.in",
    subject: "CS301: Surprise Quiz Announcement — Lecture Session",
    body: "Dear Students, there will be a short surprise quiz at the beginning of Thursday's lecture in LH-3. It will cover parsing and grammar. Please carry a pen.\n\nThanks & Regards,\nProf. Anil.",
  },
  {
    id: "incoming-2",
    sender: "Placement Office",
    senderEmail: "placements@iitd.ac.in",
    subject: "Urgent: Interview Shortlist Announcement — Microsoft FTE",
    body: "Dear B.Tech Students, Microsoft has released the shortlist for FTE profiles. The interviews are scheduled this Friday in the Placement Cell. Please find the attached shortlist.\n\nRegards,\nPlacements Team.",
  },
  {
    id: "incoming-3",
    sender: "TechFest Coordinator",
    senderEmail: "gaming@techfest.org",
    subject: "TechFest 2025: Ultimate Valorant Championship Registrations Close Today",
    body: "Hey gamers! Today is your last chance to register your team of 5 for the grand Valorant tournament at TechFest 2025. Cash prize of 50K up for grabs.\n\nCheers,\nTechFest.",
  },
  {
    id: "incoming-4",
    sender: "Hostel Warden",
    senderEmail: "warden@hostel.iitd.ac.in",
    subject: "Notice: Compulsory Hostel Room Safety Inspection",
    body: "Dear Residents, the annual room safety and electrical wiring inspection is scheduled for Hostel 4 this Saturday from 10 AM to 4 PM. Presence is mandatory. Wardens will inspect.\n\nYours sincerely,\nWarden.",
  },
  {
    id: "incoming-5",
    sender: "Zomato Campus Deals",
    senderEmail: "campus@zomato.com",
    subject: "Flat 50% Off student discounts at HJD Restaurant",
    body: "Craving late night snacks? Use code CAMPUS50 at checkout to get flat 50% discount on orders above 199. Offer valid till midnight.\n\nBest,\nZomato Team.",
  },
];

// Fetch workflow (incremental sync)
export async function fetchMailbox(
  uid: string,
  lastCheckpoint: number
): Promise<Array<{
  id: string;
  sender: string;
  senderEmail: string;
  subject: string;
  body: string;
  receivedAt: string;
}>> {
  // Simulate network wait
  await new Promise((resolve) => setTimeout(resolve, 1100));

  const nowTime = +new Date();
  
  // If checkpoint exists and is recent (meaning we already did the first sync), return nothing new
  if (lastCheckpoint > 0) {
    const timeDifference = nowTime - lastCheckpoint;
    // If last sync was less than 4 seconds ago, assume no new mails have arrived in the mailbox
    if (timeDifference < 8000) {
      return [];
    }
  }

  // Generate dynamic incoming emails timestamps relative to now
  return NEW_EMAILS_POOL.map((item, index) => {
    // Spread them out slightly (e.g. current time minus minutes)
    const receivedTime = new Date(nowTime - (index * 5 * 60 * 1000)).toISOString();
    return {
      ...item,
      receivedAt: receivedTime,
    };
  });
}
