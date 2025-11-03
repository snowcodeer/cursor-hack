const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export interface StreamChunk {
  content: string;
  done: boolean;
}

export async function* generateStory(
  prompt: string,
  existingStory?: string
): AsyncGenerator<string, void, unknown> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const messages = [
    {
      role: 'system' as const,
      content: 'You are a creative storyteller. Write engaging, atmospheric narrative stories with branching paths. Keep responses very brief - aim for 1-2 sentences maximum. Be immersive and punchy. Always narrate the story in third person - never ask questions, just tell what happens.'
    },
    ...(existingStory ? [
      {
        role: 'assistant' as const,
        content: existingStory
      }
    ] : []),
    {
      role: 'user' as const,
      content: existingStory 
        ? `Continue the story from here, maintaining the same tone and style. Narrate what happens next - do not ask questions, just tell the story: ${prompt}`
        : `Start a story with this prompt. Narrate what happens - do not ask questions, just tell the story: ${prompt}`
    }
  ];

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      messages,
      stream: true,
      temperature: 0.8,
      max_tokens: 80  // Limit story segments to be very concise
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) {
    throw new Error('Failed to get response reader');
  }

  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') {
          return;
        }
        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.delta?.content || '';
          if (content) {
            yield content;
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
  }
}

export async function generateDecisions(
  storySoFar: string
): Promise<string[]> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'Generate exactly 2 compelling story decision options based on the story so far. Each should be a very short phrase (3-5 words maximum) that presents a meaningful choice. Keep it concise and punchy. Return ONLY the two options, one per line, no numbering or bullets.'
        },
        {
          role: 'user',
          content: `Based on this story:\n\n${storySoFar}\n\nGenerate 2 decision options:`
        }
      ],
      temperature: 0.9,
      max_tokens: 100
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '';
  const decisions = content
    .split('\n')
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0)
    .slice(0, 2);

  return decisions.length === 2 ? decisions : [
    'Take the path through the darkness',
    'Stay and search for another way'
  ];
}

export async function generateUnsettlingComment(
  storyContext: string,
  lastDecision?: string
): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a mysterious, unsettling voice that questions the user\'s decisions in a story game. Generate brief, creepy, or thought-provoking comments or questions. Keep them short (1-2 sentences max).'
        },
        {
          role: 'user',
          content: `The story context: ${storyContext}. ${lastDecision ? `Last decision: ${lastDecision}.` : ''} Generate an unsettling comment or question.`
        }
      ],
      temperature: 1.0,
      max_tokens: 50
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || 'Are you sure about that?';
}

export async function generateStorySummary(
  fullStory: string,
  decisions: string[]
): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'Create a brief, vivid description (2-3 sentences) of the ending scene that can be used to generate an image. Focus on visual details and atmosphere.'
        },
        {
          role: 'user',
          content: `Story: ${fullStory}\n\nDecisions made: ${decisions.join(', ')}\n\nDescribe the ending scene visually:`
        }
      ],
      temperature: 0.8,
      max_tokens: 150
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || 'A mysterious ending to an uncertain journey.';
}
