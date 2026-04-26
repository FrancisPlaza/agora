// Agora — seed data
// 32 topics from JDN101 syllabus + 32 students + presentation schedule + sample notes.
// Typos in the original syllabus normalised here (Friedrich, Volksgeist, Durkheim,
// sociological, Mangabeira, Bobbitt, McDougal). Production migration should normalise
// the same way from any verbatim source data.
// Bentham appears 3x (topics 2, 24, 28) and Unger 2x (topics 10, 20) — same person, different themes.
// `work` field name is kept for prototype compatibility; production schema renames it to `theme`.

const PHILOSOPHERS = [
  { id: 1,  name: "David Hume",                          work: "Legal Positivism",                                       art: "Customary Bedrock" },
  { id: 2,  name: "Jeremy Bentham",                      work: "On the Principles of Morals and Legislation",            art: "The Greatest Sum" },
  { id: 3,  name: "John Austin",                         work: "The Province of Jurisprudence",                          art: "Sovereign Command" },
  { id: 4,  name: "Hans Kelsen",                         work: "Pure Theory of Law",                                     art: "The Grundnorm" },
  { id: 5,  name: "Thomas Hobbes",                       work: "Legalism, or Rule by the Law",                           art: "Leviathan's Frame" },
  { id: 6,  name: "Herbert Hart",                        work: "Rule of Recognition",                                    art: "What Officials Do" },
  { id: 7,  name: "Confucianism",                        work: "Political Theory and Rectification of Names",            art: "Names Made True" },
  { id: 8,  name: "Ronald Dworkin",                      work: "Interpretivist Approach and Best Fit Theory",            art: "Hercules' Reading" },
  { id: 9,  name: "Justice Oliver Wendell Holmes",       work: "The Path of the Law",                                    art: "The Bad Man's Map" },
  { id: 10, name: "Roberto Mangabeira Unger",            work: "Hegemony, Deconstruction and Hermeneutics of Suspicion", art: "Suspicions Held" },
  { id: 11, name: "Friedrich Karl von Savigny",          work: "The Volksgeist",                                         art: "The People's Spirit" },
  { id: 12, name: "Sir Henry Sumner Maine",              work: "Legal History Theory",                                   art: "Status to Contract" },
  { id: 13, name: "G.W.F. Hegel",                        work: "Dialectic Idealism and the Philosophy of Law",           art: "Sittlichkeit" },
  { id: 14, name: "William James",                       work: "Law as a Means to Satisfy Needs",                        art: "Pragmatic Threads" },
  { id: 15, name: "Emile Durkheim",                      work: "Theory of Legal Change",                                 art: "Conscience Collective" },
  { id: 16, name: "Charles Louis Baron de Montesquieu",  work: "Adapting Law to Shifting Conditions",                    art: "Climates of Law" },
  { id: 17, name: "R. Von Jhering",                      work: "Law as a Method of Ordering Society",                    art: "Means and Ends" },
  { id: 18, name: "Roscoe Pound",                        work: "The Scope and Purpose of Sociological Jurisprudence",    art: "Engineering Society" },
  { id: 19, name: "Max Weber",                           work: "Typology of Law",                                        art: "The Iron Cage" },
  { id: 20, name: "Roberto Mangabeira Unger",            work: "Cultural Context Theory",                                art: "Plasticity" },
  { id: 21, name: "Eugen Ehrlich",                       work: "The Living Law",                                         art: "Beyond the Codes" },
  { id: 22, name: "Talcott Parsons",                     work: "Law as Integrativist Mechanism of Social Control",       art: "Pattern Variables" },
  { id: 23, name: "John Rawls",                          work: "The Sociological School",                                art: "Original Position" },
  { id: 24, name: "Jeremy Bentham",                      work: "Felicific Calculus",                                     art: "Pleasure Measured" },
  { id: 25, name: "John Stuart Mill",                    work: "Utilitarianism, Law and Authority",                      art: "On Liberty's Limits" },
  { id: 26, name: "Henry Sidgwick",                      work: "Act and Rule Utilitarianism",                            art: "Methods of Ethics" },
  { id: 27, name: "Richard Posner",                      work: "Economic Jurisprudence and Consequentialism",            art: "Cost as Reason" },
  { id: 28, name: "Jeremy Bentham",                      work: "Originalism, Textualism, the Plain Meaning Approach",    art: "Plain Meaning" },
  { id: 29, name: "Antonin Scalia",                      work: "Contemporary Originalism",                               art: "Dead Constitutions" },
  { id: 30, name: "Harold Lasswell and Myres McDougal",  work: "Legal Education and Public Policy",                      art: "Decisions for the Public" },
  { id: 31, name: "Philip Bobbitt",                      work: "The Six Main Modalities",                                art: "Six Ways to Argue" },
  { id: 32, name: "Bonum Commune",                       work: "The Aristotelian-Thomistic Tradition",                   art: "The Common Good" },
];

// 32 plausible Filipino law-student names. Index aligns with topic id - 1.
const STUDENTS = [
  "Andrea Reyes", "Joaquin Mendoza", "Bea Villanueva", "Miguel Santos",
  "Paolo Dela Cruz", "Isabela Tan", "Rafael Garcia", "Carmela Lim",
  "Diego Aquino", "Maxine Cruz", "Lance Buenaventura", "Pia Domingo",
  "Marco Lacson", "Therese Mangahas", "Vincent Ong", "Camille Sy",
  "Enrique Pascual", "Luna Bautista", "Gabriel Roxas", "Sophia Yap",
  "Noah Quintos", "Ria Estrella", "Sebastian Cabrera", "Mika Salazar",
  "Tomas Villaroman", "Frances Bonifacio", "Elias Macaraeg", "Nicole Punzalan",
  "Joseph Aguilar", "Margaux Solis", "Antonio Florendo", "Renee del Pilar",
];

// The viewer of this prototype.
const ME = {
  name: "Andrea Reyes",
  email: "areyes@sanbeda.edu.ph",
  studentId: "2024-0142",
  topicId: 1, // presenter for Hume — Legal Positivism
};

// Presentation schedule — assigns dates across May 2026.
// Some are presented, some upcoming, some unassigned.
const TODAY = new Date(2026, 4, 22); // 22 May 2026
const DEADLINE = new Date(2026, 4, 30, 23, 0);

function buildTopics() {
  // status: unassigned | assigned | presented | published
  // Pattern: first 18 published, next 4 presented (awaiting upload),
  // next 8 assigned (upcoming), last 2 unassigned.
  const topics = PHILOSOPHERS.map((p, i) => {
    const id = p.id;
    let status = "unassigned";
    let presenter = null;
    let presentedAt = null;
    let scheduledFor = null;
    let artTitle = null;
    let explanation = null;
    let noteCount = 0;

    if (i < 18) {
      status = "published";
      presenter = STUDENTS[i];
      const day = 4 + Math.floor(i * 0.85);
      presentedAt = new Date(2026, 4, day);
      artTitle = p.art;
      explanation = sampleExplanation(p);
      noteCount = [3, 7, 2, 5, 8, 1, 4, 6, 9, 2, 3, 5, 7, 4, 6, 2, 8, 3][i];
    } else if (i < 22) {
      status = "presented";
      presenter = STUDENTS[i];
      const day = 18 + (i - 18);
      presentedAt = new Date(2026, 4, day);
      noteCount = [2, 1, 4, 0][i - 18];
    } else if (i < 30) {
      status = "assigned";
      presenter = STUDENTS[i];
      const day = 22 + (i - 22);
      scheduledFor = new Date(2026, 4, day);
    } else {
      status = "unassigned";
    }
    return {
      id, philosopher: p.name, work: p.work,
      status, presenter, presentedAt, scheduledFor,
      artTitle, explanation, noteCount,
      tint: TINTS[i % TINTS.length],
    };
  });
  return topics;
}

const TINTS = [
  // soft, subtly-saturated tints for placeholder artwork
  { bg: "#E8EEF5", ink: "#1A2B47" },
  { bg: "#F3E8E1", ink: "#4A2C1F" },
  { bg: "#E6EFE8", ink: "#1F3A29" },
  { bg: "#F0E9F4", ink: "#3A2A4A" },
  { bg: "#F4EBDB", ink: "#4A3920" },
  { bg: "#E1ECEF", ink: "#1F3A42" },
  { bg: "#EFE4E4", ink: "#4A2424" },
  { bg: "#E8E8EE", ink: "#27293A" },
  { bg: "#EAF0E1", ink: "#2D3A1A" },
  { bg: "#F2E5EC", ink: "#4A203A" },
  { bg: "#E5E8F0", ink: "#202A47" },
  { bg: "#F4EFDF", ink: "#4A4220" },
];

function sampleExplanation(p) {
  return `${p.name} approaches the question of law not as a set of commands but as a structure of reasons. ` +
    `On ${p.work}, the central move is to treat the legal as inseparable from the moral horizon that gives it sense. ` +
    `This piece reads that move as a tension — the line between what the law is and what it ought to become. ` +
    `The composition uses scale and edge to stage that tension visually. ` +
    `What survives, in the end, is the question itself: whose reasons count, and on what authority. ` +
    `That is the inheritance ${p.name} leaves us, and the one this class is asked to receive critically.`;
}

const SAMPLE_CLASS_NOTES = [
  { author: "Bea Villanueva", time: "2h ago", body: "Useful framing: Hume isn't denying that morality matters — only that it can't ground a legal system the way reason can. The is/ought gap is the lever, not natural law." },
  { author: "Miguel Santos",  time: "5h ago", body: "Worth flagging: classical positivism here is closer to Hume's scepticism than to Austin's command theory. Easy to conflate them in five minutes." },
  { author: "Paolo Dela Cruz", time: "1d ago", body: "The poster's split palette — warm on one side, cold on the other — is staging the is/ought split. Read the gradient and you get the argument." },
];

const SAMPLE_AUDIT = [
  { actor: "Beadle Lim",   action: "marked",    target: "Topic 18 — Pound", at: "today, 14:32" },
  { actor: "Beadle Lim",   action: "approved",  target: "Renee del Pilar", at: "today, 11:08" },
  { actor: "Beadle Cruz",  action: "assigned",  target: "Topic 31 to Antonio Florendo", at: "yesterday, 17:54" },
  { actor: "Beadle Cruz",  action: "approved",  target: "Margaux Solis",  at: "yesterday, 15:20" },
  { actor: "Beadle Lim",   action: "marked",    target: "Topic 17 — Jhering", at: "yesterday, 14:35" },
  { actor: "Beadle Cruz",  action: "rejected",  target: "unverified registration", at: "2 days ago, 09:15" },
];

const PENDING_VOTERS = [
  { name: "Renee Tan",         email: "rtan@sanbeda.edu.ph",       studentId: "2024-0188", at: "2h ago" },
  { name: "Caleb Mariano",     email: "cmariano@sanbeda.edu.ph",   studentId: "2024-0177", at: "5h ago" },
  { name: "Alyssa Rodriguez",  email: "arodriguez@sanbeda.edu.ph", studentId: "2024-0169", at: "yesterday" },
  { name: "Patrick Velasquez", email: "pvelasquez@sanbeda.edu.ph", studentId: "2024-0156", at: "yesterday" },
];

const fmtDate = (d) => d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
const fmtDateTime = (d) => d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + ", " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";

Object.assign(window, {
  PHILOSOPHERS, STUDENTS, ME, TODAY, DEADLINE,
  buildTopics, sampleExplanation,
  SAMPLE_CLASS_NOTES, SAMPLE_AUDIT, PENDING_VOTERS,
  fmtDate, fmtDateTime,
});
