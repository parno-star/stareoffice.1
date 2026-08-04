"use node";

import { ConvexError, v } from "convex/values";
import OpenAI from "openai";
import { action } from "../_generated/server";
import { api } from "../_generated/api";

function getOpenAI(): OpenAI {
  return new OpenAI({
    baseURL: "https://ai-gateway.hercules.app/v1",
    apiKey: process.env.HERCULES_API_KEY,
  });
}

function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    const withoutOpen = trimmed.replace(/^```[a-zA-Z0-9]*\n?/, "");
    const withoutClose = withoutOpen.replace(/\n?```\s*$/, "");
    return withoutClose.trim();
  }
  return trimmed;
}

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const openai = getOpenAI();
  try {
    const response = await openai.chat.completions.create({
      model: "openai/gpt-5-mini",
      reasoning_effort: "minimal",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    return response.choices[0]?.message?.content ?? "";
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      throw new ConvexError({
        code: "EXTERNAL_SERVICE_ERROR",
        message: `AI Gateway: ${error.message}`,
      });
    }
    throw new ConvexError({
      code: "EXTERNAL_SERVICE_ERROR",
      message: "Gagal memanggil AI. Coba lagi.",
    });
  }
}

// ---- Outline ---------------------------------------------------------------

export type AIOutlineLesson = {
  title: string;
  summary: string;
  durationMinutes: number;
};

export type AIOutline = {
  title: string;
  description: string;
  category: string;
  level: string;
  lessons: Array<AIOutlineLesson>;
};

export const generateCourseOutline = action({
  args: {
    topic: v.string(),
    audience: v.optional(v.string()),
    lessonCount: v.optional(v.number()),
    language: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<AIOutline> => {
    await ctx.runQuery(api.users.getCurrentUser, {});

    const lessonCount = Math.min(Math.max(args.lessonCount ?? 5, 3), 10);
    const language = args.language ?? "Bahasa Indonesia";
    const audience = args.audience ?? "karyawan umum";

    const system = `Anda adalah perancang kurikulum pelatihan perusahaan yang profesional. Balas HANYA dengan JSON valid sesuai skema yang diminta. Tidak ada teks di luar JSON. Gunakan ${language}.`;
    const user = `Buat outline kelas pelatihan untuk topik: "${args.topic}". Target peserta: ${audience}. Jumlah pelajaran: ${lessonCount}.
Kembalikan JSON dengan skema:
{
  "title": string (judul kelas, singkat dan menarik),
  "description": string (2-3 kalimat tentang manfaat kelas),
  "category": salah satu dari ["onboarding","leadership","technical","soft_skills","compliance","product","other"],
  "level": salah satu dari ["beginner","intermediate","advanced"],
  "lessons": [
    { "title": string, "summary": string (1-2 kalimat), "durationMinutes": number (5-30) }
  ]
}`;

    const raw = await callAI(system, user);
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonFence(raw));
    } catch {
      throw new ConvexError({
        code: "EXTERNAL_SERVICE_ERROR",
        message: "AI mengembalikan format yang tidak valid. Coba lagi.",
      });
    }
    const VALID_CATS = [
      "onboarding",
      "leadership",
      "technical",
      "soft_skills",
      "compliance",
      "product",
      "other",
    ];
    const VALID_LEVELS = ["beginner", "intermediate", "advanced"];
    const obj = parsed as Record<string, unknown>;
    const rawLessons = Array.isArray(obj.lessons) ? obj.lessons : [];
    const lessons: Array<AIOutlineLesson> = rawLessons.map((raw) => {
      const l = raw as Record<string, unknown>;
      const dur =
        typeof l.durationMinutes === "number"
          ? Math.min(Math.max(Math.round(l.durationMinutes), 5), 60)
          : 15;
      return {
        title: typeof l.title === "string" ? l.title : "Pelajaran",
        summary: typeof l.summary === "string" ? l.summary : "",
        durationMinutes: dur,
      };
    });
    const category =
      typeof obj.category === "string" && VALID_CATS.includes(obj.category)
        ? obj.category
        : "other";
    const level =
      typeof obj.level === "string" && VALID_LEVELS.includes(obj.level)
        ? obj.level
        : "beginner";
    return {
      title: typeof obj.title === "string" ? obj.title : args.topic,
      description: typeof obj.description === "string" ? obj.description : "",
      category,
      level,
      lessons,
    };
  },
});

// ---- Lesson content --------------------------------------------------------

export const generateLessonContent = action({
  args: {
    courseTitle: v.string(),
    lessonTitle: v.string(),
    summary: v.optional(v.string()),
    language: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ content: string }> => {
    await ctx.runQuery(api.users.getCurrentUser, {});
    const language = args.language ?? "Bahasa Indonesia";

    const system = `Anda adalah pembuat materi pelatihan. Hasilkan konten pelajaran yang ringkas, terstruktur, dan mudah dipahami dalam format Markdown murni. Gunakan ${language}. Jangan sertakan judul pelajaran (akan ditambahkan terpisah). Gunakan heading level 2 atau 3, bullet, dan contoh praktis.`;
    const user = `Kelas: "${args.courseTitle}"
Judul pelajaran: "${args.lessonTitle}"
${args.summary ? `Ringkasan:
${args.summary}
` : ""}
Tulis konten pelajaran ~400-700 kata dalam Markdown. Sertakan:
- Pembukaan singkat
- 2-4 sub-topik dengan penjelasan
- Contoh / studi kasus singkat
- Rangkuman singkat di akhir (heading "## Rangkuman")`;

    const content = await callAI(system, user);
    return { content: content.trim() };
  },
});

// ---- Quiz ------------------------------------------------------------------

export type AIQuizQuestion = {
  text: string;
  options: Array<string>;
  correctIndex: number;
  explanation: string;
};

export const generateQuiz = action({
  args: {
    courseTitle: v.string(),
    context: v.string(),
    questionCount: v.optional(v.number()),
    language: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    title: string;
    description: string;
    questions: Array<AIQuizQuestion>;
  }> => {
    await ctx.runQuery(api.users.getCurrentUser, {});
    const questionCount = Math.min(Math.max(args.questionCount ?? 5, 3), 15);
    const language = args.language ?? "Bahasa Indonesia";

    const system = `Anda adalah pembuat kuis pelatihan. Hasilkan kuis pilihan ganda dalam ${language}. Balas HANYA dengan JSON valid.`;
    const user = `Kelas: "${args.courseTitle}"
Konteks / materi:
${args.context.slice(0, 6000)}

Buat ${questionCount} soal pilihan ganda (4 opsi per soal). Kembalikan JSON:
{
  "title": string,
  "description": string,
  "questions": [
    {
      "text": string,
      "options": [string, string, string, string],
      "correctIndex": number (0-3),
      "explanation": string (1-2 kalimat penjelasan jawaban benar)
    }
  ]
}`;

    const raw = await callAI(system, user);
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonFence(raw));
    } catch {
      throw new ConvexError({
        code: "EXTERNAL_SERVICE_ERROR",
        message: "AI mengembalikan format kuis yang tidak valid.",
      });
    }
    const obj = parsed as Record<string, unknown>;
    const rawQs = Array.isArray(obj.questions) ? obj.questions : [];
    const questions: Array<AIQuizQuestion> = rawQs
      .map((raw) => {
        const q = raw as Record<string, unknown>;
        const opts = Array.isArray(q.options)
          ? q.options
              .map((o) => (typeof o === "string" ? o : ""))
              .filter((o) => o.length > 0)
          : [];
        if (opts.length < 2) return null;
        const normalizedOpts = opts.slice(0, 4);
        while (normalizedOpts.length < 4) normalizedOpts.push("—");
        const idx =
          typeof q.correctIndex === "number" &&
          q.correctIndex >= 0 &&
          q.correctIndex < normalizedOpts.length
            ? q.correctIndex
            : 0;
        return {
          text: typeof q.text === "string" ? q.text : "",
          options: normalizedOpts,
          correctIndex: idx,
          explanation:
            typeof q.explanation === "string" ? q.explanation : "",
        };
      })
      .filter((x): x is AIQuizQuestion => x !== null && x.text.length > 0);

    return {
      title:
        typeof obj.title === "string" ? obj.title : `Kuis ${args.courseTitle}`,
      description:
        typeof obj.description === "string"
          ? obj.description
          : "Kuis penilaian akhir.",
      questions,
    };
  },
});

// ---- Polish description ----------------------------------------------------

export const improveCopy = action({
  args: {
    draft: v.string(),
    kind: v.string(), // "course_description" | "course_title" | "announcement"
    language: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ text: string }> => {
    await ctx.runQuery(api.users.getCurrentUser, {});
    const language = args.language ?? "Bahasa Indonesia";
    const goal =
      args.kind === "course_title"
        ? "judul kelas yang singkat, menarik, dan jelas (maksimal 8 kata)"
        : args.kind === "announcement"
          ? "pengumuman internal yang profesional, singkat, dan jelas"
          : "deskripsi kelas pelatihan yang menarik, 2-3 kalimat";
    const system = `Anda editor teks profesional. Perbaiki teks menjadi ${goal}. Balas hanya dengan hasil perbaikan, tanpa penjelasan. Gunakan ${language}.`;
    const user = args.draft;
    const text = await callAI(system, user);
    return { text: text.trim() };
  },
});
