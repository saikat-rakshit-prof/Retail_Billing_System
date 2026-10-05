<<<<<<< HEAD
# Cold Drinks POS System

Point of Sale & Inventory Management System for cold drinks store.

## Tech Stack
- Next.js 16
- React 19
- Tailwind CSS 4
- Drizzle ORM
- Neon PostgreSQL Database
- Zustand State Management

## Features
✅ Sales POS interface with cart management
✅ Inventory tracking & stock management
✅ Sales reports & analytics charts
✅ Product categories & items management
✅ PDF invoice generation
✅ Responsive mobile & desktop UI
✅ Keyboard shortcuts support

## Local Development

```bash
# Install dependencies
npm install

# Setup database and environment
cp .env.example .env
# Add your Neon database URL and OPENAI_API_KEY to .env.local

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Database Commands
```bash
npm run db:generate  # Generate new migrations
npm run db:push      # Push schema changes directly
npm run db:migrate   # Run migrations
npm run db:studio    # Open Drizzle Studio
```

## Build
```bash
npm run build
npm run start
```

## Deployment

This project is optimized for deployment on **Vercel**. Connect your GitHub repository on Vercel and add your `DATABASE_URL` environment variable.
=======
# Saikat_Enterprise
>>>>>>> 88679087104dc9461f79d2edbe804e3e5fc17088
