# QuickSync - Real-Time Shared Clipboard

A beautiful, modern application for sharing text in real-time across multiple clients. Built with Vite, React, and Supabase Realtime Database.

## Features

- **Create Rooms**: Generate unique 6-character room codes instantly
- **Join Rooms**: Enter a room code to connect with others
- **Real-Time Sync**: Text changes sync across all connected clients instantly
- **Live Presence**: See exactly how many users are currently connected to your room
- **Beautiful UI**: Dark mode, responsive design with Tailwind CSS
- **Zero Cost**: Runs entirely on Supabase's free tier

## Tech Stack

- **Frontend**: Vite + React + TypeScript
- **Styling**: Tailwind CSS
- **Routing**: React Router
- **Backend**: Supabase Realtime Database
- **Icons**: Lucide React

## Project Structure

```
src/
├── components/
│   └── PresenceFooter.tsx       # Live connection counter
├── pages/
│   ├── HomePage.tsx              # Create/join room interface
│   └── RoomPage.tsx              # Shared text editor
├── lib/
│   ├── supabase.ts               # Supabase client setup
│   └── setupDatabase.ts          # Database initialization helper
├── App.tsx                        # Router configuration
├── main.tsx                       # App entry point
└── index.css                      # Tailwind styles
```

## Setup Instructions

### Prerequisites

- Node.js 16+
- npm or yarn
- A Supabase project (free tier is fine)

### 1. Environment Variables

The `.env` file already contains your Supabase credentials:
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key

### 2. Database Setup

**IMPORTANT**: You must create the database tables before the app will work.

1. Open your Supabase dashboard: https://app.supabase.com
2. Select your project
3. Go to **SQL Editor** (left sidebar)
4. Copy and paste the SQL from `DATABASE_SETUP.md`
5. Click "Run" to execute

This creates:
- `rooms` table for storing room data and content
- `room_presence` table for tracking active connections
- RLS policies for public read/write access

### 3. Install Dependencies

```bash
npm install
```

### 4. Development

Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### 5. Build for Production

```bash
npm run build
```

The optimized build will be in the `dist/` folder, ready for deployment to Firebase Hosting or any static hosting service.

## How It Works

### Creating a Room

1. Click "Create New Room"
2. A unique 6-character code is generated
3. You're taken to the room page
4. Share the room code with others to collaborate

### Joining a Room

1. Enter a room code in the join field
2. Click "Join Room"
3. You'll see an error if the room doesn't exist
4. Otherwise, you're connected and can see existing content

### Real-Time Synchronization

- Type in the textarea to update the shared content
- Changes are sent to Supabase in real-time
- Other clients see updates instantly via Supabase subscriptions
- Your presence is tracked and shown as a live connection count

### Presence Tracking

- When you join a room, a presence entry is created
- The footer shows the total number of active connections
- Presence is automatically cleaned up when you leave or disconnect

## Technical Details

### Real-Time Updates

The app uses Supabase's `postgres_changes` channel to listen for:
- **Content updates**: When someone modifies the shared text
- **Presence changes**: When users join or leave

### Presence Management

- Each client gets a unique session ID on connect
- Presence entries are stored in the `room_presence` table
- They're automatically deleted on disconnect (via RLS policies)
- The presence footer queries the count in real-time

### Security

All tables have Row Level Security (RLS) enabled:
- Policies allow public read/write access (intentional for shared collaboration)
- All changes are tracked with timestamps
- Foreign key constraints prevent orphaned presence entries

## Deployment

### Firebase Hosting (Recommended for Free Tier)

```bash
npm run build
firebase deploy --only hosting
```

### Other Platforms

The `dist/` folder is ready for deployment to:
- Vercel
- Netlify
- GitHub Pages
- Any static hosting service

## Troubleshooting

### "Room not found" error

Make sure:
- The room code is correct (6 characters, uppercase letters/numbers)
- The room hasn't expired (rooms need at least one active connection to stay alive)
- Database tables are created (see Database Setup above)

### Real-time updates not working

Check:
- Supabase credentials are correct in `.env`
- Database tables exist
- RLS policies are created
- Network connection is active

### Presence count not updating

Verify:
- Network tab in browser DevTools shows successful subscriptions
- Supabase dashboard shows new entries in `room_presence` table

## Cost

This project runs on **Supabase Free Tier** and has:
- ✅ Free realtime database
- ✅ No authentication required
- ✅ Public RLS policies (intentional)
- ✅ Zero ongoing costs

## License

MIT
