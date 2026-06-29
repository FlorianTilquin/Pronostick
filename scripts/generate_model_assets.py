import json
from collections import Counter
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = Path("/Users/floriantilquin/Documents/New project 2")
MODEL_JSON = SOURCE_ROOT / "reports" / "worldcup_predictions.json"
KNOCKOUT_MODEL_JSON = SOURCE_ROOT / "reports" / "worldcup_2026_round_of_32_120min_predictions.json"
RESULTS_CSV = SOURCE_ROOT / "data" / "raw" / "international_results.csv"
ODDS_CSVS = [
    SOURCE_ROOT / "data" / "raw" / "world_cup_odds.csv",
    SOURCE_ROOT / "data" / "raw" / "world_cup_odds_bmbets.csv",
]
KNOCKOUT_ODDS_CSV = SOURCE_ROOT / "data" / "raw" / "world_cup_2026_round_of_32_odds_1x2_90min.csv"
APP_STORE = ROOT / "data" / "pronostick.json"

ROUND_OF_32_MATCH_IDS = {
    ("South Africa", "Canada"): 73,
    ("Germany", "Paraguay"): 74,
    ("Netherlands", "Morocco"): 75,
    ("Brazil", "Japan"): 76,
    ("France", "Sweden"): 77,
    ("Ivory Coast", "Norway"): 78,
    ("Mexico", "Ecuador"): 79,
    ("England", "DR Congo"): 80,
    ("United States", "Bosnia and Herzegovina"): 81,
    ("Belgium", "Senegal"): 82,
    ("Portugal", "Croatia"): 83,
    ("Spain", "Austria"): 84,
    ("Switzerland", "Algeria"): 85,
    ("Argentina", "Cape Verde"): 86,
    ("Colombia", "Ghana"): 87,
    ("Australia", "Egypt"): 88,
}

ROUND_OF_32_MODEL_OVERRIDES = {
    ("South Africa", "Canada"): {
        "date": "2026-06-28",
        "p_home_win": 0.1592183203784048,
        "p_draw": 0.2216850732894652,
        "p_away_win": 0.61909660633213,
        "expected_home_goals": 0.8890204381742355,
        "expected_away_goals": 1.9452635251490669,
        "modal_score": "0-1",
        "modal_score_probability": 0.11400055213841875,
        "source": "manual_model_reconstruction",
    }
}

ROUND_OF_32_BOOKMAKER_PROXY_MARKETS = {
    ("South Africa", "Canada"): {
        "home_implied_prob": 0.1592183203784048,
        "draw_implied_prob": 0.2216850732894652,
        "away_implied_prob": 0.61909660633213,
        "source": "manual_model_proxy_no_prematch_books",
        "fetched_at": "2026-06-29T12:00:21.859473+02:00",
    }
}

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
        if (match.get("stage") or "group") != "group":
            continue
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

    metadata = dict(source["metadata"])
    if KNOCKOUT_MODEL_JSON.exists():
        knockout = json.loads(KNOCKOUT_MODEL_JSON.read_text())
        metadata["generated_on"] = max(
            str(metadata.get("generated_on") or ""),
            str(knockout.get("metadata", {}).get("generated_on") or ""),
        )
        metadata["knockout_metadata"] = knockout.get("metadata", {})
        knockout_unmatched = []
        for item in knockout["predictions"]:
            if item.get("prediction_status") != "predicted":
                continue
            home = normalize_team(item["home_team"])
            away = normalize_team(item["away_team"])
            match_id = ROUND_OF_32_MATCH_IDS.get((home, away))
            reverse = False
            if match_id is None:
                match_id = ROUND_OF_32_MATCH_IDS.get((away, home))
                reverse = match_id is not None
            if match_id is None:
                knockout_unmatched.append({"home_team": item["home_team"], "away_team": item["away_team"]})
                continue

            prediction_home, prediction_away = parse_score(item["predicted_score_120"])
            if reverse:
                prediction_home, prediction_away = prediction_away, prediction_home
                p_home, p_draw, p_away = item["p_away_120"], item["p_draw_120"], item["p_home_120"]
                xg_home, xg_away = item["expected_away_goals_120"], item["expected_home_goals_120"]
            else:
                p_home, p_draw, p_away = item["p_home_120"], item["p_draw_120"], item["p_away_120"]
                xg_home, xg_away = item["expected_home_goals_120"], item["expected_away_goals_120"]

            matches.append({
                "match_id": match_id,
                "match_no": match_id,
                "group": "1/16e de finale",
                "date": item["date"],
                "city": "",
                "country": "",
                "neutral": True,
                "home_team": home if not reverse else away,
                "away_team": away if not reverse else home,
                "raw_home_team": item["home_team"],
                "raw_away_team": item["away_team"],
                "p_home_win": p_home,
                "p_draw": p_draw,
                "p_away_win": p_away,
                "pick": "H" if p_home >= p_draw and p_home >= p_away else "D" if p_draw >= p_away else "A",
                "pick_label": normalize_team(item["pick_label_120"]),
                "pick_confidence": max(p_home, p_draw, p_away),
                "expected_home_goals": xg_home,
                "expected_away_goals": xg_away,
                "modal_score": f"{prediction_home}-{prediction_away}",
                "modal_score_probability": item["predicted_score_120_probability"],
                "prediction_home_score": prediction_home,
                "prediction_away_score": prediction_away,
                "target": "score_after_120_minutes_before_penalties",
                "market_type": item.get("market_type"),
                "bookmaker_count": item.get("bookmaker_count", 0),
                "event_url": item.get("event_url", ""),
                "reversed_from_source": reverse,
            })
        if knockout_unmatched:
            raise RuntimeError(f"Unmatched knockout model fixtures: {knockout_unmatched}")

    for (home, away), item in ROUND_OF_32_MODEL_OVERRIDES.items():
        match_id = ROUND_OF_32_MATCH_IDS[(home, away)]
        prediction_home, prediction_away = parse_score(item["modal_score"])
        matches.append({
            "match_id": match_id,
            "match_no": match_id,
            "group": "1/16e de finale",
            "date": item["date"],
            "city": "",
            "country": "",
            "neutral": True,
            "home_team": home,
            "away_team": away,
            "raw_home_team": home,
            "raw_away_team": away,
            "p_home_win": item["p_home_win"],
            "p_draw": item["p_draw"],
            "p_away_win": item["p_away_win"],
            "pick": "H" if item["p_home_win"] >= item["p_draw"] and item["p_home_win"] >= item["p_away_win"] else "D" if item["p_draw"] >= item["p_away_win"] else "A",
            "pick_label": home if item["p_home_win"] >= item["p_draw"] and item["p_home_win"] >= item["p_away_win"] else "Draw after 120" if item["p_draw"] >= item["p_away_win"] else away,
            "pick_confidence": max(item["p_home_win"], item["p_draw"], item["p_away_win"]),
            "expected_home_goals": item["expected_home_goals"],
            "expected_away_goals": item["expected_away_goals"],
            "modal_score": item["modal_score"],
            "modal_score_probability": item["modal_score_probability"],
            "prediction_home_score": prediction_home,
            "prediction_away_score": prediction_away,
            "target": "score_after_120_minutes_before_penalties",
            "market_type": "manual_model_reconstruction",
            "bookmaker_count": 0,
            "event_url": "",
            "reversed_from_source": False,
        })

    groups = []
    for group in source["groups"]:
        groups.append({
            **group,
            "team": normalize_team(group["team"]),
        })

    output = {
        "display_name": "XGBoost",
        "username": "xgboost",
        "metadata": metadata,
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

    if KNOCKOUT_ODDS_CSV.exists():
        knockout_df = pd.read_csv(KNOCKOUT_ODDS_CSV)
        knockout_df = knockout_df.dropna(subset=["home_team", "away_team", "home_odds", "draw_odds", "away_odds"])
        knockout_unmatched = []
        for item in knockout_df.to_dict("records"):
            home = normalize_team(str(item["home_team"]))
            away = normalize_team(str(item["away_team"]))
            match_id = ROUND_OF_32_MATCH_IDS.get((home, away))
            reverse = False
            if match_id is None:
                match_id = ROUND_OF_32_MATCH_IDS.get((away, home))
                reverse = match_id is not None
            if match_id is None:
                knockout_unmatched.append({"home_team": item["home_team"], "away_team": item["away_team"]})
                continue

            home_team, away_team = (away, home) if reverse else (home, away)
            home_odds = float(item["away_odds"] if reverse else item["home_odds"])
            away_odds = float(item["home_odds"] if reverse else item["away_odds"])
            draw_odds = float(item["draw_odds"])
            home_prob = float(item["away_implied_prob"] if reverse else item["home_implied_prob"])
            away_prob = float(item["home_implied_prob"] if reverse else item["away_implied_prob"])
            draw_prob = float(item["draw_implied_prob"])
            grouped.setdefault(match_id, {
                "match_id": match_id,
                "match_no": match_id,
                "home_team": home_team,
                "away_team": away_team,
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
                "source_file": KNOCKOUT_ODDS_CSV.name,
                "fetched_at": str(item.get("fetched_at") or ""),
            })
        if knockout_unmatched:
            raise RuntimeError(f"Unmatched knockout bookmaker fixtures: {knockout_unmatched}")

    for (home, away), item in ROUND_OF_32_BOOKMAKER_PROXY_MARKETS.items():
        match_id = ROUND_OF_32_MATCH_IDS[(home, away)]
        home_prob = float(item["home_implied_prob"])
        draw_prob = float(item["draw_implied_prob"])
        away_prob = float(item["away_implied_prob"])
        grouped.setdefault(match_id, {
            "match_id": match_id,
            "match_no": match_id,
            "home_team": home,
            "away_team": away,
            "samples": [],
        })["samples"].append({
            "home_odds": 1 / home_prob,
            "draw_odds": 1 / draw_prob,
            "away_odds": 1 / away_prob,
            "home_implied_prob": home_prob,
            "draw_implied_prob": draw_prob,
            "away_implied_prob": away_prob,
            "bookmaker_count": 0,
            "source": str(item["source"]),
            "source_file": "manual_proxy",
            "fetched_at": str(item["fetched_at"]),
        })

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

    expected_match_ids = set(match["id"] for match in by_pair.values())
    expected_match_ids.update(grouped.keys())
    covered_match_ids = set(item["match_id"] for item in output_matches)
    if not expected_match_ids.issubset(covered_match_ids):
        missing = sorted(expected_match_ids - covered_match_ids)
        raise RuntimeError(f"Bookmaker odds cover {len(output_matches)} fixtures. Missing ids: {missing}")

    output = {
        "generated_on": max(item["fetched_at"] for item in output_matches if item["fetched_at"]),
        "description": "Average 1N2 odds for World Cup fixtures, aligned to Pronostick match order. Round-of-32 odds are 90-minute 1X2 market odds.",
        "matches": output_matches,
    }
    (ROOT / "data" / "bookmaker_odds.json").write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")


def generate_match_schedule():
    by_pair, _by_group_pair = load_matches_by_pair()
    df = pd.read_csv(ODDS_CSVS[0])
    df = df.dropna(subset=["home_team", "away_team", "commence_time"])
    schedule = []
    unmatched = []
    seen = set()

    for item in df.to_dict("records"):
        home = normalize_team(str(item["home_team"]))
        away = normalize_team(str(item["away_team"]))
        match = by_pair.get((home, away))
        if not match:
            match = next((candidate for pair, candidate in by_pair.items() if frozenset(pair) == frozenset((home, away))), None)
        if not match:
            unmatched.append({"home_team": item["home_team"], "away_team": item["away_team"]})
            continue
        if match["id"] in seen:
            continue
        seen.add(match["id"])
        schedule.append({
            "match_id": match["id"],
            "match_no": match["match_no"],
            "group": match["group_name"],
            "home_team": match["home_team"],
            "away_team": match["away_team"],
            "kickoff_at": item["commence_time"],
            "venue": f"Groupe {match['group_name']} - horaire officiel",
        })

    if unmatched:
        raise RuntimeError(f"Unmatched schedule fixtures: {unmatched}")
    if len(schedule) != len(by_pair):
        missing = sorted(set(match["id"] for match in by_pair.values()) - seen)
        raise RuntimeError(f"Schedule covers {len(schedule)} fixtures, expected {len(by_pair)}. Missing ids: {missing}")

    output = {
        "source_file": str(ODDS_CSVS[0]),
        "generated_on": df["fetched_at"].dropna().max() if "fetched_at" in df else None,
        "matches": sorted(schedule, key=lambda item: item["match_no"]),
    }
    (ROOT / "data" / "match_schedule.json").write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    generate_model_asset()
    generate_random_distribution()
    generate_bookmaker_odds()
    generate_match_schedule()
