const GEMINI_MODEL = 'gemini-2.5-flash-lite';

const buildPrompt = (reportData) => {
  return [
    'You are a manufacturing analytics assistant for a production tracking application.',
    'Analyze the following production data and return ONLY valid JSON with these keys:',
    'summary, insights, bottlenecks, qualityIssues, workerPerformance, recommendations.',
    'Keep the summary concise but actionable. Use the data to make grounded observations.',
    'When referring to worker notes, mention timestamps and stage context if relevant.',
    '',
    'Data:',
    JSON.stringify(reportData, null, 2),
  ].join('\n');
};

const stripCodeFences = (text) => {
  if (!text) return text;
  return text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
};

const parseModelJson = (text) => {
  const cleaned = stripCodeFences(text);

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    }
    throw error;
  }
};

async function generateAIInsights(reportData) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      summary: 'AI analysis is not configured because GEMINI_API_KEY is missing.',
      insights: [],
      bottlenecks: [],
      qualityIssues: reportData.qualityIssues || [],
      workerPerformance: reportData.workerStats || [],
      recommendations: ['Configure GEMINI_API_KEY to enable AI-generated analytics.'],
    };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: buildPrompt(reportData) }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2000,
          responseMimeType: 'application/json',
        },
      }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini request failed (${response.status}): ${errorBody}`);
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';

  if (!text) {
    throw new Error('Gemini returned an empty response');
  }

  const parsed = parseModelJson(text);

  return {
    summary: parsed.summary || '',
    insights: Array.isArray(parsed.insights) ? parsed.insights : [],
    bottlenecks: Array.isArray(parsed.bottlenecks) ? parsed.bottlenecks : [],
    qualityIssues: reportData.qualityIssues || [],
    workerPerformance: reportData.workerStats || [],
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
  };
}

module.exports = {
  generateAIInsights,
};
