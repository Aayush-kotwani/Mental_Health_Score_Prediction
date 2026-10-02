# MindPath — Mental Health Score Prediction

A full-stack machine learning application that predicts a student's **mental health score** from their social media habits, lifestyle and stress level. A trained scikit-learn pipeline is served through a **FastAPI** backend and consumed by a calm, editorial-style **HTML/CSS/vanilla JavaScript** frontend. The backend is deployed on **Render**.

> **Live demo:** [MindPath](https://mental-health-score-prediction-frontend-wgpv.onrender.com)
> **API docs (Swagger):** `https://mental-health-score-prediction-u5t3.onrender.com/docs`
> **Status:** Deployed on Render ✅ (free tier — the first request after inactivity may take 30–60 seconds while the service wakes up)

> ⚠️ **Disclaimer:** This project is for informational and educational purposes only. It is **not** a medical device and does not provide a diagnosis. If you are concerned about your wellbeing, please speak to a qualified health professional.

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Dataset](#dataset)
6. [Model Training](#model-training)
7. [Backend API](#backend-api)
8. [Frontend](#frontend)
9. [Run Locally](#run-locally)
10. [Deployment on Render](#deployment-on-render)
11. [Limitations & Ethical Notes](#limitations--ethical-notes)
12. [Future Improvements](#future-improvements)
13. [Author](#author)

---

## Overview

The project answers one question: *given a student's demographics, social media usage and daily routine, what mental health score would a model predict?*

The workflow end to end:

```
User fills form  →  Frontend validates  →  POST /predict (JSON)
      →  FastAPI + Pydantic validation  →  Feature engineering
      →  Trained ML pipeline (.pkl)  →  Score (float)  →  Animated result
                                    ↘  POST /explain  →  Per-tree votes  →  Forest visualization
```

## Features

- **Regression model** serialized with `joblib` and loaded once at server start-up.
- **FastAPI backend** with strict request validation (Pydantic) and a typed response model.
- **Interactive API docs** auto-generated at `/docs` and `/redoc`.
- **Random forest visualization:** an animated "under the hood" view shows your answers going in, every tree casting its own vote, and the votes being averaged into the final score. It uses the real per-tree predictions from the trained model.
- **Polished frontend** with no frameworks: semantic HTML, accessible form controls, inline validation, loading state and an animated circular score.
- **Responsive and accessible:** keyboard friendly, `aria-invalid` / `aria-describedby`, reduced-motion support.
- **Privacy-minded:** no analytics, no tracking, and answers are never stored in the browser.

## Tech Stack

| Layer | Technology |
|---|---|
| Language | Python 3, JavaScript (ES2020) |
| ML / Data | pandas, NumPy, scikit-learn, joblib |
| Backend | FastAPI, Pydantic, Uvicorn |
| Frontend | HTML5, CSS3, Vanilla JS |
| Deployment | Render |

## Project Structure

```
Mental_Health_Score_Prediction/
├── Dataset/                  # Raw training data
├── Notebook/                 # EDA, preprocessing and model training
├── Mental_Health_Model.pkl   # Trained pipeline (preprocessing + model)
├── main.py                   # FastAPI application
├── index.html                # Frontend markup
├── style.css                 # Frontend styling
├── script.js                 # Validation, API calls, result rendering
├── forest.js                 # Random forest visualization
├── requirements.txt          # Python dependencies
└── README.md
```

## Dataset

The data lives in the `Dataset/` folder. Each row describes one student.

| Column | Type | Description |
|---|---|---|
| `Age` | int | Age in years |
| `Gender` | categorical | Male / Female |
| `Country` | categorical | Country of residence |
| `Academic_Level` | categorical | High School / Undergraduate / Graduate |
| `Most_Used_Platform` | categorical | Platform used most (Instagram, TikTok, YouTube, …) |
| `Purpose_Of_Use` | categorical | Networking / Education / Entertainment / News |
| `Avg_Daily_Usage_Hours` | float | Average daily social media time |
| `Daily_Unlocks` | int | Phone unlocks per day |
| `Study_Hours` | float | Study hours per day |
| `Physical_Activity_Hours` | float | Physical activity hours per day |
| `Sleep_Hours_Per_Night` | float | Sleep hours per night |
| `Stress_Level` | categorical | Low / Medium / High / Very High |
| `Mental_Health_Score` | float | **Target** the model predicts |

<!-- TODO: add dataset source/link, number of rows, and the meaning/range of Mental_Health_Score (e.g. higher = better). -->

## Model Training

All training work is in the [`Notebook/`](Notebook) folder. The steps below describe the pipeline; fill in the highlighted details from your notebook.

### 1. Problem framing
Supervised **regression**: predict the continuous `Mental_Health_Score` from the 12 input features above.

### 2. Exploratory data analysis
- Inspected shape, data types, missing values and duplicates.
- Examined distributions and relationships between usage hours, sleep, stress and the target.
- Reviewed category frequencies, especially `Country`, which has many rare values.

### 3. Feature engineering
A `Grouped_country` feature is created to tame the high cardinality of `Country`. Only the most frequent countries are kept; the rest become `"Other"`:

```
India, USA, Canada, Australia, UK, Germany, Mexico, Turkey, France  →  kept
everything else                                                    →  "Other"
```

The same logic runs again inside the API at inference time, so training and serving stay consistent.

### 4. Preprocessing
- Categorical columns are encoded and numeric columns are scaled/passed through inside a single scikit-learn pipeline.
- Preprocessing and the estimator are saved **together**, so the API never has to reproduce transformations by hand.

<!-- TODO: state exactly which encoders/scalers you used (e.g. OneHotEncoder, OrdinalEncoder, StandardScaler) and which columns each applies to. -->

### 5. Model selection and tuning
<!-- TODO: list the algorithms you compared (e.g. Linear Regression, Random Forest, Gradient Boosting, XGBoost), the train/test split and any cross-validation or hyperparameter search. -->

### 6. Evaluation

| Metric | Value |
|---|---|
| R² | `TODO` |
| MAE | `TODO` |
| RMSE | `TODO` |

### 7. Serialization
The fitted pipeline is exported with `joblib`:

```python
import joblib
joblib.dump(pipeline, "Mental_Health_Model.pkl")
```

> **Important:** the scikit-learn version used to train the model must match the version installed when the API runs. Pin it in `requirements.txt` (see [Deployment](#deployment-on-render)).

## Backend API

**Base URL (local):** `http://127.0.0.1:8000`  
**Base URL (production):** `https://your-service-name.onrender.com`

### Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Health / welcome message |
| `POST` | `/predict` | Returns the predicted mental health score |
| `POST` | `/explain` | Returns every tree's individual prediction (powers the forest visualization) |
| `GET` | `/docs` | Swagger UI |

### Request body — `POST /predict`

| Field | Type | Constraints |
|---|---|---|
| `age` | integer | 10 – 100 |
| `gender` | string | `Male`, `Female` |
| `country` | string | Any country name |
| `academic_level` | string | `Undergraduate`, `Graduate`, `High School` |
| `most_used_platform` | string | `Facebook`, `LinkedIn`, `Instagram`, `Snapchat`, `Twitter`, `YouTube`, `TikTok`, `LINE`, `KakaoTalk`, `VKontakte`, `WhatsApp`, `WeChat` |
| `purpose_of_use` | string | `Networking`, `Education`, `Entertainment`, `News` |
| `avg_daily_usage_hours` | float | 0 – 24 |
| `daily_unlocks` | integer | ≥ 0 |
| `study_hours` | float | 0 – 24 |
| `physical_activity_hours` | float | 0 – 24 |
| `sleep_hours_per_night` | float | 0 – 24 |
| `stress_level` | string | `Low`, `Medium`, `High`, `Very High` |

**Example**

```bash
curl -X POST "http://127.0.0.1:8000/predict" \
  -H "Content-Type: application/json" \
  -d '{
    "age": 21,
    "gender": "Female",
    "country": "India",
    "academic_level": "Undergraduate",
    "most_used_platform": "Instagram",
    "purpose_of_use": "Entertainment",
    "avg_daily_usage_hours": 4.5,
    "daily_unlocks": 80,
    "study_hours": 5,
    "physical_activity_hours": 1,
    "sleep_hours_per_night": 6.5,
    "stress_level": "Medium"
  }'
```

### Response

```json
{ "predicted_mental_health_score": 6.78 }
```

The score is rounded to two decimals.

### `POST /explain`

Takes the **same request body** as `/predict` and returns one prediction per tree in the random forest:

```json
{
  "n_trees": 100,
  "tree_predictions": [6.5, 7.1, 6.9, 6.4, "…"],
  "mean": 6.78
}
```

`mean` is the average of all tree votes and matches the `/predict` score. The endpoint works whether the saved model is a scikit-learn `Pipeline` ending in a forest or a bare forest, and returns `400` if the model is not a tree ensemble.

### Error responses

| Status | Meaning |
|---|---|
| `422 Unprocessable Entity` | A field is missing, out of range or not an allowed value. The body lists each problem. |
| `500 Internal Server Error` | The model could not process the input (for example, an unseen category). |

### CORS
The API enables `CORSMiddleware` so the browser frontend can call it from a different origin. `allow_origins=["*"]` is convenient for development; for production, restrict it to your frontend's domain.

## Frontend

The UI is plain HTML, CSS and JavaScript, designed as a calm, editorial wellness product (warm cream palette, serif headings, muted teal accent).

- **Schema-driven form:** the 12 fields in `script.js` mirror the Pydantic model exactly; only these keys are sent to the API.
- **Client-side validation** matching Pydantic constraints, with inline messages (no `alert()` dialogs).
- **Progress indicator** that updates as questions are answered.
- **Animated SVG score ring** that fills from 0 to the returned score.
- **Random forest visualization** (`forest.js`) in three stages: your inputs, a vote from each tree (shaded by value), and a histogram of all votes with the average marked. It replays on demand and respects reduced-motion settings. If `/explain` is unavailable, a short note is shown and the main result is unaffected.
- **Header link** to this GitHub repository.
- **Friendly error handling** for network failures, validation errors (422) and server errors (5xx).
- **Configuration in one place** — edit the `CONFIG` object at the top of `script.js`:

```js
const CONFIG = {
  BRAND: "MindPath",
  API_BASE_URL: "http://127.0.0.1:8000",   // ← use your Render URL for the deployed version
  PREDICT_ENDPOINT: "/predict",
  SCORE_MAX: 10,                            // ← set to your model's score scale
  SCORE_DECIMALS: 2,
};
```

## Run Locally

**Prerequisites:** Python 3.10+ and Git.

```bash
# 1. Clone
git clone https://github.com/Aayush-kotwani/Mental_Health_Score_Prediction.git
cd Mental_Health_Score_Prediction

# 2. Create and activate a virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS / Linux

# 3. Install dependencies
pip install -r requirements.txt

# 4. Start the API
uvicorn main:app --reload
```

The API runs at `http://127.0.0.1:8000` (docs at `/docs`).

Then open `index.html` in your browser (or use the VS Code *Live Server* extension), fill in the form and click **Analyze My Responses**.

## Deployment on Render

The FastAPI backend is deployed as a **Web Service** on [Render](https://render.com) and is live at the link at the top of this README.

### Steps to reproduce the deployment

1. Push the repository to GitHub.
2. In Render, choose **New → Web Service** and connect the repository.
3. Configure the service:

   | Setting | Value |
   |---|---|
   | Runtime | Python 3 |
   | Build Command | `pip install -r requirements.txt` |
   | Start Command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
   | Branch | `main` |

4. (Recommended) Add an environment variable `PYTHON_VERSION` matching your local version, and pin `scikit-learn`, `pandas`, `numpy` and `joblib` in `requirements.txt` to the versions used for training. Mismatched versions are the most common cause of model-loading errors.
5. Click **Create Web Service**. Render builds the project and gives you a public URL. Visit `/docs` on that URL to confirm `/predict` and `/explain` work.
6. Open `script.js` and set `API_BASE_URL` to that URL:

   ```js
   API_BASE_URL: "https://your-service-name.onrender.com",
   ```

7. Host the frontend (`index.html`, `style.css`, `script.js`) as a Render **Static Site**, GitHub Pages or any static host, and tighten the CORS `allow_origins` list to that domain.

### Notes
- On Render's free tier the service sleeps after inactivity, so the **first request can take 30–60 seconds** while it wakes up.
- Render deploys automatically on every push to the connected branch.
- Check **Logs** in the Render dashboard if a deploy fails; the cause is usually a missing dependency or a version mismatch.

## Limitations & Ethical Notes

- The model reflects patterns in a limited survey dataset and may not generalise to every population.
- Predictions depend only on the 12 inputs; they cannot capture personal history, medical conditions or context.
- The output is a statistical estimate, **not a clinical measurement or diagnosis.**
- Countries not seen during training may produce errors or less reliable predictions.
- Do not use this tool to make decisions about a person's health, education or employment.

## Future Improvements

- Show per-feature explanations (e.g. SHAP) alongside the score.
- Extend the forest view with a single-tree walkthrough showing the actual splits an input follows.
- Add automated tests for the API and a CI workflow.
- Containerise with Docker.
- Restrict CORS and add rate limiting for production.
- Add confidence/prediction intervals.

## Author

**Aayush Kotwani**  
GitHub: [@Aayush-kotwani](https://github.com/Aayush-kotwani)

---

<sub>Built for learning and exploration. Not a substitute for professional mental health care.</sub>
