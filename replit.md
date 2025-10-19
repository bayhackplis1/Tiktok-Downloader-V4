# Overview

This is a TikTok downloader web application that allows users to download videos and audio from TikTok URLs. The application features a modern, dark-themed UI with a Matrix-style aesthetic and provides video information extraction and download capabilities using yt-dlp integration.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Framework**: Radix UI components with shadcn/ui design system
- **Styling**: Tailwind CSS with custom Matrix-style theming (green text, dark background with grid patterns)
- **State Management**: React Hook Form for form handling, TanStack React Query for server state
- **Routing**: Wouter for lightweight client-side routing
- **Form Validation**: Zod for schema validation with React Hook Form resolvers

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Development**: tsx for TypeScript execution in development
- **Build**: esbuild for production bundling
- **External Tool Integration**: yt-dlp for TikTok video processing and metadata extraction

## Database Architecture
- **ORM**: Drizzle ORM with TypeScript-first approach
- **Database**: PostgreSQL (configured for Neon serverless)
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Connection**: Connection pooling with @neondatabase/serverless

## API Design
- **Pattern**: RESTful API endpoints under `/api` prefix
- **Video Processing**: `/api/tiktok/info` for metadata extraction, `/api/tiktok/download/*` for file serving
- **Error Handling**: Structured error responses with proper HTTP status codes
- **Request Logging**: Custom middleware for API request/response logging

## Development Workflow
- **Hot Reloading**: Vite development server with HMR for frontend
- **Error Handling**: Runtime error overlay plugin for development debugging
- **Path Aliases**: Configured aliases for clean imports (@db, @/*)
- **Type Safety**: Strict TypeScript configuration across client and server

## External Dependencies

- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **yt-dlp**: Command-line tool for video information extraction and downloading from TikTok
- **Radix UI**: Headless UI component library for accessibility and functionality
- **Tailwind CSS**: Utility-first CSS framework for styling
- **TanStack React Query**: Data fetching and caching library
- **Vite**: Fast build tool and development server
- **Drizzle ORM**: TypeScript ORM for database operations