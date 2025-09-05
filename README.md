# Skill Link

A Node.js backend scaffold for building a modular API service. The repository is organized with clear folders for configuration, controllers, middleware, models, and routes, making it easy to grow into a production-ready service.

## Features

- Structured API layout: `config/`, `controllers/`, `middleware/`, `models/`, `routes/`
- Environment-based configuration via `.env`
- MongoDB connection via Mongoose
- Security middleware: Helmet, CORS, rate limiting, Mongo sanitize (no HPP)
- Structured logging with Winston and request logs
- Jest + Supertest testing scaffold
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
DATABASE_URL=mongodb://localhost:27017/skill_link
JWT_SECRET=change_me
LOG_LEVEL=debug
TRUST_PROXY=false
CORS_ORIGIN=http://localhost:3000
"@ | Out-File -Encoding utf8 .env

# 4) Start the server
npm run dev
```

If you prefer a watcher for development, you can install `nodemon` locally and run `npx nodemon server.js`.

## Usage

- After starting the server, access your API at `http://localhost:3000` (or the port set in `PORT`). Health at `/health`.
- Implement routes under `routes/` and business logic in `controllers/`.
- Add shared middleware in `middleware/` and configuration in `config/`.

### Uploading Files (Beginner Friendly)

This project now supports uploads using Multer.

- Where are files saved? They are saved into the local `uploads/` folder.
- How do I access them later? They are available at `http://localhost:3000/uploads/<filename>`.

Endpoints:

- `POST /api/uploads/image` — for images only. Field name: `image`.
- `POST /api/uploads/file` — for any file. Field name: `file`.

Examples (PowerShell):

```powershell
# Upload an image
curl -Method Post -Uri http://localhost:3000/api/uploads/image -Form @{ image = Get-Item .\path\to\photo.jpg }

# Upload any file
curl -Method Post -Uri http://localhost:3000/api/uploads/file -Form @{ file = Get-Item .\path\to\document.pdf }
```

Notes:

- Max file size is 10 MB by default.
- For images, only common types are allowed (jpg, jpeg, png, gif, webp, bmp, svg+xml).
- For production, consider using cloud storage (S3, Cloudinary, etc.).

### API Reference (Quick Copy)

Base URL: `/api`

Auth: Use `Authorization: Bearer <JWT>` for protected endpoints.

Health

- `GET /health` → `{ "status": "ok" }`

Auth

- `POST /api/auth/register`
	- Body:
		- `firstname`, `lastname`, `email`, `password` (required)
		- `accountType` ("employer" | "skilled_worker")
		- `skilledWorker` (object), `employer` (object)
	- Example:
		```json
		{
			"firstname": "Jane",
			"lastname": "Doe",
			"email": "jane@example.com",
			"password": "secret123",
			"accountType": "employer",
			"employer": { "companyName": "Acme Inc", "location": "Lagos" }
		}
		```

- `POST /api/auth/login`
	- Body: `{ "email": "...", "password": "..." }`

- `GET /api/auth/me` (auth)

- `PATCH /api/auth/profile` (auth)
	- Body: partial updates for top-level `firstname`, `lastname`, `accountType`, and nested `skilledWorker` / `employer` fields supported by the models.

- `PATCH /api/auth/profile/employer/basic` (auth, employer)
	- Body: `companyName`, `companyLogo`, `location`, `contactPreference` (either at top level or under `employer`).

- `PATCH /api/auth/profile/employer/details` (auth, employer)
	- Body: `industry`, `companySize`, `website`, `shortBio` (top-level or under `employer`).

- `PATCH /api/auth/profile/employer/trust` (auth, employer)
	- Accepts JSON or `multipart/form-data`.
	- Multipart fields:
		- `files`: one or more files
		- `labels` or `labels[]` (optional; array aligned with files)
	- JSON fallback body:
		- `{ "employer": { "verificationDocs": [{ "label": "CAC Certificate", "fileUrl": "/uploads/cac.pdf" }] } }`
	- Example (PowerShell, multipart):
		```powershell
		curl -Method Patch `
			-Uri http://localhost:3000/api/auth/profile/employer/trust `
			-Headers @{ Authorization = "Bearer <TOKEN>" } `
			-Form @{ files = Get-Item .\docs\cac.pdf; labels = "CAC Certificate" }
		```

Jobs (auth)

- `POST /api/jobs` (employer only)
	- Body:
		- `title`, `description`, `budgetRange: {min,max}` (required)
		- `timeline`, `requiredSkills` (optional)
	- Note: create response returns employer as ObjectId (not populated).

- `GET /api/jobs`
	- Returns jobs for the authenticated employer. Employer is populated with safe fields (`name`, `accountType`, `employer.companyName`, `employer.location`, `employer.website`).

- `GET /api/jobs/:id`
	- Returns a single job, employer populated with safe fields.

- `PATCH /api/jobs/:id`
	- Partial update; response has employer populated with safe fields.

- `DELETE /api/jobs/:id`

Workers (public)

- `GET /api/workers/public`
	- Query: `q`, `skills`, `location`, `minRate`, `maxRate`, `availability`, `minRating`, `page`, `limit`.

- `GET /api/workers/:id`
	- Get a single public skilled worker profile.

## Technologies Used

- Node.js
- JavaScript (CommonJS)
- npm
 - Express
 - Mongoose
 - Jest / Supertest
 - Winston

## Testing

Tests live in the `tests/` folder.

```powershell
npm test
```

## Notes

- The server connects to MongoDB at startup. Ensure `DATABASE_URL` is set and the database is reachable when running `node server.js` or `npm run dev`.
- Tests use the Express app directly and do not require a live DB for the health checks.

## Author

Ikechukwu Okwuchukwu Amaechina  
GitHub: https://github.com/Ikechukwu-Okwuchukwu-Amaechina
