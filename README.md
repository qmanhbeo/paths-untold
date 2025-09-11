# AI-Generated Interactive Story (Beta)

An experimental React app where stories unfold dynamically with the help of large language models (LLMs).

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/qmanhbeo/AI-generated-interactive-story-beta.git
cd AI-generated-interactive-story-beta
```

### 2. Add your API key

Open `src/utils/AI-chat.js` and go to **line 13**.
Replace the placeholder:

```js
'Authorization': `Bearer [API key]`
```

with your own key from any supported LLM provider (e.g. **OpenAI**, **Gemini**, etc.).

---

### 3. Install dependencies

```bash
npm install
```

---

### 4. Run the development server

```bash
npm start
```

When it’s ready, the app will be available at:

* **Local:** [http://localhost:3000](http://localhost:3000)
* **On Your Network:** `http://<your-local-ip>:3000` (e.g., `http://192.168.1.10:3000`)

---

## 🛠 Tech Stack

* **React + react-scripts** (Create React App)
* **Tailwind CSS v3** (with scrollbar plugin)
* **Axios** for API requests

---

## 📌 Notes

* Make sure you have Node.js and npm installed.
* For reproducible installs, run `npm ci` instead of `npm install`.
* This project is still in beta — expect dragons 🐉.



## Project Overview
A narrative-driven AI storytelling game with dynamic memory and player choices...

## Folder Structure
- `/components`: React components like GameScreen, StartScreen
- `/utils`: All logic functions (prompt building, memory, character extraction)
- `/images`: UI assets

## Game Flow
1. Player selects story settings
2. Prompt is generated based on input
3. Story is built scene-by-scene based on choices...

## AI Usage
- OpenAI API used for story generation, summary, character memory...
