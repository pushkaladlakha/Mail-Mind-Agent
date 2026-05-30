export type EmailCategory = "important" | "low_priority";
export type EmailKind = "exam" | "lab" | "academic" | "event" | "admin" | "promo" | "newsletter";

export interface ExtractedDate {
  date: string; // ISO
  label: string;
  location?: string;
}

export interface Email {
  id: string;
  sender: string;
  senderEmail: string;
  subject: string;
  bodySnippet: string;
  receivedAt: string; // ISO
  category: EmailCategory;
  kind: EmailKind;
  summary: string;
  extractedDates: ExtractedDate[];
  tags: string[];
  unread: boolean;
  priorityScore: number; // 0–100
}

const now = new Date();
const iso = (daysFromNow: number, hour = 9, minute = 0) => {
  const d = new Date(now);
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

export const emails: Email[] = [
  {
    id: "e1",
    sender: "Office of Academic Affairs",
    senderEmail: "academics@iitd.ac.in",
    subject: "Mid-Semester Examination Schedule — Autumn Semester 2025",
    bodySnippet:
      "The mid-semester examinations for all B.Tech courses are scheduled to commence. Carry your institute ID card and reach the venue 15 minutes before the exam starts.",
    receivedAt: iso(0, 9, 14),
    category: "important",
    kind: "exam",
    summary:
      "Mid-semester exams start on Oct 14. Bring institute ID and arrive 15 minutes early. No electronic devices permitted in LH-1 and LH-2.",
    extractedDates: [
      { date: iso(3, 9, 0), label: "Autumn Mid-Sem Exam Starts", location: "LH-1" },
      { date: iso(5, 9, 0), label: "Maths & CompSci Finals", location: "LH-2" },
    ],
    tags: ["Exam", "Important", "Autumn-2025"],
    unread: true,
    priorityScore: 98,
  },
  {
    id: "e2",
    sender: "Prof. Anil Kumar",
    senderEmail: "anilk@cse.iitd.ac.in",
    subject: "CS301: Assignment 3 Submission Deadline Extended",
    bodySnippet:
      "Based on student feedback, the submission deadline for CS301 Assignment 3 (Compiler Design Parser) is extended by 48 hours. Submit via LMS.",
    receivedAt: iso(0, 7, 30),
    category: "important",
    kind: "academic",
    summary:
      "CS301 Assignment 3 deadline is extended by 48 hours. Submit your final compiler design parser code via LMS.",
    extractedDates: [{ date: iso(2, 23, 59), label: "CS301 Assignment 3 Deadline", location: "LMS Portal" }],
    tags: ["Assignment", "CS301", "Deadline"],
    unread: true,
    priorityScore: 92,
  },
  {
    id: "e3",
    sender: "Academic Registry",
    senderEmail: "registry@iitd.ac.in",
    subject: "CS402 Elective Registration Deadline",
    bodySnippet:
      "All final-year B.Tech students must complete elective registration for the advanced machine learning track before the portal closes.",
    receivedAt: iso(-1, 18, 0),
    category: "important",
    kind: "academic",
    summary:
      "Final call to register for advanced machine learning electives. Registration portal closes on Oct 18, 11:59 PM.",
    extractedDates: [{ date: iso(7, 23, 59), label: "Elective Registration Closes", location: "ERP Portal" }],
    tags: ["Registration", "Elective", "ERP"],
    unread: true,
    priorityScore: 95,
  },
  {
    id: "e4",
    sender: "Placement & Internship Cell",
    senderEmail: "internships@iitd.ac.in",
    subject: "Summer Internship Drive — Google Research Applications Open",
    bodySnippet:
      "Google Research India is accepting applications for the summer research intern program. Submit your resumes and transcripts via the placement portal.",
    receivedAt: iso(-1, 11, 5),
    category: "important",
    kind: "event",
    summary:
      "Summer Research Intern applications are open for Google Research India. Register on the placement portal by Oct 12, 5 PM.",
    extractedDates: [{ date: iso(1, 17, 0), label: "Google Intern Applications Close", location: "Placement Portal" }],
    tags: ["Internship", "Google", "Placements"],
    unread: false,
    priorityScore: 88,
  },
  {
    id: "e5",
    sender: "Department of Computer Science",
    senderEmail: "office@cse.iitd.ac.in",
    subject: "Seminar Announcement: Advances in Agentic AI by Dr. S. Rao",
    bodySnippet:
      "You are invited to join the guest seminar on recent advances in AI systems and agency, delivered by Dr. S. Rao from Google DeepMind.",
    receivedAt: iso(-1, 15, 22),
    category: "important",
    kind: "academic",
    summary:
      "Guest seminar on Agentic AI by Dr. S. Rao (Google DeepMind) on Oct 20 at 6:30 PM in the Seminar Hall. Attendance recommended.",
    extractedDates: [{ date: iso(9, 18, 30), label: "Agentic AI Seminar", location: "Seminar Hall" }],
    tags: ["Seminar", "AI", "DeepMind"],
    unread: false,
    priorityScore: 85,
  },
  {
    id: "e6",
    sender: "Placement Coordinator",
    senderEmail: "placements@iitd.ac.in",
    subject: "Final Placement Briefing & Guidelines Document",
    bodySnippet:
      "Mandatory placement briefing guidelines document has been uploaded. All registered students must read the eligibility and interview dress codes.",
    receivedAt: iso(0, 10, 42),
    category: "important",
    kind: "academic",
    summary:
      "Mandatory final placement guidelines uploaded. Review dress codes and interview protocols before the pre-placement talk starting next Monday.",
    extractedDates: [
      { date: iso(2, 10, 0), label: "Mandatory Placement Briefing", location: "Convocation Hall" }
    ],
    tags: ["Placement", "Guidelines", "Briefing"],
    unread: true,
    priorityScore: 90,
  },
  {
    id: "e7",
    sender: "Hostel Office",
    senderEmail: "maintenance@hostel.iitd.ac.in",
    subject: "Routine Water Supply Maintenance & Outage Notice",
    bodySnippet:
      "Please note that routine water pipeline maintenance will be conducted in Hostel 4 and 5 this Sunday. Expect supply interruptions.",
    receivedAt: iso(-2, 9, 45),
    category: "low_priority",
    kind: "admin",
    summary: "Routine water supply outage in Hostel 4 & 5 on Sunday from 9 AM to 2 PM due to pipeline maintenance.",
    extractedDates: [],
    tags: ["Hostel", "Maintenance"],
    unread: false,
    priorityScore: 42,
  },
  {
    id: "e8",
    sender: "Robotics Club Coordinator",
    senderEmail: "robotics@iitd.ac.in",
    subject: "Annual Robotics Design Competition — Registrations Open",
    bodySnippet:
      "Showcase your autonomous driving rovers in the annual design competition. Exciting cash prizes for top 3 teams.",
    receivedAt: iso(-2, 12, 10),
    category: "low_priority",
    kind: "event",
    summary: "Annual Robotics design competition registrations are open. Submit rover specifications before Oct 25.",
    extractedDates: [],
    tags: ["Robotics", "Competition", "Club"],
    unread: false,
    priorityScore: 35,
  },
  {
    id: "e9",
    sender: "Wellness Council",
    senderEmail: "wellness@iitd.ac.in",
    subject: "Morning Yoga & Mindfulness Session — Student Center",
    bodySnippet:
      "Join the wellness council for a peaceful morning session of yoga, breathing exercises, and meditation to relieve exams stress.",
    receivedAt: iso(-3, 8, 0),
    category: "low_priority",
    kind: "event",
    summary: "Mindfulness and yoga session tomorrow morning at 7 AM in the Student Center to relieve mid-sem stress.",
    extractedDates: [],
    tags: ["Yoga", "Wellness", "Session"],
    unread: true,
    priorityScore: 25,
  },
  {
    id: "e10",
    sender: "Cultural Council",
    senderEmail: "moodindigo@iitd.ac.in",
    subject: "Mood Indigo 2025: Pre-Fest Competitions & Auditions",
    bodySnippet:
      "Pre-fest auditions for the street play (Nukkad Natak) and Western band competitions are starting this Friday at the Open Air Theater.",
    receivedAt: iso(-2, 17, 0),
    category: "low_priority",
    kind: "event",
    summary: "Mood Indigo street play and band auditions start Friday at 5 PM. Sign up at the cultural desk.",
    extractedDates: [],
    tags: ["Mood-Indigo", "Auditions", "Festival"],
    unread: false,
    priorityScore: 30,
  },
];

export const getEmailById = (id: string) => emails.find((e) => e.id === id);
export const getImportant = () => emails.filter((e) => e.category === "important");
export const getLowPriority = () => emails.filter((e) => e.category === "low_priority");
export const getWithDates = () => emails.filter((e) => e.extractedDates.length > 0);
export const getUnread = () => emails.filter((e) => e.unread);

export const getAllExtractedDates = () =>
  emails
    .flatMap((e) =>
      e.extractedDates.map((d) => ({ ...d, emailId: e.id, kind: e.kind, sender: e.sender, subject: e.subject })),
    )
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));

export const stats = () => ({
  scanned: emails.length * 12 + 18, // mock realism
  important: getImportant().length,
  lowPriority: getLowPriority().length,
  deadlines: getAllExtractedDates().length,
  timeSavedHours: 1.2,
  noisePct: Math.round((getLowPriority().length / emails.length) * 100),
});

export const categoryBreakdown = () => {
  const total = emails.length;
  const academic = emails.filter((e) => ["academic", "exam", "lab"].includes(e.kind)).length;
  const events = emails.filter((e) => ["event", "admin"].includes(e.kind)).length;
  const promo = emails.filter((e) => ["promo", "newsletter"].includes(e.kind)).length;
  return {
    academic: Math.round((academic / total) * 100),
    events: Math.round((events / total) * 100),
    promo: Math.round((promo / total) * 100),
  };
};
