# Narrative Story Game - Story Chamber

An interactive narrative game where users make choices in dynamically generated stories. Features AI-powered storytelling with OpenAI GPT-4 Turbo, voice AI with ElevenLabs, and image generation with Gemini.

## Features

- **Dynamic Story Generation**: Stories generated using OpenAI GPT-4 Turbo with streaming text animations
- **Interactive Decisions**: Choose from AI-generated options or create your own decisions
- **Voice Input**: Speech-to-text using browser Web Speech API and ElevenLabs
- **Voice Narration**: Text-to-speech using ElevenLabs
- **Unsettling Chat Comments**: Random unsettling questions and comments during gameplay
- **Decision Tree Visualization**: Interactive D3.js tree showing all story paths
- **Ending Images**: AI-generated ending images using Gemini Imagen
- **Replay Functionality**: Replay from any decision point in the tree

## Setup

### Prerequisites

- Node.js 18+ and npm
- API Keys for:
  - OpenAI (GPT-4 Turbo access required)
  - ElevenLabs
  - Google Gemini (for Imagen)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory:
```env
VITE_OPENAI_API_KEY=your_openai_api_key_here
VITE_ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to the URL shown (typically `http://localhost:5173`)

## Project Structure

```
src/
├── components/          # React components
│   ├── LandingPage.tsx  # Landing page with Random/Custom buttons
│   ├── StoryView.tsx    # Main story display with doors
│   ├── Door.tsx         # Individual door component
│   ├── ChatBox.tsx      # Chat input and unsettling messages
│   └── EndingView.tsx   # Ending image and decision tree
├── services/            # API integrations
│   ├── openaiService.ts # OpenAI GPT-4 Turbo
│   ├── elevenlabsService.ts # ElevenLabs TTS/STT
│   └── geminiService.ts # Gemini Imagen
├── contexts/            # React Context
│   └── GameContext.tsx  # Global game state
├── utils/               # Utility functions
│   ├── decisionTree.ts  # Decision tree management
│   └── animations.ts    # Animation helpers
└── types/               # TypeScript types
    └── index.ts         # Type definitions
```

## Usage

1. **Start a Story**: Click "Random" for a random story or "Custom" to enter your own prompt
2. **Watch the Story**: The story streams in with fade-in animation, followed by three doors
3. **Make Decisions**: Click a door or speak/type your decision
4. **Continue the Journey**: Make more decisions as the story unfolds
5. **End the Story**: Click "End Story" at any time
6. **View Results**: See the ending image, then explore your decision tree
7. **Replay**: Click any node in the tree to replay from that point

## Technologies

- **React 18** with TypeScript
- **Vite** for build tooling
- **D3.js** for tree visualization
- **OpenAI GPT-4 Turbo** for story generation
- **ElevenLabs** for voice AI
- **Google Gemini Imagen** for image generation

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Notes

- Speech recognition requires a browser that supports Web Speech API (Chrome, Edge, Safari)
- API keys should never be committed to version control
- The app uses environment variables prefixed with `VITE_` for client-side access
- Some API features may require paid plans (GPT-4 Turbo, ElevenLabs, Gemini Imagen)

## License

MIT
