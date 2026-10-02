import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Literal, List
from fastapi.middleware.cors import CORSMiddleware

model = joblib.load('Mental_Health_Model.pkl')
top_countries = ['Other', 'India', 'USA', 'Canada', 'Australia', 'UK', 'Germany', 'Mexico', 'Turkey', 'France']

app = FastAPI(title="MindPath API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Request schema ----------
class StudentData(BaseModel):
    age                     : int   = Field(..., ge=10, le=100)
    gender                  : Literal['Male', 'Female']
    country                 : str
    academic_level          : Literal['Undergraduate', 'Graduate', 'High School']
    most_used_platform      : Literal['Facebook', 'LinkedIn', 'Instagram', 'Snapchat', 'Twitter', 'YouTube', 'TikTok', 'LINE', 'KakaoTalk', 'VKontakte', 'WhatsApp', 'WeChat']
    purpose_of_use          : Literal['Networking', 'Education', 'Entertainment', 'News']
    avg_daily_usage_hours   : float = Field(..., ge=0, le=24)
    daily_unlocks           : int   = Field(..., ge=0)
    study_hours             : float = Field(..., ge=0, le=24)
    physical_activity_hours : float = Field(..., ge=0, le=24)
    sleep_hours_per_night   : float = Field(..., ge=0, le=24)
    stress_level            : Literal['Medium', 'Low', 'Very High', 'High']


# ---------- Response schemas ----------
class PredictionResponse(BaseModel):
    predicted_mental_health_score: float   


class ExplainResponse(BaseModel):
    n_trees: int
    tree_predictions: List[float]          # one vote per tree in the forest
    mean: float                            # average of the votes (= the prediction)


# ---------- Shared helper ----------
def make_row(data: StudentData) -> pd.DataFrame:
    """Build the single-row DataFrame the trained pipeline expects."""
    country_group = data.country if data.country in top_countries else "Other"
    return pd.DataFrame([{
        'Age'                     : data.age,
        'Gender'                  : data.gender,
        'Country'                 : data.country,
        'Academic_Level'          : data.academic_level,
        'Most_Used_Platform'      : data.most_used_platform,
        'Purpose_Of_Use'          : data.purpose_of_use,
        'Avg_Daily_Usage_Hours'   : data.avg_daily_usage_hours,
        'Daily_Unlocks'           : data.daily_unlocks,
        'Study_Hours'             : data.study_hours,
        'Physical_Activity_Hours' : data.physical_activity_hours,
        'Sleep_Hours_Per_Night'   : data.sleep_hours_per_night,
        'Stress_Level'            : data.stress_level,
        'Grouped_country'         : country_group,
    }])


# ---------- Routes ----------
@app.get('/')
def greet():
    return {"message": "Welcome to MindPath"}


@app.post('/predict', response_model=PredictionResponse)
def predict(data: StudentData):
    input_row = make_row(data)
    prediction = model.predict(input_row)[0]
    return PredictionResponse(predicted_mental_health_score=round(float(prediction), 2))


@app.post('/explain', response_model=ExplainResponse)
def explain(data: StudentData):
    """Return every tree's individual prediction for the visualization page."""
    input_row = make_row(data)

    # Works for a sklearn Pipeline (preprocessing + forest) or a bare forest.
    is_pipeline = hasattr(model, "steps")
    forest = model[-1] if is_pipeline else model
    X = model[:-1].transform(input_row) if is_pipeline else input_row

    if not hasattr(forest, "estimators_"):
        raise HTTPException(status_code=400, detail="Model is not a tree ensemble.")

    votes = [float(tree.predict(X)[0]) for tree in forest.estimators_]
    return ExplainResponse(
        n_trees=len(votes),
        tree_predictions=[round(v, 2) for v in votes],
        mean=round(sum(votes) / len(votes), 2),
    )