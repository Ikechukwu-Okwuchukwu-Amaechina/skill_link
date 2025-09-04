# Skill Link

A Node.js backend scaffold for building a modular API service. The repository is organized with clear folders for configuration, controllers, middleware, models, and routes, making it easy to grow into a production-ready service.

## Features

- Structured API layout: `config/`, `controllers/`, `middleware/`, `models/`, `routes/`
- Environment-based configuration via `.env`
- Ready for RESTful endpoints and middleware-driven logic
- Simple start-up with Node.js; easy to extend with your preferred libraries

## Installation

Prerequisites:
- Node.js (LTS recommended)
- npm (bundled with Node.js)

Steps:
1. Clone the repo
2. Install dependencies
3. Create an environment file
4. Start the server

```powershell
# 1) Clone (or skip if you already have the repo)
git clone https://github.com/Ikechukwu-Okwuchukwu-Amaechina/skill_link.git
cd skill_link

# 2) Install dependencies
npm install

# 3) Create your environment file
# These are typical examples—adjust to your needs
# Save as .env in the project root
@"
PORT=3000
NODE_ENV=development
DATABASE_URL=
JWT_SECRET=
"@ | Out-File -Encoding utf8 .env

# 4) Start the server
node server.js
```

If you prefer a watcher for development, you can install `nodemon` locally and run `npx nodemon server.js`.

## Usage

- After starting the server, access your API at `http://localhost:3000` (or the port set in `PORT`).
- Implement routes under `routes/` and business logic in `controllers/`.
- Add shared middleware in `middleware/` and configuration in `config/`.

## Technologies Used

- Node.js
- JavaScript (CommonJS)
- npm

## Author

Ikechukwu Okwuchukwu Amaechina  
GitHub: https://github.com/Ikechukwu-Okwuchukwu-Amaechina
