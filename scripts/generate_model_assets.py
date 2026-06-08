import json
from collections import Counter
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = Path("/Users/floriantilquin/Documents/New project 2")
MODEL_JSON = SOURCE_ROOT / "reports" / "worldcup_predictions.json"
RESULTS_CSV = SOURCE_ROOT / "data" / "raw" / "international_results.csv"
ODDS_CSVS = [
    SOURCE_ROOT / "data" / "raw" / "world_cup_odds.csv",
    SOURCE_ROOT / "data" / "raw" / "world_cup_odds_bmbets.csv",
]
APP_STORE = ROOT / "data" / "pronostick.json"

TEAM_ALIASES = {
    "Bosnia and Herzegovina": "Bosnia and Herzegovina",
    "Cape Verde": "Cape Verde",
    "Czech Republic": "Czechia",
    "Curaçao": "Curacao",
    "Ivory Coast": "Ivory Coast",
    "South Korea": "Korea Republic",
    "DR Congo": "DR Congo",
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


def generate_bookmaker_odds():
    by_pair, by_group_pair = load_matches_by_pair()
    rows = []
    for csv_path in ODDS_CSVS:
        if not csv_path.exists():
            continue
        df = pd.read_csv(csv_path)
        df["source_file"] = csv_path.name
        rows.append(df)

    if not rows:
        raise RuntimeError(f"No bookmaker odds files found: {ODDS_CSVS}")

    df = pd.concat(rows, ignore_index=True)
    df = df.dropna(subset=["home_team", "away_team", "home_odds", "draw_odds", "away_odds"])

    grouped = {}
    unmatched = []
    for item in df.to_dict("records"):
        home = normalize_team(str(item["home_team"]))
        away = normalize_team(str(item["away_team"]))
        match = by_pair.get((home, away))
        reverse = False
        if not match:
            match = next((candidate for pair, candidate in by_pair.items() if frozenset(pair) == frozenset((home, away))), None)
            reverse = bool(match and (match["home_team"], match["away_team"]) == (away, home))
        if not match:
            unmatched.append({"home_team": item["home_team"], "away_team": item["away_team"]})
            continue

        home_odds = float(item["away_odds"] if reverse else item["home_odds"])
        away_odds = float(item["home_odds"] if reverse else item["away_odds"])
        draw_odds = float(item["draw_odds"])
        home_prob = float(item["away_implied_prob"] if reverse else item["home_implied_prob"])
        away_prob = float(item["home_implied_prob"] if reverse else item["away_implied_prob"])
        draw_prob = float(item["draw_implied_prob"])

        grouped.setdefault(match["id"], {
            "match_id": match["id"],
            "match_no": match["match_no"],
            "home_team": match["home_team"],
            "away_team": match["away_team"],
            "samples": [],
        })["samples"].append({
            "home_odds": home_odds,
            "draw_odds": draw_odds,
            "away_odds": away_odds,
            "home_implied_prob": home_prob,
            "draw_implied_prob": draw_prob,
            "away_implied_prob": away_prob,
            "bookmaker_count": int(item.get("bookmaker_count") or 0),
            "source": str(item.get("source") or ""),
            "source_file": str(item.get("source_file") or ""),
            "fetched_at": str(item.get("fetched_at") or ""),
        })

    if unmatched:
        raise RuntimeError(f"Unmatched bookmaker fixtures: {unmatched}")

    output_matches = []
    for match_id, item in sorted(grouped.items(), key=lambda entry: entry[1]["match_no"]):
        samples = item.pop("samples")
        output_matches.append({
            **item,
            "home_odds": sum(sample["home_odds"] for sample in samples) / len(samples),
            "draw_odds": sum(sample["draw_odds"] for sample in samples) / len(samples),
            "away_odds": sum(sample["away_odds"] for sample in samples) / len(samples),
            "home_implied_prob": sum(sample["home_implied_prob"] for sample in samples) / len(samples),
            "draw_implied_prob": sum(sample["draw_implied_prob"] for sample in samples) / len(samples),
            "away_implied_prob": sum(sample["away_implied_prob"] for sample in samples) / len(samples),
            "samples": len(samples),
            "bookmaker_count_avg": sum(sample["bookmaker_count"] for sample in samples) / len(samples),
            "sources": sorted({sample["source"] for sample in samples if sample["source"]}),
            "source_files": sorted({sample["source_file"] for sample in samples if sample["source_file"]}),
            "fetched_at": max(sample["fetched_at"] for sample in samples if sample["fetched_at"]),
        })

    if len(output_matches) != len(by_pair):
        missing = sorted(set(match["id"] for match in by_pair.values()) - set(item["match_id"] for item in output_matches))
        raise RuntimeError(f"Bookmaker odds cover {len(output_matches)} fixtures, expected {len(by_pair)}. Missing ids: {missing}")

    output = {
        "generated_on": max(item["fetched_at"] for item in output_matches if item["fetched_at"]),
        "description": "Average 1N2 odds for World Cup group-stage fixtures, aligned to Pronostick match order.",
        "matches": output_matches,
    }
    (ROOT / "data" / "bookmaker_odds.json").write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    generate_model_asset()
    generate_random_distribution()
    generate_bookmaker_odds()
