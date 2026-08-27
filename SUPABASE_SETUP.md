# Hambin ERP - Supabase Integration Guide

## Overview

This project has been configured to work with **Supabase** as the backend database instead of MySQL/PHP. The PHP API files have been removed and replaced with a Supabase client configuration.

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be provisioned
3. Go to **Project Settings** → **API** to get your credentials

### 2. Configure Environment Variables

Copy the `.env.example` file to `.env`:

```bash
cp .env.example .env
```

Then edit `.env` and add your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Set Up the Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Copy the contents of `database/supabase_schema.sql`
3. Paste and run the SQL script in the editor
4. This will create all necessary tables, types, indexes, and RLS policies

### 4. Install Dependencies

```bash
npm install
```

The `@supabase/supabase-js` package is already included in `package.json`.

### 5. Run the Development Server

```bash
npm run dev
```

## Removed Files

The following unnecessary PHP/MySQL files have been removed:

- `public/api/` - All PHP API endpoints
- `db_test.php` - PHP database test file
- `install.php` - PHP installation script
- `start-dev.bat` - Windows batch file for PHP development
- `public/start.bat` - Another Windows batch file
- `database/db_test.php` - Duplicate test file

## Next Steps

The current codebase uses an in-memory store (`src/lib/store.tsx`) with localStorage persistence. To fully integrate with Supabase:

1. **Update the store** to use Supabase queries instead of localStorage
2. **Implement authentication** using Supabase Auth
3. **Add real-time subscriptions** for live updates
4. **Configure Row Level Security (RLS)** policies for your specific needs

## File Structure

```
/workspace
├── .env.example          # Environment variables template
├── .gitignore           # Updated git ignore rules
├── database/
│   ├── 01_schema.sql    # Original MySQL schema (reference)
│   ├── 02_seed.sql      # Original seed data (reference)
│   └── supabase_schema.sql  # New PostgreSQL schema for Supabase
├── src/
│   ├── lib/
│   │   ├── supabase.ts  # Supabase client configuration
│   │   ├── store.tsx    # State management (needs Supabase integration)
│   │   └── ...
│   └── ...
└── ...
```

## Documentation

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
