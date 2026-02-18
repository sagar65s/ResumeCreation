import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import bcrypt from "bcryptjs";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});


export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);



// HEALTH CHECK ROUTE (Render keep-alive)
  app.get("/health", (req, res) => {
    res.status(200).send("OK");
  });

  app.get("/sitemap.xml", (req, res) => {
  res.sendFile(__dirname + "/server/sitemap.xml");
});



  // Resume Routes
  app.get(api.resumes.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    const resumes = await storage.getResumes(user.id);
    res.json(resumes);
  });

  app.get(api.resumes.get.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    const resume = await storage.getResume(Number(req.params.id));
    if (!resume) return res.sendStatus(404);
    if (resume.userId !== user.id) return res.sendStatus(403);
    res.json(resume);
  });

  app.post(api.resumes.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    try {
      const input = api.resumes.create.input.parse(req.body);
      const resume = await storage.createResume({ ...input, userId: user.id });
      res.status(201).json(resume);
    } catch (err) {
       if (err instanceof z.ZodError) {
          res.status(400).json({ message: err.errors[0].message });
       } else {
          res.sendStatus(500);
       }
    }
  });

  app.put(api.resumes.update.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    const id = Number(req.params.id);
    const existing = await storage.getResume(id);
    if (!existing) return res.sendStatus(404);
    if (existing.userId !== user.id) return res.sendStatus(403);

    try {
        const input = api.resumes.update.input.parse(req.body);
        const updated = await storage.updateResume(id, input);
        res.json(updated);
    } catch (err) {
        if (err instanceof z.ZodError) {
            res.status(400).json({ message: err.errors[0].message });
         } else {
            res.sendStatus(500);
         }
    }
  });

  app.delete(api.resumes.delete.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    const id = Number(req.params.id);
    const existing = await storage.getResume(id);
    if (!existing) return res.sendStatus(404);
    if (existing.userId !== user.id) return res.sendStatus(403);

    await storage.deleteResume(id);
    res.sendStatus(204);
  });

  // PDF Generation Route (Server-side fallback/alternative)
  app.get(api.resumes.downloadPdf.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    const id = Number(req.params.id);
    const resume = await storage.getResume(id);

    if (!resume) return res.sendStatus(404);
    if (resume.userId !== user.id) return res.sendStatus(403);

    // For now, since we have react-to-print on frontend which is more reliable for CSS,
    // we'll just return the resume data and let the frontend handle the "download"
    // by triggering the print dialog. 
    // If a true server-side PDF is needed, we'd use puppeteer here.
    res.json(resume);
  });

  // AI Generation Route
  // AI Generation Route
app.post(api.ai.generateResume.path, async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const {
      jobRole,
      experienceLevel,
      skills,
      currentEducation,
      projectsContext,
    } = api.ai.generateResume.input.parse(req.body);

    const systemPrompt = `
You are an expert resume writer.
Return ONLY valid JSON. No markdown. No explanation.

JSON schema:
{
  "personalInfo": { "fullName": "", "email": "", "phone": "", "bio": "", "location": "" },
  "experience": [{ "role": "", "company": "", "startDate": "", "endDate": "", "description": "" }],
  "education": [{ "degree": "", "school": "", "startDate": "", "endDate": "" }],
  "skills": [],
  "projects": [{ "name": "", "description": "", "link": "", "techStack": [] }]
}
`;

    const userPrompt = `
Job Role: ${jobRole}
Experience Level: ${experienceLevel}
Skills: ${skills || "Relevant skills"}
Education: ${currentEducation || "Relevant education"}
Projects: ${projectsContext || "Relevant projects"}
`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.3,
      max_tokens: 900,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    const json = JSON.parse(raw);

    res.json(json);
  } catch (err) {
    console.error("Groq Resume AI Error:", err);
    res.status(500).json({ message: "Failed to generate resume" });
  }
});


  // Seed Data
  if (process.env.NODE_ENV !== "production") {
    const existingUser = await storage.getUserByUsername("demo");
    if (!existingUser) {
        const hashedPassword = await bcrypt.hash("demo123", 10);
        const user = await storage.createUser({
            username: "demo",
            password: hashedPassword,
            name: "Demo User"
        });
        await storage.createResume({
            userId: user.id,
            title: "Sample Resume",
            content: {
                personalInfo: {
                    fullName: "Demo User",
                    email: "demo@example.com",
                    phone: "+1 234 567 8900",
                    bio: "Experienced Software Engineer with a passion for building scalable applications.",
                    location: "San Francisco, CA"
                },
                experience: [
                    {
                        role: "Senior Developer",
                        company: "Tech Corp",
                        startDate: "2020-01",
                        endDate: "Present",
                        description: "• Led a team of 5 developers.\n• Architected microservices.",
                        current: true
                    }
                ],
                education: [
                    {
                        degree: "BS Computer Science",
                        school: "University of Tech",
                        startDate: "2015-09",
                        endDate: "2019-05"
                    }
                ],
                skills: ["React", "Node.js", "TypeScript", "PostgreSQL"],
                projects: [
                    {
                        name: "Resume Builder",
                        description: "An AI-powered resume builder app.",
                        link: "https://example.com"
                    }
                ]
            },
            isAiGenerated: false
        });
        console.log("Seeded demo user and resume");
    }
  }

  return httpServer;
}


// import type { Express } from "express";
// import { type Server } from "http";
// import { setupAuth } from "./auth";
// import { storage } from "./storage";
// import { api } from "@shared/routes";
// import { z } from "zod";
// import bcrypt from "bcryptjs";
// import axios from "axios";

// export async function registerRoutes(
//   httpServer: Server,
//   app: Express
// ): Promise<Server> {

//   setupAuth(app);

//   // ---------------- RESUME ROUTES ----------------

//   app.get(api.resumes.list.path, async (req, res) => {
//     if (!req.isAuthenticated()) return res.sendStatus(401);
//     const user = req.user as any;
//     const resumes = await storage.getResumes(user.id);
//     res.json(resumes);
//   });

//   app.get(api.resumes.get.path, async (req, res) => {
//     if (!req.isAuthenticated()) return res.sendStatus(401);
//     const user = req.user as any;
//     const resume = await storage.getResume(Number(req.params.id));
//     if (!resume) return res.sendStatus(404);
//     if (resume.userId !== user.id) return res.sendStatus(403);
//     res.json(resume);
//   });

//   app.post(api.resumes.create.path, async (req, res) => {
//     if (!req.isAuthenticated()) return res.sendStatus(401);
//     const user = req.user as any;

//     try {
//       const input = api.resumes.create.input.parse(req.body);
//       const resume = await storage.createResume({ ...input, userId: user.id });
//       res.status(201).json(resume);
//     } catch (err) {
//       if (err instanceof z.ZodError) {
//         res.status(400).json({ message: err.errors[0].message });
//       } else {
//         res.sendStatus(500);
//       }
//     }
//   });

//   app.put(api.resumes.update.path, async (req, res) => {
//     if (!req.isAuthenticated()) return res.sendStatus(401);
//     const user = req.user as any;
//     const id = Number(req.params.id);

//     const existing = await storage.getResume(id);
//     if (!existing) return res.sendStatus(404);
//     if (existing.userId !== user.id) return res.sendStatus(403);

//     try {
//       const input = api.resumes.update.input.parse(req.body);
//       const updated = await storage.updateResume(id, input);
//       res.json(updated);
//     } catch (err) {
//       if (err instanceof z.ZodError) {
//         res.status(400).json({ message: err.errors[0].message });
//       } else {
//         res.sendStatus(500);
//       }
//     }
//   });

//   app.delete(api.resumes.delete.path, async (req, res) => {
//     if (!req.isAuthenticated()) return res.sendStatus(401);
//     const user = req.user as any;
//     const id = Number(req.params.id);

//     const existing = await storage.getResume(id);
//     if (!existing) return res.sendStatus(404);
//     if (existing.userId !== user.id) return res.sendStatus(403);

//     await storage.deleteResume(id);
//     res.sendStatus(204);
//   });

//   // ---------------- AI GENERATION (HUGGING FACE) ----------------

//   app.post(api.ai.generateResume.path, async (req, res) => {
//     if (!req.isAuthenticated()) return res.sendStatus(401);

//     try {
//       const {
//         jobRole,
//         experienceLevel,
//         skills,
//         currentEducation,
//         projectsContext
//       } = api.ai.generateResume.input.parse(req.body);

//       const prompt = `
// You are an expert resume writer.
// Return ONLY valid JSON. No markdown. No explanation.

// JSON format:
// {
//   "personalInfo": {
//     "fullName": "Full Name",
//     "email": "email@example.com",
//     "phone": "Phone",
//     "bio": "Professional Bio",
//     "location": "City, Country"
//   },
//   "experience": [
//     {
//       "role": "Job Title",
//       "company": "Company Name",
//       "startDate": "YYYY-MM",
//       "endDate": "YYYY-MM or Present",
//       "description": "• Point 1\\n• Point 2"
//     }
//   ],
//   "education": [
//     {
//       "degree": "Degree",
//       "school": "University",
//       "startDate": "YYYY-MM",
//       "endDate": "YYYY-MM"
//     }
//   ],
//   "skills": [],
//   "projects": [
//     {
//       "name": "Project Name",
//       "description": "Description",
//       "link": "https://...",
//       "techStack": []
//     }
//   ]
// }

// Job Role: ${jobRole}
// Experience Level: ${experienceLevel}
// Skills: ${skills || "Relevant skills"}
// Education: ${currentEducation || "Relevant education"}
// Projects: ${projectsContext || "Relevant projects"}
// `;

//       const hfResponse = await axios.post(
//         "https://router.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
//         {
//           inputs: prompt,
//           parameters: {
//             max_new_tokens: 900,
//             temperature: 0.3
//           }
//         },
//         {
//           headers: {
//             Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
//             "Content-Type": "application/json"
//           }
//         }
//       );

//       const rawText = hfResponse.data?.[0]?.generated_text || "{}";

//       const start = rawText.indexOf("{");
//       const end = rawText.lastIndexOf("}");
//       const jsonText = rawText.substring(start, end + 1);

//       const resumeJson = JSON.parse(jsonText);

//       res.json(resumeJson);

//     } catch (err) {
//       console.error("HuggingFace AI Error:", err);
//       res.status(500).json({ message: "AI resume generation failed" });
//     }
//   });

//   // ---------------- SEED DATA ----------------

//   if (process.env.NODE_ENV !== "production") {
//     const existingUser = await storage.getUserByUsername("demo");

//     if (!existingUser) {
//       const hashedPassword = await bcrypt.hash("demo123", 10);

//       const user = await storage.createUser({
//         username: "demo",
//         password: hashedPassword,
//         name: "Demo User"
//       });

//       await storage.createResume({
//         userId: user.id,
//         title: "Sample Resume",
//         content: {
//           personalInfo: {
//             fullName: "Demo User",
//             email: "demo@example.com",
//             phone: "+1 234 567 8900",
//             bio: "Experienced Software Engineer.",
//             location: "San Francisco, CA"
//           },
//           experience: [],
//           education: [],
//           skills: ["JavaScript", "React", "Node.js"],
//           projects: []
//         },
//         isAiGenerated: false
//       });

//       console.log("Demo user seeded");
//     }
//   }

//   return httpServer;
// }
