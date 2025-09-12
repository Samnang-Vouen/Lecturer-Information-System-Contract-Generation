# Lecturer Information System - Contract Generation

A full-stack web application for managing lecturer information, course assignments, and contract generation.

## Project Structure

```
Lecturer-Information-System-Contract-Generation/
│
├── client-side/      # Frontend (React + Vite)
│   ├── src/          # Source code (components, hooks, pages, store, etc.)
│   ├── public/       # Static assets
│   ├── package.json  # Frontend dependencies and scripts
│   └── ...           # Config files (Vite, Tailwind, ESLint)
│
├── server-side/      # Backend (Node.js + Express)
│   ├── src/          # Source code (controllers, models, routes, config)
│   ├── package.json  # Backend dependencies and scripts
│   └── ...           # Middleware, uploads, utils
│
├── LICENSE
└── README.md
```

## Features

- Lecturer management (profiles, research fields, universities)
- Course and class assignment
- User authentication and role-based access
- Contract generation and digital signatures
- Admin and lecturer dashboards

## Tech Stack

- **Frontend:** React, Vite, Tailwind CSS, MUI, Zustand, Axios, DaisyUI
- **Backend:** Node.js, Express, Sequelize, MySQL, JWT, Multer, Swagger UI
- **Other:** ESLint, PostCSS, ExcelJS, XLSX

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- MySQL server

### Installation

1. **Clone the repository:**
	 ```sh
	 git clone https://github.com/Samnang-Vouen/Lecturer-Information-System-Contract-Generation.git
	 cd Lecturer-Information-System-Contract-Generation
	 ```

2. **Install dependencies:**
	 - Frontend:
		 ```sh
		 cd client-side
		 npm install
		 ```
	 - Backend:
		 ```sh
		 cd ../server-side
		 npm install
		 ```

3. **Configure environment variables:**
	 - Create a `.env` file in `server-side/` with your database and JWT settings.

4. **Run the development servers:**
	 - Frontend:
		 ```sh
		 npm run dev
		 ```
	 - Backend:
		 ```sh
		 npm run dev
		 ```

## Usage

- Access the frontend at `http://localhost:5173` (default Vite port).
- Backend API runs at `http://localhost:3000` (default Express port).

## License

This project is licensed under the MIT License.