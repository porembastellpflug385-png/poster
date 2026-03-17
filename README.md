<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/e8fd1591-ad4f-4398-8f8d-c0cb15261eb5

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create `.env` from [.env.example](.env.example) and set `POSTER_API_KEY`
3. Start the API server:
   `npm run dev:api`
4. In another terminal, start the frontend:
   `npm run dev`

## Deploy Notes

If you deploy on Vercel, configure either:

- `POSTER_API_KEY` and `POSTER_API_BASE_URL`
- or `OPENAI_API_KEY` and `OPENAI_BASE_URL`

After deployment, open `/api/health` to verify:

- whether the API key was detected
- which base URL is being used
- whether `/v1` was normalized correctly
