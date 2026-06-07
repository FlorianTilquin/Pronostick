import json
from collections import Counter
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = Path("/Users/floriantilquin/Documents/New project 2")
MODEL_JSON = SOURCE_ROOT / "reports" / "worldcup_predictions.json"
RESULTS_CSV = SOURCE_ROOT / "data" / "raw" / "international_results.csv"
APP_STORE = ROOT / "data" / "pronostick.json"

TEAM_ALIASES = {
    "Bosnia and Herzegovina": "Bosnia and Herzegovina",
    "Cape Verde": "Cape Verde",
    "Czech Republic": "Czechia",
    "Curaçao": "Curacao",
    "Ivory Coast": "Ivory Coast",
    "South Korea": "Korea Republic",
    "Turkey": "Turkiye",
    "United States": "United States",
}


def normalize_team(name: str) -> str:
    return TEAM_ALIASES.get(name, name)


def load_matches_by_pair():
    store = json.loads(APP_STORE.read_text())
    by_pair = {}
    by_group_pair = {}
    for match in store["matches"]:
        pair = (match["home_team"], match["away_team"])
        by_pair[pair] = match
        by_group_pair[(match["group_name"], frozenset(pair))] = match
    return by_pair, by_group_pair


def parse_score(score: str) -> tuple[int, int]:
    home, away = score.split("-", 1)
    return int(home), int(away)


def generate_model_asset():
    source = json.loads(MODEL_JSON.read_text())
    by_pair, by_group_pair = load_matches_by_pair()
    matches = []
    unmatched = []

    for item in source["matches"]:
        home = normalize_team(item["home_team"])
        away = normalize_team(item["away_team"])
        match = by_pair.get((home, away))
        reverse = False
        if not match:
            match = by_group_pair.get((item["group"], frozenset((home, away))))
            reverse = bool(match and (match["home_team"], match["away_team"]) == (away, home))
        if not match:
            unmatched.append({"group": item["group"], "home_team": item["home_team"], "away_team": item["away_team"]})
            continue

        modal_home, modal_away = parse_score(item["modal_score"])
        prediction_home, prediction_away = (modal_away, modal_home) if reverse else (modal_home, modal_away)
        p_home, p_draw, p_away = item["p_home_win"], item["p_draw"], item["p_away_win"]
        xg_home, xg_away = item["expected_home_goals"], item["expected_away_goals"]
        if reverse:
            p_home, p_away = p_away, p_home
            xg_home, xg_away = xg_away, xg_home

        matches.append({
            "match_id": match["id"],
            "match_no": match["match_no"],
            "group": match["group_name"],
            "date": item["date"],
            "city": item["city"],
            "country": item["country"],
            "neutral": item["neutral"],
            "home_team": match["home_team"],
            "away_team": match["away_team"],
            "raw_home_team": item["home_team"],
            "raw_away_team": item["away_team"],
            "p_home_win": p_home,
            "p_draw": p_draw,
            "p_away_win": p_away,
            "pick": "H" if p_home >= p_draw and p_home >= p_away else "D" if p_draw >= p_away else "A",
            "pick_label": normalize_team(item["pick_label"]),
            "pick_confidence": item["pick_confidence"],
            "expected_home_goals": xg_home,
            "expected_away_goals": xg_away,
            "modal_score": f"{prediction_home}-{prediction_away}",
            "modal_score_probability": item["modal_score_probability"],
            "prediction_home_score": prediction_home,
            "prediction_away_score": prediction_away,
            "reversed_from_source": reverse,
        })

    if unmatched:
        raise RuntimeError(f"Unmatched model fixtures: {unmatched}")

    groups = []
    for group in source["groups"]:
        groups.append({
            **group,
            "team": normalize_team(group["team"]),
        })

    output = {
        "display_name": "XGBoost",
        "username": "xgboost",
        "metadata": source["metadata"],
        "matches": sorted(matches, key=lambda item: item["match_no"]),
        "groups": groups,
        "qualifiers": [
            {"group": item["group"], "rank": item["rank"], "team": normalize_team(item["team"])}
            for item in source["qualifiers"]
        ],
    }
    (ROOT / "data" / "model_xgboost.json").write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")


def generate_random_distribution():
    df = pd.read_csv(RESULTS_CSV)
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date", "home_score", "away_score", "tournament"])
    tournament = df["tournament"].astype(str)
    df = df[
        (df["date"].dt.year >= 1990)
        & (tournament != "Friendly")
        & (~tournament.str.contains("qualification", case=False, na=False))
        & (df["home_score"] >= 0)
        & (df["away_score"] >= 0)
        & (df["home_score"] <= 30)
        & (df["away_score"] <= 30)
    ].copy()
    df["home_score"] = df["home_score"].astype(int)
    df["away_score"] = df["away_score"].astype(int)

    counts = Counter(zip(df["home_score"], df["away_score"]))
    scorelines = [
        {"home": home, "away": away, "count": count}
        for (home, away), count in sorted(counts.items(), key=lambda item: (-item[1], item[0][0], item[0][1]))
    ]
    top_tournaments = df["tournament"].value_counts().head(20).to_dict()
    output = {
        "seed": 20260611,
        "simulations": 10000,
        "source": {
            "file": str(RESULTS_CSV),
            "description": "International tournament matches since 1990, excluding friendlies and qualification matches.",
            "matches": int(len(df)),
            "start": df["date"].min().date().isoformat(),
            "end": df["date"].max().date().isoformat(),
            "tournaments": int(df["tournament"].nunique()),
            "top_tournaments": top_tournaments,
        },
        "scorelines": scorelines,
    }
    (ROOT / "data" / "random_score_distribution.json").write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    generate_model_asset()
    generate_random_distribution()
